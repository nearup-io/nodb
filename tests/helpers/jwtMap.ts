import { type User } from "../../src/models/user.model";

interface JwtMap {
  [key: string]: Pick<User, "clerkId" | "email">;
}

const jwtMap: JwtMap = {
  ["jwt1"]: {
    clerkId: "id",
    email: "email",
  },
};
