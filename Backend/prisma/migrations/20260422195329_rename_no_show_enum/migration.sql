/*
  Warnings:

  - The values [NO_SHOW] on the enum `BookingEventType` will be removed. If these variants are still used in the database, this will fail.
  - The values [CUSTOMER_NO_SHOW] on the enum `BusinessNotificationType` will be removed. If these variants are still used in the database, this will fail.
  - The values [REFUND_PROCESSED] on the enum `CustomerNotificationType` will be removed. If these variants are still used in the database, this will fail.
  - The `cancelled_by` column on the `bookings` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('CUSTOMER', 'OWNER', 'SYSTEM');

-- AlterEnum
BEGIN;
CREATE TYPE "BookingEventType_new" AS ENUM ('BOOKING_CREATED', 'PAYMENT_PAID', 'PAYMENT_FAILED', 'PAYMENT_TIMEOUT', 'BOOKING_CONFIRMED', 'CUSTOMER_REMINDED', 'CUSTOMER_CHECKED_IN', 'SERVICE_STARTED', 'SERVICE_COMPLETED', 'SERVICE_DELAYED', 'BOOKING_CANCELLED', 'BOOKING_NO_SHOW', 'PAYMENT_SETTLED', 'PAYMENT_REFUNDED', 'REFUND_INITIATED', 'REFUND_COMPLETED');
ALTER TABLE "booking_events" ALTER COLUMN "event_type" TYPE "BookingEventType_new" USING ("event_type"::text::"BookingEventType_new");
ALTER TYPE "BookingEventType" RENAME TO "BookingEventType_old";
ALTER TYPE "BookingEventType_new" RENAME TO "BookingEventType";
DROP TYPE "public"."BookingEventType_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'REFUND_INITIATED';
ALTER TYPE "BookingStatus" ADD VALUE 'REFUNDED';

-- AlterEnum
BEGIN;
CREATE TYPE "BusinessNotificationType_new" AS ENUM ('NEW_BOOKING', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'STAFF_LEAVE_REQUEST', 'STAFF_LEAVE_APPROVED', 'STAFF_LEAVE_REJECTED', 'NEW_REVIEW', 'REVIEW_REPLY', 'PAYMENT_SETTLED', 'SERVICE_DELAYED', 'SERVICE_EXTENDED', 'QUEUE_SHIFTED', 'BOOKING_NO_SHOW', 'HOLIDAY_CREATED', 'REVIEW_RECEIVED', 'STAFF_INVITE_EXPIRED', 'STAFF_INVITE_RESENT', 'BOOKING_COMPLETED', 'SERVICE_CHECKED_IN');
ALTER TABLE "business_notifications" ALTER COLUMN "type" TYPE "BusinessNotificationType_new" USING ("type"::text::"BusinessNotificationType_new");
ALTER TYPE "BusinessNotificationType" RENAME TO "BusinessNotificationType_old";
ALTER TYPE "BusinessNotificationType_new" RENAME TO "BusinessNotificationType";
DROP TYPE "public"."BusinessNotificationType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "CustomerNotificationType_new" AS ENUM ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'PAYMENT_SUCCESS', 'REMINDER_1_HOUR', 'REMINDER_15_MIN', 'SERVICE_COMPLETED', 'SERVICE_DELAYED', 'QUEUE_SHIFTED', 'BOOKING_CANCELLED', 'REVIEW_REQUEST', 'REFUND_INITIATED', 'REFUND_COMPLETED', 'BOOKING_NO_SHOW');
ALTER TABLE "customer_notifications" ALTER COLUMN "type" TYPE "CustomerNotificationType_new" USING ("type"::text::"CustomerNotificationType_new");
ALTER TYPE "CustomerNotificationType" RENAME TO "CustomerNotificationType_old";
ALTER TYPE "CustomerNotificationType_new" RENAME TO "CustomerNotificationType";
DROP TYPE "public"."CustomerNotificationType_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StaffNotificationType" ADD VALUE 'BOOKING_NO_SHOW';
ALTER TYPE "StaffNotificationType" ADD VALUE 'SERVICE_COMPLETED';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "is_visible" BOOLEAN NOT NULL DEFAULT true,
DROP COLUMN "cancelled_by",
ADD COLUMN     "cancelled_by" "CancelledBy";
