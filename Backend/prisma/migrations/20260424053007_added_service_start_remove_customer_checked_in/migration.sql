/*
  Warnings:

  - The values [CUSTOMER_CHECKED_IN] on the enum `StaffNotificationType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StaffNotificationType_new" AS ENUM ('NEW_BOOKING', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'SERVICE_STARTED', 'NEXT_CUSTOMER_READY', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'NEW_REVIEW', 'REVIEW_RECEIVED', 'REVIEW_REPLY', 'DAILY_SUMMARY', 'PERFORMANCE_UPDATE', 'BUSINESS_HOLIDAY', 'ACCOUNT_SUSPENDED', 'SERVICE_DELAYED', 'SERVICE_EXTENDED', 'BOOKING_NO_SHOW', 'SERVICE_COMPLETED');
ALTER TABLE "staff_notifications" ALTER COLUMN "type" TYPE "StaffNotificationType_new" USING ("type"::text::"StaffNotificationType_new");
ALTER TYPE "StaffNotificationType" RENAME TO "StaffNotificationType_old";
ALTER TYPE "StaffNotificationType_new" RENAME TO "StaffNotificationType";
DROP TYPE "public"."StaffNotificationType_old";
COMMIT;
