# Hintro API Documentation

> **Base URL:** `http://localhost:5000` (development) | `https://api.your-domain.com` (production)
>
> **Version:** 1.0.0
>
> **Authentication:** Supabase JWT — all endpoints (except health) require `Authorization: Bearer <token>`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Error Codes](#error-codes)
5. [Rate Limiting](#rate-limiting)
6. [Endpoints](#endpoints)
   - [Health](#health)
   - [Boards](#boards)
   - [Members](#members)
   - [Lists](#lists)
   - [Tasks](#tasks)
   - [Task Movement](#task-movement)
   - [Task Assignees](#task-assignees)
   - [Activity](#activity)
   - [Users](#users)
7. [WebSocket Events](#websocket-events)
8. [Validation Schemas](#validation-schemas)
9. [Enums](#enums)
10. [Pagination](#pagination)

---

## Overview

The Hintro API is a RESTful service built with Express 5 and Prisma 6 ORM. Real-time updates are delivered via Socket.IO 4 on the same HTTP server.

**Key characteristics:**
- JSON request/response bodies
- UUID identifiers for all resources
- Zod schema validation on all inputs
- Role-based access control (admin, editor, viewer) per board
- Paginated list endpoints with filtering and sorting

---

## Authentication

All API endpoints (except `GET /api/health`) require a valid **Supabase access token**.

### Request Header

```
Authorization: Bearer <supabase_access_token>
```

### How to obtain a token

Use the Supabase client SDK:

```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

### Backend verification

The `authMiddleware` creates a per-request Supabase client (using the anon key and the caller's Bearer token) and calls `supabase.auth.getUser(token)` to verify the JWT. If valid, the user's UUID is attached to the request as `req.userId`. A profile row is auto-created in the database if one does not already exist.

---

## Response Format

### Success Response (2xx)

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

For paginated endpoints, a `pagination` object is included:

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "pages": 5
  }
}
```

### Error Response (4xx/5xx)

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": [ ... ]
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Input failed Zod schema validation |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Insufficient role for this action |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Duplicate resource (e.g., member already added) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Rate Limiting

- **Window:** 15 minutes
- **Max requests:** 100 per IP per window
- **Scope:** All `/api` routes
- **Headers returned:** `RateLimit-*` (standard headers)

---

## Endpoints

### Health

#### `GET /api/health`

Health check endpoint. No authentication required.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-02-16T12:00:00.000Z",
    "uptime": 3600.5
  }
}
```

---

### Boards

#### `GET /api/boards`

List all boards the authenticated user is a member of (or owns).

**Auth:** Required  
**Query Parameters:** [PaginationQuery](#paginationquery)

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `limit` | integer | 10 | Items per page (max 100) |
| `sort` | string | — | Sort field |
| `order` | `asc` \| `desc` | `desc` | Sort direction |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "owner_id": "uuid",
      "name": "My Board",
      "description": "A project board",
      "color": "#4472C4",
      "is_archived": false,
      "created_at": "2026-02-16T12:00:00.000Z",
      "updated_at": "2026-02-16T12:00:00.000Z",
      "owner": { "id": "uuid", "first_name": "John", "last_name": "Doe", "email": "john@example.com" },
      "_count": { "members": 3, "lists": 4 }
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 5, "pages": 1 }
}
```

---

#### `POST /api/boards`

Create a new board. The authenticated user becomes the owner. Three default lists (To Do, In Progress, Done) are created automatically.

**Auth:** Required  
**Body:** [CreateBoardInput](#createboardinput)

```json
{
  "name": "Sprint Board",
  "description": "Q1 sprint planning",
  "color": "#FF6B35"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | Yes | 1-255 characters |
| `description` | string \| null | No | — |
| `color` | string | No | Hex format `#RRGGBB` |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "owner_id": "uuid",
    "name": "Sprint Board",
    "description": "Q1 sprint planning",
    "color": "#FF6B35",
    "is_archived": false,
    "created_at": "2026-02-16T12:00:00.000Z",
    "updated_at": "2026-02-16T12:00:00.000Z",
    "lists": [
      { "id": "uuid", "name": "To Do", "position": 0 },
      { "id": "uuid", "name": "In Progress", "position": 1 },
      { "id": "uuid", "name": "Done", "position": 2 }
    ],
    "owner": { "id": "uuid", "first_name": "John", "last_name": "Doe", "email": "john@example.com" }
  },
  "message": "Board created successfully"
}
```

---

#### `GET /api/boards/:boardId`

Get board details with all lists and their tasks.

**Auth:** Required  
**Role:** Any board member

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "owner_id": "uuid",
    "name": "Sprint Board",
    "description": "...",
    "color": "#FF6B35",
    "is_archived": false,
    "lists": [
      {
        "id": "uuid",
        "name": "To Do",
        "position": 0,
        "tasks": [
          {
            "id": "uuid",
            "title": "Task title",
            "position": 0,
            "priority": "medium",
            "is_completed": false,
            "assignees": [
              { "id": "uuid", "user": { "id": "uuid", "first_name": "John", "last_name": "Doe", "avatar_url": "https://..." } }
            ]
          }
        ]
      }
    ],
    "members": [
      { "id": "uuid", "user_id": "uuid", "role": "admin", "user": { "id": "uuid", "first_name": "John", "last_name": "Doe", "email": "john@example.com", "avatar_url": "https://..." } }
    ]
  }
}
```

---

#### `PUT /api/boards/:boardId`

Update a board.

**Auth:** Required  
**Role:** Board owner only (service-layer ownership check)  
**Body:** [UpdateBoardInput](#updateboardinput)

```json
{
  "name": "Updated Name",
  "description": "New description",
  "color": "#28A745",
  "is_archived": false
}
```

All fields are optional.

**Response `200`:**

```json
{
  "success": true,
  "data": { ... },
  "message": "Board updated successfully"
}
```

**Socket event emitted:** `board:updated`

---

#### `DELETE /api/boards/:boardId`

Delete a board and all associated data (lists, tasks, members, activity).

**Auth:** Required  
**Role:** Board owner only (ownership check in service layer)

**Response `200`:**

```json
{
  "success": true,
  "message": "Board deleted successfully"
}
```

---

### Members

#### `POST /api/boards/:boardId/members`

Add a user to a board.

**Auth:** Required  
**Role:** `admin`  
**Body:** [AddBoardMemberInput](#addboardmemberinput)

```json
{
  "user_id": "uuid-of-user-to-add",
  "role": "editor"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `user_id` | UUID | Yes | Must be valid user ID |
| `role` | `admin` \| `editor` \| `viewer` | No | Default: `editor` |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "board_id": "uuid",
    "user_id": "uuid",
    "role": "editor",
    "joined_at": "2026-02-16T12:00:00.000Z"
  },
  "message": "Member added successfully"
}
```

**Socket event emitted:** `member:added`

---

#### `DELETE /api/boards/:boardId/members/:userId`

Remove a user from a board.

**Auth:** Required  
**Role:** Any member (self-remove) or `admin` (remove others)

**Response `200`:**

```json
{
  "success": true,
  "message": "Member removed successfully"
}
```

**Socket event emitted:** `member:removed`

---

### Lists

#### `POST /api/boards/:boardId/lists`

Create a new list in a board.

**Auth:** Required  
**Role:** `admin`, `editor`  
**Body:** [CreateListInput](#createlistinput)

```json
{
  "name": "In Progress",
  "position": 1
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | Yes | 1-255 characters |
| `position` | integer | No | Non-negative; auto-assigned if omitted |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "board_id": "uuid",
    "name": "In Progress",
    "position": 1,
    "created_at": "2026-02-16T12:00:00.000Z",
    "updated_at": "2026-02-16T12:00:00.000Z"
  },
  "message": "List created successfully"
}
```

**Socket event emitted:** `list:created`

---

#### `PUT /api/boards/:boardId/lists/:listId`

Update a list's name or position.

**Auth:** Required  
**Role:** `admin`, `editor`  
**Body:** [UpdateListInput](#updatelistinput)

```json
{
  "name": "Done",
  "position": 2
}
```

All fields are optional.

**Response `200`:**

```json
{
  "success": true,
  "data": { ... },
  "message": "List updated successfully"
}
```

**Socket event emitted:** `list:updated`

---

#### `DELETE /api/boards/:boardId/lists/:listId`

Delete a list and all its tasks.

**Auth:** Required  
**Role:** `admin`

**Response `200`:**

```json
{
  "success": true,
  "message": "List deleted successfully"
}
```

**Socket event emitted:** `list:deleted`

---

### Tasks

#### `GET /api/boards/:boardId/tasks`

List all tasks in a board with filtering and pagination.

**Auth:** Required  
**Role:** Any board member  
**Query Parameters:** [TaskFilterQuery](#taskfilterquery)

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 100) |
| `sort` | string | — | Sort field |
| `order` | `asc` \| `desc` | `desc` | Sort direction |
| `search` | string | — | Search in task title/description |
| `priority` | `low` \| `medium` \| `high` \| `urgent` | — | Filter by priority |
| `is_completed` | boolean | — | Filter by completion status |
| `list_id` | UUID | — | Filter by list |
| `assigned_to` | UUID | — | Filter by assignee |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "list_id": "uuid",
      "title": "Implement drag and drop",
      "description": "Add @dnd-kit support",
      "position": 0,
      "priority": "high",
      "due_date": "2026-03-01",
      "is_completed": false,
      "created_by": "uuid",
      "created_at": "2026-02-16T12:00:00.000Z",
      "updated_at": "2026-02-16T12:00:00.000Z",
      "assignees": [
        { "id": "uuid", "user": { "id": "uuid", "first_name": "Jane", "last_name": "Smith" } }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 12, "pages": 1 }
}
```

---

#### `POST /api/boards/:boardId/tasks`

Create a new task.

**Auth:** Required  
**Role:** `admin`, `editor`  
**Body:** [CreateTaskInput](#createtaskinput)

```json
{
  "list_id": "uuid-of-target-list",
  "title": "Write API documentation",
  "description": "Cover all endpoints with examples",
  "priority": "high",
  "due_date": "2026-03-15"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `list_id` | UUID | Yes | Must be a list in this board |
| `title` | string | Yes | 1-255 characters |
| `description` | string \| null | No | — |
| `priority` | enum | No | `low`, `medium`, `high`, `urgent` (default: `medium`) |
| `due_date` | date string | No | ISO 8601 date (e.g., `2026-03-15`) |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "list_id": "uuid",
    "title": "Write API documentation",
    "description": "Cover all endpoints with examples",
    "position": 0,
    "priority": "high",
    "due_date": "2026-03-15",
    "is_completed": false,
    "created_by": "uuid",
    "created_at": "2026-02-16T12:00:00.000Z",
    "updated_at": "2026-02-16T12:00:00.000Z"
  },
  "message": "Task created successfully"
}
```

**Socket event emitted:** `task:created`

---

#### `GET /api/boards/:boardId/tasks/:taskId`

Get a single task with full details including assignees.

**Auth:** Required  
**Role:** Any board member

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "list_id": "uuid",
    "title": "Write API documentation",
    "description": "...",
    "position": 0,
    "priority": "high",
    "due_date": "2026-03-15",
    "is_completed": false,
    "created_by": "uuid",
    "created_at": "2026-02-16T12:00:00.000Z",
    "updated_at": "2026-02-16T12:00:00.000Z",
    "creator": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
    "assignees": [ ... ],
    "list": { "id": "uuid", "name": "To Do", "board_id": "uuid" }
  }
}
```

---

#### `PUT /api/boards/:boardId/tasks/:taskId`

Update task fields.

**Auth:** Required  
**Role:** `admin`, `editor`  
**Body:** [UpdateTaskInput](#updatetaskinput)

```json
{
  "title": "Updated title",
  "description": "New description",
  "priority": "urgent",
  "is_completed": true,
  "due_date": "2026-04-01"
}
```

All fields are optional.

| Field | Type | Constraints |
|---|---|---|
| `title` | string | 1-255 characters |
| `description` | string \| null | — |
| `position` | integer | Non-negative |
| `priority` | enum | `low`, `medium`, `high`, `urgent` |
| `due_date` | date \| null | ISO 8601 date |
| `is_completed` | boolean | — |
| `list_id` | UUID | Move to different list |

**Response `200`:**

```json
{
  "success": true,
  "data": { ... },
  "message": "Task updated successfully"
}
```

**Socket event emitted:** `task:updated`

---

#### `DELETE /api/boards/:boardId/tasks/:taskId`

Delete a task permanently.

**Auth:** Required  
**Role:** `admin`, `editor`

**Response `200`:**

```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

**Socket event emitted:** `task:deleted`

---

### Task Movement

#### `PUT /api/boards/:boardId/tasks/:taskId/move`

Move a task to a different list and/or position (drag & drop).

**Auth:** Required  
**Role:** `admin`, `editor`  
**Body:** [MoveTaskInput](#movetaskinput)

```json
{
  "list_id": "uuid-of-target-list",
  "position": 2
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `list_id` | UUID | Yes | Target list (can be same or different list) |
| `position` | integer | Yes | Non-negative target index |

The server reorders other tasks in the source and target lists automatically.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "list_id": "uuid-of-target-list",
    "position": 2,
    "title": "Moved task",
    ...
  },
  "message": "Task moved successfully"
}
```

**Socket event emitted:** `task:moved`

---

### Task Assignees

#### `POST /api/boards/:boardId/tasks/:taskId/assignees`

Assign a user to a task.

**Auth:** Required  
**Role:** `admin`, `editor`  
**Body:** [AssignUserInput](#assignuserinput)

```json
{
  "user_id": "uuid-of-user-to-assign"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `user_id` | UUID | Yes | Must be a board member |

**Response `201`:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "task_id": "uuid",
    "user_id": "uuid",
    "assigned_at": "2026-02-16T12:00:00.000Z"
  },
  "message": "User assigned successfully"
}
```

**Socket event emitted:** `task:updated` (with full updated task)

---

#### `DELETE /api/boards/:boardId/tasks/:taskId/assignees/:userId`

Remove a user from a task.

**Auth:** Required  
**Role:** `admin`, `editor`

**Response `200`:**

```json
{
  "success": true,
  "message": "User unassigned successfully"
}
```

**Socket event emitted:** `task:updated` (with full updated task)

---

### Activity

#### `GET /api/boards/:boardId/activity`

Get the activity log for a board.

**Auth:** Required  
**Role:** Any board member  
**Query Parameters:** [ActivityFilterQuery](#activityfilterquery)

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `limit` | integer | 10 | Items per page (max 100) |
| `sort` | string | — | Sort field |
| `order` | `asc` \| `desc` | `desc` | Sort direction |
| `task_id` | UUID | — | Filter by specific task |

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "board_id": "uuid",
      "task_id": "uuid",
      "user_id": "uuid",
      "action_type": "create",
      "entity_type": "task",
      "changes": { "title": "New task" },
      "created_at": "2026-02-16T12:00:00.000Z",
      "user": { "first_name": "John", "last_name": "Doe" }
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 25, "pages": 3 }
}
```

---

### Users

#### `GET /api/users/search`

Search for users by name or email. Used for inviting members to boards.

**Auth:** Required  
**Query Parameters:** [UserSearchQuery](#usersearchquery)

| Param | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `q` | string | — | 1-255 chars, required | Search query |
| `limit` | integer | 10 | Max 20 | Maximum results |

**Example:** `GET /api/users/search?q=jane&limit=5`

**Response `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "jane@example.com",
      "first_name": "Jane",
      "last_name": "Smith",
      "avatar_url": "https://..."
    }
  ]
}
```

The authenticated user is excluded from search results.

---

## WebSocket Events

Socket.IO runs on the same server as REST API. Connect with a Supabase access token:

```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: { token: supabaseAccessToken },
  transports: ["websocket", "polling"],
});
```

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join-board` | `boardId: string` | Join board room for real-time updates |
| `leave-board` | `boardId: string` | Leave board room |

### Server → Client

All events are broadcast to the `board:{boardId}` room when REST API mutations occur.

| Event | Payload | Triggered By |
|---|---|---|
| `task:created` | `{ boardId: string, task: Task }` | `POST .../tasks` |
| `task:updated` | `{ boardId: string, task: Task }` | `PUT .../tasks/:id`, assign/unassign |
| `task:deleted` | `{ boardId: string, taskId: string, listId: string }` | `DELETE .../tasks/:id` |
| `task:moved` | `{ boardId: string, task: Task }` | `PUT .../tasks/:id/move` |
| `board:updated` | `{ boardId: string, board: Board }` | `PUT .../boards/:id` |
| `list:created` | `{ boardId: string, list: List }` | `POST .../lists` |
| `list:updated` | `{ boardId: string, list: List }` | `PUT .../lists/:id` |
| `list:deleted` | `{ boardId: string, listId: string }` | `DELETE .../lists/:id` |
| `member:added` | `{ boardId: string, member: BoardMember }` | `POST .../members` |
| `member:removed` | `{ boardId: string, userId: string }` | `DELETE .../members/:id` |

### Authentication

The Socket.IO middleware validates the JWT token on connection. If invalid:

```typescript
socket.on("connect_error", (err) => {
  console.error(err.message); // "Authentication required" | "Invalid or expired token"
});
```

---

## Validation Schemas

All schemas are defined using **Zod** in the shared package (`packages/shared/src/schemas/inputs.ts`) and validated via express middleware.

### CreateBoardInput

```typescript
{
  name: string,         // 1-255 chars, required
  description?: string | null,
  color?: string         // regex: /^#[0-9a-fA-F]{6}$/
}
```

### UpdateBoardInput

```typescript
{
  name?: string,         // 1-255 chars
  description?: string | null,
  color?: string,        // regex: /^#[0-9a-fA-F]{6}$/
  is_archived?: boolean
}
```

### AddBoardMemberInput

```typescript
{
  user_id: string,       // UUID, required
  role?: "admin" | "editor" | "viewer"  // default: "editor"
}
```

### CreateListInput

```typescript
{
  name: string,          // 1-255 chars, required
  position?: number      // non-negative integer
}
```

### UpdateListInput

```typescript
{
  name?: string,         // 1-255 chars
  position?: number      // non-negative integer
}
```

### CreateTaskInput

```typescript
{
  list_id: string,       // UUID, required
  title: string,         // 1-255 chars, required
  description?: string | null,
  priority?: "low" | "medium" | "high" | "urgent",
  due_date?: string | null  // ISO date string
}
```

### UpdateTaskInput

```typescript
{
  title?: string,        // 1-255 chars
  description?: string | null,
  position?: number,     // non-negative integer
  priority?: "low" | "medium" | "high" | "urgent",
  due_date?: string | null,
  is_completed?: boolean,
  list_id?: string       // UUID — move to different list
}
```

### MoveTaskInput

```typescript
{
  list_id: string,       // UUID, required
  position: number       // non-negative integer, required
}
```

### AssignUserInput

```typescript
{
  user_id: string        // UUID, required
}
```

### PaginationQuery

```typescript
{
  page?: number,         // positive integer (default: 1)
  limit?: number,        // positive integer, max 100 (default: 10)
  sort?: string,         // sort field name
  order?: "asc" | "desc" // default: "desc"
}
```

### TaskFilterQuery

Extends `PaginationQuery` with:

```typescript
{
  search?: string,       // search in title/description
  priority?: "low" | "medium" | "high" | "urgent",
  is_completed?: boolean,
  list_id?: string,      // UUID
  assigned_to?: string   // UUID
}
```

Default `limit` for tasks is `50` (controller override).

### ActivityFilterQuery

Extends `PaginationQuery` with:

```typescript
{
  task_id?: string       // UUID — filter activity by task
}
```

### UserSearchQuery

```typescript
{
  q: string,             // 1-255 chars, required
  limit?: number         // positive integer, max 20 (default: 10)
}
```

---

## Enums

### TaskPriority

```
low | medium | high | urgent
```

### BoardRole

```
admin | editor | viewer
```

### ActionType

```
create | update | delete | move
```

### EntityType

```
board | list | task | comment
```

---

## Pagination

All list endpoints support pagination with consistent parameters:

```
GET /api/boards?page=2&limit=20&sort=created_at&order=desc
```

**Response includes:**

```json
{
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

- `page` — Current page (1-indexed)
- `limit` — Items per page
- `total` — Total item count
- `pages` — Total number of pages

---

## Quick Reference

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/health` | — | Health check |
| `GET` | `/api/boards` | auth | List boards |
| `POST` | `/api/boards` | auth | Create board |
| `GET` | `/api/boards/:boardId` | member | Get board |
| `PUT` | `/api/boards/:boardId` | owner | Update board |
| `DELETE` | `/api/boards/:boardId` | owner | Delete board |
| `POST` | `/api/boards/:boardId/members` | admin | Add member |
| `DELETE` | `/api/boards/:boardId/members/:userId` | member | Remove member |
| `POST` | `/api/boards/:boardId/lists` | admin, editor | Create list |
| `PUT` | `/api/boards/:boardId/lists/:listId` | admin, editor | Update list |
| `DELETE` | `/api/boards/:boardId/lists/:listId` | admin | Delete list |
| `GET` | `/api/boards/:boardId/tasks` | member | List tasks |
| `POST` | `/api/boards/:boardId/tasks` | admin, editor | Create task |
| `GET` | `/api/boards/:boardId/tasks/:taskId` | member | Get task |
| `PUT` | `/api/boards/:boardId/tasks/:taskId` | admin, editor | Update task |
| `DELETE` | `/api/boards/:boardId/tasks/:taskId` | admin, editor | Delete task |
| `PUT` | `/api/boards/:boardId/tasks/:taskId/move` | admin, editor | Move task |
| `POST` | `/api/boards/:boardId/tasks/:taskId/assignees` | admin, editor | Assign user |
| `DELETE` | `/api/boards/:boardId/tasks/:taskId/assignees/:userId` | admin, editor | Unassign user |
| `GET` | `/api/boards/:boardId/activity` | member | Activity log |
| `GET` | `/api/users/search?q=...` | auth | Search users |
