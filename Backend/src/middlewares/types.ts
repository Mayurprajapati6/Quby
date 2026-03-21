import { Request } from "express";
import type { JwtPayload } from "../module/auth/auth.types";

export type { JwtPayload };

export interface AuthRequest extends Request {
  user?: JwtPayload;
}