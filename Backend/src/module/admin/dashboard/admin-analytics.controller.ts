import type { Request, Response } from "express";
import { AdminAnalyticsRepository as Repo } from "./admin-analytics.repository";

export class AdminAnalyticsController {

  static async getAnalytics(req: Request, res: Response) {
    try {
      const period = (req.query.period as string) === "weekly"
        ? "weekly"
        : (req.query.period as string) === "monthly"
        ? "monthly"
        : "daily";

      const [
        lifetimeCounts,
        growthData,
        topBusinesses,
        weeklyServices,
        cityDistribution,
        salonTypeDistribution,
        ownerBusinessCount,
      ] = await Promise.all([
        Repo.getLifetimeCounts(),
        Repo.getGrowthData(period),
        Repo.getTopEarningBusinesses(),
        Repo.getWeeklyServiceStats(),
        Repo.getCityDistribution(),
        Repo.getSalonTypeDistribution(),
        Repo.getOwnerBusinessCount(),
      ]);

      res.json({
        success: true,
        data: {
          lifetime_counts:       lifetimeCounts,
          growth_data:           growthData,
          top_businesses:        topBusinesses,
          weekly_services:       weeklyServices,
          city_distribution:     cityDistribution,
          salon_type_distribution: salonTypeDistribution,
          owner_business_count:  ownerBusinessCount,
          period,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
