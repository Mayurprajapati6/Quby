import { Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ScheduleService } from "./schedule.service";
import { successResponse } from "../../../utils/helpers/response";
import { AuthRequest } from "../../../middlewares/types";
import { SCHEDULE_MESSAGES } from "../../../constants/messages";

export class ScheduleController {

  static getSchedule = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schedule = await ScheduleService.getSchedule(req.params.businessId, req.user!.userId);
      res.status(StatusCodes.OK).json(successResponse(schedule));
    } catch (err) { next(err); }
  };

  static updateSchedule = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schedule = await ScheduleService.updateSchedule(req.params.businessId, req.user!.userId, req.body.schedules);
      res.status(StatusCodes.OK).json(successResponse(schedule, SCHEDULE_MESSAGES.UPDATED));
    } catch (err) { next(err); }
  };

  static getHolidays = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const holidays = await ScheduleService.getHolidays(req.params.businessId, req.user!.userId);
      res.status(StatusCodes.OK).json(successResponse(holidays));
    } catch (err) { next(err); }
  };

  static createHoliday = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const holiday = await ScheduleService.createHoliday(req.params.businessId, req.user!.userId, req.body);
      res.status(StatusCodes.CREATED).json(successResponse(holiday, SCHEDULE_MESSAGES.HOLIDAY_CREATED));
    } catch (err) { next(err); }
  };

  static deleteHoliday = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ScheduleService.deleteHoliday(req.params.businessId, req.params.holidayId, req.user!.userId);
      res.status(StatusCodes.OK).json(successResponse(null, SCHEDULE_MESSAGES.HOLIDAY_DELETED));
    } catch (err) { next(err); }
  };
}