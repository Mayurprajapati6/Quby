/*
  Warnings:

  - The values [SPA] on the enum `BusinessType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BusinessType_new" AS ENUM ('SALON');
ALTER TABLE "businesses" ALTER COLUMN "business_type" TYPE "BusinessType_new" USING ("business_type"::text::"BusinessType_new");
ALTER TABLE "platform_services" ALTER COLUMN "category" TYPE "BusinessType_new" USING ("category"::text::"BusinessType_new");
ALTER TYPE "BusinessType" RENAME TO "BusinessType_old";
ALTER TYPE "BusinessType_new" RENAME TO "BusinessType";
DROP TYPE "public"."BusinessType_old";
COMMIT;
