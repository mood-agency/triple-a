---
name: triple-a-api
description: Access the triple-a note management API for CRUD operations on notes, labels, projects, contacts, and history
user-invocable: true
metadata:
  clawdbot:
    primaryEnv: TRIPLE_A_API_KEY
    requires:
      bins: ["node"]
---

# Triple-A Note Management API

This skill provides access to the Triple-A note management API, allowing you to perform CRUD operations on notes, labels, projects, contacts, and history.

## Using Executable Scripts

**This skill includes executable JavaScript scripts for deterministic, reliable API operations.**

### When to use scripts:
- ✅ Creating, updating, or deleting resources (notes, labels, projects, contacts)
- ✅ Complex workflows requiring multiple API calls
- ✅ Bulk operations or data transformations
- ✅ When you need reliable error handling and automatic retries

### When to use markdown instructions:
- ✅ Simple queries and exploration
- ✅ Understanding API capabilities
- ✅ Custom operations not covered by existing scripts

### Available Scripts:

**1. Main CLI:** `node scripts/triple-a-cli.js <command>`

Full-featured command-line interface for all API operations.

```bash
# List today's tasks
node scripts/triple-a-cli.js notes list --date 2026-01-27 --completed false

# Create a note
node scripts/triple-a-cli.js notes create --content "Review PR" --category todo --date 2026-01-27

# Search notes
node scripts/triple-a-cli.js notes search --query "API" --category todo

# Run --help for full usage
node scripts/triple-a-cli.js --help
```

**2. Example Scripts:**

Quick, focused scripts for common operations:

- `scripts/examples/create-task.js [content]` - Create a todo task for today
- `scripts/examples/list-today.js [--all] [--category cat]` - List today's pending tasks
- `scripts/examples/search-notes.js <query> [--category cat]` - Search notes by text
- `scripts/examples/complete-task.js <note-id>` - Mark a task as completed
- `scripts/examples/assign-label.js <note-id> <label-name> [color]` - Create label and assign to note

**Examples:**

```bash
# Create a task
node scripts/examples/create-task.js "Review pull request"

# List today's tasks
node scripts/examples/list-today.js

# Search for notes containing "API"
node scripts/examples/search-notes.js "API"

# Complete a specific task
node scripts/examples/complete-task.js 550e8400-e29b-41d4-a716-446655440000

# Create and assign "urgent" label
node scripts/examples/assign-label.js 550e8400-e29b-41d4-a716-446655440000 urgent "#ff0000"
```

### Configuration:

Scripts automatically read from environment variables (configured via molt.bot):

- `TRIPLE_A_API_KEY` - Your API key (required, auto-configured)
- `TRIPLE_A_BASE_URL` - API base URL (optional, default: http://localhost:3000)
- `DEBUG=1` - Enable debug logging (optional)

### Script Features:

- ✅ **Automatic authentication** - API key handled automatically
- ✅ **Error handling** - Clear error messages with helpful hints
- ✅ **Retry logic** - Automatic retries for rate limits and server errors
- ✅ **Timeout protection** - 30-second timeout with clear error messages
- ✅ **Formatted output** - Clean, readable results

---

## Overview & Authentication

**Base URL:** `http://localhost:3000` (configurable via `TRIPLE_A_BASE_URL` env var)

**Authentication:**
- All API requests require an API key in the `x-api-key` header
- API key format: `sk_live_` followed by 32 hexadecimal characters
- Example: `x-api-key: sk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

**Note:** When using the provided scripts (`scripts/triple-a-cli.js` or `scripts/examples/*`), authentication is handled automatically via the `TRIPLE_A_API_KEY` environment variable. You don't need to manually set headers.

**Rate Limiting:**
- Default: 100 requests per minute per API key
- Rate limit is configurable per key
- When limit is exceeded, API returns 429 status with `retry_after` header

**Scope System:**
The API uses a scope-based authorization system:
- `read` - Required for GET requests (reading data)
- `write` - Required for POST, PUT, PATCH requests (creating/updating data)
- `delete` - Required for DELETE requests (deleting data)

**Response Format:**
All responses are in JSON format with consistent structure:
```json
{
  "data": {...},
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}
```

**Pagination:**
List endpoints support pagination parameters:
- `limit` - Number of results per page (default: 100, max: 1000)
- `offset` - Number of results to skip (default: 0)

Example: `GET /api/v1/notes?limit=50&offset=100`

---

## Notes API

The Notes API provides 8 endpoints for managing notes with full CRUD capabilities, search, and history tracking.

### Endpoints

#### List Notes
```
GET /api/v1/notes
```

Query Parameters:
- `date` - Filter by specific date (format: YYYY-MM-DD)
- `project_id` - Filter by project UUID
- `completed` - Filter by completion status (true/false)
- `category` - Filter by category (todo/followup/notes/meeting)
- `pinned` - Filter by pinned status (true/false)
- `assignee_id` - Filter by assigned contact UUID
- `limit` - Results per page (default: 100)
- `offset` - Results to skip (default: 0)

Example:
```bash
GET /api/v1/notes?date=2026-01-27&completed=false&category=todo
Headers:
  x-api-key: sk_live_...
```

#### Get Single Note
```
GET /api/v1/notes/:id
```

Example:
```bash
GET /api/v1/notes/550e8400-e29b-41d4-a716-446655440000
Headers:
  x-api-key: sk_live_...
```

#### Create Note
```
POST /api/v1/notes
```

Required fields:
- `content` (string) - Main content of the note
- `category` (string) - One of: todo, followup, notes, meeting
- `date` (string) - Date in YYYY-MM-DD format

Optional fields:
- `description` (string | null) - Additional details
- `completed` (boolean) - Completion status (default: false)
- `deadline` (string | null) - Deadline timestamp (ISO 8601)
- `pinned` (boolean) - Pin status (default: false)
- `assignee_id` (string | null) - Contact UUID
- `project_id` (string | null) - Project UUID
- `labels` (string[]) - Array of label UUIDs

Example:
```bash
POST /api/v1/notes
Headers:
  x-api-key: sk_live_...
Body:
{
  "content": "Review pull request",
  "category": "todo",
  "date": "2026-01-27",
  "description": "Check code review for triple-a API",
  "deadline": "2026-01-28T17:00:00Z",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "labels": ["660e8400-e29b-41d4-a716-446655440000"]
}
```

#### Update Note (Full)
```
PUT /api/v1/notes/:id
```

Replaces the entire note. All fields from Create Note are supported.

Example:
```bash
PUT /api/v1/notes/550e8400-e29b-41d4-a716-446655440000
Headers:
  x-api-key: sk_live_...
Body:
{
  "content": "Review pull request (updated)",
  "category": "todo",
  "date": "2026-01-28",
  "completed": false
}
```

#### Update Note (Partial)
```
PATCH /api/v1/notes/:id
```

Updates only the provided fields. Preferred over PUT for single-field updates.

Example:
```bash
PATCH /api/v1/notes/550e8400-e29b-41d4-a716-446655440000
Headers:
  x-api-key: sk_live_...
Body:
{
  "completed": true
}
```

#### Delete Note
```
DELETE /api/v1/notes/:id
```

Performs a soft delete (sets `deleted_at` timestamp). Deleted notes won't appear in normal queries.

Example:
```bash
DELETE /api/v1/notes/550e8400-e29b-41d4-a716-446655440000
Headers:
  x-api-key: sk_live_...
```

#### Search Notes
```
POST /api/v1/notes/search
```

Full-text search across note content and description.

Request body:
- `query` (string) - Search term
- `filters` (object) - Optional filters:
  - `category` (string) - Filter by category
  - `completed` (boolean) - Filter by completion
  - `date_from` (string) - Filter from date (YYYY-MM-DD)
  - `date_to` (string) - Filter to date (YYYY-MM-DD)
  - `project_id` (string) - Filter by project
  - `assignee_id` (string) - Filter by assignee

Example:
```bash
POST /api/v1/notes/search
Headers:
  x-api-key: sk_live_...
Body:
{
  "query": "API",
  "filters": {
    "category": "todo",
    "completed": false,
    "date_from": "2026-01-01"
  }
}
```

#### Get Note History
```
GET /api/v1/notes/:id/history
```

Returns the change history for a specific note, including all versions and actions.

Example:
```bash
GET /api/v1/notes/550e8400-e29b-41d4-a716-446655440000/history
Headers:
  x-api-key: sk_live_...
```

### Note Schema

```json
{
  "id": "uuid",
  "date": "2026-01-27",
  "content": "string (required)",
  "description": "string | null",
  "category": "todo | followup | notes | meeting (required)",
  "completed": "boolean",
  "completed_at": "timestamp | null",
  "deadline": "timestamp | null",
  "pinned": "boolean",
  "sort_order": "number",
  "assignee_id": "uuid | null",
  "project_id": "uuid | null",
  "labels": ["uuid"],
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "deleted_at": "timestamp | null",
  "deleted_reason": "string | null"
}
```

---

## Labels API

The Labels API provides 6 endpoints for managing labels (tags) for notes.

### Endpoints

#### List Labels
```
GET /api/v1/labels
```

Returns all labels for the authenticated user.

Example:
```bash
GET /api/v1/labels
Headers:
  x-api-key: sk_live_...
```

#### Get Single Label
```
GET /api/v1/labels/:id
```

Example:
```bash
GET /api/v1/labels/660e8400-e29b-41d4-a716-446655440000
Headers:
  x-api-key: sk_live_...
```

#### Create Label
```
POST /api/v1/labels
```

Required fields:
- `name` (string) - Label name

Optional fields:
- `color` (string) - Hex color code (e.g., "#ff0000")

Example:
```bash
POST /api/v1/labels
Headers:
  x-api-key: sk_live_...
Body:
{
  "name": "urgent",
  "color": "#ff0000"
}
```

#### Update Label
```
PUT /api/v1/labels/:id
```

Example:
```bash
PUT /api/v1/labels/660e8400-e29b-41d4-a716-446655440000
Headers:
  x-api-key: sk_live_...
Body:
{
  "name": "urgent-updated",
  "color": "#ff3300"
}
```

#### Delete Label
```
DELETE /api/v1/labels/:id
```

Deletes the label and removes it from all notes.

Example:
```bash
DELETE /api/v1/labels/660e8400-e29b-41d4-a716-446655440000
Headers:
  x-api-key: sk_live_...
```

#### Get Notes with Label
```
GET /api/v1/labels/:id/notes
```

Returns all notes that have this label.

Example:
```bash
GET /api/v1/labels/660e8400-e29b-41d4-a716-446655440000/notes
Headers:
  x-api-key: sk_live_...
```

### Label Schema

```json
{
  "id": "uuid",
  "name": "string (required)",
  "color": "string (hex color)",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

---

## Projects API

The Projects API provides 6 endpoints for managing projects that group related notes.

### Endpoints

#### List Projects
```
GET /api/v1/projects
```

Returns all projects for the authenticated user.

Example:
```bash
GET /api/v1/projects
Headers:
  x-api-key: sk_live_...
```

#### Get Single Project
```
GET /api/v1/projects/:id
```

Example:
```bash
GET /api/v1/projects/770e8400-e29b-41d4-a716-446655440000
Headers:
  x-api-key: sk_live_...
```

#### Create Project
```
POST /api/v1/projects
```

Required fields:
- `name` (string) - Project name

Optional fields:
- `description` (string | null) - Project description

Example:
```bash
POST /api/v1/projects
Headers:
  x-api-key: sk_live_...
Body:
{
  "name": "Triple-A API",
  "description": "API development tasks"
}
```

#### Update Project
```
PUT /api/v1/projects/:id
```

Example:
```bash
PUT /api/v1/projects/770e8400-e29b-41d4-a716-446655440000
Headers:
  x-api-key: sk_live_...
Body:
{
  "name": "Triple-A API (Updated)",
  "description": "Enhanced API development tasks"
}
```

#### Delete Project
```
DELETE /api/v1/projects/:id
```

Deletes the project. Notes in this project will have their `project_id` set to null.

Example:
```bash
DELETE /api/v1/projects/770e8400-e29b-41d4-a716-446655440000
Headers:
  x-api-key: sk_live_...
```

#### Get Project Notes
```
GET /api/v1/projects/:id/notes
```

Returns all notes assigned to this project.

Example:
```bash
GET /api/v1/projects/770e8400-e29b-41d4-a716-446655440000/notes
Headers:
  x-api-key: sk_live_...
```

### Project Schema

```json
{
  "id": "uuid",
  "name": "string (required)",
  "description": "string | null",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

---

## Contacts API

The Contacts API provides 6 endpoints for managing contacts that can be assigned to notes.

### Endpoints

#### List Contacts
```
GET /api/v1/contacts
```

Returns all contacts for the authenticated user.

Example:
```bash
GET /api/v1/contacts
Headers:
  x-api-key: sk_live_...
```

#### Get Single Contact
```
GET /api/v1/contacts/:id
```

Example:
```bash
GET /api/v1/contacts/880e8400-e29b-41d4-a716-446655440000
Headers:
  x-api-key: sk_live_...
```

#### Create Contact
```
POST /api/v1/contacts
```

Required fields:
- `name` (string) - Contact name

Optional fields:
- `email` (string | null) - Contact email

Example:
```bash
POST /api/v1/contacts
Headers:
  x-api-key: sk_live_...
Body:
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

#### Update Contact
```
PUT /api/v1/contacts/:id
```

Example:
```bash
PUT /api/v1/contacts/880e8400-e29b-41d4-a716-446655440000
Headers:
  x-api-key: sk_live_...
Body:
{
  "name": "John Doe (Updated)",
  "email": "john.doe@example.com"
}
```

#### Delete Contact
```
DELETE /api/v1/contacts/:id
```

Deletes the contact. Notes assigned to this contact will have their `assignee_id` set to null.

Example:
```bash
DELETE /api/v1/contacts/880e8400-e29b-41d4-a716-446655440000
Headers:
  x-api-key: sk_live_...
```

#### Get Contact Notes
```
GET /api/v1/contacts/:id/notes
```

Returns all notes assigned to this contact.

Example:
```bash
GET /api/v1/contacts/880e8400-e29b-41d4-a716-446655440000/notes
Headers:
  x-api-key: sk_live_...
```

### Contact Schema

```json
{
  "id": "uuid",
  "name": "string (required)",
  "email": "string | null",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

---

## History API

The History API provides access to the global change history across all notes.

### Endpoints

#### Get Global History
```
GET /api/v1/history
```

Query Parameters:
- `note_id` (string) - Filter by specific note UUID
- `action_type` (string) - Filter by action (created/edit/postponed/completed/uncompleted)
- `limit` (number) - Results per page (default: 100)
- `offset` (number) - Results to skip (default: 0)

Example:
```bash
GET /api/v1/history?note_id=550e8400-e29b-41d4-a716-446655440000&action_type=edit
Headers:
  x-api-key: sk_live_...
```

---

## Error Handling

The API returns consistent error responses with the following structure:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

**Authentication Errors (401):**
- `INVALID_API_KEY` - Key format is incorrect or key not found
  - Ensure key starts with `sk_live_` and is valid
- `API_KEY_REVOKED` - The API key has been revoked
  - Generate a new key from the Triple-A UI
- `API_KEY_EXPIRED` - The API key has expired
  - Generate a new key or extend expiration date

**Authorization Errors (403):**
- `INSUFFICIENT_SCOPE` - The API key doesn't have required scope
  - Details include required scope and provided scopes
  - Example: Writing requires `write` scope, deleting requires `delete` scope

**Rate Limiting (429):**
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
  - Response includes `retry_after` header (60 seconds)
  - Wait before retrying or increase rate limit for the key

**Validation Errors (400):**
- `VALIDATION_ERROR` - Missing required fields or invalid data
  - Check the error message for specific field issues
  - Common: missing `content`, `category`, or `date` in note creation

**Not Found (404):**
- `NOT_FOUND` - Resource doesn't exist
  - Verify the UUID is correct
  - Check if resource was deleted

**Server Errors (500):**
- `INTERNAL_ERROR` - Internal server error
  - Retry the request
  - If persistent, contact support

---

## Common Workflows

### 1. Create a Task with Label and Project

```bash
# Step 1: Create a project (if doesn't exist)
POST /api/v1/projects
Body: {"name": "Triple-A API", "description": "API development tasks"}
Response: {"data": {"id": "project-uuid", ...}}

# Step 2: Create a label (if doesn't exist)
POST /api/v1/labels
Body: {"name": "urgent", "color": "#ff0000"}
Response: {"data": {"id": "label-uuid", ...}}

# Step 3: Create note with project and label
POST /api/v1/notes
Body: {
  "content": "Review pull request",
  "category": "todo",
  "date": "2026-01-27",
  "project_id": "project-uuid",
  "labels": ["label-uuid"]
}
```

### 2. List Today's Pending Tasks

```bash
GET /api/v1/notes?date=2026-01-27&completed=false&category=todo
```

### 3. Complete a Task

```bash
PATCH /api/v1/notes/{note-id}
Body: {"completed": true}
```

### 4. Search for Notes Containing "API"

```bash
POST /api/v1/notes/search
Body: {
  "query": "API",
  "filters": {
    "completed": false
  }
}
```

### 5. View All Notes with a Specific Label

```bash
GET /api/v1/labels/{label-id}/notes
```

### 6. View Change History for a Note

```bash
GET /api/v1/notes/{note-id}/history
```

### 7. Assign a Task to a Contact

```bash
# Step 1: Create contact (if doesn't exist)
POST /api/v1/contacts
Body: {"name": "John Doe", "email": "john@example.com"}
Response: {"data": {"id": "contact-uuid", ...}}

# Step 2: Assign task to contact
PATCH /api/v1/notes/{note-id}
Body: {"assignee_id": "contact-uuid"}
```

---

## Best Practices

### When to Use Which Endpoint

**Listing vs Searching:**
- Use `GET /api/v1/notes` with query parameters for filtered browsing (by date, project, category)
- Use `POST /api/v1/notes/search` for full-text search across content and description

**Update Operations:**
- Use `PATCH /api/v1/notes/:id` when updating one or few fields (more efficient)
- Use `PUT /api/v1/notes/:id` when replacing the entire note

**Finding Related Notes:**
- Use `GET /api/v1/labels/:id/notes` to find all notes with a specific label
- Use `GET /api/v1/projects/:id/notes` to view all notes in a project scope
- Use `GET /api/v1/contacts/:id/notes` to see all tasks assigned to someone

**Audit Trail:**
- Use `GET /api/v1/notes/:id/history` to review all changes to a note
- Use `GET /api/v1/history` with filters for global audit across notes

### Performance Tips

**Pagination:**
- Always use pagination (`limit` and `offset`) for large result sets
- Default limit is 100, but you can adjust based on needs
- Maximum limit is 1000 items per page

**Filtering:**
- Filter at the API level rather than fetching all and filtering client-side
- Combine multiple filter parameters for precise queries
- Example: `?date=2026-01-27&category=todo&completed=false` is better than fetching all notes

**Batch Operations:**
- Use dedicated endpoints like `GET /api/v1/projects/:id/notes` instead of multiple single-note requests
- When creating multiple resources, consider spacing requests to avoid rate limits

**Rate Limit Management:**
- Monitor `RateLimit-*` response headers to track usage
- Default is 100 req/min, but keys can have custom limits
- Cache frequently accessed data client-side when possible

### Data Integrity

**Soft Deletes:**
- All DELETE operations perform soft deletes (set `deleted_at` timestamp)
- Deleted notes don't appear in normal queries by default
- This preserves audit trail and allows recovery if needed

**Label Synchronization:**
- The `labels` array in notes is automatically synchronized with the `note_labels` join table
- No need to manage the many-to-many relationship manually

**Timestamps:**
- Use ISO 8601 format for all timestamp fields (e.g., `2026-01-28T17:00:00Z`)
- Dates use YYYY-MM-DD format (e.g., `2026-01-27`)

**UUIDs:**
- All resource IDs are UUIDs (version 4)
- Always validate UUID format before making requests

### Security

**API Key Management:**
- Generate API keys from the Triple-A UI (Settings → API Keys)
- Keys are shown only once upon creation - store securely
- Use minimum required scopes (read-only keys when possible)
- Set expiration dates for temporary access
- Revoke unused keys immediately

**Scope Selection:**
- `read` - For read-only integrations (dashboards, reports)
- `write` - For integrations that create/update data
- `delete` - Only when deletion capability is necessary

**Rate Limits:**
- Configure appropriate rate limits per key based on usage patterns
- Lower limits for experimental/development keys
- Higher limits for production integrations

---

## Additional Notes

**Realtime Broadcasting:**
The API includes Supabase Realtime broadcasting for mutations. Changes made through the API propagate automatically to connected web clients in real-time.

**Production Deployment:**
When deploying to production, update the base URL from `http://localhost:3000` to your deployed API URL. The skill can be configured with different URLs by setting the base URL in your integration.

**Future Enhancements:**
Batch operation types are defined in the API schema (`src/types/api.ts`) but endpoints are not yet implemented. These will allow bulk create/update/delete operations in a single request.

**Support:**
For issues or questions about the API, refer to the Triple-A documentation or contact support.
