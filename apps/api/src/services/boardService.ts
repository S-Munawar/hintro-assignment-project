import { prisma } from "../config/database.js";
import { createError } from "../middleware/errorHandler.js";
import { paginate, paginationMeta } from "../utils/pagination.js";
import type { Prisma, BoardRole } from "@prisma/client";

// ─── Board Service ─────────────────────────────────────────────────────

export const boardService = {
  /** Fetch all boards the user owns or is a member of, paginated. */
  async getBoardsForUser(userId: string, page: number, limit: number) {
    const where: Prisma.BoardWhereInput = {
      OR: [
        { owner_id: userId },
        { members: { some: { user_id: userId } } },
      ],
    };

    const [boards, total] = await Promise.all([
      prisma.board.findMany({
        where,
        include: {
          owner: { select: { id: true, first_name: true, last_name: true, email: true } },
          _count: { select: { members: true, lists: true } },
        },
        orderBy: { created_at: "desc" },
        ...paginate({ page, limit }),
      }),
      prisma.board.count({ where }),
    ]);

    return { boards, pagination: paginationMeta(page, limit, total) };
  },

  /** Create a new board with a default "To Do" list. */
  async createBoard(userId: string, data: { name: string; description?: string | null; color?: string }) {
    const board = await prisma.board.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? "#4472C4",
        owner_id: userId,
        // Create default lists
        lists: {
          createMany: {
            data: [
              { name: "To Do", position: 0 },
              { name: "In Progress", position: 1 },
              { name: "Done", position: 2 },
            ],
          },
        },
      },
      include: {
        lists: { orderBy: { position: "asc" } },
        owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        board_id: board.id,
        user_id: userId,
        action_type: "create",
        entity_type: "board",
        changes: { name: board.name },
      },
    });

    return board;
  },

  /** Get a single board with all lists and their tasks. */
  async getBoardWithLists(boardId: string) {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        owner: { select: { id: true, first_name: true, last_name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, first_name: true, last_name: true, email: true, avatar_url: true } },
          },
        },
        lists: {
          orderBy: { position: "asc" },
          include: {
            tasks: {
              orderBy: { position: "asc" },
              include: {
                creator: { select: { id: true, first_name: true, last_name: true } },
                assignees: {
                  include: {
                    user: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!board) {
      throw createError(404, "NOT_FOUND", "Board not found");
    }

    return board;
  },

  /** Update board fields. Only the owner can update. */
  async updateBoard(boardId: string, userId: string, data: { name?: string; description?: string | null; color?: string; is_archived?: boolean }) {
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) throw createError(404, "NOT_FOUND", "Board not found");
    if (board.owner_id !== userId) throw createError(403, "FORBIDDEN", "Only the board owner can update this board");

    const updated = await prisma.board.update({
      where: { id: boardId },
      data,
      include: {
        owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        board_id: boardId,
        user_id: userId,
        action_type: "update",
        entity_type: "board",
        changes: data as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  },

  /** Delete a board. Only the owner can delete. */
  async deleteBoard(boardId: string, userId: string) {
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) throw createError(404, "NOT_FOUND", "Board not found");
    if (board.owner_id !== userId) throw createError(403, "FORBIDDEN", "Only the board owner can delete this board");

    await prisma.board.delete({ where: { id: boardId } });
  },

  /** Add a member to a board. */
  async addMember(boardId: string, userId: string, newMemberId: string, role: string = "editor") {
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) throw createError(404, "NOT_FOUND", "Board not found");

    // Only owner or admin can add members
    if (board.owner_id !== userId) {
      const requester = await prisma.boardMember.findUnique({
        where: { board_id_user_id: { board_id: boardId, user_id: userId } },
      });
      if (!requester || requester.role !== "admin") {
        throw createError(403, "FORBIDDEN", "Only the owner or admin can add members");
      }
    }

    // Check target user exists
    const targetUser = await prisma.profile.findUnique({ where: { id: newMemberId } });
    if (!targetUser) throw createError(404, "NOT_FOUND", "User not found");

    // Prevent adding owner as member
    if (newMemberId === board.owner_id) {
      throw createError(400, "BAD_REQUEST", "Cannot add the board owner as a member");
    }

    const member = await prisma.boardMember.create({
      data: {
        board_id: boardId,
        user_id: newMemberId,
        role: (role as BoardRole) ?? "editor",
      },
      include: {
        user: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        board_id: boardId,
        user_id: userId,
        action_type: "create",
        entity_type: "board",
        changes: { action: "member_added", member_id: newMemberId, role },
      },
    });

    return member;
  },

  /** Remove a member from a board. */
  async removeMember(boardId: string, userId: string, targetUserId: string) {
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) throw createError(404, "NOT_FOUND", "Board not found");

    // Owner can remove anyone; admins can remove editors/viewers; members can remove themselves
    if (board.owner_id !== userId && userId !== targetUserId) {
      const requester = await prisma.boardMember.findUnique({
        where: { board_id_user_id: { board_id: boardId, user_id: userId } },
      });
      if (!requester || requester.role !== "admin") {
        throw createError(403, "FORBIDDEN", "Insufficient permissions to remove members");
      }
    }

    // Cannot remove the owner
    if (targetUserId === board.owner_id) {
      throw createError(400, "BAD_REQUEST", "Cannot remove the board owner");
    }

    const member = await prisma.boardMember.findUnique({
      where: { board_id_user_id: { board_id: boardId, user_id: targetUserId } },
    });
    if (!member) throw createError(404, "NOT_FOUND", "Member not found");

    await prisma.boardMember.delete({
      where: { id: member.id },
    });

    await prisma.activityLog.create({
      data: {
        board_id: boardId,
        user_id: userId,
        action_type: "delete",
        entity_type: "board",
        changes: { action: "member_removed", member_id: targetUserId },
      },
    });
  },
};
