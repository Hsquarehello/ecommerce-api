import type { Role } from "../generated/prisma/enums.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        role: Role;
      };
    }
  }
}

export {};
