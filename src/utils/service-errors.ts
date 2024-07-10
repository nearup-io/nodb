interface IServiceError {
  explicitMessage: string;
}

type StatusCodes = 400 | 401 | 404 | 500;

export class ServiceError extends Error implements IServiceError {
  explicitMessage: string;
  statusCode: StatusCodes;
  constructor(message: string, statusCode: StatusCodes) {
    super(message);
    this.explicitMessage = message;
    this.statusCode = statusCode;
  }
}

export class RoutingError extends Error implements IServiceError {
  explicitMessage: string;
  constructor(message: string) {
    super(message);
    this.explicitMessage = message;
  }
}

export class ConnectionError extends Error implements IServiceError {
  explicitMessage: string;
  constructor(message: string) {
    super(message);
    this.explicitMessage = message;
  }
}
