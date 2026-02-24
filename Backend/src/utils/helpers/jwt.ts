import jwt, { JwtPayload as LibJwtPayload, SignOptions } from "jsonwebtoken";
import { serverConfig } from "../../config";
import { JwtPayload } from "../../module/auth/auth.types";
import { UnauthorizedError } from "../errors/app.error";

const ACCESS_SECRET = serverConfig.JWT_SECRET!;
const REFRESH_SECRET = serverConfig.JWT_REFRESH_SECRET!;

const ACCESS_EXPIRES_IN =
  serverConfig.JWT_ACCESS_SECRET_EXPIRES_IN as SignOptions["expiresIn"];
const REFRESH_EXPIRES_IN =
  serverConfig.JWT_REFRESH_SECRET_EXPIRES_IN as SignOptions["expiresIn"];

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JwtPayload {
  return verify(token, ACCESS_SECRET);
}

export function verifyRefreshToken(token: string): JwtPayload {
  return verify(token, REFRESH_SECRET);
}

function verify(token: string, secret: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded === "string") {
      throw new UnauthorizedError("Invalid token.");
    }

    const payload = decoded as LibJwtPayload & JwtPayload;

    if (!payload.userId || !payload.role || payload.version === undefined) {
      throw new UnauthorizedError("Invalid token payload.");
    }

    return {
      userId: payload.userId,
      role: payload.role,
      version: payload.version,
    };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Invalid or expired token.");
  }
}