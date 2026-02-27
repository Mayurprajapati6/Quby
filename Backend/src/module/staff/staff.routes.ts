// ─────────────────────────────────────────────────────────────────────────────
// MODULE : staff
// FILE   : staff.routes.ts
// CHANGE : PATCH /profile now uses uploadSingle + handleMulterError before controller
//          Avatar arrives as multipart/form-data field "image"
// ─────────────────────────────────────────────────────────────────────────────

import express                   from "express";
import { StaffController }       from "./staff.controller";
import { validateRequestBody }   from "../../validators";
import { updateStaffProfileSchema } from "../../validators/staff.validator";
import { authenticate }          from "../../middlewares/auth.middleware";
import { authorizeRoles }        from "../../middlewares/role.middleware";
import { uploadSingle, handleMulterError } from "../../utils/helpers/multer";

const router = express.Router();

router.use(authenticate, authorizeRoles("STAFF"));

router.get("/profile", StaffController.getProfile);

router.patch(
  "/profile",
  uploadSingle,                               
  handleMulterError,                        
  validateRequestBody(updateStaffProfileSchema),
  StaffController.updateProfile
);

export default router;