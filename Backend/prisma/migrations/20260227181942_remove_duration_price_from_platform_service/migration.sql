/*
  Warnings:

  - You are about to drop the column `default_duration` on the `platform_services` table. All the data in the column will be lost.
  - You are about to drop the column `default_price` on the `platform_services` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "platform_services" DROP COLUMN "default_duration",
DROP COLUMN "default_price";
