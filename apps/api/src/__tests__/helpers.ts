/**
 * Shared test helpers — database seeding, cleanup, and auth utilities.
 *
 * IMPORTANT (ESM):
 * 1. The Supabase mock is registered at module scope (before any app import).
 * 2. Call `await initTestSuite()` once in your top-level `beforeAll` to
 *    eagerly load app, prisma, and supertest via dynamic import().
 * 3. After that, `authRequest()` and other helpers are synchronous.
 */
import { jest } from "@jest/globals";
import { randomUUID } from "crypto";
import type { Express } from "express";

// ─── Types ───────────────────────────────────────────────────────────

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

export interface TestBoard {
  id: string;
  owner_id: string;
  name: string;
  lists: { id: string; name: string; position: number }[];
}

// ─── Supabase mock (registered before any app import) ────────────────

jest.unstable_mockModule("@supabase/supabase-js", () => ({
  createClient: (
    _url: string,
    _key: string,
    options?: { global?: { headers?: { Authorization?: string } } },
  ) => {
    const authHeader = options?.global?.headers?.Authorization ?? "";
    const token = authHeader.replace("Bearer ", "");

    return {
      auth: {
        getUser: async (passedToken?: string) => {
          const t = passedToken || token;

          // Test tokens follow the format "test-token-<userId>"
          if (t && t.startsWith("test-token-")) {
            const userId = t.replace("test-token-", "");
            return {
              data: {
                user: {
                  id: userId,
                  email: `${userId.slice(0, 8)}@test.com`,
                  user_metadata: { first_name: "Test", last_name: "User" },
                },
              },
              error: null,
            };
          }

          return {
            data: { user: null },
            error: { message: "Invalid token", status: 401 },
          };
        },
      },
    };
  },
}));

// ─── Eagerly-loaded singletons ───────────────────────────────────────

let _app: Express;
let _prisma: Awaited<typeof import("../config/database.js")>["prisma"];
let _request: typeof import("supertest");
let _initialized = false;

/**
 * Must be called once (typically in the top-level `beforeAll`) before
 * using `authRequest`, `cleanDatabase`, or any helper that touches the DB / app.
 */
export async function initTestSuite() {
  if (_initialized) return;

  const [appMod, supertestMod, dbMod] = await Promise.all([
    import("../app.js"),
    import("supertest"),
    import("../config/database.js"),
  ]);

  _app = appMod.default;
  _request = supertestMod.default;
  _prisma = dbMod.prisma;
  _initialized = true;
}

/** Get the Express app (must call initTestSuite first). */
export function getApp() {
  if (!_initialized) throw new Error("Call initTestSuite() in beforeAll first");
  return _app;
}

/** Get the Prisma client (must call initTestSuite first). */
export function getPrisma() {
  if (!_initialized) throw new Error("Call initTestSuite() in beforeAll first");
  return _prisma;
}

/** Get supertest's request function (must call initTestSuite first). */
function getRequest() {
  if (!_initialized) throw new Error("Call initTestSuite() in beforeAll first");
  return _request;
}

// ─── User helpers ────────────────────────────────────────────────────

/** Create a profile in the database and return a test user with an auth token. */
export async function createTestUser(overrides?: {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}): Promise<TestUser> {
  const prisma = getPrisma();
  const id = overrides?.id ?? randomUUID();
  const email = overrides?.email ?? `${id.slice(0, 8)}@test.com`;

  await prisma.profile.upsert({
    where: { id },
    update: {},
    create: {
      id,
      email,
      first_name: overrides?.first_name ?? "Test",
      last_name: overrides?.last_name ?? "User",
    },
  });

  return {
    id,
    email,
    token: `test-token-${id}`,
  };
}

// ─── Board helpers ───────────────────────────────────────────────────

/** Create a board via the API and return its data. */
export async function createTestBoard(
  user: TestUser,
  name = "Test Board",
): Promise<TestBoard> {
  const request = getRequest();
  const app = getApp();

  const res = await request(app)
    .post("/api/boards")
    .set("Authorization", `Bearer ${user.token}`)
    .send({ name })
    .expect(201);

  return {
    id: res.body.data.id,
    owner_id: user.id,
    name: res.body.data.name,
    lists: res.body.data.lists,
  };
}

/** Create a task via the API and return its data. */
export async function createTestTask(
  user: TestUser,
  boardId: string,
  listId: string,
  title = "Test Task",
  extra?: { priority?: string; description?: string },
) {
  const request = getRequest();
  const app = getApp();

  const res = await request(app)
    .post(`/api/boards/${boardId}/tasks`)
    .set("Authorization", `Bearer ${user.token}`)
    .send({ title, list_id: listId, ...extra })
    .expect(201);

  return res.body.data;
}

// ─── Cleanup ─────────────────────────────────────────────────────────

/**
 * Delete all test data from the database.
 * Order matters due to foreign key constraints.
 */
export async function cleanDatabase() {
  const prisma = getPrisma();
  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.taskAssignee.deleteMany(),
    prisma.task.deleteMany(),
    prisma.list.deleteMany(),
    prisma.boardMember.deleteMany(),
    prisma.board.deleteMany(),
    prisma.profile.deleteMany(),
  ]);
}

// ─── Request builder ─────────────────────────────────────────────────

/**
 * Synchronous convenience wrapper for authenticated requests.
 * Returns an object with get / post / put / delete methods that
 * already include the Authorization header.
 *
 * Requires `initTestSuite()` to have been called.
 */
export function authRequest(user: TestUser) {
  const app = getApp();
  const request = getRequest();

  return {
    get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${user.token}`),
    post: (url: string) => request(app).post(url).set("Authorization", `Bearer ${user.token}`),
    put: (url: string) => request(app).put(url).set("Authorization", `Bearer ${user.token}`),
    delete: (url: string) => request(app).delete(url).set("Authorization", `Bearer ${user.token}`),
  };
}
