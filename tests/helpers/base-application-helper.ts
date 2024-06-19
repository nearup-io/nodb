import type { Hono } from "hono";
import app from "../../src/app.ts";

export abstract class BaseApplicationHelper {
  private readonly application: Hono;

  protected constructor() {
    this.application = app;
  }

  get app(): Hono {
    return this.application;
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
}
