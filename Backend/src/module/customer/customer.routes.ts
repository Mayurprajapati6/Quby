import express from "express";
import { CustomerController } from "./customer.controller";
import { validateRequestBody } from "../../validators";
import { updateCustomerProfileSchema } from "../../validators/customer.validator";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";

const router = express.Router();

router.use(authenticate, authorizeRoles("CUSTOMER"));

router.get("/profile", CustomerController.getProfile);

router.put("/profile", validateRequestBody(updateCustomerProfileSchema), CustomerController.updateProfile);

export default router;