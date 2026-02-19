import { Request } from "express";
import { JwtPayload } from "../module/auth/auth.types"

export interface AuthRequest extends Request {
  user?: JwtPayload;
}