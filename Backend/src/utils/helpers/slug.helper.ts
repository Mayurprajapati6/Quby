import { prisma } from "../../config/prisma";

export async function generateUniqueSlug(
    businessName: string,
    city:         string
): Promise<string> {
    const base = `${businessName}-${city}`
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")   
        .replace(/\s+/g, "-")            
        .replace(/-+/g, "-")             
        .slice(0, 200);                  

    let slug    = base;
    let counter = 2;

    while (true) {
        const existing = await prisma.business.findUnique({ where: { slug } });
        if (!existing) return slug;
        slug = `${base}-${counter}`;
        counter++;
    }
}