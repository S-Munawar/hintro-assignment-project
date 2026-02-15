import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import {
  initTestSuite,
  getApp,
  getPrisma,
  createTestUser,
  cleanDatabase,
  type TestUser,
} from "../helpers.js";

let request: typeof import("supertest");

describe("Authentication & Health", () => {
  let user: TestUser;

  beforeAll(async () => {
    await initTestSuite();
    const mod = await import("supertest");
    request = mod.default;
    await cleanDatabase();
    user = await createTestUser();
  });

  afterAll(async () => {
    await cleanDatabase();
    getPrisma().$disconnect();
  });

  // ─── Public endpoints ──────────────────────────────────────────────

  describe("GET /", () => {
    it("returns welcome message", async () => {
      const app = getApp();
      const res = await request(app).get("/").expect(200);

      expect(res.body).toEqual({
        success: true,
        message: "Welcome to the Hintro API",
      });
    });
  });

  describe("GET /api/health", () => {
    it("returns health status", async () => {
      const app = getApp();
      const res = await request(app).get("/api/health").expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("ok");
      expect(res.body.data).toHaveProperty("timestamp");
      expect(res.body.data).toHaveProperty("uptime");
    });
  });

  describe("GET /nonexistent", () => {
    it("returns 404 for unknown routes", async () => {
      const app = getApp();
      const res = await request(app).get("/nonexistent").expect(404);

      expect(res.body).toEqual({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "The requested resource was not found",
        },
      });
    });
  });

  // ─── Auth middleware ───────────────────────────────────────────────

  describe("Protected routes", () => {
    it("rejects requests without Authorization header", async () => {
      const app = getApp();
      const res = await request(app).get("/api/boards").expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
      expect(res.body.error.message).toMatch(/missing/i);
    });

    it("rejects requests with malformed Authorization header", async () => {
      const app = getApp();
      const res = await request(app)
        .get("/api/boards")
        .set("Authorization", "InvalidScheme abc123")
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects requests with invalid token", async () => {
      const app = getApp();
      const res = await request(app)
        .get("/api/boards")
        .set("Authorization", "Bearer invalid-token-value")
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
      expect(res.body.error.message).toMatch(/invalid|expired/i);
    });

    it("accepts requests with valid token", async () => {
      const app = getApp();
      const res = await request(app)
        .get("/api/boards")
        .set("Authorization", `Bearer ${user.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
