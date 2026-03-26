import { Response, NextFunction } from "express";
import { CustomerService } from "./customer.service";
import { AuthService } from "../auth/auth.service";
import { prisma } from "../../config/prisma";
import { successResponse } from "../../utils/helpers/response";
import { NotFoundError } from "../../utils/errors/app.error";
import type { AuthRequest } from "../../middlewares/types";

export class CustomerController {

  static async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await CustomerService.getProfile(req.user!.userId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await CustomerService.updateProfile(
        req.user!.userId,
        req.body,
        req.file,
      );
      res.json(successResponse(data, "Profile updated successfully."));
    } catch (err) { next(err); }
  }

  static async deleteAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await CustomerService.deleteAccount(req.user!.userId, req.body.password);
      res.json(successResponse(null, "Account deleted successfully."));
    } catch (err) { next(err); }
  }

  static async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const token = req.body.refresh_token ?? req.cookies?.refresh_token ?? "";
      await AuthService.logout(token);
      res.json(successResponse(null, "Logged out successfully."));
    } catch (err) { next(err); }
  }

  static async getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const customer = await prisma.customer.findUnique({
        where:  { user_id: req.user!.userId },
        select: { id: true },
      });
      if (!customer) throw new NotFoundError("Customer not found.");

      const page   = Math.max(1, parseInt(req.query.page   as string) || 1);
      const limit  = Math.min(50, parseInt(req.query.limit as string) || 20);
      const unread = req.query.unread === "true";

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.customerNotification.findMany({
          where:   {
            customer_id: customer.id,
            ...(unread && { is_read: false }),
          },
          orderBy: { created_at: "desc" },
          skip:    (page - 1) * limit,
          take:    limit,
        }),
        prisma.customerNotification.count({
          where: { customer_id: customer.id, ...(unread && { is_read: false }) },
        }),
        prisma.customerNotification.count({
          where: { customer_id: customer.id, is_read: false },
        }),
      ]);

      res.json({
        success: true,
        data: {
          notifications,
          unread_count: unreadCount,
          pagination: {
            total,
            page,
            limit,
            total_pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (err) { next(err); }
  }

  static async markNotificationRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const customer = await prisma.customer.findUnique({
        where:  { user_id: req.user!.userId },
        select: { id: true },
      });
      if (!customer) throw new NotFoundError("Customer not found.");

      const notification = await prisma.customerNotification.findFirst({
        where: { id: req.params.id, customer_id: customer.id },
      });
      if (!notification) throw new NotFoundError("Notification not found.");

      if (!notification.is_read) {
        await prisma.customerNotification.update({
          where: { id: req.params.id },
          data:  { is_read: true, read_at: new Date() },
        });
      }

      res.json(successResponse(null, "Notification marked as read."));
    } catch (err) { next(err); }
  }

  static async markAllNotificationsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const customer = await prisma.customer.findUnique({
        where:  { user_id: req.user!.userId },
        select: { id: true },
      });
      if (!customer) throw new NotFoundError("Customer not found.");

      const result = await prisma.customerNotification.updateMany({
        where: { customer_id: customer.id, is_read: false },
        data:  { is_read: true, read_at: new Date() },
      });

      res.json(successResponse({ updated: result.count }, "All notifications marked as read."));
    } catch (err) { next(err); }
  }
}
