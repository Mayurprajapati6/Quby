import { Router } from "express";
import { AdminUsersController } from "./admin-users.controller";

export const adminUsersRouter = Router();

adminUsersRouter.get("/owners", AdminUsersController.getOwners);
adminUsersRouter.get("/owners/:ownerId", AdminUsersController.getOwnerDetail);

adminUsersRouter.get("/customers", AdminUsersController.getCustomers);
adminUsersRouter.get("/customers/:customerId", AdminUsersController.getCustomerDetail);

adminUsersRouter.get("/staff", AdminUsersController.getStaff);
adminUsersRouter.get("/staff/:staffId", AdminUsersController.getStaffDetail);

adminUsersRouter.get("/staff/:staffId/reviews", AdminUsersController.getStaffReviews);