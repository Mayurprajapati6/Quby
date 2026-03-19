-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cancellable_until" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "cancellation_window_hours" INTEGER NOT NULL DEFAULT 2;
