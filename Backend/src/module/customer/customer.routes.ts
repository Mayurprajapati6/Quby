import express from "express";
import { CustomerController } from "./customer.controller";
import { validateRequestBody } from "../../validators";
import { updateCustomerProfileSchema } from "../../validators/customer.validator";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";
import { uploadSingle, handleMulterError } from "../../utils/helpers/multer";

const router = express.Router();

router.use(authenticate, authorizeRoles("CUSTOMER"));

router.get("/profile", CustomerController.getProfile);

router.put(
  "/profile",
  uploadSingle,
  handleMulterError,
  validateRequestBody(updateCustomerProfileSchema),
  CustomerController.updateProfile
);

export default router;