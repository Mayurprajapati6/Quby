/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `customers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `scan_absolute_end` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scan_absolute_start` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scan_recommended_end` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `service_end_expected` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `service_start_expected` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `holidays` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customer_id` to the `platform_fee_transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `staff_id` to the `platform_fee_transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `valid_from` to the `qr_codes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `staff_attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `staff_services` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "QrStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('BOOKING', 'BUSINESS_MANUAL', 'LEAVE_SYSTEM', 'HOLIDAY_SYSTEM');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'RUNNING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BusinessNotificationType" ADD VALUE 'STAFF_LEAVE_APPROVED';
ALTER TYPE "BusinessNotificationType" ADD VALUE 'STAFF_LEAVE_REJECTED';
ALTER TYPE "BusinessNotificationType" ADD VALUE 'REVIEW_REPLY';
ALTER TYPE "BusinessNotificationType" ADD VALUE 'BUSINESS_SUSPENDED';
ALTER TYPE "BusinessNotificationType" ADD VALUE 'HOLIDAY_CREATED';

-- AlterEnum
ALTER TYPE "CustomerNotificationType" ADD VALUE 'PAYMENT_CONFIRMED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StaffNotificationType" ADD VALUE 'BOOKING_CONFIRMED';
ALTER TYPE "StaffNotificationType" ADD VALUE 'REVIEW_REPLY';
ALTER TYPE "StaffNotificationType" ADD VALUE 'BUSINESS_HOLIDAY';
ALTER TYPE "StaffNotificationType" ADD VALUE 'ACCOUNT_SUSPENDED';
ALTER TYPE "StaffNotificationType" ADD VALUE 'SERVICE_DELAYED';

-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "address_line1" VARCHAR(255),
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "phone" VARCHAR(20),
ADD COLUMN     "state" VARCHAR(100);

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "scan_absolute_end" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "scan_absolute_start" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "scan_recommended_end" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "service_end_actual" TIMESTAMPTZ(3),
ADD COLUMN     "service_end_expected" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "service_start_actual" TIMESTAMPTZ(3),
ADD COLUMN     "service_start_expected" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "staff_taken_time" INTEGER;

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "facebook_url" VARCHAR(500),
ADD COLUMN     "instagram_url" VARCHAR(500),
ADD COLUMN     "map_link" VARCHAR(1000),
ADD COLUMN     "twitter_url" VARCHAR(500),
ADD COLUMN     "whatsapp_number" VARCHAR(20),
ADD COLUMN     "youtube_url" VARCHAR(500);

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "first_login_at" TIMESTAMPTZ(3),
ADD COLUMN     "username" VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE "holidays" ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "owners" ADD COLUMN     "address_line1" VARCHAR(255),
ADD COLUMN     "address_line2" VARCHAR(255),
ADD COLUMN     "personal_info" TEXT;

-- AlterTable
ALTER TABLE "platform_fee_transactions" ADD COLUMN     "customer_id" TEXT NOT NULL,
ADD COLUMN     "staff_id" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING',
ALTER COLUMN "collected_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "qr_codes" ADD COLUMN     "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "qr_status" "QrStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "valid_from" TIMESTAMPTZ(3) NOT NULL,
ALTER COLUMN "qr_code_id" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "staff_response" TEXT,
ADD COLUMN     "staff_response_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "state" VARCHAR(100);

-- AlterTable
ALTER TABLE "staff_attendance" ADD COLUMN     "source" "AttendanceSource" NOT NULL DEFAULT 'BUSINESS_MANUAL',
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "staff_services" ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "refund_status" VARCHAR(20) DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspended_at" TIMESTAMPTZ(3),
ADD COLUMN     "suspended_reason" TEXT;

-- CreateTable
CREATE TABLE "qr_scan_logs" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "qr_code_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "scanned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scan_result" VARCHAR(20) NOT NULL,
    "scan_method" VARCHAR(20) NOT NULL DEFAULT 'CAMERA',

    CONSTRAINT "qr_scan_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qr_scan_logs_booking_id_idx" ON "qr_scan_logs"("booking_id");

-- CreateIndex
CREATE INDEX "qr_scan_logs_staff_id_scanned_at_idx" ON "qr_scan_logs"("staff_id", "scanned_at");

-- CreateIndex
CREATE INDEX "qr_scan_logs_qr_code_id_idx" ON "qr_scan_logs"("qr_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_key_idx" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE INDEX "bookings_staff_id_arrival_window_start_idx" ON "bookings"("staff_id", "arrival_window_start");

-- CreateIndex
CREATE INDEX "bookings_business_id_idx" ON "bookings"("business_id");

-- CreateIndex
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");

-- CreateIndex
CREATE INDEX "bookings_business_id_status_service_date_idx" ON "bookings"("business_id", "status", "service_date");

-- CreateIndex
CREATE INDEX "bookings_staff_id_status_service_date_idx" ON "bookings"("staff_id", "status", "service_date");

-- CreateIndex
CREATE UNIQUE INDEX "customers_username_key" ON "customers"("username");

-- CreateIndex
CREATE INDEX "customers_username_idx" ON "customers"("username");

-- CreateIndex
CREATE INDEX "escrow_transactions_business_id_status_idx" ON "escrow_transactions"("business_id", "status");

-- CreateIndex
CREATE INDEX "escrow_transactions_staff_id_status_idx" ON "escrow_transactions"("staff_id", "status");

-- CreateIndex
CREATE INDEX "platform_fee_transactions_staff_id_idx" ON "platform_fee_transactions"("staff_id");

-- CreateIndex
CREATE INDEX "qr_codes_qr_status_idx" ON "qr_codes"("qr_status");

-- CreateIndex
CREATE INDEX "reviews_customer_id_created_at_idx" ON "reviews"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "staff_attendance_business_id_date_status_idx" ON "staff_attendance"("business_id", "date", "status");

-- CreateIndex
CREATE INDEX "users_is_suspended_idx" ON "users"("is_suspended");

-- AddForeignKey
ALTER TABLE "qr_scan_logs" ADD CONSTRAINT "qr_scan_logs_qr_code_id_fkey" FOREIGN KEY ("qr_code_id") REFERENCES "qr_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scan_logs" ADD CONSTRAINT "qr_scan_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scan_logs" ADD CONSTRAINT "qr_scan_logs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
