/*
  Warnings:

  - The values [PROVIDER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `user_id` on the `booking_events` table. All the data in the column will be lost.
  - You are about to drop the column `provider_id` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `provider_id` on the `escrow_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `holiday_date` on the `holidays` table. All the data in the column will be lost.
  - You are about to drop the column `provider_id` on the `holidays` table. All the data in the column will be lost.
  - You are about to drop the column `provider_id` on the `platform_fee_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `provider_breakdown` on the `platform_revenue` table. All the data in the column will be lost.
  - You are about to drop the column `provider_comment` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `provider_id` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `provider_rating` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `provider_response` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `provider_response_at` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `password_hash` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `provider_id` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `leave_date` on the `staff_leaves` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `staff_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `custom_price` on the `staff_services` table. All the data in the column will be lost.
  - You are about to drop the column `provider_id` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `address_line1` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `address_line2` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `avatar_url` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `date_of_birth` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phone_verified_at` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `pincode` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `admin_users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `provider_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `provider_images` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `provider_notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `provider_service_offerings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `provider_wallet_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `provider_wallets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `providers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `staff_wallet_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `staff_wallets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_wallets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wallet_transactions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[user_id]` on the table `staff` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[staff_id,day_of_week]` on the table `staff_schedules` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `business_id` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customer_id` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `business_id` to the `escrow_transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `business_id` to the `holidays` table without a default value. This is not possible if the table is not empty.
  - Added the required column `end_date` to the `holidays` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_date` to the `holidays` table without a default value. This is not possible if the table is not empty.
  - Added the required column `business_id` to the `platform_fee_transactions` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `category` on the `platform_services` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `business_id` to the `reviews` table without a default value. This is not possible if the table is not empty.
  - Added the required column `business_rating` to the `reviews` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customer_id` to the `reviews` table without a default value. This is not possible if the table is not empty.
  - Added the required column `business_id` to the `staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `staff` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `staff` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `end_date` to the `staff_leaves` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_date` to the `staff_leaves` table without a default value. This is not possible if the table is not empty.
  - Added the required column `day_of_week` to the `staff_schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `business_id` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customer_id` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('SALON', 'SPA');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "CustomerNotificationType" AS ENUM ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'REMINDER_1_HOUR', 'REMINDER_15_MIN', 'YOUR_TURN_SOON', 'SERVICE_READY', 'SERVICE_COMPLETED', 'BOOKING_CANCELLED', 'REFUND_PROCESSED', 'REVIEW_REQUEST');

-- CreateEnum
CREATE TYPE "BusinessNotificationType" AS ENUM ('NEW_BOOKING', 'BOOKING_CANCELLED', 'STAFF_LEAVE_REQUEST', 'NEW_REVIEW', 'PAYMENT_RECEIVED', 'LOW_RATING_ALERT', 'BUSINESS_VERIFIED', 'BUSINESS_REJECTED');

-- CreateEnum
CREATE TYPE "BusinessWalletTransactionType" AS ENUM ('ESCROW_RELEASE', 'PLATFORM_FEE', 'WITHDRAWAL');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('CUSTOMER', 'STAFF', 'OWNER', 'ADMIN');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
COMMIT;

-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE 'CREDIT';

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_user_id_fkey";

-- DropForeignKey
ALTER TABLE "holidays" DROP CONSTRAINT "holidays_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "provider_history" DROP CONSTRAINT "provider_history_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "provider_images" DROP CONSTRAINT "provider_images_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "provider_notifications" DROP CONSTRAINT "provider_notifications_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "provider_service_offerings" DROP CONSTRAINT "provider_service_offerings_platform_service_id_fkey";

-- DropForeignKey
ALTER TABLE "provider_service_offerings" DROP CONSTRAINT "provider_service_offerings_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "provider_wallet_transactions" DROP CONSTRAINT "provider_wallet_transactions_wallet_id_fkey";

-- DropForeignKey
ALTER TABLE "provider_wallets" DROP CONSTRAINT "provider_wallets_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "staff" DROP CONSTRAINT "staff_provider_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_services" DROP CONSTRAINT "staff_services_service_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_wallet_transactions" DROP CONSTRAINT "staff_wallet_transactions_wallet_id_fkey";

-- DropForeignKey
ALTER TABLE "staff_wallets" DROP CONSTRAINT "staff_wallets_staff_id_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_wallets" DROP CONSTRAINT "user_wallets_user_id_fkey";

-- DropForeignKey
ALTER TABLE "wallet_transactions" DROP CONSTRAINT "wallet_transactions_wallet_id_fkey";

-- DropIndex
DROP INDEX "bookings_provider_id_service_date_idx";

-- DropIndex
DROP INDEX "bookings_user_id_created_at_idx";

-- DropIndex
DROP INDEX "holidays_provider_id_holiday_date_idx";

-- DropIndex
DROP INDEX "platform_fee_transactions_provider_id_idx";

-- DropIndex
DROP INDEX "reviews_provider_id_created_at_idx";

-- DropIndex
DROP INDEX "staff_phone_key";

-- DropIndex
DROP INDEX "staff_provider_id_idx";

-- DropIndex
DROP INDEX "staff_provider_id_is_active_idx";

-- DropIndex
DROP INDEX "staff_leaves_staff_id_leave_date_idx";

-- DropIndex
DROP INDEX "staff_notifications_created_at_idx";

-- DropIndex
DROP INDEX "staff_schedules_staff_id_date_idx";

-- DropIndex
DROP INDEX "staff_schedules_staff_id_date_key";

-- DropIndex
DROP INDEX "transactions_user_id_created_at_idx";

-- DropIndex
DROP INDEX "users_city_state_idx";

-- DropIndex
DROP INDEX "users_created_at_idx";

-- DropIndex
DROP INDEX "users_phone_idx";

-- DropIndex
DROP INDEX "users_phone_key";

-- AlterTable
ALTER TABLE "booking_events" DROP COLUMN "user_id",
ADD COLUMN     "triggered_by" TEXT;

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "provider_id",
DROP COLUMN "user_id",
ADD COLUMN     "business_id" TEXT NOT NULL,
ADD COLUMN     "customer_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "escrow_transactions" DROP COLUMN "provider_id",
ADD COLUMN     "business_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "holidays" DROP COLUMN "holiday_date",
DROP COLUMN "provider_id",
ADD COLUMN     "business_id" TEXT NOT NULL,
ADD COLUMN     "end_date" DATE NOT NULL,
ADD COLUMN     "start_date" DATE NOT NULL;

-- AlterTable
ALTER TABLE "platform_fee_transactions" DROP COLUMN "provider_id",
ADD COLUMN     "business_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "platform_revenue" DROP COLUMN "provider_breakdown",
ADD COLUMN     "business_breakdown" JSONB;

-- AlterTable
ALTER TABLE "platform_services" ADD COLUMN     "image_url" VARCHAR(500),
DROP COLUMN "category",
ADD COLUMN     "category" "BusinessType" NOT NULL;

-- AlterTable
ALTER TABLE "reviews" DROP COLUMN "provider_comment",
DROP COLUMN "provider_id",
DROP COLUMN "provider_rating",
DROP COLUMN "provider_response",
DROP COLUMN "provider_response_at",
DROP COLUMN "user_id",
ADD COLUMN     "business_comment" TEXT,
ADD COLUMN     "business_id" TEXT NOT NULL,
ADD COLUMN     "business_rating" INTEGER NOT NULL,
ADD COLUMN     "business_response" TEXT,
ADD COLUMN     "business_response_at" TIMESTAMPTZ(3),
ADD COLUMN     "customer_id" TEXT NOT NULL,
ADD COLUMN     "is_edited" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "staff" DROP COLUMN "password_hash",
DROP COLUMN "provider_id",
ADD COLUMN     "business_id" TEXT NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "staff_leaves" DROP COLUMN "leave_date",
ADD COLUMN     "end_date" DATE NOT NULL,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "start_date" DATE NOT NULL;

-- AlterTable
ALTER TABLE "staff_schedules" DROP COLUMN "date",
ADD COLUMN     "day_of_week" "DayOfWeek" NOT NULL,
ALTER COLUMN "start_time" DROP NOT NULL,
ALTER COLUMN "end_time" DROP NOT NULL;

-- AlterTable
ALTER TABLE "staff_services" DROP COLUMN "custom_price";

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "provider_id",
DROP COLUMN "user_id",
ADD COLUMN     "business_id" TEXT NOT NULL,
ADD COLUMN     "customer_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "address_line1",
DROP COLUMN "address_line2",
DROP COLUMN "avatar_url",
DROP COLUMN "city",
DROP COLUMN "country",
DROP COLUMN "date_of_birth",
DROP COLUMN "gender",
DROP COLUMN "name",
DROP COLUMN "phone",
DROP COLUMN "phone_verified_at",
DROP COLUMN "pincode",
DROP COLUMN "state",
ALTER COLUMN "email_verified_at" SET DATA TYPE TIMESTAMPTZ(3);

-- DropTable
DROP TABLE "admin_users";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "provider_history";

-- DropTable
DROP TABLE "provider_images";

-- DropTable
DROP TABLE "provider_notifications";

-- DropTable
DROP TABLE "provider_service_offerings";

-- DropTable
DROP TABLE "provider_wallet_transactions";

-- DropTable
DROP TABLE "provider_wallets";

-- DropTable
DROP TABLE "providers";

-- DropTable
DROP TABLE "staff_wallet_transactions";

-- DropTable
DROP TABLE "staff_wallets";

-- DropTable
DROP TABLE "user_wallets";

-- DropTable
DROP TABLE "wallet_transactions";

-- DropEnum
DROP TYPE "NotificationType";

-- DropEnum
DROP TYPE "ProviderNotificationType";

-- DropEnum
DROP TYPE "ProviderType";

-- DropEnum
DROP TYPE "ProviderWalletTransactionType";

-- DropEnum
DROP TYPE "StaffWalletTransactionType";

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "avatar_url" VARCHAR(500),
    "gender" VARCHAR(20),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "country" VARCHAR(100) NOT NULL DEFAULT 'India',
    "address_line1" VARCHAR(255),
    "address_line2" VARCHAR(255),
    "total_bookings" INTEGER NOT NULL DEFAULT 0,
    "completed_bookings" INTEGER NOT NULL DEFAULT 0,
    "cancelled_bookings" INTEGER NOT NULL DEFAULT 0,
    "total_spent" INTEGER NOT NULL DEFAULT 0,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_booking_date" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_favourites" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_favourites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_wallets" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "lifetime_spent" INTEGER NOT NULL DEFAULT 0,
    "lifetime_refunds" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "booking_id" TEXT,
    "transaction_id" TEXT,
    "description" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notifications" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "type" "CustomerNotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "action_url" VARCHAR(500),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "avatar_url" VARCHAR(500),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "total_businesses" INTEGER NOT NULL DEFAULT 0,
    "active_businesses" INTEGER NOT NULL DEFAULT 0,
    "total_staff" INTEGER NOT NULL DEFAULT 0,
    "total_bookings" INTEGER NOT NULL DEFAULT 0,
    "lifetime_earnings" INTEGER NOT NULL DEFAULT 0,
    "current_balance" INTEGER NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "business_name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "business_type" "BusinessType" NOT NULL,
    "service_for" "ServiceFor" NOT NULL,
    "description" TEXT,
    "address_line1" VARCHAR(255) NOT NULL,
    "address_line2" VARCHAR(255),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(10) NOT NULL,
    "country" VARCHAR(100) NOT NULL DEFAULT 'India',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "business_email" VARCHAR(255),
    "business_phone" VARCHAR(20),
    "website_url" VARCHAR(500),
    "logo_url" VARCHAR(500),
    "cover_image_url" VARCHAR(500),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(3),
    "verification_note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "break_time_minutes" INTEGER NOT NULL DEFAULT 5,
    "average_rating" DOUBLE PRECISION DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_schedules" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "open_time" VARCHAR(5),
    "close_time" VARCHAR(5),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_images" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "public_id" VARCHAR(255),
    "thumbnail_url" VARCHAR(500),
    "medium_url" VARCHAR(500),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_notifications" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "type" "BusinessNotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "action_url" VARCHAR(500),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_wallets" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "lifetime_earnings" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "BusinessWalletTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "booking_id" TEXT,
    "escrow_id" TEXT,
    "description" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_service_offerings" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "platform_service_id" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "discounted_price" INTEGER,
    "image_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "booking_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_service_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_configs" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "permissions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "last_login_at" TIMESTAMPTZ(3),

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_user_id_key" ON "customers"("user_id");

-- CreateIndex
CREATE INDEX "customers_user_id_idx" ON "customers"("user_id");

-- CreateIndex
CREATE INDEX "customers_city_state_idx" ON "customers"("city", "state");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customer_favourites_customer_id_idx" ON "customer_favourites"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_favourites_customer_id_business_id_key" ON "customer_favourites"("customer_id", "business_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_wallets_customer_id_key" ON "customer_wallets"("customer_id");

-- CreateIndex
CREATE INDEX "customer_wallets_customer_id_idx" ON "customer_wallets"("customer_id");

-- CreateIndex
CREATE INDEX "customer_wallet_transactions_wallet_id_created_at_idx" ON "customer_wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "customer_wallet_transactions_booking_id_idx" ON "customer_wallet_transactions"("booking_id");

-- CreateIndex
CREATE INDEX "customer_notifications_customer_id_created_at_idx" ON "customer_notifications"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "customer_notifications_customer_id_is_read_idx" ON "customer_notifications"("customer_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "owners_user_id_key" ON "owners"("user_id");

-- CreateIndex
CREATE INDEX "owners_user_id_idx" ON "owners"("user_id");

-- CreateIndex
CREATE INDEX "owners_phone_idx" ON "owners"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_slug_key" ON "businesses"("slug");

-- CreateIndex
CREATE INDEX "businesses_owner_id_idx" ON "businesses"("owner_id");

-- CreateIndex
CREATE INDEX "businesses_slug_idx" ON "businesses"("slug");

-- CreateIndex
CREATE INDEX "businesses_city_state_idx" ON "businesses"("city", "state");

-- CreateIndex
CREATE INDEX "businesses_business_type_service_for_idx" ON "businesses"("business_type", "service_for");

-- CreateIndex
CREATE INDEX "businesses_is_verified_is_active_idx" ON "businesses"("is_verified", "is_active");

-- CreateIndex
CREATE INDEX "businesses_latitude_longitude_idx" ON "businesses"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "business_schedules_business_id_idx" ON "business_schedules"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_schedules_business_id_day_of_week_key" ON "business_schedules"("business_id", "day_of_week");

-- CreateIndex
CREATE INDEX "business_images_business_id_idx" ON "business_images"("business_id");

-- CreateIndex
CREATE INDEX "business_images_is_primary_idx" ON "business_images"("is_primary");

-- CreateIndex
CREATE INDEX "business_notifications_business_id_created_at_idx" ON "business_notifications"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "business_notifications_business_id_is_read_idx" ON "business_notifications"("business_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "business_wallets_business_id_key" ON "business_wallets"("business_id");

-- CreateIndex
CREATE INDEX "business_wallets_business_id_idx" ON "business_wallets"("business_id");

-- CreateIndex
CREATE INDEX "business_wallet_transactions_wallet_id_created_at_idx" ON "business_wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "business_wallet_transactions_booking_id_idx" ON "business_wallet_transactions"("booking_id");

-- CreateIndex
CREATE INDEX "business_service_offerings_business_id_idx" ON "business_service_offerings"("business_id");

-- CreateIndex
CREATE INDEX "business_service_offerings_platform_service_id_idx" ON "business_service_offerings"("platform_service_id");

-- CreateIndex
CREATE INDEX "business_service_offerings_business_id_is_active_idx" ON "business_service_offerings"("business_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "business_service_offerings_business_id_platform_service_id_key" ON "business_service_offerings"("business_id", "platform_service_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_configs_key_key" ON "platform_configs"("key");

-- CreateIndex
CREATE INDEX "platform_configs_key_idx" ON "platform_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "admins_email_idx" ON "admins"("email");

-- CreateIndex
CREATE INDEX "bookings_customer_id_created_at_idx" ON "bookings"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "bookings_business_id_service_date_idx" ON "bookings"("business_id", "service_date");

-- CreateIndex
CREATE INDEX "holidays_business_id_start_date_end_date_idx" ON "holidays"("business_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "platform_fee_transactions_business_id_idx" ON "platform_fee_transactions"("business_id");

-- CreateIndex
CREATE INDEX "platform_services_category_service_for_idx" ON "platform_services"("category", "service_for");

-- CreateIndex
CREATE INDEX "reviews_business_id_created_at_idx" ON "reviews"("business_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_id_key" ON "staff"("user_id");

-- CreateIndex
CREATE INDEX "staff_user_id_idx" ON "staff"("user_id");

-- CreateIndex
CREATE INDEX "staff_business_id_idx" ON "staff"("business_id");

-- CreateIndex
CREATE INDEX "staff_business_id_is_active_idx" ON "staff"("business_id", "is_active");

-- CreateIndex
CREATE INDEX "staff_email_idx" ON "staff"("email");

-- CreateIndex
CREATE INDEX "staff_leaves_staff_id_start_date_idx" ON "staff_leaves"("staff_id", "start_date");

-- CreateIndex
CREATE INDEX "staff_schedules_staff_id_idx" ON "staff_schedules"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_schedules_staff_id_day_of_week_key" ON "staff_schedules"("staff_id", "day_of_week");

-- CreateIndex
CREATE INDEX "transactions_customer_id_created_at_idx" ON "transactions"("customer_id", "created_at");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_favourites" ADD CONSTRAINT "customer_favourites_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_favourites" ADD CONSTRAINT "customer_favourites_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_wallets" ADD CONSTRAINT "customer_wallets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_wallet_transactions" ADD CONSTRAINT "customer_wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "customer_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_schedules" ADD CONSTRAINT "business_schedules_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_images" ADD CONSTRAINT "business_images_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_notifications" ADD CONSTRAINT "business_notifications_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_wallets" ADD CONSTRAINT "business_wallets_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_wallet_transactions" ADD CONSTRAINT "business_wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "business_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_service_offerings" ADD CONSTRAINT "business_service_offerings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_service_offerings" ADD CONSTRAINT "business_service_offerings_platform_service_id_fkey" FOREIGN KEY ("platform_service_id") REFERENCES "platform_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_service_offering_id_fkey" FOREIGN KEY ("service_offering_id") REFERENCES "business_service_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
