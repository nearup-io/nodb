import type { ITestApplicationHelper } from "./IApplicationHelper.ts";
import { MongodbTestApplicationHelper } from "./mongodb-test-application-helper.ts";
import { PostgresTestApplicationHelper } from "./postgres-test-application-helper.ts";

export function createTestApplicationHelperFactory(): ITestApplicationHelper {
  if (!!Bun.env.POSTGRES_URL) {
    return new PostgresTestApplicationHelper();
  } else {
    return new MongodbTestApplicationHelper();
  }
}
