/*
  Warnings:

  - You are about to drop the column `current_streak` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `last_booking_date` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `longest_streak` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `current_service_streak` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `last_service_date` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `longest_service_streak` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the `customer_favourites` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `platform_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `staff_attendance` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "customer_favourites" DROP CONSTRAINT "customer_favourites_business_id_fkey";

-- DropForeignKey
ALTER TABLE "customer_favourites" DROP CONSTRAINT "customer_favourites_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_attendance" DROP CONSTRAINT "staff_attendance_staff_id_fkey";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "current_streak",
DROP COLUMN "last_booking_date",
DROP COLUMN "longest_streak";

-- AlterTable
ALTER TABLE "staff" DROP COLUMN "current_service_streak",
DROP COLUMN "last_service_date",
DROP COLUMN "longest_service_streak";

-- DropTable
DROP TABLE "customer_favourites";

-- DropTable
DROP TABLE "platform_configs";

-- DropTable
DROP TABLE "staff_attendance";

-- DropEnum
DROP TYPE "AttendanceSource";

-- DropEnum
DROP TYPE "AttendanceStatus";
