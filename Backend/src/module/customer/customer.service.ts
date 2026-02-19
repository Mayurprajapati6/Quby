import { CustomerRepository } from "./customer.repository";
import { uploadImage } from "../../utils/helpers/cloudinary";
import { ConflictError, NotFoundError, BadRequestError } from "../../utils/errors/app.error";
import { toCustomerProfile } from "./customer.mapper";
import { UpdateCustomerProfileDTO, CustomerProfile } from "./customer.types";

export class CustomerService {
  static async getProfile(userId: string): Promise<CustomerProfile> {
    const customer = await CustomerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError("Customer profile not found.");

    return toCustomerProfile(customer.user, customer);
  }

  static async updateProfile(
    userId: string,
    data: UpdateCustomerProfileDTO
  ): Promise<CustomerProfile> {
    const customer = await CustomerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError("Customer profile not found.");

    if (data.phone) {
      const existing = await CustomerRepository.findByPhone(data.phone);
      if (existing && existing.id !== customer.id) {
        throw new ConflictError("This phone number is already linked to another account.");
      }
    }

    let avatarUrl: string | undefined;
    if (data.avatar) {
      try {
        const uploaded = await uploadImage(data.avatar, "PROFILES");
        avatarUrl = uploaded.secure_url;
      } catch (error: any) {
        throw new BadRequestError(`Avatar upload failed: ${error.message}`);
      }
    }

    const updated = await CustomerRepository.updateProfile(customer.id, {
      name:      data.name,
      phone:     data.phone,
      city:      data.city,
      state:     data.state,
      gender:    data.gender,
      ...(avatarUrl && { avatar_url: avatarUrl }),
    });

    return toCustomerProfile(customer.user, updated);
  }
}