import cron   from "node-cron";
import logger from "../config/logger.config";
import { notificationQueue } from "../config/bullmq";
import { prisma } from "../config/prisma";

cron.schedule("30 20 * * *", async () => {
  try {
    await notificationQueue.add(
      "cleanup-notifications",
      { type: "cleanup-notifications" },
      { jobId: `notif-cleanup-${Date.now()}` },
    );
    logger.info("[Cron] Queued notification cleanup job");
  } catch (err) {
    logger.error("[Cron] Notification cleanup queue failed:", err);
  }
});

cron.schedule("0 * * * *", async () => {
  try {
    const now      = new Date();
    const oneHrAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const expiredTokens = await prisma.emailVerificationToken.findMany({
      where: {
        is_used:    false,
        expires_at: { gte: oneHrAgo, lte: now },
        user: {
          role:          "STAFF",
          password_hash: null,   
        },
      },
      include: {
        user: {
          include: {
            staff_profile: {            
              include: {
                business: {
                  include: {
                    owner: { select: { user: { select: { id: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const token of expiredTokens) {
      const staff = token.user.staff_profile;  // FIX: correct relation name
      if (!staff) continue;

      const business = staff.business;
      if (!business) continue;

      const notifExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.businessNotification.create({
        data: {
          business_id: business.id,
          type:        "STAFF_INVITE_EXPIRED",
          title:       "Staff Setup Link Expired",
          message:     `${staff.name} (${staff.email}) has not completed account setup. Their invitation link has expired. Go to Staff > ${staff.name} and tap "Resend Invitation".`,
          target:      "OWNER",
          expires_at:  notifExpiry,
          data: {
            staff_id:   staff.id,
            staff_name: staff.name,
            staff_email: staff.email,
          },
        },
      }).catch(() => {});

      logger.info(`[Cron] Expired setup token: staff ${staff.name} (${staff.email}), business ${business.business_name}`);
    }

    if (expiredTokens.length > 0) {
      logger.info(`[Cron] Notified owners about ${expiredTokens.length} expired staff invitation(s)`);
    }
  } catch (err) {
    logger.error("[Cron] Expired token check failed:", err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🧹 CLEANUP OLD REFRESH TOKENS (Every 6 hours)
// Problem: Refresh tokens accumulate forever in DB, slowing down queries
// Solution: Delete tokens older than 8 days (1 day past 7-day expiry)
// ═══════════════════════════════════════════════════════════════════════════
cron.schedule("0 */6 * * *", async () => {
  try {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    
    const result = await prisma.refreshToken.deleteMany({
      where: {
        created_at: { lt: eightDaysAgo }
      }
    });
    
    if (result.count > 0) {
      logger.info(`[Cron] Deleted ${result.count} old refresh tokens (older than 8 days)`);
    }
  } catch (err) {
    logger.error("[Cron] Refresh token cleanup failed:", err);
  }
});

logger.info("[Cron] All jobs scheduled");