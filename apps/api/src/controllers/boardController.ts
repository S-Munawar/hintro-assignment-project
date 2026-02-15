import type { Request, Response, NextFunction } from "express";
import { boardService } from "../services/boardService.js";

export const boardController = {
  /** GET /api/boards */
  async listBoards(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.validatedQuery || req.query;
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const result = await boardService.getBoardsForUser(req.userId!, page, limit);

      res.json({
        success: true,
        data: result.boards,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/boards */
  async createBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const board = await boardService.createBoard(req.userId!, req.body);

      res.status(201).json({
        success: true,
        data: board,
        message: "Board created successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/boards/:boardId */
  async getBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const boardId = req.params.boardId as string;
      const board = await boardService.getBoardWithLists(boardId);

      res.json({
        success: true,
        data: board,
      });
    } catch (error) {
      next(error);
    }
  },

  /** PUT /api/boards/:boardId */
  async updateBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const boardId = req.params.boardId as string;
      const board = await boardService.updateBoard(boardId, req.userId!, req.body);

      res.json({
        success: true,
        data: board,
        message: "Board updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  /** DELETE /api/boards/:boardId */
  async deleteBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const boardId = req.params.boardId as string;
      await boardService.deleteBoard(boardId, req.userId!);

      res.json({
        success: true,
        message: "Board deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/boards/:boardId/members */
  async addMember(req: Request, res: Response, next: NextFunction) {
    try {
      const boardId = req.params.boardId as string;
      const member = await boardService.addMember(
        boardId,
        req.userId!,
        req.body.user_id,
        req.body.role,
      );

      res.status(201).json({
        success: true,
        data: member,
        message: "Member added successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  /** DELETE /api/boards/:boardId/members/:userId */
  async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      const boardId = req.params.boardId as string;
      const targetUserId = req.params.userId as string;
      await boardService.removeMember(boardId, req.userId!, targetUserId);

      res.json({
        success: true,
        message: "Member removed successfully",
      });
    } catch (error) {
      next(error);
    }
  },
};
