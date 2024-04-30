import { createClient, type RedisClientType } from "redis";

class RedisClient {
  private client: RedisClientType;

  constructor() {
    this.client = createClient({
      password: Bun.env.REDIS_PORT,
      socket: {
        host: Bun.env.REDIS_HOST,
        port: Bun.env.REDIS_PORT,
      },
    });
    this.client.on("error", (err) => console.log("Redis Client Error", err));
  }
  get redis() {
    return this.client;
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

export default RedisClient;
