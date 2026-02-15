import { Router, type IRouter } from "express";
import { taskController } from "../controllers/taskController.js";
import { authMiddleware } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validation.js";
import {
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
  AssignUserInput,
  TaskFilterQuery,
} from "@repo/shared/schemas";

const router: IRouter = Router({ mergeParams: true }); // mergeParams to access :boardId from parent

// All task routes require authentication + board membership
router.use(authMiddleware, authorize());

// ── Task CRUD ────────────────────────────────────────────────────────

router.get("/", validate(TaskFilterQuery, "query"), taskController.listTasks);
router.post("/", authorize("admin", "editor"), validate(CreateTaskInput), taskController.createTask);
router.get("/:taskId", taskController.getTask);
router.put("/:taskId", authorize("admin", "editor"), validate(UpdateTaskInput), taskController.updateTask);
router.delete("/:taskId", authorize("admin", "editor"), taskController.deleteTask);

// ── Task Position ────────────────────────────────────────────────────

router.put("/:taskId/move", authorize("admin", "editor"), validate(MoveTaskInput), taskController.moveTask);

// ── Task Assignees ───────────────────────────────────────────────────

router.post("/:taskId/assignees", authorize("admin", "editor"), validate(AssignUserInput), taskController.assignUser);
router.delete("/:taskId/assignees/:userId", authorize("admin", "editor"), taskController.unassignUser);

export default router;
