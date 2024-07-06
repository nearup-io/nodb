-- AlterTable
ALTER TABLE "Token" ADD COLUMN     "applicationId" TEXT,
ALTER COLUMN "environmentId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom rule to enforce either environment or application is linked to the token
ALTER TABLE "Token"
ADD CONSTRAINT chk_token CHECK ("environmentId" IS NOT NULL OR "applicationId" IS NOT NULL);
