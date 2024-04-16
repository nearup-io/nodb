interface IServiceError {
  explicitMessage: string;
}

export class ServiceError extends Error implements IServiceError {
  explicitMessage: string;
  constructor(message: string) {
    super(message);
    this.explicitMessage = message;
  }
}

export class RoutingError extends Error implements IServiceError {
  explicitMessage: string;
  constructor(message: string) {
    super(message);
    this.explicitMessage = message;
  }
}