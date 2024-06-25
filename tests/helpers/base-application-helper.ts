import type { Hono } from "hono";
import { expect } from "bun:test";

export abstract class BaseApplicationHelper {
  protected application:
    | {
        app: Hono;
        stopApp: () => Promise<void>;
      }
    | undefined;

  get app(): Hono {
    return this.application!.app;
  }

  public async executePostRequest({
    url,
    token,
    body,
  }: {
    url: string;
    token?: string;
    body?: any;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: token }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
  }

  public async executePatchRequest({
    url,
    token,
    body,
  }: {
    url: string;
    token?: string;
    body?: any;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: token }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
  }

  public async executePutRequest({
    url,
    token,
    body,
  }: {
    url: string;
    token?: string;
    body?: any;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: token }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
  }

  public async executeGetRequest({
    url,
    token,
  }: {
    url: string;
    token?: string;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: token }),
      },
    });
  }

  public async executeDeleteRequest({
    url,
    token,
  }: {
    url: string;
    token?: string;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: token }),
      },
    });
  }

  async createAppWithEnvironmentEntities({
    appName,
    token,
    environmentName,
    entityName,
    entities,
  }: {
    appName: string;
    environmentName: string;
    token: string;
    entityName: string;
    entities: any[];
  }): Promise<string[]> {
    const appResponse = await this.executePostRequest({
      url: `/apps/${appName}`,
      token,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(appResponse.status).toBe(201);

    const environmentResponse = await this.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      token,
      body: {
        description: "This is an environment",
      },
    });
    expect(environmentResponse.status).toBe(201);

    const entityResponse = await this.executePostRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      token,
      body: entities,
    });
    expect(entityResponse.status).toBe(201);
    const { ids } = (await entityResponse.json()) as { ids: string[] };

    return ids;
  }
}
