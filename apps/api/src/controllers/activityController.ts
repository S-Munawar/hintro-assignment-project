import type { Request, Response, NextFunction } from "express";
import { activityService } from "../services/activityService.js";

export const activityController = {
  /** GET /api/boards/:boardId/activity */
  async getActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const boardId = req.params.boardId as string;
      const query = req.validatedQuery || req.query;
      const result = await activityService.getActivityLog(boardId, {
        task_id: query.task_id as string | undefined,
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
      });

      res.json({
        success: true,
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  },
};
