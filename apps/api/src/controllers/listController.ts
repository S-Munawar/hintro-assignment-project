import type { Request, Response, NextFunction } from "express";
import { listService } from "../services/listService.js";

export const listController = {
  /** POST /api/boards/:boardId/lists */
  async createList(req: Request, res: Response, next: NextFunction) {
    try {
      const boardId = req.params.boardId as string;
      const list = await listService.createList(boardId, req.userId!, req.body);

      res.status(201).json({
        success: true,
        data: list,
        message: "List created successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  /** PUT /api/boards/:boardId/lists/:listId */
  async updateList(req: Request, res: Response, next: NextFunction) {
    try {
      const listId = req.params.listId as string;
      const list = await listService.updateList(listId, req.userId!, req.body);

      res.json({
        success: true,
        data: list,
        message: "List updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  /** DELETE /api/boards/:boardId/lists/:listId */
  async deleteList(req: Request, res: Response, next: NextFunction) {
    try {
      const listId = req.params.listId as string;
      await listService.deleteList(listId, req.userId!);

      res.json({
        success: true,
        message: "List deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
};
