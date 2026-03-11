-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BusinessNotificationType" ADD VALUE 'SERVICE_EXTENDED';
ALTER TYPE "BusinessNotificationType" ADD VALUE 'QUEUE_SHIFTED';
ALTER TYPE "BusinessNotificationType" ADD VALUE 'REVIEW_RECEIVED';

-- AlterEnum
ALTER TYPE "CustomerNotificationType" ADD VALUE 'QUEUE_SHIFTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StaffNotificationType" ADD VALUE 'REVIEW_RECEIVED';
ALTER TYPE "StaffNotificationType" ADD VALUE 'SERVICE_EXTENDED';
