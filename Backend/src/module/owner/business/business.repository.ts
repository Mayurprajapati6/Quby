import { prisma } from "../../../config/prisma";
import { Prisma } from "../../../../generated/prisma/client";

const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"] as const;

export class BusinessRepository {

  static async findByOwnerAndId(businessId: string, ownerId: string) {
    return prisma.business.findFirst({
      where: { id: businessId, owner_id: ownerId },
      include: {
        images:    { orderBy: { sort_order: "asc" } },
        schedules: { orderBy: { day_of_week: "asc" } },
      },
    });
  }

  static async findBySlug(slug: string) {
    return prisma.business.findUnique({
      where: { slug },
      include: {
        images:    { orderBy: { sort_order: "asc" } },
        schedules: { orderBy: { day_of_week: "asc" } },
      },
    });
  }

  static async findAllByOwner(ownerId: string) {
    return prisma.business.findMany({
      where:   { owner_id: ownerId },
      include: {
        images:    { where: { is_primary: true } },
        schedules: true,
      },
      orderBy: { created_at: "desc" },
    });
  }

  static async createWithTransaction(data: {
    ownerId:        string;
    slug:           string;
    business_name:  string;
    business_type:  "SALON";
    service_for:    "MEN" | "UNISEX";
    description?:   string;
    address_line1:  string;
    address_line2?: string;
    city:           string;
    state:          string;
    pincode:        string;
    latitude?:      number;
    longitude?:     number;
    business_email?: string;
    business_phone?: string;
    website_url?:   string;
    images: Array<{
      image_url:     string;
      public_id?:    string;
      is_primary:    boolean;
      sort_order:    number;
    }>;
  }) {
    return prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          owner_id:      data.ownerId,
          slug:          data.slug,
          business_name: data.business_name,
          business_type: data.business_type,
          service_for:   data.service_for,
          description:   data.description,
          address_line1: data.address_line1,
          address_line2: data.address_line2,
          city:          data.city,
          state:         data.state,
          pincode:       data.pincode,
          latitude:      data.latitude,
          longitude:     data.longitude,
          business_email: data.business_email,
          business_phone: data.business_phone,
          website_url:   data.website_url,
        },
      });

      await tx.businessSchedule.createMany({
        data: DAYS.map((day) => ({
          business_id: business.id,
          day_of_week: day,
          is_open:     false,
          open_time:   null,
          close_time:  null,
        })),
      });

      await tx.businessImage.createMany({
        data: data.images.map((img) => ({
          business_id:   business.id,
          image_url:     img.image_url,
          public_id:     img.public_id,
          is_primary:    img.is_primary,
          sort_order:    img.sort_order,
        })),
      });

      await tx.owner.update({
        where: { id: data.ownerId },
        data:  { total_businesses: { increment: 1 } },
      });

      return business;
    });
  }

  static async update(businessId: string, data: Prisma.BusinessUpdateInput) {
    return prisma.business.update({ where: { id: businessId }, data });
  }

  static async submitForVerification(businessId: string) {
    return prisma.business.update({
      where: { id: businessId },
      data:  { is_active: true },
    });
  }

  static async findPendingVerification(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where:   { is_verified: false, is_active: true },
        include: {
          owner:  { select: { name: true, phone: true, user: { select: { email: true } } } },
          images: { where: { is_primary: true } },
        },
        orderBy: { created_at: "asc" },
        skip,
        take:    limit,
      }),
      prisma.business.count({ where: { is_verified: false, is_active: true } }),
    ]);
    return { businesses, total };
  }

  static async findByIdForAdmin(id: string) {
    return prisma.business.findUnique({
      where:   { id },
      include: {
        owner:     { include: { user: { select: { email: true } } } },
        images:    { orderBy: { sort_order: "asc" } },
        schedules: true,
        services:  { include: { platform_service: true } },
      },
    });
  }

  static async approveWithTransaction(businessId: string, ownerId: string) {
    return prisma.$transaction(async (tx) => {
      const business = await tx.business.update({
        where: { id: businessId },
        data:  { is_verified: true, verified_at: new Date() },
      });

      await tx.businessWallet.create({
        data: { business_id: businessId, balance: 0, currency: "INR" },
      });

      await tx.businessNotification.create({
        data: {
          business_id: businessId,
          type:        "BUSINESS_VERIFIED",
          title:       "Business Approved!",
          message:     `${business.business_name} is now live on the platform.`,
          data:        { businessId, slug: business.slug },
        },
      });

      await tx.owner.update({
        where: { id: ownerId },
        data:  { active_businesses: { increment: 1 } },
      });

      return business;
    });
  }

  static async reject(businessId: string, reason: string) {
    return prisma.business.update({
      where: { id: businessId },
      data:  {
        is_verified:       false,
        verification_note: reason,
      },
    });
  }
}