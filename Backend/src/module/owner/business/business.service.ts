import { BusinessRepository }  from './business.repository';
import {uploadMultipleImageBuffers, bulkDeleteFromCloudinary} from '../../../utils/helpers/cloudinary';
import { generateUniqueSlug } from '../../../utils/helpers/slug.helper';
import { redisClient } from '../../../config/redis';
import { socketService } from '../../../socket/socket.service';
import { queueEmail } from '../../../services/email.services';
import { prisma } from '../../../config/prisma';
import { NotFoundError, BadRequestError } from '../../../utils/errors/app.error';
import { BUSINESS_MESSAGES } from '../../../constants/messages';
import {CreateBusinessDTO, UpdateBusinessDTO, BusinessDTO}  from './business.types';
import logger from '../../../config/logger.config';

async function invalidateBusinessCache(slug: string): Promise<void> {
  try {
    await redisClient.del(`cache:business:${slug}`);
  } catch (err) {
    logger.warn('[Business] Cache invalidation failed (non-fatal):', err);
  }
}

export class BusinessService {

  static async create(
    ownerId:    string,
    data:       CreateBusinessDTO,
    imageFiles: Express.Multer.File[]
  ): Promise<BusinessDTO> {
    if (!imageFiles || imageFiles.length < 3) {
      throw new BadRequestError('At least 3 business images are required.');
    }
    if (imageFiles.length > 10) {
      throw new BadRequestError('Maximum 10 images allowed.');
    }

    const slug = await generateUniqueSlug(data.business_name, data.city);

    let rawUploads: Awaited<ReturnType<typeof uploadMultipleImageBuffers>>;
    try {
      rawUploads = await uploadMultipleImageBuffers(imageFiles, 'BUSINESSES');
    } catch (err: any) {
      throw new BadRequestError(`Image upload failed: ${err.message}`);
    }

    const uploadedImages = rawUploads.map((result, i) => ({
      image_url:  result.secure_url,
      public_id:  result.public_id,
      is_primary: i === 0,
      sort_order: i,
    }));

    try {
      const business = await BusinessRepository.createWithTransaction({
        ownerId,
        slug,
        business_name:  data.business_name,
        business_type:  'SALON',
        service_for:    data.service_for,
        description:    data.description,
        address_line1:  data.address_line1,
        address_line2:  data.address_line2,
        city:           data.city,
        state:          data.state,
        pincode:        data.pincode,
        latitude:       data.latitude,
        longitude:      data.longitude,
        business_email: data.business_email,
        business_phone: data.business_phone,
        website_url:    data.website_url,
        images:         uploadedImages,
      });

      const full = await BusinessRepository.findByOwnerAndId(business.id, ownerId);
      return full as unknown as BusinessDTO;
    } catch (err) {
      bulkDeleteFromCloudinary(uploadedImages.map((i) => i.public_id)).catch((e) =>
        logger.error('[Business] Cloudinary rollback after DB failure failed:', e)
      );
      throw err;
    }
  }

  static async getMyBusinesses(ownerId: string): Promise<BusinessDTO[]> {
    const businesses = await BusinessRepository.findAllByOwner(ownerId);
    return businesses as unknown as BusinessDTO[];
  }

  static async getOne(businessId: string, ownerId: string): Promise<BusinessDTO> {
    const business = await BusinessRepository.findByOwnerAndId(businessId, ownerId);
    if (!business) throw new NotFoundError(BUSINESS_MESSAGES.NOT_FOUND);
    return business as unknown as BusinessDTO;
  }

  static async update(
    businessId: string,
    ownerId:    string,
    data:       UpdateBusinessDTO
  ): Promise<BusinessDTO> {
    const business = await BusinessRepository.findByOwnerAndId(businessId, ownerId);
    if (!business) throw new NotFoundError(BUSINESS_MESSAGES.NOT_FOUND);

    await BusinessRepository.update(businessId, {
      ...(data.business_name  && { business_name:  data.business_name }),
      ...(data.description    !== undefined && { description:    data.description }),
      ...(data.address_line1  && { address_line1:  data.address_line1 }),
      ...(data.address_line2  !== undefined && { address_line2:  data.address_line2 }),
      ...(data.city           && { city:           data.city }),
      ...(data.state          && { state:          data.state }),
      ...(data.pincode        && { pincode:        data.pincode }),
      ...(data.latitude       !== undefined && { latitude:       data.latitude }),
      ...(data.longitude      !== undefined && { longitude:      data.longitude }),
      ...(data.business_email !== undefined && { business_email: data.business_email }),
      ...(data.business_phone !== undefined && { business_phone: data.business_phone }),
      ...(data.website_url    !== undefined && { website_url:    data.website_url }),
    });

    await invalidateBusinessCache(business.slug);

    const full = await BusinessRepository.findByOwnerAndId(businessId, ownerId);
    return full as unknown as BusinessDTO;
  }

  static async submitForVerification(
    businessId: string,
    ownerId:    string
  ): Promise<void> {
    const business = await BusinessRepository.findByOwnerAndId(businessId, ownerId);
    if (!business) throw new NotFoundError(BUSINESS_MESSAGES.NOT_FOUND);
    if (business.is_verified) throw new BadRequestError(BUSINESS_MESSAGES.ALREADY_VERIFIED);

    await BusinessRepository.submitForVerification(businessId);
    await invalidateBusinessCache(business.slug);

    try {
      const admins = await prisma.admin.findMany({
        include: {
          user: { select: { id: true, email: true } },
        },
      });

      const ownerName = (business as any).owner?.name ?? 'Unknown';

      for (const admin of admins) {
        socketService.notifyNew(admin.user.id, {
          type:    'NEW_BUSINESS_SUBMISSION',
          title:   'New Business Submitted',
          message: `${business.business_name} has been submitted for verification`,
          data: {
            businessId,
            businessName: business.business_name,
            ownerName,
            submittedAt:  new Date().toISOString(),
          },
        } as any);
        await queueEmail({
          to:   admin.user.email,
          type: 'business-submitted',
          data: {
            adminName:    admin.name,
            businessName: business.business_name,
            businessId,
            ownerName,
          },
        });
      }
    } catch (err) {
      logger.warn('[Business] Admin notification failed (non-fatal):', err);
    }
  }
}