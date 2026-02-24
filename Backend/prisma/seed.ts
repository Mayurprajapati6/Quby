import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import bcrypt from "bcryptjs";

async function seedAdmin() {
  const email    = process.env.ADMIN_EMAIL    ?? "admin@yourdomain.com";
  const password = process.env.ADMIN_PASSWORD ?? "Admin@123456";
  const name     = process.env.ADMIN_NAME     ?? "Super Admin";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password_hash: passwordHash,
      role:        "ADMIN",
      is_active:   true,
      is_verified: true,
      version:     1,
    },
  });

  await prisma.admin.upsert({
    where: { user_id: user.id },
    update: {},
    create: {
      user_id:   user.id,
      name,
      is_active: true,
      permissions: {
        manage_users:      true,
        manage_businesses: true,
        manage_platform:   true,
        manage_staff:      true,
        view_analytics:    true,
      },
    },
  });

  console.log(`✅ Admin seeded: ${email}`);
}

async function seedPlatformConfig() {
  const configs = [
    {
      key:         "PLATFORM_FEE_PERCENTAGE",
      value:       "5",
      description: "Platform fee as a percentage of the service amount (e.g. 5 = 5%)",
    },
    {
      key:         "QR_VALID_WINDOW_MINUTES",
      value:       "10",
      description: "Minutes a customer has to scan their QR code after arriving",
    },
    {
      key:         "ESCROW_RELEASE_DELAY_MINUTES",
      value:       "5",
      description: "Minutes after service completion before escrow is released to the business",
    },
    {
      key:         "CANCELLATION_WINDOW_HOURS",
      value:       "4",
      description: "Hours before service start within which a cancellation qualifies for a full refund",
    },
    {
      key:         "DEFAULT_BREAK_TIME_MINUTES",
      value:       "5",
      description: "Default gap between back-to-back bookings for a staff member",
    },
    {
      key:         "MAX_BUSINESS_IMAGES",
      value:       "10",
      description: "Maximum number of gallery images a business can upload",
    },
    {
      key:         "MIN_BUSINESS_IMAGES",
      value:       "3",
      description: "Minimum number of gallery images required for a business listing",
    },
    {
      key:         "MAX_REVIEW_IMAGES",
      value:       "3",
      description: "Maximum number of images a customer can attach to a review",
    },
    {
      key:         "NO_SHOW_WINDOW_MINUTES",
      value:       "15",
      description: "Minutes past arrival window end before a booking is marked as no-show",
    },
    {
      key:         "MAX_ACTIVE_BOOKINGS_PER_CUSTOMER",
      value:       "3",
      description: "Maximum number of upcoming confirmed bookings a customer can hold at once",
    },
  ];

  for (const config of configs) {
    await prisma.platformConfig.upsert({
      where:  { key: config.key },
      update: {},
      create: {
        key:         config.key,
        value:       config.value,
        description: config.description,
      },
    });
  }

  console.log(`✅ Platform config seeded: ${configs.length} keys`);
}

async function main() {
  console.log("🌱 Starting seed...\n");

  await seedAdmin();
  await seedPlatformConfig();

  console.log("\n🎉 Seed complete.");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());