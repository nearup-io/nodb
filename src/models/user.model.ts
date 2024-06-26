import type { Application } from "./application.model";

export type User = {
  clerkId: string;
  email: string;
  applications: Application[];
  lastUse: Date;
};
