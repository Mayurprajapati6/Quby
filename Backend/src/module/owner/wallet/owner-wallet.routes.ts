import { Router } from "express";
import { OwnerWalletController } from "./owner-wallet.controller";

export const ownerWalletRouter = Router();

ownerWalletRouter.get("/escrow", OwnerWalletController.getEscrowHistory);
ownerWalletRouter.get("/",       OwnerWalletController.getSummary);
