import { z } from "zod";
import { uuidSchema, dateSchema } from "./common.js";
import { TaskPriorityEnum, BoardRoleEnum } from "./enums.js";

// ─── Input Schemas ───────────────────────────────────────────────────
// Schemas for validating API request bodies / form submissions.
// Only include user-controlled fields; server-managed fields
// (id, created_at, updated_at, etc.) are omitted.

// ── Board ────────────────────────────────────────────────────────────

export const CreateBoardInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  color: z.string().max(7).regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type CreateBoardInput = z.infer<typeof CreateBoardInput>;

export const UpdateBoardInput = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  color: z.string().max(7).regex(/^#[0-9a-fA-F]{6}$/).optional(),
  is_archived: z.boolean().optional(),
});
export type UpdateBoardInput = z.infer<typeof UpdateBoardInput>;

// ── Board Member ─────────────────────────────────────────────────────

export const AddBoardMemberInput = z.object({
  user_id: uuidSchema,
  role: BoardRoleEnum.optional(),
});
export type AddBoardMemberInput = z.infer<typeof AddBoardMemberInput>;

export const UpdateBoardMemberInput = z.object({
  role: BoardRoleEnum,
});
export type UpdateBoardMemberInput = z.infer<typeof UpdateBoardMemberInput>;

// ── List ─────────────────────────────────────────────────────────────

export const CreateListInput = z.object({
  name: z.string().min(1).max(255),
  position: z.number().int().nonnegative().optional(),
});
export type CreateListInput = z.infer<typeof CreateListInput>;

export const UpdateListInput = z.object({
  name: z.string().min(1).max(255).optional(),
  position: z.number().int().nonnegative().optional(),
});
export type UpdateListInput = z.infer<typeof UpdateListInput>;

// ── Task ─────────────────────────────────────────────────────────────

export const CreateTaskInput = z.object({
  list_id: uuidSchema,
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  priority: TaskPriorityEnum.optional(),
  due_date: dateSchema.nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const UpdateTaskInput = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  position: z.number().int().nonnegative().optional(),
  priority: TaskPriorityEnum.optional(),
  due_date: dateSchema.nullable().optional(),
  is_completed: z.boolean().optional(),
  list_id: uuidSchema.optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

export const MoveTaskInput = z.object({
  list_id: uuidSchema,
  position: z.number().int().nonnegative(),
});
export type MoveTaskInput = z.infer<typeof MoveTaskInput>;

// ── Task Assignee ────────────────────────────────────────────────────

export const AssignUserInput = z.object({
  user_id: uuidSchema,
});
export type AssignUserInput = z.infer<typeof AssignUserInput>;

// ── Pagination ───────────────────────────────────────────────────────

export const PaginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type PaginationQuery = z.infer<typeof PaginationQuery>;

// ── Task Filter ──────────────────────────────────────────────────────

export const TaskFilterQuery = PaginationQuery.extend({
  search: z.string().optional(),
  priority: TaskPriorityEnum.optional(),
  is_completed: z.coerce.boolean().optional(),
  list_id: uuidSchema.optional(),
  assigned_to: uuidSchema.optional(),
});
export type TaskFilterQuery = z.infer<typeof TaskFilterQuery>;

// ── Activity Filter ──────────────────────────────────────────────────

export const ActivityFilterQuery = PaginationQuery.extend({
  task_id: uuidSchema.optional(),
});
export type ActivityFilterQuery = z.infer<typeof ActivityFilterQuery>;

// ── User Search ──────────────────────────────────────────────────────

export const UserSearchQuery = z.object({
  q: z.string().min(1).max(255),
  limit: z.coerce.number().int().positive().max(20).default(10),
});
export type UserSearchQuery = z.infer<typeof UserSearchQuery>;
