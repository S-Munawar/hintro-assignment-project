import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import {
  initTestSuite,
  createTestUser,
  cleanDatabase,
  authRequest,
  type TestUser,
} from "../helpers.js";

describe("User Search", () => {
  let alice: TestUser;
  let bob: TestUser;
  let charlie: TestUser;

  beforeAll(async () => {
    await initTestSuite();
    await cleanDatabase();
    alice = await createTestUser({ first_name: "Alice", last_name: "Johnson", email: "alice@example.com" });
    bob = await createTestUser({ first_name: "Bob", last_name: "Smith", email: "bob@example.com" });
    charlie = await createTestUser({ first_name: "Charlie", last_name: "Brown", email: "charlie@example.com" });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe("GET /api/users/search", () => {
    it("returns 401 without auth", async () => {
      const { default: supertest } = await import("supertest");
      const { default: app } = await import("../../app.js");
      await supertest(app).get("/api/users/search?q=alice").expect(401);
    });

    it("returns 400 without query param", async () => {
      await authRequest(alice).get("/api/users/search").expect(400);
    });

    it("searches users by first name", async () => {
      const res = await authRequest(alice).get("/api/users/search?q=Bob").expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].first_name).toBe("Bob");
      expect(res.body.data[0].email).toBe("bob@example.com");
    });

    it("searches users by email", async () => {
      const res = await authRequest(alice).get("/api/users/search?q=charlie@").expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].first_name).toBe("Charlie");
    });

    it("searches users by last name", async () => {
      const res = await authRequest(alice).get("/api/users/search?q=smith").expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].first_name).toBe("Bob");
    });

    it("excludes the requesting user from results", async () => {
      const res = await authRequest(alice).get("/api/users/search?q=alice").expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it("is case-insensitive", async () => {
      const res = await authRequest(bob).get("/api/users/search?q=ALICE").expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].first_name).toBe("Alice");
    });

    it("returns empty array for no matches", async () => {
      const res = await authRequest(alice).get("/api/users/search?q=zzzznoone").expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it("respects limit parameter", async () => {
      const res = await authRequest(alice).get("/api/users/search?q=@example.com&limit=1").expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it("returns correct user shape", async () => {
      const res = await authRequest(alice).get("/api/users/search?q=bob").expect(200);

      const user = res.body.data[0];
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("email");
      expect(user).toHaveProperty("first_name");
      expect(user).toHaveProperty("last_name");
      expect(user).toHaveProperty("avatar_url");
      // Should NOT expose sensitive fields
      expect(user).not.toHaveProperty("is_active");
      expect(user).not.toHaveProperty("created_at");
    });
  });
});
