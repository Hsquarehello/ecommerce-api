import { prisma } from "../../config/prisma.js";

export const authRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  incrementTokenVersion(id: string) {
    return prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
  },

  createUser(input: { name: string; email: string; password: string; rememberMe?: boolean }) {
    return prisma.user.create({ data: input });
  },
};
