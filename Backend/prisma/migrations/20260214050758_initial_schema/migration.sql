/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'STAFF', 'PROVIDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('SALON', 'SPA');

-- CreateEnum
CREATE TYPE "ServiceFor" AS ENUM ('MEN', 'UNISEX');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CANCELLED_TIMEOUT', 'CANCELLED_NO_SHOW', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('HELD', 'RELEASED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PROCESSING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BookingEventType" AS ENUM ('BOOKING_CREATED', 'PAYMENT_INITIATED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'BOOKING_CONFIRMED', 'CUSTOMER_REMINDED', 'CUSTOMER_CHECKED_IN', 'SERVICE_STARTED', 'SERVICE_COMPLETED', 'BOOKING_CANCELLED', 'BOOKING_NO_SHOW', 'MONEY_RELEASED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'REMINDER_1_HOUR', 'REMINDER_15_MIN', 'YOUR_TURN_SOON', 'SERVICE_READY', 'SERVICE_COMPLETED', 'BOOKING_CANCELLED', 'REFUND_PROCESSED', 'REVIEW_REQUEST');

-- CreateEnum
CREATE TYPE "ProviderNotificationType" AS ENUM ('NEW_BOOKING', 'BOOKING_CANCELLED', 'STAFF_LEAVE_REQUEST', 'NEW_REVIEW', 'PAYMENT_RECEIVED', 'LOW_RATING_ALERT');

-- CreateEnum
CREATE TYPE "StaffNotificationType" AS ENUM ('NEW_BOOKING', 'BOOKING_CANCELLED', 'CUSTOMER_CHECKED_IN', 'NEXT_CUSTOMER_READY', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'NEW_REVIEW', 'DAILY_SUMMARY', 'PAYMENT_RECEIVED');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('BOOKING_PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "ProviderWalletTransactionType" AS ENUM ('ESCROW_RELEASE', 'PLATFORM_FEE');

-- CreateEnum
CREATE TYPE "StaffWalletTransactionType" AS ENUM ('EARNING');

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "phone_verified_at" TIMESTAMP(3),
    "avatar_url" VARCHAR(500),
    "date_of_birth" DATE,
    "gender" VARCHAR(20),
    "address_line1" VARCHAR(255),
    "address_line2" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "pincode" VARCHAR(10),
    "country" VARCHAR(100),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "last_login_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMPTZ(3),
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(3),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
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

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_services" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" "ProviderType" NOT NULL,
    "service_for" "ServiceFor" NOT NULL,
    "default_duration" INTEGER NOT NULL,
    "default_price" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "business_name" VARCHAR(200) NOT NULL,
    "provider_type" "ProviderType" NOT NULL,
    "service_for" "ServiceFor" NOT NULL,
    "description" TEXT,
    "owner_name" VARCHAR(100) NOT NULL,
    "owner_email" VARCHAR(255) NOT NULL,
    "owner_phone" VARCHAR(20) NOT NULL,
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
    "gst_number" VARCHAR(50),
    "pan_number" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "working_hours" JSONB NOT NULL,
    "closed_days" JSONB NOT NULL DEFAULT '[]',
    "average_rating" DOUBLE PRECISION DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_images" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "image_url" VARCHAR(500) NOT NULL,
    "public_id" VARCHAR(255),
    "thumbnail_url" VARCHAR(500),
    "medium_url" VARCHAR(500),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_history" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "changed_by" TEXT NOT NULL,
    "change_type" VARCHAR(50) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "holiday_date" DATE NOT NULL,
    "holiday_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "applies_to_all_staff" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_holidays" (
    "id" TEXT NOT NULL,
    "holiday_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_notifications" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "type" "ProviderNotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "action_url" VARCHAR(500),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_wallets" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "lifetime_earnings" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "provider_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "ProviderWalletTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "booking_id" TEXT,
    "escrow_id" TEXT,
    "description" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "password_hash" VARCHAR(255),
    "email" VARCHAR(255),
    "avatar_url" VARCHAR(500),
    "bio" TEXT,
    "specialization" VARCHAR(200),
    "experience_years" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "average_rating" DOUBLE PRECISION DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_notifications" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "type" "StaffNotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "action_url" VARCHAR(500),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_wallets" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "lifetime_earnings" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "StaffWalletTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "booking_id" TEXT,
    "description" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_schedules" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_leaves" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "leave_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "leave_type" VARCHAR(50) NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "approved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_service_offerings" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "platform_service_id" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "discounted_price" INTEGER,
    "break_time_minutes" INTEGER NOT NULL DEFAULT 5,
    "image_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "booking_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "provider_service_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_services" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "service_offering_id" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "custom_price" INTEGER,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "booking_number" VARCHAR(20) NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "service_date" DATE NOT NULL,
    "queue_number" INTEGER NOT NULL,
    "arrival_window_start" TIMESTAMPTZ(3) NOT NULL,
    "arrival_window_end" TIMESTAMPTZ(3) NOT NULL,
    "service_start_time" TIMESTAMPTZ(3) NOT NULL,
    "service_end_time" TIMESTAMPTZ(3) NOT NULL,
    "checked_in_at" TIMESTAMPTZ(3),
    "service_started_at" TIMESTAMPTZ(3),
    "service_completed_at" TIMESTAMPTZ(3),
    "services" JSONB NOT NULL,
    "total_duration" INTEGER NOT NULL,
    "service_amount" INTEGER NOT NULL,
    "platform_fee" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by" TEXT,
    "cancellation_reason" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_queues" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "service_date" DATE NOT NULL,
    "queue_data" JSONB NOT NULL DEFAULT '[]',
    "last_queue_number" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "daily_queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_events" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "event_type" "BookingEventType" NOT NULL,
    "event_data" JSONB NOT NULL,
    "user_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_codes" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "qr_code_id" VARCHAR(50) NOT NULL,
    "qr_data" TEXT NOT NULL,
    "qr_image_url" TEXT NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMPTZ(3),
    "used_by_staff" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_timers" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "estimated_end" TIMESTAMPTZ(3) NOT NULL,
    "actual_end" TIMESTAMPTZ(3),

    CONSTRAINT "service_timers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "razorpay_order_id" VARCHAR(100) NOT NULL,
    "razorpay_payment_id" VARCHAR(100),
    "razorpay_signature" VARCHAR(500),
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "payment_method" VARCHAR(50),
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),
    "failure_reason" TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_fee_transactions" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'COLLECTED',
    "collected_at" TIMESTAMPTZ(3) NOT NULL,
    "is_refundable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "platform_fee_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_transactions" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'HELD',
    "held_at" TIMESTAMPTZ(3) NOT NULL,
    "scheduled_release_at" TIMESTAMPTZ(3) NOT NULL,
    "released_at" TIMESTAMPTZ(3),
    "refunded_at" TIMESTAMPTZ(3),

    CONSTRAINT "escrow_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "razorpay_refund_id" VARCHAR(100) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PROCESSING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "action_url" VARCHAR(500),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "staff_rating" INTEGER NOT NULL,
    "provider_rating" INTEGER NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "staff_comment" TEXT,
    "provider_comment" TEXT,
    "images" JSONB,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "provider_response" TEXT,
    "provider_response_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_revenue" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_bookings" INTEGER NOT NULL DEFAULT 0,
    "successful_bookings" INTEGER NOT NULL DEFAULT 0,
    "cancelled_bookings" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" INTEGER NOT NULL DEFAULT 0,
    "refunded_amount" INTEGER NOT NULL DEFAULT 0,
    "net_revenue" INTEGER NOT NULL DEFAULT 0,
    "provider_breakdown" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_revenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
    "permissions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE INDEX "email_verification_tokens_token_idx" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "user_wallets_user_id_key" ON "user_wallets"("user_id");

-- CreateIndex
CREATE INDEX "user_wallets_user_id_idx" ON "user_wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_booking_id_idx" ON "wallet_transactions"("booking_id");

-- CreateIndex
CREATE INDEX "platform_services_category_service_for_idx" ON "platform_services"("category", "service_for");

-- CreateIndex
CREATE INDEX "platform_services_is_active_idx" ON "platform_services"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "providers_owner_email_key" ON "providers"("owner_email");

-- CreateIndex
CREATE UNIQUE INDEX "providers_owner_phone_key" ON "providers"("owner_phone");

-- CreateIndex
CREATE INDEX "providers_owner_email_idx" ON "providers"("owner_email");

-- CreateIndex
CREATE INDEX "providers_owner_phone_idx" ON "providers"("owner_phone");

-- CreateIndex
CREATE INDEX "providers_city_state_idx" ON "providers"("city", "state");

-- CreateIndex
CREATE INDEX "providers_provider_type_service_for_idx" ON "providers"("provider_type", "service_for");

-- CreateIndex
CREATE INDEX "providers_is_verified_is_active_idx" ON "providers"("is_verified", "is_active");

-- CreateIndex
CREATE INDEX "providers_latitude_longitude_idx" ON "providers"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "provider_images_provider_id_idx" ON "provider_images"("provider_id");

-- CreateIndex
CREATE INDEX "provider_images_is_primary_idx" ON "provider_images"("is_primary");

-- CreateIndex
CREATE INDEX "provider_history_provider_id_idx" ON "provider_history"("provider_id");

-- CreateIndex
CREATE INDEX "provider_history_created_at_idx" ON "provider_history"("created_at");

-- CreateIndex
CREATE INDEX "holidays_provider_id_holiday_date_idx" ON "holidays"("provider_id", "holiday_date");

-- CreateIndex
CREATE UNIQUE INDEX "staff_holidays_holiday_id_staff_id_key" ON "staff_holidays"("holiday_id", "staff_id");

-- CreateIndex
CREATE INDEX "provider_notifications_provider_id_created_at_idx" ON "provider_notifications"("provider_id", "created_at");

-- CreateIndex
CREATE INDEX "provider_notifications_provider_id_is_read_idx" ON "provider_notifications"("provider_id", "is_read");

-- CreateIndex
CREATE INDEX "provider_notifications_created_at_idx" ON "provider_notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "provider_wallets_provider_id_key" ON "provider_wallets"("provider_id");

-- CreateIndex
CREATE INDEX "provider_wallets_provider_id_idx" ON "provider_wallets"("provider_id");

-- CreateIndex
CREATE INDEX "provider_wallet_transactions_wallet_id_created_at_idx" ON "provider_wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "provider_wallet_transactions_booking_id_idx" ON "provider_wallet_transactions"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_phone_key" ON "staff"("phone");

-- CreateIndex
CREATE INDEX "staff_provider_id_idx" ON "staff"("provider_id");

-- CreateIndex
CREATE INDEX "staff_provider_id_is_active_idx" ON "staff"("provider_id", "is_active");

-- CreateIndex
CREATE INDEX "staff_phone_idx" ON "staff"("phone");

-- CreateIndex
CREATE INDEX "staff_notifications_staff_id_created_at_idx" ON "staff_notifications"("staff_id", "created_at");

-- CreateIndex
CREATE INDEX "staff_notifications_staff_id_is_read_idx" ON "staff_notifications"("staff_id", "is_read");

-- CreateIndex
CREATE INDEX "staff_notifications_created_at_idx" ON "staff_notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_wallets_staff_id_key" ON "staff_wallets"("staff_id");

-- CreateIndex
CREATE INDEX "staff_wallets_staff_id_idx" ON "staff_wallets"("staff_id");

-- CreateIndex
CREATE INDEX "staff_wallet_transactions_wallet_id_created_at_idx" ON "staff_wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "staff_wallet_transactions_booking_id_idx" ON "staff_wallet_transactions"("booking_id");

-- CreateIndex
CREATE INDEX "staff_schedules_staff_id_date_idx" ON "staff_schedules"("staff_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "staff_schedules_staff_id_date_key" ON "staff_schedules"("staff_id", "date");

-- CreateIndex
CREATE INDEX "staff_leaves_staff_id_leave_date_idx" ON "staff_leaves"("staff_id", "leave_date");

-- CreateIndex
CREATE INDEX "staff_leaves_status_idx" ON "staff_leaves"("status");

-- CreateIndex
CREATE INDEX "provider_service_offerings_provider_id_idx" ON "provider_service_offerings"("provider_id");

-- CreateIndex
CREATE INDEX "provider_service_offerings_platform_service_id_idx" ON "provider_service_offerings"("platform_service_id");

-- CreateIndex
CREATE INDEX "provider_service_offerings_provider_id_is_active_idx" ON "provider_service_offerings"("provider_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "provider_service_offerings_provider_id_platform_service_id_key" ON "provider_service_offerings"("provider_id", "platform_service_id");

-- CreateIndex
CREATE INDEX "staff_services_staff_id_idx" ON "staff_services"("staff_id");

-- CreateIndex
CREATE INDEX "staff_services_service_offering_id_idx" ON "staff_services"("service_offering_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_services_staff_id_service_offering_id_key" ON "staff_services"("staff_id", "service_offering_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_number_key" ON "bookings"("booking_number");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_idempotency_key_key" ON "bookings"("idempotency_key");

-- CreateIndex
CREATE INDEX "bookings_user_id_created_at_idx" ON "bookings"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "bookings_staff_id_service_date_idx" ON "bookings"("staff_id", "service_date");

-- CreateIndex
CREATE INDEX "bookings_provider_id_service_date_idx" ON "bookings"("provider_id", "service_date");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_booking_number_idx" ON "bookings"("booking_number");

-- CreateIndex
CREATE INDEX "bookings_idempotency_key_idx" ON "bookings"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_staff_id_service_date_queue_number_key" ON "bookings"("staff_id", "service_date", "queue_number");

-- CreateIndex
CREATE INDEX "daily_queues_staff_id_service_date_idx" ON "daily_queues"("staff_id", "service_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_queues_staff_id_service_date_key" ON "daily_queues"("staff_id", "service_date");

-- CreateIndex
CREATE INDEX "booking_events_booking_id_created_at_idx" ON "booking_events"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "booking_events_event_type_idx" ON "booking_events"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "qr_codes_booking_id_key" ON "qr_codes"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "qr_codes_qr_code_id_key" ON "qr_codes"("qr_code_id");

-- CreateIndex
CREATE INDEX "qr_codes_qr_code_id_idx" ON "qr_codes"("qr_code_id");

-- CreateIndex
CREATE INDEX "qr_codes_is_used_idx" ON "qr_codes"("is_used");

-- CreateIndex
CREATE UNIQUE INDEX "service_timers_booking_id_key" ON "service_timers"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_booking_id_key" ON "transactions"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_razorpay_order_id_key" ON "transactions"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_razorpay_payment_id_key" ON "transactions"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_razorpay_order_id_idx" ON "transactions"("razorpay_order_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_created_at_idx" ON "transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_booking_id_idx" ON "transactions"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_fee_transactions_transaction_id_key" ON "platform_fee_transactions"("transaction_id");

-- CreateIndex
CREATE INDEX "platform_fee_transactions_collected_at_idx" ON "platform_fee_transactions"("collected_at");

-- CreateIndex
CREATE INDEX "platform_fee_transactions_provider_id_idx" ON "platform_fee_transactions"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_transactions_transaction_id_key" ON "escrow_transactions"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_transactions_booking_id_key" ON "escrow_transactions"("booking_id");

-- CreateIndex
CREATE INDEX "escrow_transactions_status_idx" ON "escrow_transactions"("status");

-- CreateIndex
CREATE INDEX "escrow_transactions_scheduled_release_at_idx" ON "escrow_transactions"("scheduled_release_at");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_transaction_id_key" ON "refunds"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_razorpay_refund_id_key" ON "refunds"("razorpay_refund_id");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");

-- CreateIndex
CREATE INDEX "reviews_provider_id_created_at_idx" ON "reviews"("provider_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_staff_id_created_at_idx" ON "reviews"("staff_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_overall_rating_idx" ON "reviews"("overall_rating");

-- CreateIndex
CREATE INDEX "platform_revenue_date_idx" ON "platform_revenue"("date");

-- CreateIndex
CREATE UNIQUE INDEX "platform_revenue_date_key" ON "platform_revenue"("date");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_email_idx" ON "admin_users"("email");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "user_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_images" ADD CONSTRAINT "provider_images_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_history" ADD CONSTRAINT "provider_history_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_holidays" ADD CONSTRAINT "staff_holidays_holiday_id_fkey" FOREIGN KEY ("holiday_id") REFERENCES "holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_holidays" ADD CONSTRAINT "staff_holidays_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_notifications" ADD CONSTRAINT "provider_notifications_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_wallets" ADD CONSTRAINT "provider_wallets_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_wallet_transactions" ADD CONSTRAINT "provider_wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "provider_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_wallets" ADD CONSTRAINT "staff_wallets_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_wallet_transactions" ADD CONSTRAINT "staff_wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "staff_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leaves" ADD CONSTRAINT "staff_leaves_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_service_offerings" ADD CONSTRAINT "provider_service_offerings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_service_offerings" ADD CONSTRAINT "provider_service_offerings_platform_service_id_fkey" FOREIGN KEY ("platform_service_id") REFERENCES "platform_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_service_offering_id_fkey" FOREIGN KEY ("service_offering_id") REFERENCES "provider_service_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_queues" ADD CONSTRAINT "daily_queues_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_timers" ADD CONSTRAINT "service_timers_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_transactions" ADD CONSTRAINT "platform_fee_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
