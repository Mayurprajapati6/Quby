import { prisma } from "../../config/prisma";
import { UpdateStaffProfileRepoDTO } from "./staff.types";

export class StaffRepository {

    static async findByUserId(userId: string) {
        return prisma.staff.findUnique({
            where: { user_id: userId },
            include: {
                user: {
                    select: { email: true },
                },
                business: {
                    select: {
                        id:            true,
                        business_name: true,
                        business_type: true,
                        city:          true,
                        state:         true,
                    },
                },
                services: {
                    where: { is_available: true },
                    include: {
                        service_offering: {
                            select: {
                                price: true,
                                platform_service: {
                                    select: { name: true },
                                },
                            },
                        },
                    },
                },
                schedules: {
                    orderBy: { day_of_week: "asc" },
                },
            },
        });
    }

    static async findAvatarById(staffId: string) {
        return prisma.staff.findUnique({
            where:  { id: staffId },
            select: { id: true, avatar_url: true },
        });
    }

    static async updateProfile(staffId: string, data: UpdateStaffProfileRepoDTO) {
        return prisma.staff.update({
            where: { id: staffId },
            data: {
                ...(data.avatar_url       !== undefined && { avatar_url:       data.avatar_url }),
                ...(data.bio              !== undefined && { bio:              data.bio }),
                ...(data.experience_years !== undefined && { experience_years: data.experience_years }),
            },
        });
    }
}