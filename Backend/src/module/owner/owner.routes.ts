import express from "express";
import { OwnerController } from "./owner.controller";
import { validateRequestBody } from "../../validators";
import { updateOwnerProfileSchema } from "../../validators/owner.validator";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";
import { uploadSingle, handleMulterError } from "../../utils/helpers/multer";

const router = express.Router();

router.use(authenticate, authorizeRoles("OWNER"));

router.get("/profile", OwnerController.getProfile);

router.put(
  "/profile",
  uploadSingle,
  handleMulterError,
  validateRequestBody(updateOwnerProfileSchema),
  OwnerController.updateProfile
);

export default router;