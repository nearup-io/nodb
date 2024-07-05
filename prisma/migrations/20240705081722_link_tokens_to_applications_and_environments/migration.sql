/*
  Warnings:

  - Added the required column `applicationId` to the `Token` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Token" ADD COLUMN     "applicationId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
