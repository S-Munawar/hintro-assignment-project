"use client";

import { create } from "zustand";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { useBoardStore } from "./useBoardStore";
import type { Task, TaskAssignee, ActivityLogEntry, Pagination } from "@/types";

interface TaskState {
  /* ── Detail modal ───────────────────────────────────────────────── */
  selectedTask: Task | null;
  selectedTaskLoading: boolean;

  /* ── Activity ───────────────────────────────────────────────────── */
  activityLogs: ActivityLogEntry[];
  activityPagination: Pagination | null;
  activityLoading: boolean;

  /* ── Actions: Tasks ─────────────────────────────────────────────── */
  createTask: (boardId: string, data: { list_id: string; title: string; description?: string; priority?: string; due_date?: string | null }) => Promise<Task>;
  updateTask: (boardId: string, taskId: string, data: { title?: string; description?: string | null; priority?: string; due_date?: string | null }) => Promise<Task>;
  deleteTask: (boardId: string, taskId: string) => Promise<void>;
  moveTask: (boardId: string, taskId: string, data: { list_id: string; position: number }) => Promise<void>;
  fetchTaskDetail: (boardId: string, taskId: string) => Promise<void>;
  clearSelectedTask: () => void;

  /* ── Actions: Assignees ─────────────────────────────────────────── */
  assignUser: (boardId: string, taskId: string, userId: string) => Promise<TaskAssignee>;
  unassignUser: (boardId: string, taskId: string, userId: string) => Promise<void>;

  /* ── Actions: Activity ──────────────────────────────────────────── */
  fetchActivity: (boardId: string, taskId?: string, page?: number) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  selectedTask: null,
  selectedTaskLoading: false,
  activityLogs: [],
  activityPagination: null,
  activityLoading: false,

  // ── Tasks ──────────────────────────────────────────────────────────

  createTask: async (boardId, data) => {
    const res = await apiPost<Task>(`/boards/${boardId}/tasks`, data);
    const task = res.data;
    // Add task to the correct list in currentBoard (guard against duplicates from socket)
    const boardStore = useBoardStore.getState();
    if (boardStore.currentBoard?.id === boardId) {
      const lists = boardStore.currentBoard.lists.map((l) => {
        if (l.id === task.list_id) {
          if (l.tasks.some((t) => t.id === task.id)) return l;
          return { ...l, tasks: [...l.tasks, { ...task, assignees: task.assignees ?? [] }] };
        }
        return l;
      });
      useBoardStore.setState({ currentBoard: { ...boardStore.currentBoard, lists } });
    }
    return task;
  },

  updateTask: async (boardId, taskId, data) => {
    const res = await apiPut<Task>(`/boards/${boardId}/tasks/${taskId}`, data);
    const task = res.data;
    // Update task in currentBoard lists
    const boardStore = useBoardStore.getState();
    if (boardStore.currentBoard) {
      const lists = boardStore.currentBoard.lists.map((l) => ({
        ...l,
        tasks: l.tasks.map((t) => (t.id === taskId ? { ...t, ...task } : t)),
      }));
      useBoardStore.setState({ currentBoard: { ...boardStore.currentBoard, lists } });
    }
    // Update selected task if open
    if (get().selectedTask?.id === taskId) {
      set({ selectedTask: { ...get().selectedTask!, ...task } });
    }
    return task;
  },

  deleteTask: async (boardId, taskId) => {
    await apiDelete(`/boards/${boardId}/tasks/${taskId}`);
    const boardStore = useBoardStore.getState();
    if (boardStore.currentBoard) {
      const lists = boardStore.currentBoard.lists.map((l) => ({
        ...l,
        tasks: l.tasks.filter((t) => t.id !== taskId),
      }));
      useBoardStore.setState({ currentBoard: { ...boardStore.currentBoard, lists } });
    }
    if (get().selectedTask?.id === taskId) {
      set({ selectedTask: null });
    }
  },

  moveTask: async (boardId, taskId, data) => {
    // The optimistic move is already done by the board store
    await apiPut(`/boards/${boardId}/tasks/${taskId}/move`, data);
  },

  fetchTaskDetail: async (boardId, taskId) => {
    set({ selectedTaskLoading: true });
    try {
      const res = await apiGet<Task>(`/boards/${boardId}/tasks/${taskId}`);
      set({ selectedTask: res.data });
    } finally {
      set({ selectedTaskLoading: false });
    }
  },

  clearSelectedTask: () => set({ selectedTask: null }),

  // ── Assignees ──────────────────────────────────────────────────────

  assignUser: async (boardId, taskId, userId) => {
    const res = await apiPost<TaskAssignee>(`/boards/${boardId}/tasks/${taskId}/assignees`, { user_id: userId });
    // Update selected task (guard against duplicates from concurrent socket events)
    const task = get().selectedTask;
    if (task?.id === taskId) {
      const existing = task.assignees ?? [];
      if (!existing.some((a) => a.id === res.data.id || a.user_id === res.data.user_id)) {
        set({ selectedTask: { ...task, assignees: [...existing, res.data] } });
      }
    }
    // Also update in board lists
    const boardStore = useBoardStore.getState();
    if (boardStore.currentBoard) {
      const lists = boardStore.currentBoard.lists.map((l) => ({
        ...l,
        tasks: l.tasks.map((t) => {
          if (t.id === taskId) {
            const curr = t.assignees ?? [];
            if (curr.some((a) => a.id === res.data.id || a.user_id === res.data.user_id)) return t;
            return { ...t, assignees: [...curr, res.data] };
          }
          return t;
        }),
      }));
      useBoardStore.setState({ currentBoard: { ...boardStore.currentBoard, lists } });
    }
    return res.data;
  },

  unassignUser: async (boardId, taskId, userId) => {
    await apiDelete(`/boards/${boardId}/tasks/${taskId}/assignees/${userId}`);
    const task = get().selectedTask;
    if (task?.id === taskId) {
      set({ selectedTask: { ...task, assignees: (task.assignees ?? []).filter((a) => a.user_id !== userId) } });
    }
    const boardStore = useBoardStore.getState();
    if (boardStore.currentBoard) {
      const lists = boardStore.currentBoard.lists.map((l) => ({
        ...l,
        tasks: l.tasks.map((t) => {
          if (t.id === taskId) {
            return { ...t, assignees: (t.assignees ?? []).filter((a) => a.user_id !== userId) };
          }
          return t;
        }),
      }));
      useBoardStore.setState({ currentBoard: { ...boardStore.currentBoard, lists } });
    }
  },

  // ── Activity ───────────────────────────────────────────────────────

  fetchActivity: async (boardId, taskId, page = 1) => {
    set({ activityLoading: true });
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (taskId) params.task_id = taskId;
      const res = await apiGet<ActivityLogEntry[]>(`/boards/${boardId}/activity`, params);
      set({ activityLogs: res.data, activityPagination: res.pagination ?? null });
    } finally {
      set({ activityLoading: false });
    }
  },
}));
