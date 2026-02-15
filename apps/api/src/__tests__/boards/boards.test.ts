import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import {
  initTestSuite,
  createTestUser,
  createTestBoard,
  cleanDatabase,
  authRequest,
  getPrisma,
  type TestUser,
  type TestBoard,
} from "../helpers.js";

describe("Board CRUD", () => {
  let owner: TestUser;
  let member: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    await initTestSuite();
    await cleanDatabase();
    owner = await createTestUser({ first_name: "Owner", last_name: "One" });
    member = await createTestUser({ first_name: "Member", last_name: "Two" });
    stranger = await createTestUser({ first_name: "Stranger", last_name: "Three" });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  // ─── Create ────────────────────────────────────────────────────────

  describe("POST /api/boards", () => {
    it("creates a board with default lists", async () => {
      const res = await authRequest(owner)
        .post("/api/boards")
        .send({ name: "My Board", description: "A test board", color: "#FF5733" })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("My Board");
      expect(res.body.data.description).toBe("A test board");
      expect(res.body.data.color).toBe("#FF5733");
      expect(res.body.data.owner.id).toBe(owner.id);
      // Creates 3 default lists
      expect(res.body.data.lists).toHaveLength(3);
      expect(res.body.data.lists.map((l: { name: string }) => l.name)).toEqual([
        "To Do",
        "In Progress",
        "Done",
      ]);
    });

    it("creates a board with minimal input", async () => {
      const res = await authRequest(owner)
        .post("/api/boards")
        .send({ name: "Minimal Board" })
        .expect(201);

      expect(res.body.data.name).toBe("Minimal Board");
      expect(res.body.data.color).toBe("#4472C4"); // default color
    });

    it("rejects missing name", async () => {
      const res = await authRequest(owner)
        .post("/api/boards")
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.name).toBeDefined();
    });

    it("rejects empty name", async () => {
      const res = await authRequest(owner)
        .post("/api/boards")
        .send({ name: "" })
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects invalid color format", async () => {
      const res = await authRequest(owner)
        .post("/api/boards")
        .send({ name: "Bad Color", color: "red" })
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.color).toBeDefined();
    });
  });

  // ─── List ──────────────────────────────────────────────────────────

  describe("GET /api/boards", () => {
    let board1: TestBoard;
    let board2: TestBoard;

    beforeAll(async () => {
      await cleanDatabase();
      owner = await createTestUser({ first_name: "Owner", last_name: "One" });
      member = await createTestUser({ first_name: "Member", last_name: "Two" });
      stranger = await createTestUser({ first_name: "Stranger", last_name: "Three" });

      board1 = await createTestBoard(owner, "Board Alpha");
      board2 = await createTestBoard(owner, "Board Beta");
    });

    it("returns boards owned by the user", async () => {
      const res = await authRequest(owner)
        .get("/api/boards")
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.pagination).toHaveProperty("page");
      expect(res.body.pagination).toHaveProperty("total");
      expect(res.body.pagination).toHaveProperty("pages");
    });

    it("returns empty list for user with no boards", async () => {
      const res = await authRequest(stranger)
        .get("/api/boards")
        .expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it("supports pagination", async () => {
      const res = await authRequest(owner)
        .get("/api/boards?page=1&limit=1")
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.limit).toBe(1);
      expect(res.body.pagination.pages).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Get single ───────────────────────────────────────────────────

  describe("GET /api/boards/:boardId", () => {
    let board: TestBoard;

    beforeAll(async () => {
      await cleanDatabase();
      owner = await createTestUser({ first_name: "Owner", last_name: "One" });
      stranger = await createTestUser({ first_name: "Stranger", last_name: "Three" });
      board = await createTestBoard(owner, "Detail Board");
    });

    it("returns board with lists and members", async () => {
      const res = await authRequest(owner)
        .get(`/api/boards/${board.id}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(board.id);
      expect(res.body.data.name).toBe("Detail Board");
      expect(res.body.data.lists).toHaveLength(3);
      expect(res.body.data.owner.id).toBe(owner.id);
    });

    it("returns 404 for nonexistent board", async () => {
      const res = await authRequest(owner)
        .get("/api/boards/00000000-0000-0000-0000-000000000000")
        .expect(404);

      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 403 for non-member", async () => {
      const res = await authRequest(stranger)
        .get(`/api/boards/${board.id}`)
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // ─── Update ────────────────────────────────────────────────────────

  describe("PUT /api/boards/:boardId", () => {
    let board: TestBoard;

    beforeAll(async () => {
      await cleanDatabase();
      owner = await createTestUser({ first_name: "Owner", last_name: "One" });
      member = await createTestUser({ first_name: "Member", last_name: "Two" });
      stranger = await createTestUser({ first_name: "Stranger", last_name: "Three" });
      board = await createTestBoard(owner, "Update Me");
    });

    it("updates board name and description", async () => {
      const res = await authRequest(owner)
        .put(`/api/boards/${board.id}`)
        .send({ name: "Updated Name", description: "New description" })
        .expect(200);

      expect(res.body.data.name).toBe("Updated Name");
      expect(res.body.data.description).toBe("New description");
    });

    it("archives a board", async () => {
      const res = await authRequest(owner)
        .put(`/api/boards/${board.id}`)
        .send({ is_archived: true })
        .expect(200);

      expect(res.body.data.is_archived).toBe(true);
    });

    it("rejects update from non-owner (authorize 'admin')", async () => {
      const res = await authRequest(stranger)
        .put(`/api/boards/${board.id}`)
        .send({ name: "Hacked" })
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  // ─── Delete ────────────────────────────────────────────────────────

  describe("DELETE /api/boards/:boardId", () => {
    let board: TestBoard;

    beforeAll(async () => {
      await cleanDatabase();
      owner = await createTestUser({ first_name: "Owner", last_name: "One" });
      stranger = await createTestUser({ first_name: "Stranger", last_name: "Three" });
      board = await createTestBoard(owner, "Delete Me");
    });

    it("rejects delete from non-owner", async () => {
      const res = await authRequest(stranger)
        .delete(`/api/boards/${board.id}`)
        .expect(403);

      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("deletes the board (cascade)", async () => {
      const res = await authRequest(owner)
        .delete(`/api/boards/${board.id}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted/i);

      // Verify it's gone
      await authRequest(owner)
        .get(`/api/boards/${board.id}`)
        .expect(404);
    });

    it("returns 404 when deleting nonexistent board", async () => {
      const res = await authRequest(owner)
        .delete("/api/boards/00000000-0000-0000-0000-000000000000")
        .expect(404);

      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ─── Members ───────────────────────────────────────────────────────

  describe("Board Members", () => {
    let board: TestBoard;

    beforeAll(async () => {
      await cleanDatabase();
      owner = await createTestUser({ first_name: "Owner", last_name: "One" });
      member = await createTestUser({ first_name: "Member", last_name: "Two" });
      stranger = await createTestUser({ first_name: "Stranger", last_name: "Three" });
      board = await createTestBoard(owner, "Members Board");
    });

    describe("POST /api/boards/:boardId/members", () => {
      it("adds a member to the board", async () => {
        const res = await authRequest(owner)
          .post(`/api/boards/${board.id}/members`)
          .send({ user_id: member.id, role: "editor" })
          .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data.user.id).toBe(member.id);
      });

      it("rejects adding non-existent user", async () => {
        const res = await authRequest(owner)
          .post(`/api/boards/${board.id}/members`)
          .send({ user_id: "00000000-0000-0000-0000-000000000000" })
          .expect(404);

        expect(res.body.error.code).toBe("NOT_FOUND");
      });

      it("rejects adding owner as member", async () => {
        const res = await authRequest(owner)
          .post(`/api/boards/${board.id}/members`)
          .send({ user_id: owner.id })
          .expect(400);

        expect(res.body.error.code).toBe("BAD_REQUEST");
      });

      it("rejects non-owner/admin adding members", async () => {
        const res = await authRequest(stranger)
          .post(`/api/boards/${board.id}/members`)
          .send({ user_id: stranger.id })
          .expect(403);

        expect(res.body.error.code).toBe("FORBIDDEN");
      });
    });

    describe("DELETE /api/boards/:boardId/members/:userId", () => {
      it("allows owner to remove a member", async () => {
        // First add the member back if removed
        await authRequest(owner)
          .post(`/api/boards/${board.id}/members`)
          .send({ user_id: member.id, role: "editor" });

        const res = await authRequest(owner)
          .delete(`/api/boards/${board.id}/members/${member.id}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/removed/i);
      });

      it("rejects removing the board owner", async () => {
        const res = await authRequest(owner)
          .delete(`/api/boards/${board.id}/members/${owner.id}`)
          .expect(400);

        expect(res.body.error.code).toBe("BAD_REQUEST");
      });
    });
  });
});
