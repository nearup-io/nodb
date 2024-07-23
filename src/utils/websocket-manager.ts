import { createBunWebSocket } from "hono/bun";
import type { UpgradeWebSocket, WSContext } from "hono/ws";

interface BunServerWebSocket<T> {
  send(data: string | ArrayBufferLike, compress?: boolean): void;
  close(code?: number, reason?: string): void;
  data: T;
  readyState: 0 | 1 | 2 | 3;
}
interface BunWebSocketHandler<T> {
  open(ws: BunServerWebSocket<T>): void;
  close(ws: BunServerWebSocket<T>, code?: number, reason?: string): void;
  message(ws: BunServerWebSocket<T>, message: string | Uint8Array): void;
}

interface BunWebSocketData {
  connId: number;
  url: URL;
  protocol: string;
}

type OperationType = "write" | "update" | "delete";

class WebSocketManager {
  public upgradeWebSocket: UpgradeWebSocket;
  public websocket: BunWebSocketHandler<BunWebSocketData>;
  private clients: Map<string, WSContext[]> = new Map<string, WSContext[]>();

  constructor() {
    const { upgradeWebSocket, websocket } = createBunWebSocket();
    this.upgradeWebSocket = upgradeWebSocket;
    this.websocket = websocket;
  }

  private constructMapKey(props: {
    appName: string;
    envName?: string;
  }): string {
    const baseUrl = props.appName;
    if (!props.envName) return baseUrl;

    return `${baseUrl}/${props.envName}`;
  }

  addClient(props: { ws: WSContext; appName: string; envName?: string }) {
    const { ws, ...rest } = props;
    const key = this.constructMapKey(rest);

    if (!this.clients.get(key)) {
      this.clients.set(key, [ws]);
    } else {
      this.clients.get(key)!.push(ws);
    }
  }

  emit(props: {
    appName: string;
    envName: string;
    type: OperationType;
    data: any;
  }) {
    const { type, data, ...rest } = props;
    const message = JSON.stringify(props);
    const key = this.constructMapKey(rest);
    this.clients.get(key)?.forEach((client) => client.send(message));
    // If someone subscribes to the whole app send them the messages also
    this.clients.get(props.appName)?.forEach((client) => client.send(message));
  }

  closeConnection(props: {
    ws: WSContext;
    appName: string;
    envName?: string;
  }): void {
    const key = this.constructMapKey({
      appName: props.appName,
      envName: props.envName,
    });
    if (!this.clients.get(key)) return;

    const index = this.clients
      .get(key)!
      .findIndex((socket) => socket === props.ws);
    this.clients.get(key)!.splice(index, 1);
  }
}

let wsManager = new WebSocketManager();

const getWsManager = (): WebSocketManager => {
  if (!wsManager) return new WebSocketManager();
  return wsManager;
};

export default getWsManager();
