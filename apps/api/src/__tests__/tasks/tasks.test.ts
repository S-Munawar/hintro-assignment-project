import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import {
  initTestSuite,
  createTestUser,
  createTestBoard,
  createTestTask,
  cleanDatabase,
  authRequest,
  type TestUser,
  type TestBoard,
} from "../helpers.js";

describe("Task CRUD, Move & Assignees", () => {
  let owner: TestUser;
  let editor: TestUser;
  let viewer: TestUser;
  let stranger: TestUser;
  let board: TestBoard;
  let todoListId: string;
  let inProgressListId: string;
  let doneListId: string;

  beforeAll(async () => {
    await initTestSuite();
    await cleanDatabase();
    owner = await createTestUser({ first_name: "Owner", last_name: "Task" });
    editor = await createTestUser({ first_name: "Editor", last_name: "Task" });
    viewer = await createTestUser({ first_name: "Viewer", last_name: "Task" });
    stranger = await createTestUser({ first_name: "Stranger", last_name: "Task" });

    board = await createTestBoard(owner, "Task Test Board");
    todoListId = board.lists.find((l) => l.name === "To Do")!.id;
    inProgressListId = board.lists.find((l) => l.name === "In Progress")!.id;
    doneListId = board.lists.find((l) => l.name === "Done")!.id;

    // Add editor and viewer as members
    await authRequest(owner)
      .post(`/api/boards/${board.id}/members`)
      .send({ user_id: editor.id, role: "editor" });
    await authRequest(owner)
      .post(`/api/boards/${board.id}/members`)
      .send({ user_id: viewer.id, role: "viewer" });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  // ─── Create ────────────────────────────────────────────────────────

  describe("POST /api/boards/:boardId/tasks", () => {
    it("creates a task in a list", async () => {
      const res = await authRequest(owner)
        .post(`/api/boards/${board.id}/tasks`)
        .send({
          title: "First Task",
          list_id: todoListId,
          priority: "high",
          description: "Important work",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("First Task");
      expect(res.body.data.priority).toBe("high");
      expect(res.body.data.description).toBe("Important work");
      expect(res.body.data.position).toBe(0);
      expect(res.body.data.creator.id).toBe(owner.id);
      expect(res.body.data.list.id).toBe(todoListId);
    });

    it("auto-increments position", async () => {
      const res = await authRequest(owner)
        .post(`/api/boards/${board.id}/tasks`)
        .send({ title: "Second Task", list_id: todoListId })
        .expect(201);

      expect(res.body.data.position).toBe(1);
    });

    it("allows editor to create tasks", async () => {
      const res = await authRequest(editor)
        .post(`/api/boards/${board.id}/tasks`)
        .send({ title: "Editor Task", list_id: todoListId })
        .expect(201);

      expect(res.body.data.title).toBe("Editor Task");
      expect(res.body.data.creator.id).toBe(editor.id);
    });

    it("rejects task creation from viewer", async () => {
      const res = await authRequest(viewer)
        .post(`/api/boards/${board.id}/tasks`)
        .send({ title: "Viewer Task", list_id: todoListId })
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects task creation from non-member", async () => {
      const res = await authRequest(stranger)
        .post(`/api/boards/${board.id}/tasks`)
        .send({ title: "Stranger Task", list_id: todoListId })
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects empty title", async () => {
      const res = await authRequest(owner)
        .post(`/api/boards/${board.id}/tasks`)
        .send({ title: "", list_id: todoListId })
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects missing list_id", async () => {
      const res = await authRequest(owner)
        .post(`/api/boards/${board.id}/tasks`)
        .send({ title: "No List" })
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects invalid priority value", async () => {
      const res = await authRequest(owner)
        .post(`/api/boards/${board.id}/tasks`)
        .send({ title: "Bad Priority", list_id: todoListId, priority: "critical" })
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.priority).toBeDefined();
    });
  });

  // ─── List / Filter ────────────────────────────────────────────────

  describe("GET /api/boards/:boardId/tasks", () => {
    it("returns all tasks for the board", async () => {
      const res = await authRequest(owner)
        .get(`/api/boards/${board.id}/tasks`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.pagination).toHaveProperty("total");
    });

    it("filters by priority", async () => {
      const res = await authRequest(owner)
        .get(`/api/boards/${board.id}/tasks?priority=high`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach((t: { priority: string }) => {
        expect(t.priority).toBe("high");
      });
    });

    it("filters by list_id", async () => {
      const res = await authRequest(owner)
        .get(`/api/boards/${board.id}/tasks?list_id=${todoListId}`)
        .expect(200);

      res.body.data.forEach((t: { list: { id: string } }) => {
        expect(t.list.id).toBe(todoListId);
      });
    });

    it("searches by title", async () => {
      const res = await authRequest(owner)
        .get(`/api/boards/${board.id}/tasks?search=First`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].title).toContain("First");
    });

    it("viewer can read tasks", async () => {
      const res = await authRequest(viewer)
        .get(`/api/boards/${board.id}/tasks`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ─── Get single ───────────────────────────────────────────────────

  describe("GET /api/boards/:boardId/tasks/:taskId", () => {
    it("returns a single task with assignees", async () => {
      const task = await createTestTask(owner, board.id, todoListId, "Detail Task");

      const res = await authRequest(owner)
        .get(`/api/boards/${board.id}/tasks/${task.id}`)
        .expect(200);

      expect(res.body.data.id).toBe(task.id);
      expect(res.body.data.title).toBe("Detail Task");
      expect(res.body.data).toHaveProperty("assignees");
      expect(res.body.data).toHaveProperty("list");
    });

    it("returns 404 for nonexistent task", async () => {
      const res = await authRequest(owner)
        .get(`/api/boards/${board.id}/tasks/00000000-0000-0000-0000-000000000000`)
        .expect(404);

      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ─── Update ────────────────────────────────────────────────────────

  describe("PUT /api/boards/:boardId/tasks/:taskId", () => {
    let taskId: string;

    beforeAll(async () => {
      const task = await createTestTask(owner, board.id, todoListId, "Update Me");
      taskId = task.id;
    });

    it("updates task title and priority", async () => {
      const res = await authRequest(owner)
        .put(`/api/boards/${board.id}/tasks/${taskId}`)
        .send({ title: "Updated Title", priority: "urgent" })
        .expect(200);

      expect(res.body.data.title).toBe("Updated Title");
      expect(res.body.data.priority).toBe("urgent");
    });

    it("sets description to null", async () => {
      const res = await authRequest(owner)
        .put(`/api/boards/${board.id}/tasks/${taskId}`)
        .send({ description: null })
        .expect(200);

      expect(res.body.data.description).toBeNull();
    });

    it("rejects update from viewer", async () => {
      const res = await authRequest(viewer)
        .put(`/api/boards/${board.id}/tasks/${taskId}`)
        .send({ title: "Hacked" })
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // ─── Move ──────────────────────────────────────────────────────────

  describe("PUT /api/boards/:boardId/tasks/:taskId/move", () => {
    let taskId: string;

    beforeAll(async () => {
      const task = await createTestTask(owner, board.id, todoListId, "Move Me");
      taskId = task.id;
    });

    it("moves task to a different list", async () => {
      const res = await authRequest(owner)
        .put(`/api/boards/${board.id}/tasks/${taskId}/move`)
        .send({ list_id: inProgressListId, position: 0 })
        .expect(200);

      expect(res.body.data.list.id).toBe(inProgressListId);
      expect(res.body.data.position).toBe(0);
    });

    it("moves task within the same list", async () => {
      // Create a second task in In Progress
      await createTestTask(owner, board.id, inProgressListId, "Another In Progress");

      const res = await authRequest(owner)
        .put(`/api/boards/${board.id}/tasks/${taskId}/move`)
        .send({ list_id: inProgressListId, position: 1 })
        .expect(200);

      expect(res.body.data.position).toBe(1);
    });

    it("rejects move with missing fields", async () => {
      const res = await authRequest(owner)
        .put(`/api/boards/${board.id}/tasks/${taskId}/move`)
        .send({ position: 0 }) // missing list_id
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects move from viewer", async () => {
      const res = await authRequest(viewer)
        .put(`/api/boards/${board.id}/tasks/${taskId}/move`)
        .send({ list_id: doneListId, position: 0 })
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // ─── Assignees ─────────────────────────────────────────────────────

  describe("Task Assignees", () => {
    let taskId: string;

    beforeAll(async () => {
      const task = await createTestTask(owner, board.id, todoListId, "Assign Me");
      taskId = task.id;
    });

    describe("POST /api/boards/:boardId/tasks/:taskId/assignees", () => {
      it("assigns a board member to a task", async () => {
        const res = await authRequest(owner)
          .post(`/api/boards/${board.id}/tasks/${taskId}/assignees`)
          .send({ user_id: editor.id })
          .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data.user.id).toBe(editor.id);
      });

      it("assigns the owner (self-assign)", async () => {
        const res = await authRequest(owner)
          .post(`/api/boards/${board.id}/tasks/${taskId}/assignees`)
          .send({ user_id: owner.id })
          .expect(201);

        expect(res.body.data.user.id).toBe(owner.id);
      });

      it("rejects duplicate assignment", async () => {
        const res = await authRequest(owner)
          .post(`/api/boards/${board.id}/tasks/${taskId}/assignees`)
          .send({ user_id: editor.id })
          .expect(409);

        expect(res.body.error.code).toBe("CONFLICT");
      });

      it("rejects assigning non-member", async () => {
        const res = await authRequest(owner)
          .post(`/api/boards/${board.id}/tasks/${taskId}/assignees`)
          .send({ user_id: stranger.id })
          .expect(400);

        expect(res.body.error.code).toBe("BAD_REQUEST");
      });

      it("rejects assignment from viewer", async () => {
        const res = await authRequest(viewer)
          .post(`/api/boards/${board.id}/tasks/${taskId}/assignees`)
          .send({ user_id: viewer.id })
          .expect(403);

        expect(res.body.error.code).toBe("FORBIDDEN");
      });
    });

    describe("DELETE /api/boards/:boardId/tasks/:taskId/assignees/:userId", () => {
      it("unassigns a user from a task", async () => {
        const res = await authRequest(owner)
          .delete(`/api/boards/${board.id}/tasks/${taskId}/assignees/${editor.id}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/unassigned/i);
      });

      it("returns 404 for non-existent assignment", async () => {
        const res = await authRequest(owner)
          .delete(`/api/boards/${board.id}/tasks/${taskId}/assignees/${stranger.id}`)
          .expect(404);

        expect(res.body.error.code).toBe("NOT_FOUND");
      });
    });
  });

  // ─── Delete ────────────────────────────────────────────────────────

  describe("DELETE /api/boards/:boardId/tasks/:taskId", () => {
    it("deletes a task", async () => {
      const task = await createTestTask(owner, board.id, todoListId, "Delete Me");

      const res = await authRequest(owner)
        .delete(`/api/boards/${board.id}/tasks/${task.id}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted/i);

      // Verify it's gone
      await authRequest(owner)
        .get(`/api/boards/${board.id}/tasks/${task.id}`)
        .expect(404);
    });

    it("returns 404 for nonexistent task", async () => {
      const res = await authRequest(owner)
        .delete(`/api/boards/${board.id}/tasks/00000000-0000-0000-0000-000000000000`)
        .expect(404);

      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("rejects delete from viewer", async () => {
      const task = await createTestTask(owner, board.id, todoListId, "Viewer Cannot Delete");

      const res = await authRequest(viewer)
        .delete(`/api/boards/${board.id}/tasks/${task.id}`)
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });
});
