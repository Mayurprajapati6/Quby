import { Router } from "express";
import { OwnerEscrowController } from "./owner-escrow.controller";

export const ownerEscrowRouter = Router();

ownerEscrowRouter.get("/", OwnerEscrowController.getEscrows);
ownerEscrowRouter.get("/:escrowId", OwnerEscrowController.getEscrowDetail);
