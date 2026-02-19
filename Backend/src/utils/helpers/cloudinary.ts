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
  REVIEWS:    "reviews",
} as const;

export type CloudinaryFolder = keyof typeof CLOUDINARY_FOLDERS;

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; 
const ALLOWED_FORMATS     = ["jpg", "jpeg", "png", "webp"];

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

function validateImageFile(file: string): void {
  if (!file.startsWith("data:image/")) {
    throw new BadRequestError("Invalid file. Must be a base64 encoded image.");
  }

  const base64Data = file.split(",")[1];
  if (!base64Data) {
    throw new BadRequestError("Invalid base64 image data.");
  }

  const sizeInBytes = (base64Data.length * 3) / 4;
  if (sizeInBytes > MAX_FILE_SIZE_BYTES) {
    throw new BadRequestError(
      `Image size exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`
    );
  }

  const formatMatch = file.match(/data:image\/(\w+);/);
  const format = formatMatch?.[1] ?? null;

  if (!format || !ALLOWED_FORMATS.includes(format)) {
    throw new BadRequestError(
      `Unsupported format. Allowed: ${ALLOWED_FORMATS.join(", ")}.`
    );
  }
}

export async function uploadImage(
  file: string,
  folder: CloudinaryFolder = "PROFILES"
): Promise<UploadResult> {
  validateImageFile(file);

  try {
    const result = await cloudinary.uploader.upload(file, {
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
    });

    return {
      secure_url:    result.secure_url,
      public_id:     result.public_id,
      format:        result.format,
      width:         result.width,
      height:        result.height,
      bytes:         result.bytes,
      thumbnail_url: result.eager?.[0]?.secure_url,
      medium_url:    result.eager?.[1]?.secure_url,
    };
  } catch (error: any) {
    if (error instanceof BadRequestError) throw error;
    console.error("[Cloudinary] Upload error:", error);
    throw new BadRequestError(`Image upload failed: ${error.message ?? "Unknown error"}`);
  }
}

export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  if (!publicId) throw new BadRequestError("Public ID is required.");

  try {
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === "ok")        return true;
    if (result.result === "not found") return true; // Already gone — treat as success

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