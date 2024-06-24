interface TestUser {
  jwt: string;
  email: string;
  userId: string;
}

const user1Details = Bun.env.USER_1?.split(",") || [];
const user2Details = Bun.env.USER_2?.split(",") || [];
const user3Details = Bun.env.USER_3?.split(",") || [];
const user4Details = Bun.env.USER_4?.split(",") || [];
if (
  user1Details.length !== 3 ||
  user2Details.length !== 3 ||
  user3Details.length !== 3 ||
  user4Details.length !== 3
)
  throw new Error("Test user is missing");

const defaultTestUser: TestUser = {
  email: user1Details.at(0)!,
  userId: user1Details.at(1)!,
  jwt: user1Details.at(2)!,
};

const testUser2: TestUser = {
  email: user2Details.at(0)!,
  userId: user2Details.at(1)!,
  jwt: user2Details.at(2)!,
};

const testUser3: TestUser = {
  email: user3Details.at(0)!,
  userId: user3Details.at(1)!,
  jwt: user3Details.at(2)!,
};

const testUser4: TestUser = {
  email: user4Details.at(0)!,
  userId: user4Details.at(1)!,
  jwt: user4Details.at(2)!,
};

export { defaultTestUser, testUser2, testUser3, testUser4, type TestUser };
