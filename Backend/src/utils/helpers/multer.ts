import multer from "multer";
import { BadRequestError } from "../errors/app.error";
import { Request, Response, NextFunction } from "express";

const ALLOWED_MIMETYPES   = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES  = 5 * 1024 * 1024; 

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

const baseConfig = { storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES } };

function uploadSingleFactory(fieldName?: string): any {
  return multer({ ...baseConfig }).single(fieldName ?? "image");
}

export const uploadSingle = new Proxy(uploadSingleFactory, {
  apply(target, thisArg, args: any[]) {
    if (args.length === 1 && typeof args[0] === "string") {
      return target(args[0]);
    }
    return target("image")(args[0], args[1], args[2]);
  },
}) as any;

export const uploadMultiple = multer({
  ...baseConfig,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 10 },
}).array("images", 10);

export const uploadFields = (
  fields: Array<{ name: string; maxCount: number }>
) =>
  multer({ ...baseConfig }).fields(fields);

export const uploadArray = (fieldName: string, maxCount: number) =>
  multer({ ...baseConfig, limits: { fileSize: MAX_FILE_SIZE_BYTES, files: maxCount } }).array(fieldName, maxCount);

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
