export class HttpError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, details?: Record<string, unknown>) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function toErrorResponse(err: unknown, requestId: string) {
  if (err instanceof HttpError) {
    return {
      status: err.status,
      body: {
        code: err.code,
        message: err.details?.message || 'Request failed',
        requestId,
        details: err.details,
      },
    };
  }

  return {
    status: 500,
    body: {
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error',
      requestId,
    },
  };
}
