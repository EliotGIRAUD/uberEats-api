import { TooManyRequests } from "../common/exceptions.js";
import type { FastifyRequest } from "fastify";

/** Fenêtre glissante : nombre max de tentatives de login par IP. */
export const LOGIN_MAX_ATTEMPTS_PER_WINDOW = Number(process.env.LOGIN_MAX_ATTEMPTS_PER_WINDOW ?? 5);
/** Durée de la fenêtre (ms). */
export const LOGIN_WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS ?? 60_000);
/** Durée du blocage IP après dépassement (ms) — 15 min par défaut. */
export const LOGIN_BAN_MS = Number(process.env.LOGIN_BAN_MS ?? 15 * 60_000);
/** Délai de base du soft lockout (ms), doublé à chaque échec. */
export const LOGIN_SOFT_LOCK_BASE_MS = Number(process.env.LOGIN_SOFT_LOCK_BASE_MS ?? 1_000);
/** Plafond du délai entre deux tentatives (ms). */
export const LOGIN_SOFT_LOCK_MAX_MS = Number(process.env.LOGIN_SOFT_LOCK_MAX_MS ?? 30_000);

/**
 * En production : combiner ce mécanisme avec un CAPTCHA (ex. après 2–3 échecs)
 * et un store partagé (Redis) pour les déploiements multi-instances.
 */
type IpLoginState = {
  /** Horodatages des tentatives dans la fenêtre courante. */
  attempts: number[];
  /** Échecs consécutifs récents (soft lockout exponentiel). */
  consecutiveFailures: number;
  lastAttemptAt?: number;
  bannedUntil?: number;
};

const store = new Map<string, IpLoginState>();

function getOrCreate(ip: string): IpLoginState {
  let state = store.get(ip);
  if (!state) {
    state = { attempts: [], consecutiveFailures: 0 };
    store.set(ip, state);
  }
  return state;
}

/** IP client (proxy / Docker : x-forwarded-for). */
export function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? request.ip;
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(",")[0]?.trim() ?? request.ip;
  }
  return request.ip;
}

function pruneAttempts(state: IpLoginState, now: number): void {
  state.attempts = state.attempts.filter((t) => now - t < LOGIN_WINDOW_MS);
}

/** Délai imposé avant la prochaine tentative après des échecs (backoff exponentiel). */
export function softLockDelayMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) {
    return 0;
  }
  const delay = LOGIN_SOFT_LOCK_BASE_MS * 2 ** (consecutiveFailures - 1);
  return Math.min(LOGIN_SOFT_LOCK_MAX_MS, delay);
}

export type LoginProtectionCheck = {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: "ip-banned" | "rate-window" | "soft-lockout";
};

export function checkLoginAllowed(ip: string, now = Date.now()): LoginProtectionCheck {
  const state = getOrCreate(ip);

  if (state.bannedUntil !== undefined && now < state.bannedUntil) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((state.bannedUntil - now) / 1000),
      reason: "ip-banned"
    };
  }

  if (state.bannedUntil !== undefined && now >= state.bannedUntil) {
    state.bannedUntil = undefined;
    state.attempts = [];
    state.consecutiveFailures = 0;
  }

  pruneAttempts(state, now);

  if (state.attempts.length >= LOGIN_MAX_ATTEMPTS_PER_WINDOW) {
    state.bannedUntil = now + LOGIN_BAN_MS;
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(LOGIN_BAN_MS / 1000),
      reason: "rate-window"
    };
  }

  if (state.consecutiveFailures > 0 && state.lastAttemptAt !== undefined) {
    const requiredDelay = softLockDelayMs(state.consecutiveFailures);
    const elapsed = now - state.lastAttemptAt;
    if (elapsed < requiredDelay) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((requiredDelay - elapsed) / 1000),
        reason: "soft-lockout"
      };
    }
  }

  return { allowed: true };
}

/** Enregistre une nouvelle tentative de login (compte dans la fenêtre 1 min). */
export function recordLoginAttempt(ip: string, now = Date.now()): void {
  const state = getOrCreate(ip);
  pruneAttempts(state, now);
  state.attempts.push(now);
  state.lastAttemptAt = now;
}

export function recordLoginFailure(ip: string, now = Date.now()): void {
  const state = getOrCreate(ip);
  state.consecutiveFailures += 1;
  state.lastAttemptAt = now;
}

export function recordLoginSuccess(ip: string): void {
  store.delete(ip);
}

export function assertLoginAllowed(request: FastifyRequest): void {
  const ip = getClientIp(request);
  const check = checkLoginAllowed(ip);

  if (!check.allowed) {
    const messages: Record<NonNullable<LoginProtectionCheck["reason"]>, string> = {
      "ip-banned": "Trop de tentatives de connexion. Cette adresse IP est temporairement bloquée.",
      "rate-window": `Maximum ${LOGIN_MAX_ATTEMPTS_PER_WINDOW} tentatives par minute atteint. Réessayez plus tard.`,
      "soft-lockout":
        "Veuillez patienter avant une nouvelle tentative (délai progressif après échecs)."
    };

    const detail = check.reason ? messages[check.reason] : "Trop de requêtes.";
    throw new TooManyRequests(
      detail,
      check.retryAfterSeconds,
      `https://api.ubereats.local/problems/login-rate-limited`
    );
  }

  recordLoginAttempt(ip);
}

/** Réinitialise le store (tests uniquement). */
export function resetLoginProtectionStore(): void {
  store.clear();
}
