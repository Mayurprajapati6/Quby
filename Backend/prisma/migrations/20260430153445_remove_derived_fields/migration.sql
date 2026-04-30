/*
  Warnings:

  - You are about to drop the column `arrival_window_end` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `arrival_window_start` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `scan_window_end` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `scan_window_start` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `service_end_time` on the `bookings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "arrival_window_end",
DROP COLUMN "arrival_window_start",
DROP COLUMN "scan_window_end",
DROP COLUMN "scan_window_start",
DROP COLUMN "service_end_time";
