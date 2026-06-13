import { Router } from "express";
import { BusinessTodayController } from "./business-today.controller";

export const businessTodayRouter = Router();

businessTodayRouter.get("/", BusinessTodayController.getTodayQueue);
