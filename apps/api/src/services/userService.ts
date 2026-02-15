import { prisma } from "../config/database.js";

// ─── User Service ──────────────────────────────────────────────────────

export const userService = {
  /**
   * Search for users by email or name.
   * Returns profiles matching the query string (case-insensitive).
   * Excludes the requesting user from results.
   */
  async searchUsers(query: string, requesterId: string, limit: number = 10) {
    const q = query.trim().toLowerCase();

    const users = await prisma.profile.findMany({
      where: {
        id: { not: requesterId },
        is_active: true,
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { first_name: { contains: q, mode: "insensitive" } },
          { last_name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        avatar_url: true,
      },
      take: limit,
      orderBy: { first_name: "asc" },
    });

    return users;
  },
};
