/*
  Warnings:

  - A unique constraint covering the columns `[staff_id,service_date,service_start_time]` on the table `bookings` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "bookings_staff_id_service_date_service_start_time_key" ON "bookings"("staff_id", "service_date", "service_start_time");
