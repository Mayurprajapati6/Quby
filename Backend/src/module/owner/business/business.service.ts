import { prisma } from "../../../config/prisma";
import { OwnerBusinessRepository as Repo } from "./business.repository";
import { AuthRepository } from "../../../module/auth/auth.repository";
import { generateUniqueSlug } from "../../../utils/helpers/slug";
import {
  uploadImageBuffer,
  deleteFromCloudinary,
  bulkDeleteFromCloudinary,
} from "../../../utils/helpers/cloudinary";
import { queueEmail } from "../../../services/email.services";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from "../../../utils/errors/app.error";
import logger from "../../../config/logger.config";
import { formatInTimeZone } from "date-fns-tz";
import type { CreateBusinessDTO, UpdateBusinessDTO } from "./business.types";

const IST = "Asia/Kolkata";

function toIST(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
export class BusinessService {

  private static async resolveOwner(userId: string) {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: userId },
      select: { id: true, name: true, user: { select: { email: true } } },
    });
    if (!owner) throw new NotFoundError("Owner profile not found.");
    return owner;
  }

  static async listMyBusinesses(
    userId:  string,
    filters: { name?: string; city?: string; state?: string },
    page:    number,
    limit:   number,
  ) {
    const owner = await this.resolveOwner(userId);
    const { businesses, total } = await Repo.findAllByOwnerId(owner.id, filters, page, limit);

    return {
      businesses: businesses.map(b => ({
        id:                 b.id,
        business_name:      b.business_name,
        slug:               b.slug,
        city:               b.city,
        state:              b.state,
        service_for:        b.service_for,
        primary_image:      b.primary_image,
        logo_url:           b.logo_url          ?? null,
        is_active:          b.is_active,
        average_rating:      b.average_rating    ?? 0,
        total_reviews:       b.total_reviews,
        active_staff_count:  b.active_staff_count,
        total_earning_inr:   (b.settled_earning ?? 0) / 100,
        today_bookings:      b.today_bookings,
        is_verified:         b.is_verified,
        verification_status: b.is_verified ? "VERIFIED" : null,
        created_at:          toIST(b.created_at),
      })),
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  static async getMyBusiness(userId: string, businessId: string) {
    const owner    = await this.resolveOwner(userId);
    const business = await Repo.findByOwnerAndId(owner.id, businessId);
    if (!business) throw new NotFoundError("Business not found.");
    return business;
  }

  static async createBusiness(
    userId:     string,
    dto:        CreateBusinessDTO,
    logoFile?:  Express.Multer.File,
    coverFile?: Express.Multer.File,
  ) {
    const owner = await this.resolveOwner(userId);

    const slug = await generateUniqueSlug(dto.business_name, dto.city);

    let logo_url:        string | undefined;
    let cover_image_url: string | undefined;

    if (logoFile) {
      const r  = await uploadImageBuffer(logoFile, "BUSINESSES");
      logo_url = r.secure_url;
    }
    if (coverFile) {
      const r         = await uploadImageBuffer(coverFile, "BUSINESSES");
      cover_image_url = r.secure_url;
    }

    const business = await Repo.create({
      ownerId:           owner.id,
      business_name:     dto.business_name,
      slug,
      business_type:     dto.business_type ?? "SALON",
      service_for:       dto.service_for,
      description:       dto.description,
      address_line1:     dto.address_line1,
      address_line2:     dto.address_line2,
      city:              dto.city,
      state:             dto.state,
      pincode:           dto.pincode,
      country:           dto.country ?? "India",
      latitude:          dto.latitude,
      longitude:         dto.longitude,
      map_link:          dto.map_link,
      business_phone:    dto.business_phone,
      website_url:       dto.website_url,
      instagram_url:     dto.instagram_url,
      facebook_url:      dto.facebook_url,
      twitter_url:       dto.twitter_url,
      youtube_url:       dto.youtube_url,
      whatsapp_number:   dto.whatsapp_number,
      logo_url,
      cover_image_url,
      break_time_minutes:        dto.break_time_minutes        ?? 5,
      cancellation_window_hours: dto.cancellation_window_hours ?? 2,
    });

    await prisma.owner.update({
      where: { id: owner.id },
      data:  { total_businesses: { increment: 1 }, active_businesses: { increment: 1 } },
    });

    return business;
  }

  static async updateBusiness(
    userId:     string,
    businessId: string,
    dto:        UpdateBusinessDTO,
    logoFile?:  Express.Multer.File,
    coverFile?: Express.Multer.File,
  ) {
    const owner    = await this.resolveOwner(userId);
    const business = await Repo.findByOwnerAndId(owner.id, businessId);
    if (!business) throw new NotFoundError("Business not found.");

    let slug = business.slug;
    if (dto.business_name || dto.city) {
      slug = await generateUniqueSlug(
        dto.business_name ?? business.business_name,
        dto.city          ?? business.city,
      );
    }

    let logo_url        = business.logo_url;
    let cover_image_url = business.cover_image_url;

    if (logoFile) {
      if (business.logo_url) {
        const oldId = extractPublicId(business.logo_url);
        if (oldId) await deleteFromCloudinary(oldId).catch(() => {});
      }
      logo_url = (await uploadImageBuffer(logoFile, "BUSINESSES")).secure_url;
    }

    if (coverFile) {
      if (business.cover_image_url) {
        const oldId = extractPublicId(business.cover_image_url);
        if (oldId) await deleteFromCloudinary(oldId).catch(() => {});
      }
      cover_image_url = (await uploadImageBuffer(coverFile, "BUSINESSES")).secure_url;
    }

    return Repo.update(business.id, {
      ...dto,
      slug,
      logo_url,
      cover_image_url,
    });
  }

  static async uploadImages(
    userId:     string,
    businessId: string,
    files:      Express.Multer.File[],
  ) {
    const owner    = await this.resolveOwner(userId);
    const business = await Repo.findByOwnerAndId(owner.id, businessId);
    if (!business) throw new NotFoundError("Business not found.");

    if (!files.length) throw new BadRequestError("No images provided.");

    const existingCount = await Repo.countImages(businessId);
    const MAX_IMAGES    = 10;
    if (existingCount + files.length > MAX_IMAGES) {
      throw new BadRequestError(
        `A business can have at most ${MAX_IMAGES} images. ` +
        `Currently has ${existingCount}, tried to add ${files.length}.`
      );
    }

    const uploads = await Promise.allSettled(
      files.map(f => uploadImageBuffer(f, "BUSINESSES"))
    );

    const created = [];
    for (let i = 0; i < uploads.length; i++) {
      const result = uploads[i];
      if (result.status === "fulfilled") {
        const isPrimary = existingCount === 0 && i === 0;
        const img = await Repo.createImage({
          business_id: businessId,
          image_url:   result.value.secure_url,
          public_id:   result.value.public_id,
          sort_order:  existingCount + i,
          is_primary:  isPrimary,
        });
        created.push(img);
      }
    }

    return created;
  }

  static async deleteImage(userId: string, businessId: string, imageId: string) {
    const owner    = await this.resolveOwner(userId);
    const business = await Repo.findByOwnerAndId(owner.id, businessId);
    if (!business) throw new NotFoundError("Business not found.");

    const image = await Repo.findImage(imageId);
    if (!image || image.business_id !== businessId) throw new NotFoundError("Image not found.");

    if (image.public_id) await deleteFromCloudinary(image.public_id).catch(() => {});
    await Repo.deleteImage(imageId);
  }

  static async setPrimaryImage(userId: string, businessId: string, imageId: string) {
    const owner    = await this.resolveOwner(userId);
    const business = await Repo.findByOwnerAndId(owner.id, businessId);
    if (!business) throw new NotFoundError("Business not found.");

    const image = await Repo.findImage(imageId);
    if (!image || image.business_id !== businessId) throw new NotFoundError("Image not found.");

    await Repo.setImageAsPrimary(businessId, imageId);
    return { primary_image_id: imageId };
  }

  static async deleteBusiness(userId: string, businessId: string) {
    const owner = await this.resolveOwner(userId);

    const business = await Repo.findByIdForDeletion(businessId);
    if (!business) throw new NotFoundError("Business not found.");

    const owned = await prisma.business.findFirst({
      where:  { id: businessId, owner_id: owner.id },
      select: { id: true },
    });
    if (!owned) throw new ForbiddenError("This business does not belong to you.");

    const activeCount = (business as any)._count?.bookings ?? 0;
    if (activeCount > 0) {
      throw new BadRequestError(
        `Cannot delete: ${activeCount} active booking(s) exist. ` +
        "Please wait for all active bookings to complete."
      );
    }

    // Check for active (PAID) payments not yet settled
    const activePaid = await prisma.payment.count({
      where: { business_id: businessId, status: "PAID" },
    });
    if (activePaid > 0) {
      throw new BadRequestError(
        `Cannot delete: ${activePaid} payment(s) are pending settlement. ` +
        "Please wait for all services to complete."
      );
    }

    const publicIds = ((business as any).images ?? [])
      .map((img: any) => img.public_id)
      .filter(Boolean);
    if (publicIds.length) await bulkDeleteFromCloudinary(publicIds).catch(() => {});

    await Repo.delete(businessId);

    await prisma.owner.update({
      where: { id: owner.id },
      data:  { total_businesses: { decrement: 1 }, active_businesses: { decrement: 1 } },
    });
  }


  static async submitForVerification(userId: string, businessId: string) {
    const owner    = await this.resolveOwner(userId);
    const business = await Repo.findByOwnerAndId(owner.id, businessId);
    if (!business) throw new NotFoundError("Business not found.");
    return { business_id: businessId, message: "Business submitted for verification." };
  }

}

function extractPublicId(url: string): string | undefined {
  try {
    const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(\.\w+)?$/);
    return m?.[1];
  } catch { return undefined; }
}