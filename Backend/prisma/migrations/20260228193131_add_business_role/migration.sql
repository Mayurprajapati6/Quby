/*
  Warnings:

  - A unique constraint covering the columns `[auth_user_id]` on the table `businesses` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BusinessNotificationType" ADD VALUE 'BOOKING_CONFIRMED';
ALTER TYPE "BusinessNotificationType" ADD VALUE 'ESCROW_RELEASED';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'BUSINESS';

-- AlterTable
ALTER TABLE "business_notifications" ADD COLUMN     "expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "target" VARCHAR(10) NOT NULL DEFAULT 'BOTH';

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "auth_user_id" VARCHAR(36);

-- AlterTable
ALTER TABLE "customer_notifications" ADD COLUMN     "expires_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "staff_notifications" ADD COLUMN     "expires_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "business_notifications_business_id_target_idx" ON "business_notifications"("business_id", "target");

-- CreateIndex
CREATE INDEX "business_notifications_expires_at_idx" ON "business_notifications"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_auth_user_id_key" ON "businesses"("auth_user_id");

-- CreateIndex
CREATE INDEX "businesses_auth_user_id_idx" ON "businesses"("auth_user_id");

-- CreateIndex
CREATE INDEX "customer_notifications_expires_at_idx" ON "customer_notifications"("expires_at");

-- CreateIndex
CREATE INDEX "staff_notifications_expires_at_idx" ON "staff_notifications"("expires_at");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
