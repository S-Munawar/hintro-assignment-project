# Hintro — Architecture Document

**Real-Time Task Collaboration Platform**

PERN Stack (PostgreSQL, Express, React/Next.js, Node.js)

---

## Executive Summary

This document describes the architecture of **Hintro**, a real-time Kanban board application built with the PERN stack. Users can create boards, organise tasks across lists, drag-and-drop across columns, collaborate in real-time via Socket.IO, and review a full activity audit trail.

### Architectural Highlights

| Concern | Choice |
|---|---|
| Frontend | Next.js 16 (App Router) with React 19, Zustand 5, Tailwind CSS 3, @dnd-kit |
| Backend | Express 5, Prisma 6, Socket.IO 4, Zod validation |
| Database | Prisma Postgres (managed PostgreSQL) |
| Real-time | Socket.IO (WebSocket + polling fallback) |
| Auth | Supabase Auth (email/password, OAuth) |
| Monorepo | Turborepo 2 with pnpm 9 workspaces |
| Testing | Vitest 4 (frontend — 348 tests), Jest 30 (backend — 150 tests) |
| CI/CD | GitHub Actions → Docker Hub → GCE Docker Compose |

---

## 1. System Overview

### 1.1 High-Level Architecture

Three-tier architecture:

1. **Presentation Layer** — Next.js 16 App Router with server/client components
2. **Application Layer** — Express 5 REST API + Socket.IO for WebSockets
3. **Data Layer** — Prisma Postgres (managed) via Prisma 6 ORM

### 1.2 Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend Framework | Next.js | 16.1.5 | SSR, routing, React server components |
| UI Library | React | 19.2 | Component rendering |
| State Management | Zustand | 5 | Lightweight client stores |
| Drag & Drop | @dnd-kit | core 6.3, sortable 10.0 | Cross-list task reordering |
| Styling | Tailwind CSS | 3.4 | Utility-first CSS |
| HTTP Client | Axios | 1.7 | API requests with interceptors |
| Real-time (client) | Socket.IO Client | 4.8 | WebSocket communication |
| Icons | Lucide React | — | SVG icon library |
| Backend Runtime | Node.js | ≥ 18 (20 recommended) | JavaScript runtime |
| Web Framework | Express | 5.1 | HTTP server and routing |
| ORM | Prisma | 6.8 | Type-safe DB client and migrations |
| Database | Prisma Postgres | Managed | Relational persistence |
| Auth | Supabase Auth | 2.49 | Managed authentication |
| Validation | Zod | 3.24 | Schema validation (shared package) |
| Security | Helmet | 8.1 | HTTP security headers |
| Rate Limiting | express-rate-limit | 7.5 | Request throttling |
| Logging | Morgan | — | HTTP request logging |
| Backend Tests | Jest | 30 | Unit + integration tests |
| Frontend Tests | Vitest | 4 | Unit + component tests |
| Monorepo | Turborepo | 2.8 | Build orchestration |
| Package Manager | pnpm | 9.0 | Fast, disk-efficient |
| Containerisation | Docker / Compose | — | Multi-service deployment |

### 1.3 Monorepo Structure

```
/
├── apps/
│   ├── web/                 # Next.js 16 frontend (App Router)
│   └── api/                 # Express 5 REST API + Socket.IO
├── packages/
│   ├── shared/              # Zod schemas, TypeScript types, enums
│   ├── eslint-config/       # Shared ESLint configurations
│   ├── typescript-config/   # Shared tsconfig presets
│   └── ui/                  # Shared React component library
├── docker-compose.yml       # API + Web (Prisma Postgres)
├── turbo.json               # Pipeline: build, lint, check-types, dev
├── pnpm-workspace.yaml      # apps/*, packages/*
└── package.json             # Root with pnpm@9, Node ≥18
```

**Turborepo pipeline** (`turbo.json`):

- `build` — depends on `^build` (topological)
- `lint` — independent
- `check-types` — depends on `^check-types`
- `dev` — persistent, cached

---

## 2. Frontend Architecture

### 2.1 Project Structure

The frontend uses Next.js 16 **App Router** (not Pages Router):

```
apps/web/
├── app/                         # App Router pages
│   ├── layout.tsx               # Root layout (Providers, AuthGuard)
│   ├── page.tsx                 # Dashboard (board list)
│   ├── login/page.tsx           # Login form
│   ├── signup/page.tsx          # Signup form
│   ├── forgot-password/page.tsx # Password reset
│   ├── settings/page.tsx        # User settings
│   ├── auth/callback/page.tsx   # OAuth callback handler
│   └── board/[boardId]/page.tsx # Kanban board view
├── components/
│   ├── Auth/                    # LoginForm, SignupForm, AuthGuard, AuthenticatedLayout
│   ├── Board/                   # BoardCard, BoardHeader, ListColumn, CreateBoardModal,
│   │                            #   CreateListForm, BoardMembersModal
│   ├── Task/                    # TaskCard, TaskDetailModal, CreateTaskForm
│   ├── Activity/                # ActivityLog
│   ├── Layout/                  # Sidebar
│   ├── Common/                  # Modal, Loader, Toast
│   └── Providers.tsx            # Zustand + socket providers
├── store/
│   ├── useAuthStore.ts          # Auth state & Supabase actions
│   ├── useBoardStore.ts         # Board CRUD state
│   ├── useTaskStore.ts          # Task CRUD + drag-and-drop state
│   ├── useSocketStore.ts        # Socket.IO connection state
│   └── useToastStore.ts         # Toast notification state
├── hooks/
│   ├── useAuth.ts               # Auth lifecycle hook
│   ├── useSocket.ts             # Socket.IO connection hook
│   └── useBoardSocket.ts        # Board-specific socket events
├── lib/
│   ├── api.ts                   # Axios instance with auth interceptor
│   ├── supabaseClient.ts        # Supabase browser client
│   └── authService.ts           # Wraps Supabase Auth methods
└── __tests__/                   # 348 Vitest tests
    ├── components/
    ├── hooks/
    └── store/
```

### 2.2 State Management (Zustand 5)

Five stores manage application state:

**Auth Store** (`useAuthStore`)
- State: `user`, `session`, `isAuthenticated`, `isLoading`
- Actions: `signIn`, `signUp`, `signOut`, `signInWithOAuth`, `updateProfile`
- Listens to `supabase.auth.onAuthStateChange()` for session sync

**Board Store** (`useBoardStore`)
- State: `boards`, `currentBoard`, `isLoading`, `error`
- Actions: `fetchBoards`, `createBoard`, `updateBoard`, `deleteBoard`, `setCurrentBoard`

**Task Store** (`useTaskStore`)
- State: `tasks` (keyed by list), `isLoading`
- Actions: `fetchTasks`, `createTask`, `updateTask`, `deleteTask`, `moveTask`, `assignUser`, `unassignUser`
- Supports optimistic drag-and-drop updates

**Socket Store** (`useSocketStore`)
- State: `socket`, `isConnected`
- Actions: `connect`, `disconnect`, `joinBoard`, `leaveBoard`

**Toast Store** (`useToastStore`)
- State: `toasts` (array)
- Actions: `addToast`, `removeToast`

### 2.3 Drag & Drop (@dnd-kit)

Task cards use `@dnd-kit/core` + `@dnd-kit/sortable`:

- **`TaskCard`** — uses `useSortable` hook for drag handles, reduced opacity while dragging
- **`ListColumn`** — wraps tasks in `SortableContext` with `verticalListSortingStrategy`, uses `useDroppable` for empty-list drop targets
- **`BoardPage`** — `DndContext` with `pointerSensor`, `DragOverlay` for floating preview card, `onDragOver` handles cross-list moves, `onDragEnd` persists final position via API
- Optimistic updates with rollback tracked via `dragOriginRef`

### 2.4 Real-time Updates

`useBoardSocket` hook manages Socket.IO event subscriptions per board:

**Events handled:**

| Event | Action |
|---|---|
| `task:created` | Add task to store |
| `task:updated` | Merge updated task |
| `task:deleted` | Remove task from store |
| `task:moved` | Reposition task |
| `board:updated` | Update board details |
| `list:created` | Add list to store |
| `list:updated` | Update list details |
| `list:deleted` | Remove list from store |
| `member:added` | Add member to board |
| `member:removed` | Remove member from board |

### 2.5 Routing

| Route | Page Component | Auth |
|---|---|---|
| `/` | Dashboard (board list) | Required |
| `/login` | LoginForm | Public |
| `/signup` | SignupForm | Public |
| `/forgot-password` | Password reset | Public |
| `/board/[boardId]` | Kanban board view | Required |
| `/settings` | User settings | Required |
| `/auth/callback` | OAuth redirect handler | Public |

`AuthGuard` component wraps protected routes and redirects unauthenticated users.

---

## 3. Backend Architecture

### 3.1 Express Server Structure

```
apps/api/
├── src/
│   ├── app.ts                    # Express 5 app + HTTP server + Socket.IO init
│   ├── config/
│   │   ├── database.ts           # Prisma client singleton
│   │   └── env.ts                # Environment variable config
│   ├── middleware/
│   │   ├── auth.ts               # Supabase JWT verification
│   │   ├── authorize.ts          # Role-based board membership check
│   │   ├── validation.ts         # Zod schema validation
│   │   └── errorHandler.ts       # Centralised error handler
│   ├── routes/
│   │   ├── boards.ts             # Board + member + list + activity routes
│   │   ├── tasks.ts              # Task CRUD + move + assignee routes
│   │   └── users.ts              # User search route
│   ├── controllers/
│   │   ├── boardController.ts    # Board CRUD + member management
│   │   ├── listController.ts     # List create/update/delete
│   │   ├── taskController.ts     # Task CRUD + move + assign/unassign
│   │   ├── activityController.ts # Activity log retrieval
│   │   └── userController.ts     # User search
│   ├── services/
│   │   ├── boardService.ts       # Board business logic
│   │   ├── listService.ts        # List business logic
│   │   ├── taskService.ts        # Task business logic
│   │   ├── activityService.ts    # Activity logging
│   │   ├── userService.ts        # User search logic
│   │   └── socketService.ts      # Socket.IO initialisation + event types
│   └── utils/
│       ├── logger.ts             # Winston/console logger
│       └── supabase.ts           # Supabase admin client (service role)
├── prisma/
│   ├── schema.prisma             # 7 models, 4 enums, indexes
│   └── migrations/               # SQL migrations
└── package.json
```

### 3.2 Middleware Stack (in order)

1. **Helmet** — HTTP security headers
2. **CORS** — Restricted to `CORS_ORIGIN`
3. **Body Parser** — JSON (1MB limit) + URL-encoded
4. **Morgan** — HTTP request logging (disabled in test)
5. **Rate Limiter** — 100 requests / 15 minutes on `/api` routes
6. **Auth Middleware** — Verifies Supabase JWT, attaches `req.userId`
7. **Authorise Middleware** — Checks board membership + role (`admin`, `editor`, `viewer`)
8. **Validation Middleware** — Validates request body/query against Zod schemas from `@repo/shared`
9. **Error Handler** — Consistent `{ success: false, error: { code, message } }` format

### 3.3 API Endpoints

#### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check (status, uptime, timestamp) |

#### Boards

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/boards` | ✓ | any | List user's boards (paginated) |
| POST | `/api/boards` | ✓ | any | Create new board |
| GET | `/api/boards/:boardId` | ✓ | member | Get board with lists & tasks |
| PUT | `/api/boards/:boardId` | ✓ | owner | Update board |
| DELETE | `/api/boards/:boardId` | ✓ | owner | Delete board |

#### Members

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/boards/:boardId/members` | ✓ | admin | Add member to board |
| DELETE | `/api/boards/:boardId/members/:userId` | ✓ | member | Remove member |

#### Lists

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/boards/:boardId/lists` | ✓ | admin, editor | Create list |
| PUT | `/api/boards/:boardId/lists/:listId` | ✓ | admin, editor | Update list |
| DELETE | `/api/boards/:boardId/lists/:listId` | ✓ | admin | Delete list |

#### Tasks

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/boards/:boardId/tasks` | ✓ | member | List tasks (filtered, paginated) |
| POST | `/api/boards/:boardId/tasks` | ✓ | admin, editor | Create task |
| GET | `/api/boards/:boardId/tasks/:taskId` | ✓ | member | Get task detail |
| PUT | `/api/boards/:boardId/tasks/:taskId` | ✓ | admin, editor | Update task |
| DELETE | `/api/boards/:boardId/tasks/:taskId` | ✓ | admin, editor | Delete task |
| PUT | `/api/boards/:boardId/tasks/:taskId/move` | ✓ | admin, editor | Move task (drag & drop) |
| POST | `/api/boards/:boardId/tasks/:taskId/assignees` | ✓ | admin, editor | Assign user |
| DELETE | `/api/boards/:boardId/tasks/:taskId/assignees/:userId` | ✓ | admin, editor | Unassign user |

#### Activity

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/boards/:boardId/activity` | ✓ | member | Activity log (paginated, filterable by task) |

#### Users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/users/search?q=...&limit=...` | ✓ | Search users by name/email |

### 3.4 Validation Schemas (Zod — `@repo/shared`)

All input validation is handled by Zod schemas in `packages/shared/src/schemas/`:

| Schema | Fields |
|---|---|
| `CreateBoardInput` | `name` (1-255), `description?`, `color?` (#hex) |
| `UpdateBoardInput` | `name?`, `description?`, `color?`, `is_archived?` |
| `AddBoardMemberInput` | `user_id` (uuid), `role?` (admin/editor/viewer) |
| `CreateListInput` | `name` (1-255), `position?` (int) |
| `UpdateListInput` | `name?`, `position?` |
| `CreateTaskInput` | `list_id` (uuid), `title` (1-255), `description?`, `priority?`, `due_date?` |
| `UpdateTaskInput` | `title?`, `description?`, `position?`, `priority?`, `due_date?`, `is_completed?`, `list_id?` |
| `MoveTaskInput` | `list_id` (uuid), `position` (int) |
| `AssignUserInput` | `user_id` (uuid) |
| `PaginationQuery` | `page` (default 1), `limit` (max 100), `sort?`, `order` (asc/desc) |
| `TaskFilterQuery` | extends Pagination + `search?`, `priority?`, `is_completed?`, `list_id?`, `assigned_to?` |
| `ActivityFilterQuery` | extends Pagination + `task_id?` |
| `UserSearchQuery` | `q` (1-255), `limit` (max 20) |

### 3.5 Authentication Flow (Supabase)

**Login Flow:**
1. Frontend calls `supabase.auth.signInWithPassword({ email, password })`
2. Supabase returns session with access token & refresh token
3. `useAuthStore` listens to `onAuthStateChange()` and updates state
4. Axios interceptor attaches `Authorization: Bearer <token>` to API requests

**OAuth Flow:**
1. Frontend calls `supabase.auth.signInWithOAuth({ provider: 'google' | 'github' })`
2. User redirected to provider → back to `/auth/callback`
3. Supabase establishes session automatically

**Backend Verification:**
1. `authMiddleware` extracts Bearer token from `Authorization` header
2. Creates a per-request Supabase client (anon key + caller's Bearer token) and calls `supabase.auth.getUser(token)`
3. Auto-creates a profile row if one does not exist, then attaches `req.userId`
4. `authorize()` middleware checks `board_members` table for role-based access

### 3.6 Service Layer

| Service | Key Methods |
|---|---|
| `boardService` | `getBoardsForUser`, `createBoard`, `getBoardWithLists`, `updateBoard`, `deleteBoard`, `addMember`, `removeMember` |
| `listService` | `createList`, `updateList`, `deleteList` |
| `taskService` | `getTasksByBoardId`, `createTask`, `getTaskById`, `updateTask`, `deleteTask`, `moveTask`, `assignUser`, `unassignUser` |
| `activityService` | `getActivity`, `logActivity` |
| `userService` | `searchUsers` |
| `socketService` | `initSocketIO`, `getIO`, `emitToBoard` |

---

## 4. Database Design (Prisma Postgres)

### 4.1 Schema Overview

Managed by **Prisma 6** with migrations. 7 models + 4 enums:

```
auth.users (Supabase-managed)
    │
    └── profiles (1:1, trigger-created on signup)
            │
            ├── boards (owner_id)
            │     ├── board_members (user_id + role)
            │     ├── lists (position-ordered)
            │     │     └── tasks (position-ordered)
            │     │           └── task_assignees
            │     └── activity_logs
            └── (created_tasks, task_assignees, activity_logs)
```

### 4.2 Enums

```sql
TaskPriority: low | medium | high | urgent
BoardRole:    admin | editor | viewer
ActionType:   create | update | delete | move
EntityType:   board | list | task | comment
```

### 4.3 Tables

#### profiles

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, references auth.users(id) |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL |
| `first_name` | VARCHAR(100) | NOT NULL |
| `last_name` | VARCHAR(100) | NOT NULL |
| `avatar_url` | TEXT | nullable |
| `is_active` | BOOLEAN | DEFAULT true |
| `created_at` | TIMESTAMP | DEFAULT now() |
| `updated_at` | TIMESTAMP | @updatedAt |

> A Supabase database trigger auto-creates a `profiles` row when a new user signs up.

#### boards

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, auto-generated |
| `owner_id` | UUID | FK → profiles(id), ON DELETE CASCADE |
| `name` | VARCHAR(255) | NOT NULL |
| `description` | TEXT | nullable |
| `color` | VARCHAR(7) | DEFAULT '#4472C4' |
| `is_archived` | BOOLEAN | DEFAULT false |
| `created_at` | TIMESTAMP | DEFAULT now() |
| `updated_at` | TIMESTAMP | @updatedAt |

#### board_members

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `board_id` | UUID | FK → boards, ON DELETE CASCADE |
| `user_id` | UUID | FK → profiles, ON DELETE CASCADE |
| `role` | BoardRole | DEFAULT 'editor' |
| `joined_at` | TIMESTAMP | DEFAULT now() |
| | | UNIQUE(board_id, user_id) |

#### lists

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `board_id` | UUID | FK → boards, ON DELETE CASCADE |
| `name` | VARCHAR(255) | NOT NULL |
| `position` | INTEGER | NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT now() |
| `updated_at` | TIMESTAMP | @updatedAt |

#### tasks

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `list_id` | UUID | FK → lists, ON DELETE CASCADE |
| `title` | VARCHAR(255) | NOT NULL |
| `description` | TEXT | nullable |
| `position` | INTEGER | NOT NULL |
| `priority` | TaskPriority | DEFAULT 'medium' |
| `due_date` | DATE | nullable |
| `is_completed` | BOOLEAN | DEFAULT false |
| `created_by` | UUID | FK → profiles, ON DELETE CASCADE |
| `created_at` | TIMESTAMP | DEFAULT now() |
| `updated_at` | TIMESTAMP | @updatedAt |

#### task_assignees

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `task_id` | UUID | FK → tasks, ON DELETE CASCADE |
| `user_id` | UUID | FK → profiles, ON DELETE CASCADE |
| `assigned_at` | TIMESTAMP | DEFAULT now() |
| | | UNIQUE(task_id, user_id) |

#### activity_logs

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `board_id` | UUID | FK → boards, ON DELETE CASCADE |
| `task_id` | UUID | FK → tasks, ON DELETE SET NULL, nullable |
| `user_id` | UUID | FK → profiles, ON DELETE CASCADE |
| `action_type` | ActionType | NOT NULL |
| `entity_type` | EntityType | NOT NULL |
| `changes` | JSONB | nullable |
| `created_at` | TIMESTAMP | DEFAULT now() |

### 4.4 Indexing Strategy

| Index | Table | Columns | Purpose |
|---|---|---|---|
| `idx_boards_owner_id` | boards | (owner_id) | Find user's boards |
| `idx_board_members_user` | board_members | (user_id) | Find user's memberships |
| `idx_tasks_list_position` | tasks | (list_id, position) | Optimise task ordering |
| `idx_tasks_created_by` | tasks | (created_by) | Find user's created tasks |
| `idx_task_assignees_user` | task_assignees | (user_id) | Find user's assigned tasks |
| `idx_activity_board_time` | activity_logs | (board_id, created_at DESC) | Activity timeline queries |

---

## 5. Real-time Communication (Socket.IO 4)

### 5.1 Architecture

Socket.IO runs on the same HTTP server as Express. Authentication is performed during the WebSocket handshake via middleware that validates the Supabase JWT.

### 5.2 Event Types

**Client → Server:**

| Event | Payload | Action |
|---|---|---|
| `join-board` | `boardId: string` | Join socket room `board:{boardId}` |
| `leave-board` | `boardId: string` | Leave socket room |

**Server → Client** (broadcast to board room via REST controllers):

| Event | Payload |
|---|---|
| `task:created` | `{ boardId, task }` |
| `task:updated` | `{ boardId, task }` |
| `task:deleted` | `{ boardId, taskId, listId }` |
| `task:moved` | `{ boardId, task }` |
| `board:updated` | `{ boardId, board }` |
| `list:created` | `{ boardId, list }` |
| `list:updated` | `{ boardId, list }` |
| `list:deleted` | `{ boardId, listId }` |
| `member:added` | `{ boardId, member }` |
| `member:removed` | `{ boardId, userId }` |

### 5.3 Implementation Pattern

Events are **not** initiated via WebSocket. Instead:
1. Client makes REST API call (e.g., `PUT /api/boards/:boardId/tasks/:taskId`)
2. Controller calls service layer → database update
3. Controller calls `emitToBoard(boardId, event, data)` to broadcast
4. All connected clients in the board room receive the event
5. Frontend stores update state reactively

### 5.4 Connection Authentication

```typescript
// Socket.IO auth middleware (simplified)
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return next(new Error("Invalid token"));
  socket.userId = user.id;
  next();
});
```

---

## 6. API Contract Design

### 6.1 Response Format

**Success (200/201):**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "pagination": { "page": 1, "limit": 10, "total": 45, "pages": 5 }
}
```

**Error (4xx/5xx):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [ ... ]
  }
}
```

### 6.2 Authentication Header

```
Authorization: Bearer <supabase_access_token>
```

### 6.3 Pagination

```
GET /api/boards?page=1&limit=10&sort=created_at&order=desc
```

### 6.4 Task Filtering

```
GET /api/boards/:boardId/tasks?search=auth&priority=high&is_completed=false&list_id=<uuid>&assigned_to=<uuid>
```

---

## 7. Security

### 7.1 Authentication

- Delegated to **Supabase Auth** — no custom auth logic on backend
- Supported methods: email/password, Google OAuth, GitHub OAuth
- JWTs signed with project-specific secret, verified on every API request
- Auto-refresh handled by Supabase client SDK

### 7.2 Authorisation

| Role | Permissions | Scope |
|---|---|---|
| Owner | Full control, delete board, manage members | Board |
| Admin | Update board, manage members, all task/list ops | Board |
| Editor | Create, edit, delete, move tasks and lists | Board |
| Viewer | Read-only access | Board |

### 7.3 API Security Measures

- **Helmet** — Security headers (CSP, HSTS, X-Frame-Options, etc.)
- **CORS** — Restricted to `CORS_ORIGIN` environment variable
- **Rate Limiting** — 100 requests per 15 minutes per IP on `/api` routes
- **Input Validation** — All inputs validated with Zod schemas before processing
- **SQL Injection Prevention** — Parameterised queries via Prisma ORM
- **HTTPS** — Required in production

---

## 8. Testing

### 8.1 Backend (Jest 30)

- **150 tests** covering controllers, services, middleware
- Supertest for HTTP integration tests
- Mocked Prisma client and Supabase auth
- ESM support via `--experimental-vm-modules`

### 8.2 Frontend (Vitest 4)

- **348 tests** covering components, hooks, stores
- React Testing Library for component tests
- Mocked API calls, Socket.IO, Supabase client, @dnd-kit hooks
- jsdom environment

### 8.3 Total: 498 tests, all passing

---

## 9. Deployment Architecture

### 9.1 Docker

**API Dockerfile** (multi-stage):

```dockerfile
# Stage 1: Install deps
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Stage 2: Build (prisma generate + tsc)
FROM base AS builder
# ... copy workspace, install, build

# Stage 3: Production runner
FROM node:20-alpine AS runner
USER appuser
EXPOSE 5000
CMD ["node", "dist/app.js"]
```

### 9.2 Google Compute Engine

Both services run on a single GCE VM via Docker Compose:

| Service | Container | Port | Depends On |
|---|---|---|---|
| `api` | Pulled from Docker Hub | 5000 | — |
| `web` | Pulled from Docker Hub | 3000 | api (healthy) |

Docker images are stored on **Docker Hub** (`<username>/hintro-api`, `<username>/hintro-web`).

### 9.3 CI/CD Pipeline (GitHub Actions)

**CI** (`.github/workflows/ci.yml`) — on push/PR to `master`/`develop`:

```
┌─────────────────┐
│   lint +         │
│   check-types    │
└────────┬────────┘
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│test-  │ │test-  │
│web    │ │api    │
│(Vitest)│ │(Jest) │
└───┬───┘ └──┬────┘
    └────┬────┘
    ┌────▼────┐
    │  build  │
    └─────────┘
```

**CD** (`.github/workflows/cd.yml`) — on push to `main`:

1. Run full CI pipeline
2. Authenticate to GCP via Workload Identity Federation
3. Build & push Docker images to Docker Hub
4. SSH into GCE VM → pull images → `docker compose up`
5. Run Prisma migrations inside API container

### 9.4 Environment Variables

**Backend (`apps/api/.env`):**

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Default 5000 |
| `NODE_ENV` | No | development / production / test |
| `CORS_ORIGIN` | No | Default http://localhost:3000 |
| `DATABASE_URL` | Yes | Prisma Postgres connection string (`prisma+postgres://…`) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `SUPABASE_JWT_SECRET` | Yes | Supabase JWT signing secret |

**Frontend (`apps/web/.env.local`):**

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |

---

## 10. Trade-offs & Decisions

| Decision | Trade-off | Rationale |
|---|---|---|
| REST over GraphQL | More endpoints, simpler caching | Straightforward for CRUD, easy testing |
| Next.js App Router over SPA | SSR complexity | Built-in routing, layouts, React Server Components |
| Zod over Joi | Smaller ecosystem | First-class TypeScript inference, shared client/server |
| @dnd-kit over react-beautiful-dnd | Newer, less battle-tested | Active maintenance, headless design, React 19 support |
| Socket.IO over raw WS | Larger bundle | Automatic reconnection, rooms, fallback transports |
| Prisma Postgres over self-hosted PG | Managed dependency | Zero-ops database, built-in connection pooling, Accelerate caching |
| GCE + Docker Compose over K8s | Manual scaling | Simple single-server ops, full control, persistent WebSocket support |
| Vitest over Jest (frontend) | Different from backend | Native ESM, faster, Vite integration |

---

## 11. Conclusion

Hintro's PERN architecture delivers a production-ready, real-time Kanban platform with:

- **Turborepo monorepo** for shared code, parallel builds, and unified CI/CD
- **Next.js 16 + React 19** front end with Zustand stores, @dnd-kit drag-and-drop, and Tailwind CSS
- **Express 5 + Prisma 6** back end with Zod validation and Socket.IO real-time
- **Supabase Auth** for managed authentication with role-based authorisation
- **498 automated tests** (Vitest + Jest) with GitHub Actions CI/CD
- **Google Compute Engine** deployment with Docker Compose, Docker Hub, and Prisma Postgres
