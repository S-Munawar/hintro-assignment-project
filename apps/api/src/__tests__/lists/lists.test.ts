import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import {
  initTestSuite,
  createTestUser,
  createTestBoard,
  cleanDatabase,
  authRequest,
  type TestUser,
  type TestBoard,
} from "../helpers.js";

describe("List CRUD", () => {
  let owner: TestUser;
  let viewer: TestUser;
  let stranger: TestUser;
  let board: TestBoard;

  beforeAll(async () => {
    await initTestSuite();
    await cleanDatabase();
    owner = await createTestUser({ first_name: "Owner", last_name: "List" });
    viewer = await createTestUser({ first_name: "Viewer", last_name: "List" });
    stranger = await createTestUser({ first_name: "Stranger", last_name: "List" });
    board = await createTestBoard(owner, "List Test Board");

    // Add viewer as a viewer-role member
    await authRequest(owner)
      .post(`/api/boards/${board.id}/members`)
      .send({ user_id: viewer.id, role: "viewer" });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  // ─── Create ────────────────────────────────────────────────────────

  describe("POST /api/boards/:boardId/lists", () => {
    it("creates a new list at the next position", async () => {
      const res = await authRequest(owner)
        .post(`/api/boards/${board.id}/lists`)
        .send({ name: "Custom List" })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Custom List");
      // Board already has 3 default lists (0,1,2), so this should be position 3
      expect(res.body.data.position).toBe(3);
    });

    it("rejects empty name", async () => {
      const res = await authRequest(owner)
        .post(`/api/boards/${board.id}/lists`)
        .send({ name: "" })
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects creation from viewer (requires admin or editor)", async () => {
      const res = await authRequest(viewer)
        .post(`/api/boards/${board.id}/lists`)
        .send({ name: "Viewer List" })
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects creation from non-member", async () => {
      const res = await authRequest(stranger)
        .post(`/api/boards/${board.id}/lists`)
        .send({ name: "Stranger List" })
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // ─── Update ────────────────────────────────────────────────────────

  describe("PUT /api/boards/:boardId/lists/:listId", () => {
    it("updates list name", async () => {
      const listId = board.lists[0]!.id; // "To Do" list
      const res = await authRequest(owner)
        .put(`/api/boards/${board.id}/lists/${listId}`)
        .send({ name: "Backlog" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Backlog");
    });

    it("reorders list position", async () => {
      const listId = board.lists[0]!.id; // position 0
      const res = await authRequest(owner)
        .put(`/api/boards/${board.id}/lists/${listId}`)
        .send({ position: 2 })
        .expect(200);

      expect(res.body.data.position).toBe(2);
    });

    it("returns 404 for nonexistent list", async () => {
      const res = await authRequest(owner)
        .put(`/api/boards/${board.id}/lists/00000000-0000-0000-0000-000000000000`)
        .send({ name: "Ghost" })
        .expect(404);

      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("rejects update from viewer", async () => {
      const listId = board.lists[1]!.id;
      const res = await authRequest(viewer)
        .put(`/api/boards/${board.id}/lists/${listId}`)
        .send({ name: "Hacked" })
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // ─── Delete ────────────────────────────────────────────────────────

  describe("DELETE /api/boards/:boardId/lists/:listId", () => {
    it("rejects delete from non-admin (viewer)", async () => {
      const listId = board.lists[1]!.id;
      const res = await authRequest(viewer)
        .delete(`/api/boards/${board.id}/lists/${listId}`)
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("deletes a list and reorders remaining", async () => {
      // Create a disposable list to delete
      const createRes = await authRequest(owner)
        .post(`/api/boards/${board.id}/lists`)
        .send({ name: "Disposable" })
        .expect(201);

      const disposableId = createRes.body.data.id;

      const res = await authRequest(owner)
        .delete(`/api/boards/${board.id}/lists/${disposableId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted/i);
    });

    it("returns 404 for nonexistent list", async () => {
      const res = await authRequest(owner)
        .delete(`/api/boards/${board.id}/lists/00000000-0000-0000-0000-000000000000`)
        .expect(404);

      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });
});
