import type { Request, Response, NextFunction } from "express";
import { userService } from "../services/userService.js";

export const userController = {
  /** GET /api/users/search?q=...&limit=... */
  async searchUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.validatedQuery || req.query;
      const q = String(query.q);
      const limit = Number(query.limit) || 10;

      const users = await userService.searchUsers(q, req.userId!, limit);

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      next(error);
    }
  },
};
