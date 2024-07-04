/*
  Warnings:

  - You are about to drop the column `environmentId` on the `Token` table. All the data in the column will be lost.
  - Added the required column `applicationId` to the `Token` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Token" DROP CONSTRAINT "Token_environmentId_fkey";

-- AlterTable
ALTER TABLE "Token" DROP COLUMN "environmentId",
ADD COLUMN     "applicationId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "TokensOnEnvironments" (
    "tokenId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,

    CONSTRAINT "TokensOnEnvironments_pkey" PRIMARY KEY ("tokenId","environmentId")
);

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokensOnEnvironments" ADD CONSTRAINT "TokensOnEnvironments_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokensOnEnvironments" ADD CONSTRAINT "TokensOnEnvironments_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
