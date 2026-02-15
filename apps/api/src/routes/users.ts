import { Router, type IRouter } from "express";
import { userController } from "../controllers/userController.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { UserSearchQuery } from "@repo/shared/schemas";

const router: IRouter = Router();

// All user routes require authentication
router.use(authMiddleware);

// ── User Search ──────────────────────────────────────────────────────

router.get("/search", validate(UserSearchQuery, "query"), userController.searchUsers);

export default router;
