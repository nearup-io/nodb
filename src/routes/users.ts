import { Hono } from "hono";
import { getAuth } from "@hono/clerk-auth";

const app = new Hono();
app.get("/profile", async (c) => {
  const clerkClient = c.get("clerk");
  const auth = getAuth(c);

  if (!auth?.userId) {
    return c.json({
      message: "You are not logged in.",
    });
  }
  const user = await clerkClient.users.getUser(auth.userId);
  console.log(user.primaryEmailAddress?.emailAddress);
  return c.json(user);
});

export default app;
