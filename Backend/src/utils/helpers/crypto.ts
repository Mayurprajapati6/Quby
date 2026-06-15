import bcrypt from "bcryptjs";
import crypto from "crypto";

// Reduced from 12 to 10 for production performance on Render free tier
// 10 rounds = ~100-150ms (vs 12 rounds = 300-500ms on weak CPUs)
// Still secure: 2^10 = 1024 iterations, sufficient for passwords
const SALT_ROUNDS = 10;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(
  plaintext: string,
  hash:      string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateNumericCode(length = 6): string {
  const max = Math.pow(10, length) - 1;
  const min = Math.pow(10, length - 1);
  return crypto.randomInt(min, max + 1).toString();
}