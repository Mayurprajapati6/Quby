export interface AppError extends Error {
  statusCode: number;
}

export class InternalServerError extends Error implements AppError {
  statusCode = 500;
  constructor(message: string) {
    super(message);
    this.name = "InternalServerError";
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

export class BadRequestError extends Error implements AppError {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

export class NotFoundError extends Error implements AppError {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends Error implements AppError {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends Error implements AppError {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ConflictError extends Error implements AppError {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class NotImplementedError extends Error implements AppError {
  statusCode = 501;
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
    Object.setPrototypeOf(this, NotImplementedError.prototype);
  }
}