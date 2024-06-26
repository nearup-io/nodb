import type { ITestApplicationHelper } from "./IApplicationHelper.ts";
import { PostgresTestApplicationHelper } from "./postgres-test-application-helper.ts";

export function createTestApplicationHelperFactory(): ITestApplicationHelper {
  if (!!Bun.env.POSTGRES_URL) {
    return new PostgresTestApplicationHelper();
  }
  throw new Error("POSTGRES URL MISSING");
}
