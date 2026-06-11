

import { Response, NextFunction } from "express";
import { StaffQueueService } from "./staff-queue.service";
import { QueueRecalculationService } from "./queue-recalculation.service";
import { successResponse } from "../../../utils/helpers/response";
import { BadRequestError } from "../../../utils/errors/app.error";
import type { AuthRequest } from "../../../middlewares/types";

export class StaffQueueController {

  static async getTodayQueue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await StaffQueueService.getTodayQueue(req.user!.userId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async getQueueByDate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { date } = req.params;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new BadRequestError("date must be YYYY-MM-DD.");
      }
      const data = await StaffQueueService.getQueueByDate(req.user!.userId, date);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async scanQr(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { qr_code_id } = req.body;
      if (!qr_code_id?.trim()) throw new BadRequestError("qr_code_id is required.");
      const data = await StaffQueueService.scanQr(req.user!.userId, qr_code_id.trim());
      res.json(successResponse(data, "Customer checked in."));
    } catch (err) { next(err); }
  }

  static async completeService(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { booking_id } = req.body;
      if (!booking_id?.trim()) throw new BadRequestError("booking_id is required.");
      const data = await StaffQueueService.completeService(req.user!.userId, booking_id.trim());
      res.json(successResponse(data, "Service marked complete."));
    } catch (err) { next(err); }
  }

  static async extendService(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { booking_id, extra_minutes } = req.body;
      if (!booking_id?.trim())               throw new BadRequestError("booking_id is required.");
      if (!Number.isInteger(extra_minutes))  throw new BadRequestError("extra_minutes must be an integer.");
      const data = await StaffQueueService.extendService(
        req.user!.userId,
        booking_id.trim(),
        extra_minutes,
      );
      res.json(successResponse(data, `Service extended by ${extra_minutes} min.`));
    } catch (err) { next(err); }
  }

  // static async reportDelay(req: AuthRequest, res: Response, next: NextFunction) {
  //   try {
  //     const { booking_id, delay_minutes } = req.body;
  //     if (!booking_id?.trim())            throw new BadRequestError("booking_id is required.");
  //     if (!Number.isInteger(delay_minutes)) throw new BadRequestError("delay_minutes must be an integer.");
  //     const data = await StaffQueueService.reportDelay(
  //       req.user!.userId,
  //       booking_id.trim(),
  //       delay_minutes,
  //     );
  //     res.json(successResponse(data, `Queue shifted by ${delay_minutes} min.`));
  //   } catch (err) { next(err); }
  // }

  static async rebuildQueue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { date } = req.body;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new BadRequestError("date must be YYYY-MM-DD.");
      }
      const staff = await import("../../../config/prisma").then(m =>
        m.prisma.staff.findUnique({
          where:  { user_id: req.user!.userId },
          select: { id: true },
        })
      );
      if (!staff) throw new BadRequestError("Staff profile not found.");
      await QueueRecalculationService.rebuildRedisQueue(staff.id, date);
      res.json(successResponse({ staff_id: staff.id, date }, "Queue rebuilt from database."));
    } catch (err) { next(err); }
  }
}