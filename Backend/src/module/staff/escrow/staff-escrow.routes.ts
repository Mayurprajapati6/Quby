import { Router } from "express";
import { StaffEscrowController } from "./staff-escrow.controller";

export const staffEscrowRouter = Router();

staffEscrowRouter.get("/", StaffEscrowController.getEscrows);
