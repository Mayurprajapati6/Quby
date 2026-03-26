import { Router } from "express";
import { CustomerWalletController } from "./customer-wallet.controller";

export const customerWalletRouter = Router();

customerWalletRouter.get("/transactions", CustomerWalletController.getTransactions);
customerWalletRouter.get("/",             CustomerWalletController.getWallet);
