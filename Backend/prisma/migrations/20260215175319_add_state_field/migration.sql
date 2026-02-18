/*
  Warnings:

  - Made the column `city` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `state` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "city" SET NOT NULL,
ALTER COLUMN "state" SET NOT NULL;

-- CreateIndex
CREATE INDEX "users_city_state_idx" ON "users"("city", "state");
