import multer from "multer";
import { BadRequestError } from "../errors/app.error";

const ALLOWED_MIMETYPES   = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES  = 5 * 1024 * 1024; // 5MB per file

const storage = multer.memoryStorage();

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError(`Unsupported format. Allowed: jpeg, png, webp.`) as any);
  }
}

export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single("image");

export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files:    10,
  },
}).array("images", 10);

import { Request, Response, NextFunction } from "express";

export function handleMulterError(
  err: any,
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(new BadRequestError("File too large. Maximum size is 5MB."));
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return next(new BadRequestError("Too many files. Maximum is 10 images."));
    }
    return next(new BadRequestError(`Upload error: ${err.message}`));
  }
  next(err);
}