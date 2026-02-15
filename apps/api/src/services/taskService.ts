import { prisma } from "../config/database.js";
import { createError } from "../middleware/errorHandler.js";
import { paginate, paginationMeta } from "../utils/pagination.js";
import type { Prisma, TaskPriority } from "@prisma/client";

export const taskService = {
  /** Get tasks for a board, with optional filters and pagination. */
  async getTasksByBoardId(
    boardId: string,
    options: {
      list_id?: string;
      priority?: string;
      assigned_to?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = options.page || 1;
    const limit = options.limit || 50;

    const where: Prisma.TaskWhereInput = { list: { board_id: boardId } };

    if (options.list_id) where.list_id = options.list_id;
    if (options.priority) where.priority = options.priority as Prisma.EnumTaskPriorityFilter;
    if (options.search) {
      where.OR = [
        { title: { contains: options.search, mode: "insensitive" } },
        { description: { contains: options.search, mode: "insensitive" } },
      ];
    }
    if (options.assigned_to) {
      where.assignees = { some: { user_id: options.assigned_to } };
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          creator: { select: { id: true, first_name: true, last_name: true } },
          assignees: {
            include: {
              user: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
            },
          },
          list: { select: { id: true, name: true } },
        },
        orderBy: { position: "asc" },
        ...paginate({ page, limit }),
      }),
      prisma.task.count({ where }),
    ]);

    return { tasks, pagination: paginationMeta(page, limit, total) };
  },

  /** Create a task in a list. Automatically assigns next position. */
  async createTask(
    userId: string,
    data: {
      list_id: string;
      title: string;
      description?: string | null;
      priority?: string;
      due_date?: string | null;
    },
  ) {
    // Verify the list exists and get its board
    const list = await prisma.list.findUnique({
      where: { id: data.list_id },
      include: { board: { select: { id: true } } },
    });
    if (!list) throw createError(404, "NOT_FOUND", "List not found");

    // Calculate next position
    const lastTask = await prisma.task.findFirst({
      where: { list_id: data.list_id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const nextPosition = (lastTask?.position ?? -1) + 1;

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        priority: (data.priority as TaskPriority) ?? "medium",
        due_date: data.due_date ? new Date(data.due_date) : null,
        position: nextPosition,
        list_id: data.list_id,
        created_by: userId,
      },
      include: {
        creator: { select: { id: true, first_name: true, last_name: true } },
        list: { select: { id: true, name: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        board_id: list.board.id,
        user_id: userId,
        task_id: task.id,
        action_type: "create",
        entity_type: "task",
        changes: { title: task.title, list: list.name },
      },
    });

    return task;
  },

  /** Get a single task by ID. */
  async getTaskById(taskId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        creator: { select: { id: true, first_name: true, last_name: true } },
        assignees: {
          include: {
            user: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
          },
        },
        list: { select: { id: true, name: true, board_id: true } },
      },
    });

    if (!task) throw createError(404, "NOT_FOUND", "Task not found");
    return task;
  },

  /** Update a task. */
  async updateTask(
    taskId: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
      priority?: string;
      due_date?: string | null;
    },
  ) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { list: { select: { board_id: true } } },
    });
    if (!task) throw createError(404, "NOT_FOUND", "Task not found");

    const updateData: Prisma.TaskUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority as TaskPriority;
    if (data.due_date !== undefined) updateData.due_date = data.due_date ? new Date(data.due_date) : null;

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        creator: { select: { id: true, first_name: true, last_name: true } },
        assignees: {
          include: {
            user: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
          },
        },
        list: { select: { id: true, name: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        board_id: task.list.board_id,
        user_id: userId,
        task_id: taskId,
        action_type: "update",
        entity_type: "task",
        changes: data as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  },

  /** Delete a task. */
  async deleteTask(taskId: string, userId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { list: { select: { board_id: true, name: true } } },
    });
    if (!task) throw createError(404, "NOT_FOUND", "Task not found");

    await prisma.activityLog.create({
      data: {
        board_id: task.list.board_id,
        user_id: userId,
        task_id: taskId,
        action_type: "delete",
        entity_type: "task",
        changes: { title: task.title, list: task.list.name },
      },
    });

    await prisma.task.delete({ where: { id: taskId } });
  },

  /** Move a task to a new list and/or position. */
  async moveTask(
    taskId: string,
    userId: string,
    data: { list_id: string; position: number },
  ) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { list: { select: { board_id: true, name: true } } },
    });
    if (!task) throw createError(404, "NOT_FOUND", "Task not found");

    const targetList = await prisma.list.findUnique({ where: { id: data.list_id } });
    if (!targetList) throw createError(404, "NOT_FOUND", "Target list not found");
    if (targetList.board_id !== task.list.board_id) {
      throw createError(400, "BAD_REQUEST", "Cannot move task to a list on a different board");
    }

    const movingToNewList = task.list_id !== data.list_id;

    await prisma.$transaction(async (tx) => {
      // Shift tasks in the source list (close the gap)
      if (movingToNewList) {
        await tx.task.updateMany({
          where: {
            list_id: task.list_id,
            position: { gt: task.position },
          },
          data: { position: { decrement: 1 } },
        });
      } else {
        // Same list: shift tasks between old and new position
        if (data.position > task.position) {
          await tx.task.updateMany({
            where: {
              list_id: task.list_id,
              position: { gt: task.position, lte: data.position },
              id: { not: taskId },
            },
            data: { position: { decrement: 1 } },
          });
        } else if (data.position < task.position) {
          await tx.task.updateMany({
            where: {
              list_id: task.list_id,
              position: { gte: data.position, lt: task.position },
              id: { not: taskId },
            },
            data: { position: { increment: 1 } },
          });
        }
      }

      // Shift tasks in the target list (make room) if moving to a new list
      if (movingToNewList) {
        await tx.task.updateMany({
          where: {
            list_id: data.list_id,
            position: { gte: data.position },
          },
          data: { position: { increment: 1 } },
        });
      }

      // Move the task
      await tx.task.update({
        where: { id: taskId },
        data: {
          list_id: data.list_id,
          position: data.position,
        },
      });
    });

    const updated = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        creator: { select: { id: true, first_name: true, last_name: true } },
        assignees: {
          include: {
            user: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
          },
        },
        list: { select: { id: true, name: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        board_id: task.list.board_id,
        user_id: userId,
        task_id: taskId,
        action_type: "update",
        entity_type: "task",
        changes: {
          action: "moved",
          from_list: task.list.name,
          to_list: targetList.name,
          new_position: data.position,
        },
      },
    });

    return updated;
  },

  /** Assign a user to a task. */
  async assignUser(taskId: string, userId: string, assigneeId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { list: { select: { board_id: true } } },
    });
    if (!task) throw createError(404, "NOT_FOUND", "Task not found");

    // Verify assignee is a board member or owner
    const board = await prisma.board.findUnique({ where: { id: task.list.board_id } });
    if (board!.owner_id !== assigneeId) {
      const membership = await prisma.boardMember.findUnique({
        where: { board_id_user_id: { board_id: task.list.board_id, user_id: assigneeId } },
      });
      if (!membership) throw createError(400, "BAD_REQUEST", "User is not a member of this board");
    }

    // Check for duplicate assignment
    const existing = await prisma.taskAssignee.findUnique({
      where: { task_id_user_id: { task_id: taskId, user_id: assigneeId } },
    });
    if (existing) throw createError(409, "CONFLICT", "User is already assigned to this task");

    const assignment = await prisma.taskAssignee.create({
      data: { task_id: taskId, user_id: assigneeId },
      include: {
        user: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        board_id: task.list.board_id,
        user_id: userId,
        task_id: taskId,
        action_type: "create",
        entity_type: "task",
        changes: { action: "user_assigned", assignee_id: assigneeId },
      },
    });

    return assignment;
  },

  /** Unassign a user from a task. */
  async unassignUser(taskId: string, userId: string, assigneeId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { list: { select: { board_id: true } } },
    });
    if (!task) throw createError(404, "NOT_FOUND", "Task not found");

    const assignment = await prisma.taskAssignee.findUnique({
      where: { task_id_user_id: { task_id: taskId, user_id: assigneeId } },
    });
    if (!assignment) throw createError(404, "NOT_FOUND", "Assignment not found");

    await prisma.taskAssignee.delete({ where: { id: assignment.id } });

    await prisma.activityLog.create({
      data: {
        board_id: task.list.board_id,
        user_id: userId,
        task_id: taskId,
        action_type: "delete",
        entity_type: "task",
        changes: { action: "user_unassigned", assignee_id: assigneeId },
      },
    });
  },
};
