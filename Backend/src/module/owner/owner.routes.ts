import express from "express";
import { OwnerController } from "./owner.controller";
import { validateRequestBody } from "../../validators";
import { updateOwnerProfileSchema } from "../../validators/owner.validator";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorizeRoles } from "../../middlewares/role.middleware";

const router = express.Router();

router.use(authenticate, authorizeRoles("OWNER"));

router.get("/profile", OwnerController.getProfile);

router.put("/profile", validateRequestBody(updateOwnerProfileSchema), OwnerController.updateProfile);

export default router;