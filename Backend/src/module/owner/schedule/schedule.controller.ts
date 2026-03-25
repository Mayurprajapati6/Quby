import { Response, NextFunction } from "express";
import type { AuthRequest }       from "../../../middlewares/types";
import { ScheduleService }        from "./schedule.service";
import { successResponse }        from "../../../utils/helpers/response";

export class ScheduleController {

  static async getSchedule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await ScheduleService.getSchedule(req.user!.userId, req.params.businessId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async updateSchedule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await ScheduleService.updateSchedule(req.user!.userId, req.params.businessId, req.body);
      res.json(successResponse(data, "Schedule updated successfully."));
    } catch (err) { next(err); }
  }

  static async getHolidays(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await ScheduleService.getHolidays(req.user!.userId, req.params.businessId);
      res.json(successResponse(data));
    } catch (err) { next(err); }
  }

  static async createHoliday(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await ScheduleService.createHoliday(req.user!.userId, req.params.businessId, req.body);
      res.status(201).json(successResponse(data, "Holiday created successfully."));
    } catch (err) { next(err); }
  }

  static async deleteHoliday(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await ScheduleService.deleteHoliday(req.user!.userId, req.params.businessId, req.params.holidayId);
      res.json(successResponse(null, "Holiday deleted successfully."));
    } catch (err) { next(err); }
  }
}
