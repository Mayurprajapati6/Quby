
import { Router } from "express";
import { StaffQrLogController }  from "./staff-qr-log.controller";

export const staffQrLogRouter = Router();

staffQrLogRouter.get("/", StaffQrLogController.getQrLog);
