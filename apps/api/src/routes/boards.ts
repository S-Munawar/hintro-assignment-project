import { Router, type IRouter } from "express";
import { boardController } from "../controllers/boardController.js";
import { listController } from "../controllers/listController.js";
import { activityController } from "../controllers/activityController.js";
import { authMiddleware } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validation.js";
import {
  CreateBoardInput,
  UpdateBoardInput,
  AddBoardMemberInput,
  CreateListInput,
  UpdateListInput,
  PaginationQuery,
  ActivityFilterQuery,
} from "@repo/shared/schemas";

const router: IRouter = Router();

// All board routes require authentication
router.use(authMiddleware);

// ── Board CRUD ───────────────────────────────────────────────────────

router.get("/", validate(PaginationQuery, "query"), boardController.listBoards);
router.post("/", validate(CreateBoardInput), boardController.createBoard);
router.get("/:boardId", authorize(), boardController.getBoard);
router.put("/:boardId", authorize("admin"), validate(UpdateBoardInput), boardController.updateBoard);
router.delete("/:boardId", boardController.deleteBoard); // ownership check is in service

// ── Board Members ────────────────────────────────────────────────────

router.post("/:boardId/members", authorize("admin"), validate(AddBoardMemberInput), boardController.addMember);
router.delete("/:boardId/members/:userId", authorize(), boardController.removeMember);

// ── Lists ────────────────────────────────────────────────────────────

router.post("/:boardId/lists", authorize("admin", "editor"), validate(CreateListInput), listController.createList);
router.put("/:boardId/lists/:listId", authorize("admin", "editor"), validate(UpdateListInput), listController.updateList);
router.delete("/:boardId/lists/:listId", authorize("admin"), listController.deleteList);

// ── Activity ─────────────────────────────────────────────────────────

router.get("/:boardId/activity", authorize(), validate(ActivityFilterQuery, "query"), activityController.getActivity);

export default router;
