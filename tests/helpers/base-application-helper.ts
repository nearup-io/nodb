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
    jwtToken,
    backendToken,
    body,
  }: {
    url: string;
    jwtToken?: string;
    backendToken?: string;
    body?: any;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwtToken && { Authorization: jwtToken }),
        ...(backendToken && { token: backendToken }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
  }

  public async executePatchRequest({
    url,
    jwtToken,
    backendToken,
    body,
  }: {
    url: string;
    jwtToken?: string;
    backendToken?: string;
    body?: any;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(jwtToken && { Authorization: jwtToken }),
        ...(backendToken && { token: backendToken }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
  }

  public async executePutRequest({
    url,
    jwtToken,
    backendToken,
    body,
  }: {
    url: string;
    jwtToken?: string;
    backendToken?: string;
    body?: any;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(jwtToken && { Authorization: jwtToken }),
        ...(backendToken && { token: backendToken }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
  }

  public async executeGetRequest({
    url,
    jwtToken,
    backendToken,
  }: {
    url: string;
    jwtToken?: string;
    backendToken?: string;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(jwtToken && { Authorization: jwtToken }),
        ...(backendToken && { token: backendToken }),
      },
    });
  }

  public async executeDeleteRequest({
    url,
    jwtToken,
    backendToken,
  }: {
    url: string;
    jwtToken?: string;
    backendToken?: string;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(jwtToken && { Authorization: jwtToken }),
        ...(backendToken && { token: backendToken }),
      },
    });
  }

  async createAppWithEnvironmentEntities({
    appName,
    jwtToken,
    environmentName,
    entityName,
    entities,
  }: {
    appName: string;
    environmentName: string;
    jwtToken: string;
    entityName: string;
    entities: any[];
  }): Promise<string[]> {
    const appResponse = await this.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(appResponse.status).toBe(201);

    const environmentResponse = await this.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken,
      body: {
        description: "This is an environment",
      },
    });
    expect(environmentResponse.status).toBe(201);

    const entityResponse = await this.executePostRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      jwtToken,
      body: entities,
    });
    expect(entityResponse.status).toBe(201);
    const { ids } = (await entityResponse.json()) as { ids: string[] };

    return ids;
  }
}
