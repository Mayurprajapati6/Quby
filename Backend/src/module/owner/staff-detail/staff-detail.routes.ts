import { Router } from "express";
import { StaffDetailController } from "./staff-detail.controller";

export const staffDetailRouter = Router({ mergeParams: true });

staffDetailRouter.get("/", StaffDetailController.getStaffDetail);
