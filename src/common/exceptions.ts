export const PROBLEM_BASE_URL = "https://api.ubereats.local/problems";

export type ProblemDetails = {
  type: string;
  title: string;
  detail: string;
  status: number;
};

/** Erreur HTTP au format RFC 7807 Problem Details (champs type, title, detail, status). */
export class HttpError extends Error {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  readonly detail: string;

  constructor(params: ProblemDetails) {
    super(params.detail);
    this.status = params.status;
    this.type = params.type;
    this.title = params.title;
    this.detail = params.detail;
    this.name = new.target.name;
  }

  toProblemDetails(): ProblemDetails {
    return {
      type: this.type,
      title: this.title,
      detail: this.detail,
      status: this.status
    };
  }
}

export class BadRequest extends HttpError {
  constructor(detail: string, type = `${PROBLEM_BASE_URL}/bad-request`) {
    super({ status: 400, title: "Bad Request", type, detail });
  }
}

export class Unauthorized extends HttpError {
  constructor(detail: string, type = `${PROBLEM_BASE_URL}/unauthorized`) {
    super({ status: 401, title: "Unauthorized", type, detail });
  }
}

export class Forbidden extends HttpError {
  constructor(detail: string, type = `${PROBLEM_BASE_URL}/forbidden`) {
    super({ status: 403, title: "Forbidden", type, detail });
  }
}

export class NotFound extends HttpError {
  constructor(detail: string, type = `${PROBLEM_BASE_URL}/not-found`) {
    super({ status: 404, title: "Not Found", type, detail });
  }
}

export class ConflictError extends HttpError {
  constructor(detail: string, type = `${PROBLEM_BASE_URL}/conflict`) {
    super({ status: 409, title: "Conflict", type, detail });
  }
}
