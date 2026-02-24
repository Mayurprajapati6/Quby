/*
  Warnings:

  - The values [REFUNDED] on the enum `BookingStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [PAYMENT_RECEIVED] on the enum `StaffNotificationType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `email` on the `admins` table. All the data in the column will be lost.
  - You are about to drop the column `password_hash` on the `admins` table. All the data in the column will be lost.
  - You are about to drop the `refunds` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `service_timers` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[user_id]` on the table `admins` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_id` to the `admins` table without a default value. This is not possible if the table is not empty.
  - Added the required column `estimated_duration` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingEventType" ADD VALUE 'SERVICE_DELAYED';
ALTER TYPE "BookingEventType" ADD VALUE 'REFUND_PROCESSED';

-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CANCELLED_TIMEOUT', 'CANCELLED_NO_SHOW');
ALTER TABLE "public"."bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "public"."BookingStatus_old";
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BusinessNotificationType" ADD VALUE 'SERVICE_DELAYED';
ALTER TYPE "BusinessNotificationType" ADD VALUE 'CUSTOMER_NO_SHOW';

-- AlterEnum
ALTER TYPE "BusinessWalletTransactionType" ADD VALUE 'REFUND_DEDUCTION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CustomerNotificationType" ADD VALUE 'SERVICE_DELAYED';
ALTER TYPE "CustomerNotificationType" ADD VALUE 'EARLY_SLOT_AVAILABLE';

-- AlterEnum
BEGIN;
CREATE TYPE "StaffNotificationType_new" AS ENUM ('NEW_BOOKING', 'BOOKING_CANCELLED', 'CUSTOMER_CHECKED_IN', 'NEXT_CUSTOMER_READY', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'NEW_REVIEW', 'DAILY_SUMMARY', 'PERFORMANCE_UPDATE');
ALTER TABLE "staff_notifications" ALTER COLUMN "type" TYPE "StaffNotificationType_new" USING ("type"::text::"StaffNotificationType_new");
ALTER TYPE "StaffNotificationType" RENAME TO "StaffNotificationType_old";
ALTER TYPE "StaffNotificationType_new" RENAME TO "StaffNotificationType";
DROP TYPE "public"."StaffNotificationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "refunds" DROP CONSTRAINT "refunds_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "service_timers" DROP CONSTRAINT "service_timers_booking_id_fkey";

-- DropIndex
DROP INDEX "admins_email_idx";

-- DropIndex
DROP INDEX "admins_email_key";

-- AlterTable
ALTER TABLE "admins" DROP COLUMN "email",
DROP COLUMN "password_hash",
ADD COLUMN     "avatar_url" VARCHAR(500),
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "actual_duration" INTEGER,
ADD COLUMN     "estimated_duration" INTEGER NOT NULL,
ADD COLUMN     "payment_confirmed_at" TIMESTAMPTZ(3),
ADD COLUMN     "service_done_at" TIMESTAMPTZ(3),
ADD COLUMN     "service_done_by" TEXT;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "current_service_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_service_date" TIMESTAMPTZ(3),
ADD COLUMN     "longest_service_streak" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "refund_amount" INTEGER,
ADD COLUMN     "refund_id" VARCHAR(100),
ADD COLUMN     "refunded_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- DropTable
DROP TABLE "refunds";

-- DropTable
DROP TABLE "service_timers";

-- CreateTable
CREATE TABLE "staff_attendance" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "check_in_time" TIMESTAMPTZ(3),
    "check_out_time" TIMESTAMPTZ(3),
    "marked_by" TEXT,
    "is_auto_marked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_performance" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "total_bookings" INTEGER NOT NULL,
    "total_estimated_minutes" INTEGER NOT NULL,
    "total_actual_minutes" INTEGER NOT NULL,
    "average_efficiency" DOUBLE PRECISION NOT NULL,
    "on_time_count" INTEGER NOT NULL,
    "delayed_count" INTEGER NOT NULL,
    "avg_delay_minutes" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_performance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_attendance_staff_id_date_idx" ON "staff_attendance"("staff_id", "date");

-- CreateIndex
CREATE INDEX "staff_attendance_business_id_date_idx" ON "staff_attendance"("business_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "staff_attendance_staff_id_date_key" ON "staff_attendance"("staff_id", "date");

-- CreateIndex
CREATE INDEX "staff_performance_staff_id_month_idx" ON "staff_performance"("staff_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "staff_performance_staff_id_month_key" ON "staff_performance"("staff_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "admins_user_id_key" ON "admins"("user_id");

-- CreateIndex
CREATE INDEX "admins_user_id_idx" ON "admins"("user_id");

-- CreateIndex
CREATE INDEX "qr_codes_expires_at_idx" ON "qr_codes"("expires_at");

-- AddForeignKey
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_performance" ADD CONSTRAINT "staff_performance_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
