import { v2 as cloudinary } from "cloudinary";
import { serverConfig } from "../../config";
import { BadRequestError } from "../errors/app.error";

cloudinary.config({
  cloud_name: serverConfig.CLOUDINARY_CLOUD_NAME,
  api_key:    serverConfig.CLOUDINARY_API_KEY,
  api_secret: serverConfig.CLOUDINARY_API_SECRET,
});

export const CLOUDINARY_FOLDERS = {
  PROFILES:   "profiles",
  BUSINESSES: "businesses",
  SERVICES:   "services",
  REVIEWS:    "reviews",
} as const;

export type CloudinaryFolder = keyof typeof CLOUDINARY_FOLDERS;

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIMETYPES   = ["image/jpeg", "image/png", "image/webp"];
export interface UploadResult {
  secure_url:    string;
  public_id:     string;
  format:        string;
  width:         number;
  height:        number;
  bytes:         number;
  thumbnail_url: string | undefined;
  medium_url:    string | undefined;
}
export interface BulkDeleteResult {
  success: string[];
  failed:  string[];
}

export function validateImageBuffer(file: Express.Multer.File): void {
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    throw new BadRequestError(
      `Unsupported format. Allowed: ${ALLOWED_MIMETYPES.join(", ")}.`
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new BadRequestError(
      `Image size exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`
    );
  }
}

export async function uploadImageBuffer(
  file: Express.Multer.File,
  folder: CloudinaryFolder = "PROFILES"
): Promise<UploadResult> {
  validateImageBuffer(file);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:        CLOUDINARY_FOLDERS[folder],
        resource_type: "image",
        transformation: [
          { width: 1920, height: 1080, crop: "limit" },
          { quality: "auto:good" },
          { fetch_format: "auto" },
        ],
        eager: [
          { width: 400, height: 300, crop: "fill", quality: "auto:good" }, // thumbnail
          { width: 800, height: 600, crop: "fill", quality: "auto:good" }, // medium
        ],
        eager_async: true,
      },
      (error, result) => {
        if (error || !result) {
          return reject(new BadRequestError(`Image upload failed: ${error?.message ?? "Unknown error"}`));
        }
        resolve({
          secure_url:    result.secure_url,
          public_id:     result.public_id,
          format:        result.format,
          width:         result.width,
          height:        result.height,
          bytes:         result.bytes,
          thumbnail_url: result.eager?.[0]?.secure_url,
          medium_url:    result.eager?.[1]?.secure_url,
        });
      }
    );

    uploadStream.end(file.buffer);
  });
}

export async function uploadMultipleImageBuffers(
  files: Express.Multer.File[],
  folder: CloudinaryFolder = "BUSINESSES"
): Promise<UploadResult[]> {
  return Promise.all(files.map((file) => uploadImageBuffer(file, folder)));
}

export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  if (!publicId) throw new BadRequestError("Public ID is required.");

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result === "ok")        return true;
    if (result.result === "not found") return true; 
    console.error(`[Cloudinary] Delete failed for ${publicId}:`, result);
    return false;
  } catch (error: any) {
    console.error("[Cloudinary] Delete error:", error);
    throw new BadRequestError(`Image deletion failed: ${error.message ?? "Unknown error"}`);
  }
}

export async function bulkDeleteFromCloudinary(publicIds: string[]): Promise<BulkDeleteResult> {
  const results: BulkDeleteResult = { success: [], failed: [] };

  await Promise.allSettled(
    publicIds.map(async (publicId) => {
      try {
        const deleted = await deleteFromCloudinary(publicId);
        deleted ? results.success.push(publicId) : results.failed.push(publicId);
      } catch {
        results.failed.push(publicId);
      }
    })
  );

  return results;
}

export function getOptimizedImageUrl(
  publicId: string,
  width?: number,
  height?: number
): string {
  const transformations: string[] = [];
  if (width || height) {
    transformations.push(`w_${width ?? "auto"},h_${height ?? "auto"},c_fill`);
  }
  transformations.push("q_auto:good", "f_auto");
  return cloudinary.url(publicId, { transformation: transformations, secure: true });
}

export function getResponsiveImageUrls(publicId: string) {
  return {
    thumbnail: getOptimizedImageUrl(publicId, 400, 300),
    small:     getOptimizedImageUrl(publicId, 640, 480),
    medium:    getOptimizedImageUrl(publicId, 1024, 768),
    large:     getOptimizedImageUrl(publicId, 1920, 1080),
    original:  cloudinary.url(publicId, { secure: true }),
  };
}

export function extractPublicId(url: string): string | undefined {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(\.\w+)?$/);
    return match?.[1];
  } catch {
    return undefined;
  }
}