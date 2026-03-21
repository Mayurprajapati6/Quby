import { prisma } from "../../config/prisma";

const MAX_SLUG_LENGTH = 200;
const MAX_ATTEMPTS    = 100;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")   
    .replace(/\s+/g, "-")            
    .replace(/-+/g, "-")             
    .replace(/^-|-$/g, "");         
}

export async function generateUniqueSlug(
  businessName: string,
  city:         string,
): Promise<string> {
  const base = `${slugify(businessName)}-${slugify(city)}`
    .replace(/-+/g, "-")       
    .replace(/^-|-$/g, "")    
    .slice(0, MAX_SLUG_LENGTH) || "business";

  let slug    = base;
  let counter = 2;

  while (counter <= MAX_ATTEMPTS + 2) {
    const existing = await prisma.business.findUnique({
      where:  { slug },
      select: { id: true },   
    });

    if (!existing) return slug;

    
    slug = `${base}-${counter}`;
    counter++;
  }

  throw new Error(
    `Could not generate unique slug for "${businessName}" after ${MAX_ATTEMPTS} attempts.`
  );
}

