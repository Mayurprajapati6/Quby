import { CustomerRepository }  from "./customer.repository";
import { AuthRepository } from "../auth/auth.repository";
import { uploadImageBuffer } from "../../utils/helpers/cloudinary";
import { verifyPassword } from "../../utils/helpers/crypto";
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} from "../../utils/errors/app.error";
import { toCustomerProfile } from "./customer.mapper";
import type {
  UpdateCustomerProfileDTO,
  CustomerProfile,
} from "./customer.types";

export class CustomerService {

  static async getProfile(userId: string): Promise<CustomerProfile> {
    const customer = await CustomerRepository.findByUserId(userId);
    if (!customer) throw new NotFoundError("Customer profile not found.");
    return toCustomerProfile(customer as any);
  }

  static async updateProfile(
    userId:      string,
    data:        UpdateCustomerProfileDTO,
    avatarFile?: Express.Multer.File
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
    if (avatarFile) {
      try {
        const uploaded = await uploadImageBuffer(avatarFile, "PROFILES");
        avatarUrl      = uploaded.secure_url;
      } catch (err: any) {
        throw new BadRequestError(`Avatar upload failed: ${err.message}`);
      }
    }

    const updated = await CustomerRepository.updateProfile(customer.id, {
      ...(data.name          !== undefined && { name:          data.name          }),
      ...(data.phone         !== undefined && { phone:         data.phone         }),
      ...(data.city          !== undefined && { city:          data.city          }),
      ...(data.state         !== undefined && { state:         data.state         }),
      ...(data.gender        !== undefined && { gender:        data.gender        }),
      ...(data.address_line1 !== undefined && { address_line1: data.address_line1 }),
      ...(data.address_line2 !== undefined && { address_line2: data.address_line2 }),
      ...(avatarUrl                        && { avatar_url:    avatarUrl          }),
    });

    return toCustomerProfile(updated as any);
  }

  static async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await AuthRepository.findUserById(userId);
    if (!user)               throw new NotFoundError("Account not found.");
    if (!user.password_hash) throw new BadRequestError("Account setup is incomplete.");

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) throw new UnauthorizedError("Incorrect password. Account deletion cancelled.");

    await AuthRepository.deleteUser(userId);
  }
}
