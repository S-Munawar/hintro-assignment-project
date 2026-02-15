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

describe("Activity Log", () => {
  let owner: TestUser;
  let viewer: TestUser;
  let stranger: TestUser;
  let board: TestBoard;
  let todoListId: string;
  let taskId: string;

  beforeAll(async () => {
    await initTestSuite();
    await cleanDatabase();
    owner = await createTestUser({ first_name: "Owner", last_name: "Activity" });
    viewer = await createTestUser({ first_name: "Viewer", last_name: "Activity" });
    stranger = await createTestUser({ first_name: "Stranger", last_name: "Activity" });

    // Create board → logs "board create" activity
    board = await createTestBoard(owner, "Activity Board");
    todoListId = board.lists.find((l) => l.name === "To Do")!.id;

    // Add viewer member
    await authRequest(owner)
      .post(`/api/boards/${board.id}/members`)
      .send({ user_id: viewer.id, role: "viewer" });

    // Create a task → logs "task create" activity
    const task = await createTestTask(owner, board.id, todoListId, "Tracked Task");
    taskId = task.id;

    // Update the task → logs "task update" activity
    await authRequest(owner)
      .put(`/api/boards/${board.id}/tasks/${taskId}`)
      .send({ title: "Tracked Task (Updated)", priority: "high" });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  // ─── Get activity ─────────────────────────────────────────────────

  describe("GET /api/boards/:boardId/activity", () => {
    it("returns activity log for the board", async () => {
      const res = await authRequest(owner)
        .get(`/api/boards/${board.id}/activity`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3); // board create, member add, task create, task update
      expect(res.body.pagination).toHaveProperty("total");
      expect(res.body.pagination).toHaveProperty("pages");

      // Each log entry has expected shape
      const entry = res.body.data[0];
      expect(entry).toHaveProperty("action_type");
      expect(entry).toHaveProperty("entity_type");
      expect(entry).toHaveProperty("user");
      expect(entry.user).toHaveProperty("id");
      expect(entry.user).toHaveProperty("first_name");
    });

    it("filters by task_id", async () => {
      const res = await authRequest(owner)
        .get(`/api/boards/${board.id}/activity?task_id=${taskId}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(2); // create + update
      res.body.data.forEach((entry: { task: { id: string } | null }) => {
        if (entry.task) {
          expect(entry.task.id).toBe(taskId);
        }
      });
    });

    it("supports pagination", async () => {
      const res = await authRequest(owner)
        .get(`/api/boards/${board.id}/activity?page=1&limit=2`)
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.limit).toBe(2);
    });

    it("allows viewer to read activity", async () => {
      const res = await authRequest(viewer)
        .get(`/api/boards/${board.id}/activity`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it("rejects non-member", async () => {
      const res = await authRequest(stranger)
        .get(`/api/boards/${board.id}/activity`)
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns activities in newest-first order", async () => {
      const res = await authRequest(owner)
        .get(`/api/boards/${board.id}/activity`)
        .expect(200);

      const timestamps = res.body.data.map(
        (e: { created_at: string }) => new Date(e.created_at).getTime(),
      );
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
      }
    });
  });
});
