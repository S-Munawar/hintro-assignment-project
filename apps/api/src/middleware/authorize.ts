import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database.js";
import { createError } from "./errorHandler.js";

/**
 * Middleware that checks if the authenticated user is a member of the board
 * specified by :boardId param. Optionally restricts to certain roles.
 */
export function authorize(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const boardId = req.params.boardId as string | undefined;
      const userId = req.userId;

      if (!boardId || !userId) {
        next(createError(400, "BAD_REQUEST", "Missing board ID or user ID"));
        return;
      }

      // Check if user is the board owner
      const board = await prisma.board.findUnique({
        where: { id: boardId },
        select: { owner_id: true },
      });

      if (!board) {
        next(createError(404, "NOT_FOUND", "Board not found"));
        return;
      }

      // Board owner has full access
      if (board.owner_id === userId) {
        next();
        return;
      }

      // Check board membership
      const member = await prisma.boardMember.findUnique({
        where: { board_id_user_id: { board_id: boardId, user_id: userId } },
      });

      if (!member) {
        next(createError(403, "FORBIDDEN", "You are not a member of this board"));
        return;
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(member.role)) {
        next(createError(403, "FORBIDDEN", `Requires one of: ${allowedRoles.join(", ")}`));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
