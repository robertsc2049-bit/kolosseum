// src/api/http_errors.ts
export type ApiErrorBody = {
  ok: false;
  code: string;
  error: string;
  details?: unknown;
};

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(args: { status: number; code: string; message: string; details?: unknown }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
  }

  toBody(): ApiErrorBody {
    const body: ApiErrorBody = { ok: false, code: this.code, error: this.message };
    if (typeof this.details !== "undefined") body.details = this.details;
    return body;
  }
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError({ status: 400, code: "BAD_REQUEST", message, details });
}

export function unauthorized(message = "Unauthorized", details?: unknown): ApiError {
  return new ApiError({ status: 401, code: "UNAUTHORIZED", message, details });
}

export function forbidden(message = "Forbidden", details?: unknown): ApiError {
  return new ApiError({ status: 403, code: "FORBIDDEN", message, details });
}

export function notFound(message = "Not found", details?: unknown): ApiError {
  return new ApiError({ status: 404, code: "NOT_FOUND", message, details });
}

export function conflict(message = "Conflict", details?: unknown): ApiError {
  return new ApiError({ status: 409, code: "CONFLICT", message, details });
}

export function unprocessable(message = "Unprocessable entity", details?: unknown): ApiError {
  return new ApiError({ status: 422, code: "UNPROCESSABLE", message, details });
}

export function upstreamBadGateway(message = "Upstream failure", details?: unknown): ApiError {
  return new ApiError({ status: 502, code: "UPSTREAM_BAD_GATEWAY", message, details });
}

export function internalError(message = "Internal error", details?: unknown): ApiError {
  return new ApiError({ status: 500, code: "INTERNAL", message, details });
}