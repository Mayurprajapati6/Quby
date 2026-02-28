import express from "express";
import { BusinessServicesController } from "./business-services.controller";
import { validateRequestBody } from "../../../validators";
import { addBusinessServiceSchema, updateBusinessServiceSchema } from "../../../validators/business-services.validator";

const router = express.Router({ mergeParams: true });

router.get("/",BusinessServicesController.list);
router.post("/",validateRequestBody(addBusinessServiceSchema), BusinessServicesController.add);
router.patch("/:offeringId",validateRequestBody(updateBusinessServiceSchema), BusinessServicesController.update);
router.delete("/:offeringId",BusinessServicesController.remove);

export default router;