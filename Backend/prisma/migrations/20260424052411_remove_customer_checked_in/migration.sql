/*
  Warnings:

  - The values [CUSTOMER_CHECKED_IN] on the enum `BookingEventType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BookingEventType_new" AS ENUM ('BOOKING_CREATED', 'PAYMENT_PAID', 'PAYMENT_FAILED', 'PAYMENT_TIMEOUT', 'BOOKING_CONFIRMED', 'CUSTOMER_REMINDED', 'SERVICE_STARTED', 'SERVICE_COMPLETED', 'SERVICE_DELAYED', 'BOOKING_CANCELLED', 'BOOKING_NO_SHOW', 'PAYMENT_SETTLED', 'PAYMENT_REFUNDED', 'REFUND_INITIATED', 'REFUND_COMPLETED');
ALTER TABLE "booking_events" ALTER COLUMN "event_type" TYPE "BookingEventType_new" USING ("event_type"::text::"BookingEventType_new");
ALTER TYPE "BookingEventType" RENAME TO "BookingEventType_old";
ALTER TYPE "BookingEventType_new" RENAME TO "BookingEventType";
DROP TYPE "public"."BookingEventType_old";
COMMIT;
