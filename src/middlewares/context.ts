class Context {
  private context: { [key: string]: any } = {};

  public register(id: string, value: any): void {
    if (this.context[id]) {
      throw new Error(`Service with ${id} is already registered`);
    }

    this.context[id] = value;
  }

  public get<T>(id: string): T {
    if (!this.context[id]) {
      throw new Error(`Service with ${id} is not registered`);
    }

    return this.context[id] as T;
  }
}

export default Context;
