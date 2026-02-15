import { prisma } from "../config/database.js";
import { paginate, paginationMeta } from "../utils/pagination.js";

export const activityService = {
  /** Get activity log for a board, optionally filtered by task. */
  async getActivityLog(
    boardId: string,
    options: { task_id?: string; page?: number; limit?: number },
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;

    const where: { board_id: string; task_id?: string } = { board_id: boardId };
    if (options.task_id) where.task_id = options.task_id;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
          task: { select: { id: true, title: true } },
        },
        orderBy: { created_at: "desc" },
        ...paginate({ page, limit }),
      }),
      prisma.activityLog.count({ where }),
    ]);

    return { logs, pagination: paginationMeta(page, limit, total) };
  },
};
