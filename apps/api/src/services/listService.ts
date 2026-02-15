import { prisma } from "../config/database.js";
import { createError } from "../middleware/errorHandler.js";
import type { Prisma } from "@prisma/client";

export const listService = {
  /** Create a new list in a board. */
  async createList(boardId: string, userId: string, data: { name: string }) {
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) throw createError(404, "NOT_FOUND", "Board not found");

    // Calculate next position
    const lastList = await prisma.list.findFirst({
      where: { board_id: boardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const nextPosition = (lastList?.position ?? -1) + 1;

    const list = await prisma.list.create({
      data: {
        name: data.name,
        position: nextPosition,
        board_id: boardId,
      },
    });

    await prisma.activityLog.create({
      data: {
        board_id: boardId,
        user_id: userId,
        action_type: "create",
        entity_type: "list",
        changes: { name: list.name, position: list.position },
      },
    });

    return list;
  },

  /** Update a list (name, position). */
  async updateList(listId: string, userId: string, data: { name?: string; position?: number }) {
    const list = await prisma.list.findUnique({
      where: { id: listId },
      select: { id: true, name: true, position: true, board_id: true },
    });
    if (!list) throw createError(404, "NOT_FOUND", "List not found");

    // If position is changing, reorder other lists
    if (data.position !== undefined && data.position !== list.position) {
      await prisma.$transaction(async (tx) => {
        if (data.position! > list.position) {
          await tx.list.updateMany({
            where: {
              board_id: list.board_id,
              position: { gt: list.position, lte: data.position! },
              id: { not: listId },
            },
            data: { position: { decrement: 1 } },
          });
        } else {
          await tx.list.updateMany({
            where: {
              board_id: list.board_id,
              position: { gte: data.position!, lt: list.position },
              id: { not: listId },
            },
            data: { position: { increment: 1 } },
          });
        }

        await tx.list.update({
          where: { id: listId },
          data: { name: data.name, position: data.position },
        });
      });
    } else {
      await prisma.list.update({
        where: { id: listId },
        data: { name: data.name },
      });
    }

    const updated = await prisma.list.findUnique({ where: { id: listId } });

    await prisma.activityLog.create({
      data: {
        board_id: list.board_id,
        user_id: userId,
        action_type: "update",
        entity_type: "list",
        changes: data as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  },

  /** Delete a list and all its tasks. */
  async deleteList(listId: string, userId: string) {
    const list = await prisma.list.findUnique({
      where: { id: listId },
      select: { id: true, name: true, position: true, board_id: true },
    });
    if (!list) throw createError(404, "NOT_FOUND", "List not found");

    await prisma.$transaction(async (tx) => {
      // Delete the list (cascades to tasks via schema)
      await tx.list.delete({ where: { id: listId } });

      // Reorder remaining lists
      await tx.list.updateMany({
        where: {
          board_id: list.board_id,
          position: { gt: list.position },
        },
        data: { position: { decrement: 1 } },
      });
    });

    await prisma.activityLog.create({
      data: {
        board_id: list.board_id,
        user_id: userId,
        action_type: "delete",
        entity_type: "list",
        changes: { name: list.name },
      },
    });
  },
};
