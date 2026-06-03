import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOGIN_BAN_MS,
  LOGIN_MAX_ATTEMPTS_PER_WINDOW,
  LOGIN_SOFT_LOCK_BASE_MS,
  checkLoginAllowed,
  recordLoginAttempt,
  recordLoginFailure,
  recordLoginSuccess,
  resetLoginProtectionStore,
  softLockDelayMs
} from "../../src/services/login-protection.service.js";

describe("LoginProtectionService", () => {
  const ip = "203.0.113.42";

  beforeEach(() => {
    resetLoginProtectionStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("autorise les tentatives sous la limite de la fenêtre", () => {
    const now = Date.now();
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS_PER_WINDOW; i++) {
      expect(checkLoginAllowed(ip, now).allowed).toBe(true);
      recordLoginAttempt(ip, now);
    }
  });

  it("bloque l'IP 15 min après 5 tentatives en 1 minute", () => {
    const now = Date.now();
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS_PER_WINDOW; i++) {
      recordLoginAttempt(ip, now);
    }

    const blocked = checkLoginAllowed(ip, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("rate-window");
    expect(blocked.retryAfterSeconds).toBe(Math.ceil(LOGIN_BAN_MS / 1000));
  });

  it("réinitialise l'état après un login réussi", () => {
    const now = Date.now();
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS_PER_WINDOW; i++) {
      recordLoginAttempt(ip, now);
    }
    recordLoginSuccess(ip);
    expect(checkLoginAllowed(ip, now).allowed).toBe(true);
  });

  it("applique un délai progressif après des échecs (soft lockout)", () => {
    const t0 = Date.now();
    recordLoginAttempt(ip, t0);
    recordLoginFailure(ip, t0);

    const delay = softLockDelayMs(1);
    expect(delay).toBe(LOGIN_SOFT_LOCK_BASE_MS);

    const tooSoon = checkLoginAllowed(ip, t0 + 500);
    expect(tooSoon.allowed).toBe(false);
    expect(tooSoon.reason).toBe("soft-lockout");

    const ok = checkLoginAllowed(ip, t0 + delay);
    expect(ok.allowed).toBe(true);
  });

  it("double le délai soft lockout à chaque échec consécutif", () => {
    expect(softLockDelayMs(1)).toBe(1_000);
    expect(softLockDelayMs(2)).toBe(2_000);
    expect(softLockDelayMs(3)).toBe(4_000);
  });
});
