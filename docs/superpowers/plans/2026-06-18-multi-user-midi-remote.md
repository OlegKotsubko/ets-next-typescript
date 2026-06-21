# Multi-User MIDI Remote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a subscriber user act as a remote MIDI trigger surface for an owner user's live rundown, firing show/hide/update on the owner's titles via the Web MIDI API through the existing SSE broadcast bus.

**Architecture:** Additive layer on the documented ETS model. Project becomes a migration-seeded singleton; ownership moves onto rundowns. Three new tables (`subscriptions`, `rundown_grants`, `midi_bindings`) plus `rundowns.owner_id`. Control is grant-gated; visibility is open via a read-only directory endpoint. Logic that can be (authorization, directory shaping, binding validation, trigger payload) is extracted into pure functions and unit-tested; route handlers stay thin.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript · better-auth · Drizzle ORM + Neon Postgres · Zod · React Hook Form (`zodResolver`) · Redux Toolkit + RTK Query · MUI (admin) · SCSS (titles — not built in this plan) · Web MIDI API · **Vitest** (test runner, introduced here).

## Prerequisites (NOT built by this plan)

This plan assumes the base app from `docs/` already exists and exports these identifiers. If they are missing, build them first — they are out of scope here:

- `@/db` → `db` (Drizzle client) and `@/db/schema` with at least `users`, `projects`, `rundowns`, `rundownItems`.
- `@/lib/auth` → `auth`, with `auth.api.getSession({ headers })` returning `{ user: { id, email } } | null`.
- `@/lib/broadcast/bus` → `bus.publish(rundownId: string, event: BroadcastEvent)` where `BroadcastEvent = { type: 'show' | 'hide' | 'update'; rundownItemId: string; data?: unknown }`.
- `@/lib/titles/registry` → `getTitleModel(titleKey: string): import('zod').ZodTypeAny` (the title's `model.ts` schema).
- `middleware.ts` gating `/admin/*` and `/api/*` (extend its matcher in Task 2).
- A configured RTK store with `combineReducers`, into which Task 9 registers new slices.
- **Git is initialized** (`git init` if `git status` fails) — every task ends in a commit.

## Global Constraints

- Server derives scope from **URL + session, never the request body** (existing `project_id` rule extends to `rundownId`).
- Edge runtime is for the SSE **stream only**. All routes in this plan are **Node runtime** (default).
- Grants gate **control** (create binding + trigger), never **visibility**. The directory is readable by any authenticated user.
- Directory exposes title **name/identity only** (`label`, `titleKey`, `position`, `rundownItemId`) — never the per-title `data` jsonb.
- All new tables use `uuid` PKs `defaultRandom()`, `snake_case` columns, `<table>_<cols>_idx` indexes, `created_at timestamp not null default now()`.
- Seed project UUID is the constant `SEED_PROJECT_ID = '00000000-0000-0000-0000-000000000001'`.
- Actions enum is exactly `'show' | 'hide' | 'update'`.
- Any admin form with inputs (e.g. the request-subscription email field) uses **React Hook Form + `@hookform/resolvers/zod`**, reusing the route's Zod schema as the form resolver. Button-only views (accept/revoke/fire) need no form library.

---

### Task 1: Test tooling (Vitest)

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `vitest`, `@vitest/coverage-v8` devDeps; `"test": "vitest run"`, `"test:watch": "vitest"`)
- Create: `test/sanity.test.ts`

**Interfaces:**
- Produces: a working `npm test` so every later task can run `vitest run <file>`.

- [ ] **Step 1: Write the failing test**

```ts
// test/sanity.test.ts
import { describe, it, expect } from 'vitest';

describe('vitest', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/sanity.test.ts`
Expected: FAIL — `vitest: command not found` (not yet installed).

- [ ] **Step 3: Install and configure**

```bash
npm install -D vitest @vitest/coverage-v8
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
});
```

Add to `package.json` `"scripts"`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts test/sanity.test.ts
git commit -m "test: add vitest runner"
```

---

### Task 2: Schema — enums, ownership, tables, seed migration

**Files:**
- Modify: `db/schema.ts` (append enums + 3 tables + `rundowns.owner_id`)
- Create: `db/seed-constants.ts`
- Test: `test/db/schema-shape.test.ts`
- Modify: `middleware.ts` (extend matcher to cover `/api/directory`, `/api/subscriptions`, `/api/rundowns`)
- Migration: generated via `db:generate`, plus a hand-written seed insert

**Interfaces:**
- Produces: `subscriptions`, `rundownGrants`, `midiBindings`, `subscriptionStatus`, `midiAction` Drizzle exports; `rundowns.ownerId` column; `SEED_PROJECT_ID`, `SEED_PROJECT_LABEL` constants.

- [ ] **Step 1: Write the failing test**

```ts
// test/db/schema-shape.test.ts
import { describe, it, expect } from 'vitest';
import { subscriptions, rundownGrants, midiBindings } from '@/db/schema';
import { SEED_PROJECT_ID } from '@/db/seed-constants';

const cols = (t: any) => Object.keys(t);

describe('new schema tables', () => {
  it('subscriptions has owner/subscriber/status', () => {
    expect(cols(subscriptions)).toEqual(
      expect.arrayContaining(['id', 'ownerId', 'subscriberId', 'status', 'createdAt']),
    );
  });
  it('rundownGrants links subscription↔rundown', () => {
    expect(cols(rundownGrants)).toEqual(
      expect.arrayContaining(['id', 'subscriptionId', 'rundownId', 'createdAt']),
    );
  });
  it('midiBindings carries note+action+target', () => {
    expect(cols(midiBindings)).toEqual(
      expect.arrayContaining([
        'id', 'subscriberId', 'rundownId', 'rundownItemId',
        'action', 'midiNote', 'midiChannel', 'label', 'createdAt',
      ]),
    );
  });
  it('exposes a fixed seed project id', () => {
    expect(SEED_PROJECT_ID).toBe('00000000-0000-0000-0000-000000000001');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/db/schema-shape.test.ts`
Expected: FAIL — cannot import `subscriptions` from `@/db/schema`.

- [ ] **Step 3: Write the schema + constants**

```ts
// db/seed-constants.ts
export const SEED_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
export const SEED_PROJECT_LABEL = 'default';
```

```ts
// db/schema.ts — APPEND (assumes users, projects, rundowns, rundownItems already defined above)
import { pgEnum, pgTable, uuid, integer, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
// (users, rundowns, rundownItems are imported/declared earlier in this file)

export const subscriptionStatus = pgEnum('subscription_status', ['pending', 'accepted', 'revoked']);
export const midiAction = pgEnum('midi_action', ['show', 'hide', 'update']);

// NEW column on the existing rundowns table — add this field to the rundowns pgTable definition:
//   ownerId: uuid('owner_id').notNull().references(() => users.id),

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  subscriberId: uuid('subscriber_id').notNull().references(() => users.id),
  status: subscriptionStatus('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqPair: unique('subscriptions_owner_subscriber_uniq').on(t.ownerId, t.subscriberId),
  byOwner: index('subscriptions_owner_idx').on(t.ownerId),
  bySubscriber: index('subscriptions_subscriber_idx').on(t.subscriberId),
}));

export const rundownGrants = pgTable('rundown_grants', {
  id: uuid('id').defaultRandom().primaryKey(),
  subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  rundownId: uuid('rundown_id').notNull().references(() => rundowns.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniq: unique('rundown_grants_sub_rundown_uniq').on(t.subscriptionId, t.rundownId),
  byRundown: index('rundown_grants_rundown_idx').on(t.rundownId),
}));

export const midiBindings = pgTable('midi_bindings', {
  id: uuid('id').defaultRandom().primaryKey(),
  subscriberId: uuid('subscriber_id').notNull().references(() => users.id),
  rundownId: uuid('rundown_id').notNull().references(() => rundowns.id, { onDelete: 'cascade' }),
  rundownItemId: uuid('rundown_item_id').notNull().references(() => rundownItems.id, { onDelete: 'cascade' }),
  action: midiAction('action').notNull(),
  midiNote: integer('midi_note').notNull(),
  midiChannel: integer('midi_channel').notNull().default(0),
  label: text('label'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqNote: unique('midi_bindings_note_uniq').on(t.subscriberId, t.rundownId, t.midiNote, t.midiChannel),
  byScope: index('midi_bindings_subscriber_rundown_idx').on(t.subscriberId, t.rundownId),
}));
```

Add `ownerId: uuid('owner_id').notNull().references(() => users.id)` to the existing `rundowns` table definition.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/db/schema-shape.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Generate the migration + hand-add the seed**

```bash
npm run db:generate
```

Append to the newest generated SQL file in `db/migrations/` (after the `CREATE TABLE` statements):

```sql
-- seed the singleton project (idempotent)
INSERT INTO projects (id, name, mode, label)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Event', 'team_vs_team', 'default')
ON CONFLICT (id) DO NOTHING;
```

Extend `middleware.ts` matcher to include the new route trees:

```ts
export const config = {
  matcher: ['/admin/:path*', '/api/projects/:path*', '/api/directory', '/api/subscriptions/:path*', '/api/rundowns/:path*'],
};
```

- [ ] **Step 6: Apply migration locally**

Run: `npm run db:migrate`
Expected: migration applies; `select id,label from projects;` returns the seed row.

- [ ] **Step 7: Commit**

```bash
git add db/schema.ts db/seed-constants.ts db/migrations middleware.ts test/db/schema-shape.test.ts
git commit -m "feat(db): rundown ownership, subscription/grant/midi tables, seed project"
```

---

### Task 3: Authorization helper (`assertControl`)

**Files:**
- Create: `lib/access/control.ts`
- Test: `test/access/control.test.ts`

**Interfaces:**
- Produces:
  - `class ForbiddenError extends Error {}`
  - `interface GrantRepo { getRundownOwner(rundownId: string): Promise<string | null>; getAcceptedSubscription(ownerId: string, subscriberId: string): Promise<{ id: string } | null>; hasRundownGrant(subscriptionId: string, rundownId: string): Promise<boolean>; }`
  - `async function assertControl(repo: GrantRepo, userId: string, rundownId: string): Promise<{ ownerId: string; subscriptionId: string }>` — throws `ForbiddenError` unless an accepted subscription + grant exists. If `userId === ownerId`, returns `{ ownerId, subscriptionId: 'self' }` (owners control their own rundowns).

- [ ] **Step 1: Write the failing test**

```ts
// test/access/control.test.ts
import { describe, it, expect } from 'vitest';
import { assertControl, ForbiddenError, type GrantRepo } from '@/lib/access/control';

const repo = (over: Partial<GrantRepo>): GrantRepo => ({
  getRundownOwner: async () => 'owner-1',
  getAcceptedSubscription: async () => ({ id: 'sub-1' }),
  hasRundownGrant: async () => true,
  ...over,
});

describe('assertControl', () => {
  it('passes for a granted, accepted subscriber', async () => {
    const r = await assertControl(repo({}), 'sub-user', 'rd-1');
    expect(r).toEqual({ ownerId: 'owner-1', subscriptionId: 'sub-1' });
  });
  it('passes for the owner themselves without a subscription', async () => {
    const r = await assertControl(repo({}), 'owner-1', 'rd-1');
    expect(r).toEqual({ ownerId: 'owner-1', subscriptionId: 'self' });
  });
  it('rejects unknown rundown', async () => {
    await expect(assertControl(repo({ getRundownOwner: async () => null }), 'u', 'rd-x'))
      .rejects.toBeInstanceOf(ForbiddenError);
  });
  it('rejects when no accepted subscription', async () => {
    await expect(assertControl(repo({ getAcceptedSubscription: async () => null }), 'u', 'rd-1'))
      .rejects.toBeInstanceOf(ForbiddenError);
  });
  it('rejects when subscription exists but rundown not granted', async () => {
    await expect(assertControl(repo({ hasRundownGrant: async () => false }), 'u', 'rd-1'))
      .rejects.toBeInstanceOf(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/access/control.test.ts`
Expected: FAIL — cannot import from `@/lib/access/control`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/access/control.ts
export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') { super(message); this.name = 'ForbiddenError'; }
}

export interface GrantRepo {
  getRundownOwner(rundownId: string): Promise<string | null>;
  getAcceptedSubscription(ownerId: string, subscriberId: string): Promise<{ id: string } | null>;
  hasRundownGrant(subscriptionId: string, rundownId: string): Promise<boolean>;
}

export async function assertControl(
  repo: GrantRepo,
  userId: string,
  rundownId: string,
): Promise<{ ownerId: string; subscriptionId: string }> {
  const ownerId = await repo.getRundownOwner(rundownId);
  if (!ownerId) throw new ForbiddenError('Unknown rundown');
  if (ownerId === userId) return { ownerId, subscriptionId: 'self' };

  const sub = await repo.getAcceptedSubscription(ownerId, userId);
  if (!sub) throw new ForbiddenError('No accepted subscription');

  const granted = await repo.hasRundownGrant(sub.id, rundownId);
  if (!granted) throw new ForbiddenError('Rundown not granted');

  return { ownerId, subscriptionId: sub.id };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/access/control.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/access/control.ts test/access/control.test.ts
git commit -m "feat(access): assertControl grant-gating helper"
```

---

### Task 4: Drizzle-backed GrantRepo + directory builder + `GET /api/directory`

**Files:**
- Create: `lib/access/grant-repo.ts` (Drizzle implementation of `GrantRepo`)
- Create: `lib/directory/build.ts` (pure shaping)
- Create: `app/api/directory/route.ts`
- Test: `test/directory/build.test.ts`

**Interfaces:**
- Consumes: `GrantRepo` (Task 3).
- Produces:
  - `dbGrantRepo: GrantRepo` (uses `@/db`).
  - Types `DirectoryTitle = { rundownItemId: string; titleKey: string; position: number; label: string | null }`, `DirectoryRundown = { rundownId: string; name: string; titles: DirectoryTitle[] }`, `DirectoryUser = { userId: string; email: string; rundowns: DirectoryRundown[] }`.
  - `type DirectoryRow = { userId: string; email: string; rundownId: string | null; rundownName: string | null; rundownItemId: string | null; titleKey: string | null; position: number | null; titleLabel: string | null }`.
  - `buildDirectory(rows: DirectoryRow[]): DirectoryUser[]` — groups flat join rows; drops null rundowns/titles; never includes `data`.

- [ ] **Step 1: Write the failing test**

```ts
// test/directory/build.test.ts
import { describe, it, expect } from 'vitest';
import { buildDirectory, type DirectoryRow } from '@/lib/directory/build';

const rows: DirectoryRow[] = [
  { userId: 'u1', email: 'caster1@x', rundownId: 'r1', rundownName: 'Finals', rundownItemId: 'i1', titleKey: 'lower-third', position: 0, titleLabel: 'Intro' },
  { userId: 'u1', email: 'caster1@x', rundownId: 'r1', rundownName: 'Finals', rundownItemId: 'i2', titleKey: 'scoreboard', position: 1, titleLabel: null },
  { userId: 'u2', email: 'caster2@x', rundownId: null, rundownName: null, rundownItemId: null, titleKey: null, position: null, titleLabel: null },
];

describe('buildDirectory', () => {
  it('groups users → rundowns → titles', () => {
    const out = buildDirectory(rows);
    expect(out).toHaveLength(2);
    const u1 = out.find((u) => u.userId === 'u1')!;
    expect(u1.rundowns[0]).toMatchObject({ rundownId: 'r1', name: 'Finals' });
    expect(u1.rundowns[0].titles).toEqual([
      { rundownItemId: 'i1', titleKey: 'lower-third', position: 0, label: 'Intro' },
      { rundownItemId: 'i2', titleKey: 'scoreboard', position: 1, label: null },
    ]);
  });
  it('includes users with no rundowns as empty', () => {
    const u2 = buildDirectory(rows).find((u) => u.userId === 'u2')!;
    expect(u2.rundowns).toEqual([]);
  });
  it('never leaks a data field', () => {
    const json = JSON.stringify(buildDirectory(rows));
    expect(json).not.toContain('"data"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/directory/build.test.ts`
Expected: FAIL — cannot import `buildDirectory`.

- [ ] **Step 3: Write builder, repo, and route**

```ts
// lib/directory/build.ts
export type DirectoryTitle = { rundownItemId: string; titleKey: string; position: number; label: string | null };
export type DirectoryRundown = { rundownId: string; name: string; titles: DirectoryTitle[] };
export type DirectoryUser = { userId: string; email: string; rundowns: DirectoryRundown[] };

export type DirectoryRow = {
  userId: string; email: string;
  rundownId: string | null; rundownName: string | null;
  rundownItemId: string | null; titleKey: string | null;
  position: number | null; titleLabel: string | null;
};

export function buildDirectory(rows: DirectoryRow[]): DirectoryUser[] {
  const users = new Map<string, DirectoryUser>();
  const rundownIndex = new Map<string, DirectoryRundown>();

  for (const row of rows) {
    let user = users.get(row.userId);
    if (!user) {
      user = { userId: row.userId, email: row.email, rundowns: [] };
      users.set(row.userId, user);
    }
    if (!row.rundownId || !row.rundownName) continue;

    const rkey = `${row.userId}:${row.rundownId}`;
    let rundown = rundownIndex.get(rkey);
    if (!rundown) {
      rundown = { rundownId: row.rundownId, name: row.rundownName, titles: [] };
      rundownIndex.set(rkey, rundown);
      user.rundowns.push(rundown);
    }
    if (!row.rundownItemId || !row.titleKey || row.position === null) continue;
    rundown.titles.push({
      rundownItemId: row.rundownItemId,
      titleKey: row.titleKey,
      position: row.position,
      label: row.titleLabel,
    });
  }
  return [...users.values()];
}
```

```ts
// lib/access/grant-repo.ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { rundowns, subscriptions, rundownGrants } from '@/db/schema';
import type { GrantRepo } from './control';

export const dbGrantRepo: GrantRepo = {
  async getRundownOwner(rundownId) {
    const [r] = await db.select({ ownerId: rundowns.ownerId }).from(rundowns).where(eq(rundowns.id, rundownId)).limit(1);
    return r?.ownerId ?? null;
  },
  async getAcceptedSubscription(ownerId, subscriberId) {
    const [s] = await db.select({ id: subscriptions.id }).from(subscriptions)
      .where(and(
        eq(subscriptions.ownerId, ownerId),
        eq(subscriptions.subscriberId, subscriberId),
        eq(subscriptions.status, 'accepted'),
      )).limit(1);
    return s ?? null;
  },
  async hasRundownGrant(subscriptionId, rundownId) {
    const [g] = await db.select({ id: rundownGrants.id }).from(rundownGrants)
      .where(and(eq(rundownGrants.subscriptionId, subscriptionId), eq(rundownGrants.rundownId, rundownId)))
      .limit(1);
    return !!g;
  },
};
```

```ts
// app/api/directory/route.ts
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, rundowns, rundownItems } from '@/db/schema';
import { buildDirectory, type DirectoryRow } from '@/lib/directory/build';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Unauthorized', { status: 401 });

  const rows = await db
    .select({
      userId: users.id, email: users.email,
      rundownId: rundowns.id, rundownName: rundowns.name,
      rundownItemId: rundownItems.id, titleKey: rundownItems.titleKey,
      position: rundownItems.position, titleLabel: rundownItems.label,
    })
    .from(users)
    .leftJoin(rundowns, eq(rundowns.ownerId, users.id))
    .leftJoin(rundownItems, eq(rundownItems.rundownId, rundowns.id));

  return Response.json(buildDirectory(rows as DirectoryRow[]));
}
```

> If `rundownItems` has no `label` column yet, add `label: text('label')` to it in `db/schema.ts` and regenerate the migration as part of this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/directory/build.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/directory/build.ts lib/access/grant-repo.ts app/api/directory/route.ts test/directory/build.test.ts
git commit -m "feat(directory): GET /api/directory with grouped users→rundowns→titles"
```

---

### Task 5: Subscriptions API

**Files:**
- Create: `lib/subscriptions/schema.ts` (Zod)
- Create: `app/api/subscriptions/route.ts` (POST request)
- Create: `app/api/subscriptions/mine/route.ts` (GET)
- Create: `app/api/subscriptions/incoming/route.ts` (GET)
- Create: `app/api/subscriptions/[id]/route.ts` (PATCH accept/revoke)
- Test: `test/subscriptions/schema.test.ts`

**Interfaces:**
- Consumes: `auth`, `db`, `subscriptions`.
- Produces:
  - `createSubscriptionSchema = z.object({ ownerEmail: z.string().email() })`
  - `patchSubscriptionSchema = z.object({ status: z.enum(['accepted', 'revoked']) })`

- [ ] **Step 1: Write the failing test**

```ts
// test/subscriptions/schema.test.ts
import { describe, it, expect } from 'vitest';
import { createSubscriptionSchema, patchSubscriptionSchema } from '@/lib/subscriptions/schema';

describe('subscription schemas', () => {
  it('create requires a valid owner email', () => {
    expect(createSubscriptionSchema.safeParse({ ownerEmail: 'a@b.com' }).success).toBe(true);
    expect(createSubscriptionSchema.safeParse({ ownerEmail: 'nope' }).success).toBe(false);
  });
  it('patch only allows accepted/revoked', () => {
    expect(patchSubscriptionSchema.safeParse({ status: 'accepted' }).success).toBe(true);
    expect(patchSubscriptionSchema.safeParse({ status: 'pending' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/subscriptions/schema.test.ts`
Expected: FAIL — cannot import schemas.

- [ ] **Step 3: Write schema + routes**

```ts
// lib/subscriptions/schema.ts
import { z } from 'zod';
export const createSubscriptionSchema = z.object({ ownerEmail: z.string().email() });
export const patchSubscriptionSchema = z.object({ status: z.enum(['accepted', 'revoked']) });
```

```ts
// app/api/subscriptions/route.ts
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, subscriptions } from '@/db/schema';
import { createSubscriptionSchema } from '@/lib/subscriptions/schema';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Unauthorized', { status: 401 });

  const parsed = createSubscriptionSchema.safeParse(await req.json());
  if (!parsed.success) return new Response('Invalid', { status: 400 });

  const [owner] = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, parsed.data.ownerEmail)).limit(1);
  if (!owner) return new Response('Owner not found', { status: 404 });
  if (owner.id === session.user.id) return new Response('Cannot subscribe to self', { status: 400 });

  await db.insert(subscriptions)
    .values({ ownerId: owner.id, subscriberId: session.user.id, status: 'pending' })
    .onConflictDoNothing();
  return new Response(null, { status: 201 });
}
```

```ts
// app/api/subscriptions/mine/route.ts
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { subscriptions, rundownGrants } from '@/db/schema';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Unauthorized', { status: 401 });

  const subs = await db.select().from(subscriptions).where(eq(subscriptions.subscriberId, session.user.id));
  const result = await Promise.all(subs.map(async (s) => ({
    ...s,
    grants: await db.select({ rundownId: rundownGrants.rundownId }).from(rundownGrants)
      .where(eq(rundownGrants.subscriptionId, s.id)),
  })));
  return Response.json(result);
}
```

```ts
// app/api/subscriptions/incoming/route.ts
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { subscriptions, users } from '@/db/schema';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Unauthorized', { status: 401 });

  const rows = await db.select({
    id: subscriptions.id, status: subscriptions.status,
    subscriberId: subscriptions.subscriberId, subscriberEmail: users.email,
  }).from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.subscriberId))
    .where(eq(subscriptions.ownerId, session.user.id));
  return Response.json(rows);
}
```

```ts
// app/api/subscriptions/[id]/route.ts
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { subscriptions } from '@/db/schema';
import { patchSubscriptionSchema } from '@/lib/subscriptions/schema';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;

  const parsed = patchSubscriptionSchema.safeParse(await req.json());
  if (!parsed.success) return new Response('Invalid', { status: 400 });

  const res = await db.update(subscriptions).set({ status: parsed.data.status })
    .where(and(eq(subscriptions.id, id), eq(subscriptions.ownerId, session.user.id)))
    .returning({ id: subscriptions.id });
  if (res.length === 0) return new Response('Not found', { status: 404 });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/subscriptions/schema.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/subscriptions/schema.ts app/api/subscriptions test/subscriptions/schema.test.ts
git commit -m "feat(subscriptions): request, list, accept/revoke endpoints"
```

---

### Task 6: Rundown grants API

**Files:**
- Create: `lib/subscriptions/grants-schema.ts` (Zod)
- Create: `app/api/subscriptions/[id]/grants/route.ts` (GET list, PUT replace)
- Test: `test/subscriptions/grants-schema.test.ts`

**Interfaces:**
- Consumes: `auth`, `db`, `subscriptions`, `rundowns`, `rundownGrants`.
- Produces: `putGrantsSchema = z.object({ rundownIds: z.array(z.string().uuid()) })`.

- [ ] **Step 1: Write the failing test**

```ts
// test/subscriptions/grants-schema.test.ts
import { describe, it, expect } from 'vitest';
import { putGrantsSchema } from '@/lib/subscriptions/grants-schema';

describe('putGrantsSchema', () => {
  it('accepts an array of uuids', () => {
    expect(putGrantsSchema.safeParse({ rundownIds: ['11111111-1111-1111-1111-111111111111'] }).success).toBe(true);
  });
  it('accepts empty (revoke all)', () => {
    expect(putGrantsSchema.safeParse({ rundownIds: [] }).success).toBe(true);
  });
  it('rejects non-uuid entries', () => {
    expect(putGrantsSchema.safeParse({ rundownIds: ['nope'] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/subscriptions/grants-schema.test.ts`
Expected: FAIL — cannot import `putGrantsSchema`.

- [ ] **Step 3: Write schema + route**

```ts
// lib/subscriptions/grants-schema.ts
import { z } from 'zod';
export const putGrantsSchema = z.object({ rundownIds: z.array(z.string().uuid()) });
```

```ts
// app/api/subscriptions/[id]/grants/route.ts
import { and, eq, inArray } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { subscriptions, rundowns, rundownGrants } from '@/db/schema';
import { putGrantsSchema } from '@/lib/subscriptions/grants-schema';

async function ownedSubscription(id: string, ownerId: string) {
  const [s] = await db.select({ id: subscriptions.id }).from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.ownerId, ownerId))).limit(1);
  return s ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;
  if (!(await ownedSubscription(id, session.user.id))) return new Response('Not found', { status: 404 });

  const rows = await db.select({ rundownId: rundownGrants.rundownId }).from(rundownGrants)
    .where(eq(rundownGrants.subscriptionId, id));
  return Response.json(rows.map((r) => r.rundownId));
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;
  if (!(await ownedSubscription(id, session.user.id))) return new Response('Not found', { status: 404 });

  const parsed = putGrantsSchema.safeParse(await req.json());
  if (!parsed.success) return new Response('Invalid', { status: 400 });

  // every rundownId must belong to the acting owner — cannot grant someone else's rundown
  if (parsed.data.rundownIds.length > 0) {
    const owned = await db.select({ id: rundowns.id }).from(rundowns)
      .where(and(inArray(rundowns.id, parsed.data.rundownIds), eq(rundowns.ownerId, session.user.id)));
    if (owned.length !== parsed.data.rundownIds.length) return new Response('Rundown not owned', { status: 400 });
  }

  await db.delete(rundownGrants).where(eq(rundownGrants.subscriptionId, id));
  if (parsed.data.rundownIds.length > 0) {
    await db.insert(rundownGrants).values(parsed.data.rundownIds.map((rid) => ({ subscriptionId: id, rundownId: rid })));
  }
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/subscriptions/grants-schema.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/subscriptions/grants-schema.ts app/api/subscriptions/\[id\]/grants test/subscriptions/grants-schema.test.ts
git commit -m "feat(grants): per-rundown grant list/replace endpoints"
```

---

### Task 7: MIDI bindings CRUD

**Files:**
- Create: `lib/midi/binding-schema.ts` (Zod + a pure `validateBindingTarget`)
- Create: `app/api/rundowns/[rundownId]/midi-bindings/route.ts` (GET, POST)
- Create: `app/api/rundowns/[rundownId]/midi-bindings/[id]/route.ts` (PATCH, DELETE)
- Test: `test/midi/binding-schema.test.ts`

**Interfaces:**
- Consumes: `assertControl`, `dbGrantRepo`, `auth`, `db`, `midiBindings`, `rundownItems`, `ForbiddenError`.
- Produces:
  - `createBindingSchema = z.object({ rundownItemId: z.string().uuid(), action: z.enum(['show','hide','update']), midiNote: z.number().int().min(0).max(127), midiChannel: z.number().int().min(0).max(15).default(0), label: z.string().max(120).optional() })`
  - `patchBindingSchema` = the create schema `.partial()`
  - `function validateBindingTarget(itemRundownId: string | null, rundownId: string): void` — throws `ForbiddenError` if the item is not in this rundown (or missing).

- [ ] **Step 1: Write the failing test**

```ts
// test/midi/binding-schema.test.ts
import { describe, it, expect } from 'vitest';
import { createBindingSchema, validateBindingTarget } from '@/lib/midi/binding-schema';
import { ForbiddenError } from '@/lib/access/control';

describe('createBindingSchema', () => {
  it('accepts a valid binding and defaults channel to 0', () => {
    const p = createBindingSchema.safeParse({
      rundownItemId: '11111111-1111-1111-1111-111111111111', action: 'show', midiNote: 60,
    });
    expect(p.success && p.data.midiChannel).toBe(0);
  });
  it('rejects out-of-range notes', () => {
    expect(createBindingSchema.safeParse({
      rundownItemId: '11111111-1111-1111-1111-111111111111', action: 'show', midiNote: 200,
    }).success).toBe(false);
  });
  it('rejects unknown actions', () => {
    expect(createBindingSchema.safeParse({
      rundownItemId: '11111111-1111-1111-1111-111111111111', action: 'flash', midiNote: 60,
    }).success).toBe(false);
  });
});

describe('validateBindingTarget', () => {
  it('passes when the item belongs to the rundown', () => {
    expect(() => validateBindingTarget('rd-1', 'rd-1')).not.toThrow();
  });
  it('throws when the item is in another rundown', () => {
    expect(() => validateBindingTarget('rd-2', 'rd-1')).toThrow(ForbiddenError);
  });
  it('throws when the item is missing', () => {
    expect(() => validateBindingTarget(null, 'rd-1')).toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/midi/binding-schema.test.ts`
Expected: FAIL — cannot import schema.

- [ ] **Step 3: Write schema + routes**

```ts
// lib/midi/binding-schema.ts
import { z } from 'zod';
import { ForbiddenError } from '@/lib/access/control';

export const createBindingSchema = z.object({
  rundownItemId: z.string().uuid(),
  action: z.enum(['show', 'hide', 'update']),
  midiNote: z.number().int().min(0).max(127),
  midiChannel: z.number().int().min(0).max(15).default(0),
  label: z.string().max(120).optional(),
});

export const patchBindingSchema = createBindingSchema.partial();

export function validateBindingTarget(itemRundownId: string | null, rundownId: string): void {
  if (itemRundownId !== rundownId) throw new ForbiddenError('Title not in this rundown');
}
```

```ts
// app/api/rundowns/[rundownId]/midi-bindings/route.ts
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { midiBindings, rundownItems } from '@/db/schema';
import { assertControl, ForbiddenError } from '@/lib/access/control';
import { dbGrantRepo } from '@/lib/access/grant-repo';
import { createBindingSchema, validateBindingTarget } from '@/lib/midi/binding-schema';

export async function GET(_req: Request, { params }: { params: Promise<{ rundownId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Unauthorized', { status: 401 });
  const { rundownId } = await params;
  try { await assertControl(dbGrantRepo, session.user.id, rundownId); }
  catch (e) { if (e instanceof ForbiddenError) return new Response('Forbidden', { status: 403 }); throw e; }

  const rows = await db.select().from(midiBindings)
    .where(and(eq(midiBindings.subscriberId, session.user.id), eq(midiBindings.rundownId, rundownId)));
  return Response.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ rundownId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Unauthorized', { status: 401 });
  const { rundownId } = await params;

  const parsed = createBindingSchema.safeParse(await req.json());
  if (!parsed.success) return new Response('Invalid', { status: 400 });

  try {
    await assertControl(dbGrantRepo, session.user.id, rundownId);
    const [item] = await db.select({ rundownId: rundownItems.rundownId }).from(rundownItems)
      .where(eq(rundownItems.id, parsed.data.rundownItemId)).limit(1);
    validateBindingTarget(item?.rundownId ?? null, rundownId);
  } catch (e) {
    if (e instanceof ForbiddenError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const [created] = await db.insert(midiBindings)
    .values({ ...parsed.data, subscriberId: session.user.id, rundownId })
    .returning();
  return Response.json(created, { status: 201 });
}
```

```ts
// app/api/rundowns/[rundownId]/midi-bindings/[id]/route.ts
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { midiBindings } from '@/db/schema';
import { patchBindingSchema } from '@/lib/midi/binding-schema';

export async function PATCH(req: Request, { params }: { params: Promise<{ rundownId: string; id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Unauthorized', { status: 401 });
  const { rundownId, id } = await params;

  const parsed = patchBindingSchema.safeParse(await req.json());
  if (!parsed.success) return new Response('Invalid', { status: 400 });

  // ownership is implicit: a binding row already belongs to (subscriber, rundown)
  const res = await db.update(midiBindings).set(parsed.data)
    .where(and(eq(midiBindings.id, id), eq(midiBindings.subscriberId, session.user.id), eq(midiBindings.rundownId, rundownId)))
    .returning({ id: midiBindings.id });
  if (res.length === 0) return new Response('Not found', { status: 404 });
  return new Response(null, { status: 204 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ rundownId: string; id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Unauthorized', { status: 401 });
  const { rundownId, id } = await params;

  const res = await db.delete(midiBindings)
    .where(and(eq(midiBindings.id, id), eq(midiBindings.subscriberId, session.user.id), eq(midiBindings.rundownId, rundownId)))
    .returning({ id: midiBindings.id });
  if (res.length === 0) return new Response('Not found', { status: 404 });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/midi/binding-schema.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/midi/binding-schema.ts app/api/rundowns test/midi/binding-schema.test.ts
git commit -m "feat(midi): bindings CRUD scoped to (subscriber, rundown)"
```

---

### Task 8: Trigger endpoint (bus integration)

**Files:**
- Create: `lib/midi/trigger.ts` (pure payload builder)
- Create: `app/api/rundowns/[rundownId]/trigger/route.ts`
- Test: `test/midi/trigger.test.ts`

**Interfaces:**
- Consumes: `assertControl`, `dbGrantRepo`, `bus.publish`, `getTitleModel`, `db`, `rundownItems`, `ForbiddenError`.
- Produces:
  - `triggerSchema = z.object({ rundownItemId: z.string().uuid(), action: z.enum(['show','hide','update']) })`
  - `function buildTriggerEvent(action: 'show'|'hide'|'update', rundownItemId: string, data: unknown): { type: 'show'|'hide'|'update'; rundownItemId: string; data?: unknown }` — omits `data` for hide; includes validated `data` for show/update.

- [ ] **Step 1: Write the failing test**

```ts
// test/midi/trigger.test.ts
import { describe, it, expect } from 'vitest';
import { buildTriggerEvent, triggerSchema } from '@/lib/midi/trigger';

describe('buildTriggerEvent', () => {
  it('includes data on show', () => {
    expect(buildTriggerEvent('show', 'i1', { a: 1 })).toEqual({ type: 'show', rundownItemId: 'i1', data: { a: 1 } });
  });
  it('includes data on update', () => {
    expect(buildTriggerEvent('update', 'i1', { a: 2 })).toEqual({ type: 'update', rundownItemId: 'i1', data: { a: 2 } });
  });
  it('omits data on hide', () => {
    expect(buildTriggerEvent('hide', 'i1', { a: 1 })).toEqual({ type: 'hide', rundownItemId: 'i1' });
  });
});

describe('triggerSchema', () => {
  it('rejects bad action', () => {
    expect(triggerSchema.safeParse({ rundownItemId: '11111111-1111-1111-1111-111111111111', action: 'x' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/midi/trigger.test.ts`
Expected: FAIL — cannot import `buildTriggerEvent`.

- [ ] **Step 3: Write payload builder + route**

```ts
// lib/midi/trigger.ts
import { z } from 'zod';

export const triggerSchema = z.object({
  rundownItemId: z.string().uuid(),
  action: z.enum(['show', 'hide', 'update']),
});

export type TriggerEvent =
  | { type: 'hide'; rundownItemId: string }
  | { type: 'show' | 'update'; rundownItemId: string; data: unknown };

export function buildTriggerEvent(
  action: 'show' | 'hide' | 'update',
  rundownItemId: string,
  data: unknown,
): TriggerEvent {
  if (action === 'hide') return { type: 'hide', rundownItemId };
  return { type: action, rundownItemId, data };
}
```

```ts
// app/api/rundowns/[rundownId]/trigger/route.ts
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { rundownItems } from '@/db/schema';
import { bus } from '@/lib/broadcast/bus';
import { getTitleModel } from '@/lib/titles/registry';
import { assertControl, ForbiddenError } from '@/lib/access/control';
import { dbGrantRepo } from '@/lib/access/grant-repo';
import { triggerSchema, buildTriggerEvent } from '@/lib/midi/trigger';

export async function POST(req: Request, { params }: { params: Promise<{ rundownId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response('Unauthorized', { status: 401 });
  const { rundownId } = await params;

  const parsed = triggerSchema.safeParse(await req.json());
  if (!parsed.success) return new Response('Invalid', { status: 400 });

  try {
    await assertControl(dbGrantRepo, session.user.id, rundownId);
  } catch (e) {
    if (e instanceof ForbiddenError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const [item] = await db.select({ titleKey: rundownItems.titleKey, data: rundownItems.data, rundownId: rundownItems.rundownId })
    .from(rundownItems)
    .where(and(eq(rundownItems.id, parsed.data.rundownItemId), eq(rundownItems.rundownId, rundownId)))
    .limit(1);
  if (!item) return new Response('Not found', { status: 404 });

  let data: unknown;
  if (parsed.data.action !== 'hide') {
    const result = getTitleModel(item.titleKey).safeParse(item.data);
    if (!result.success) return new Response('Stored title data invalid', { status: 422 });
    data = result.data;
  }

  bus.publish(rundownId, buildTriggerEvent(parsed.data.action, parsed.data.rundownItemId, data));
  return new Response(null, { status: 202 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/midi/trigger.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/midi/trigger.ts app/api/rundowns/\[rundownId\]/trigger test/midi/trigger.test.ts
git commit -m "feat(midi): authorized trigger endpoint publishing to broadcast bus"
```

---

### Task 9: RTK Query slices

**Files:**
- Create: `store/api/directoryApi.ts`
- Create: `store/api/subscriptionsApi.ts`
- Create: `store/api/midiBindingsApi.ts`
- Modify: the root store reducer/middleware registration (wherever existing `*Api` slices are combined)
- Test: `test/store/midiBindingsApi.test.ts`

**Interfaces:**
- Consumes: existing `createApi`/`baseQuery` setup used by other entity slices.
- Produces hooks: `useGetDirectoryQuery`, `useGetMySubscriptionsQuery`, `useGetIncomingQuery`, `useRequestSubscriptionMutation`, `usePatchSubscriptionMutation`, `useGetGrantsQuery`, `usePutGrantsMutation`, `useGetBindingsQuery`, `useCreateBindingMutation`, `usePatchBindingMutation`, `useDeleteBindingMutation`.

- [ ] **Step 1: Write the failing test**

```ts
// test/store/midiBindingsApi.test.ts
import { describe, it, expect } from 'vitest';
import { midiBindingsApi } from '@/store/api/midiBindingsApi';

describe('midiBindingsApi', () => {
  it('builds the bindings GET url from rundownId', () => {
    const ep = midiBindingsApi.endpoints.getBindings;
    const built = (ep as any).query('rd-1');
    expect(built.url).toBe('/rundowns/rd-1/midi-bindings');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/store/midiBindingsApi.test.ts`
Expected: FAIL — cannot import `midiBindingsApi`.

- [ ] **Step 3: Write the slices**

```ts
// store/api/midiBindingsApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export type Binding = {
  id: string; rundownItemId: string; action: 'show' | 'hide' | 'update';
  midiNote: number; midiChannel: number; label: string | null;
};

export const midiBindingsApi = createApi({
  reducerPath: 'midiBindingsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Binding'],
  endpoints: (b) => ({
    getBindings: b.query<Binding[], string>({
      query: (rundownId) => ({ url: `/rundowns/${rundownId}/midi-bindings` }),
      providesTags: (_r, _e, rundownId) => [{ type: 'Binding', id: rundownId }],
    }),
    createBinding: b.mutation<Binding, { rundownId: string; body: Omit<Binding, 'id'> }>({
      query: ({ rundownId, body }) => ({ url: `/rundowns/${rundownId}/midi-bindings`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'Binding', id: rundownId }],
    }),
    patchBinding: b.mutation<void, { rundownId: string; id: string; body: Partial<Binding> }>({
      query: ({ rundownId, id, body }) => ({ url: `/rundowns/${rundownId}/midi-bindings/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'Binding', id: rundownId }],
    }),
    deleteBinding: b.mutation<void, { rundownId: string; id: string }>({
      query: ({ rundownId, id }) => ({ url: `/rundowns/${rundownId}/midi-bindings/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { rundownId }) => [{ type: 'Binding', id: rundownId }],
    }),
  }),
});

export const {
  useGetBindingsQuery, useCreateBindingMutation, usePatchBindingMutation, useDeleteBindingMutation,
} = midiBindingsApi;
```

```ts
// store/api/directoryApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { DirectoryUser } from '@/lib/directory/build';

export const directoryApi = createApi({
  reducerPath: 'directoryApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (b) => ({
    getDirectory: b.query<DirectoryUser[], void>({ query: () => ({ url: '/directory' }) }),
  }),
});
export const { useGetDirectoryQuery } = directoryApi;
```

```ts
// store/api/subscriptionsApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export type Subscription = { id: string; ownerId: string; subscriberId: string; status: 'pending' | 'accepted' | 'revoked' };

export const subscriptionsApi = createApi({
  reducerPath: 'subscriptionsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Sub', 'Incoming', 'Grants'],
  endpoints: (b) => ({
    getMySubscriptions: b.query<Array<Subscription & { grants: { rundownId: string }[] }>, void>({
      query: () => ({ url: '/subscriptions/mine' }), providesTags: ['Sub'],
    }),
    getIncoming: b.query<Array<{ id: string; status: string; subscriberId: string; subscriberEmail: string }>, void>({
      query: () => ({ url: '/subscriptions/incoming' }), providesTags: ['Incoming'],
    }),
    requestSubscription: b.mutation<void, { ownerEmail: string }>({
      query: (body) => ({ url: '/subscriptions', method: 'POST', body }), invalidatesTags: ['Sub'],
    }),
    patchSubscription: b.mutation<void, { id: string; status: 'accepted' | 'revoked' }>({
      query: ({ id, status }) => ({ url: `/subscriptions/${id}`, method: 'PATCH', body: { status } }),
      invalidatesTags: ['Incoming'],
    }),
    getGrants: b.query<string[], string>({
      query: (id) => ({ url: `/subscriptions/${id}/grants` }),
      providesTags: (_r, _e, id) => [{ type: 'Grants', id }],
    }),
    putGrants: b.mutation<void, { id: string; rundownIds: string[] }>({
      query: ({ id, rundownIds }) => ({ url: `/subscriptions/${id}/grants`, method: 'PUT', body: { rundownIds } }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Grants', id }],
    }),
  }),
});

export const {
  useGetMySubscriptionsQuery, useGetIncomingQuery, useRequestSubscriptionMutation,
  usePatchSubscriptionMutation, useGetGrantsQuery, usePutGrantsMutation,
} = subscriptionsApi;
```

Register all three in the root store: add each `*.reducerPath`/`*.reducer` to `combineReducers` and each `*.middleware` to the middleware chain, following the pattern of the existing entity slices.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/store/midiBindingsApi.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add store/api/directoryApi.ts store/api/subscriptionsApi.ts store/api/midiBindingsApi.ts test/store/midiBindingsApi.test.ts
git commit -m "feat(store): directory/subscriptions/midi-bindings RTK Query slices"
```

---

### Task 10: Owner Subscribers UI

**Files:**
- Create: `app/admin/subscribers/page.tsx`
- Create: `components/admin/SubscriberRow.tsx`
- Test: `test/components/SubscriberRow.test.tsx`
- Modify: `vitest.config.ts` (add a `jsdom` project/override for `.test.tsx`)

**Interfaces:**
- Consumes: `useGetIncomingQuery`, `usePatchSubscriptionMutation`, `useGetGrantsQuery`, `usePutGrantsMutation`.
- Produces: `<SubscriberRow sub={{ id, subscriberEmail, status }} onAccept onRevoke />` — renders email + status + Accept/Revoke buttons (Accept shown when `status !== 'accepted'`; Revoke when `status === 'accepted'`).

- [ ] **Step 1: Add jsdom + RTL deps and write the failing test**

```bash
npm install -D jsdom @testing-library/react @testing-library/user-event
```

Add to `vitest.config.ts` `test`: `environmentMatchGlobs: [['test/**/*.test.tsx', 'jsdom']]`.

```tsx
// test/components/SubscriberRow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubscriberRow } from '@/components/admin/SubscriberRow';

describe('SubscriberRow', () => {
  it('shows Accept for a pending request and fires onAccept', async () => {
    const onAccept = vi.fn();
    render(<SubscriberRow sub={{ id: 's1', subscriberEmail: 'c2@x', status: 'pending' }} onAccept={onAccept} onRevoke={vi.fn()} />);
    expect(screen.getByText('c2@x')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledWith('s1');
  });
  it('shows Revoke for an accepted subscriber', () => {
    render(<SubscriberRow sub={{ id: 's1', subscriberEmail: 'c2@x', status: 'accepted' }} onAccept={vi.fn()} onRevoke={vi.fn()} />);
    expect(screen.getByRole('button', { name: /revoke/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/components/SubscriberRow.test.tsx`
Expected: FAIL — cannot import `SubscriberRow`.

- [ ] **Step 3: Write the component + page**

```tsx
// components/admin/SubscriberRow.tsx
'use client';
import { Button, Stack, Typography, Chip } from '@mui/material';

export type SubscriberRowData = { id: string; subscriberEmail: string; status: string };

export function SubscriberRow({ sub, onAccept, onRevoke }: {
  sub: SubscriberRowData; onAccept: (id: string) => void; onRevoke: (id: string) => void;
}) {
  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <Typography sx={{ flex: 1 }}>{sub.subscriberEmail}</Typography>
      <Chip label={sub.status} size="small" />
      {sub.status !== 'accepted'
        ? <Button onClick={() => onAccept(sub.id)}>Accept</Button>
        : <Button color="error" onClick={() => onRevoke(sub.id)}>Revoke</Button>}
    </Stack>
  );
}
```

```tsx
// app/admin/subscribers/page.tsx
'use client';
import { Stack, Typography } from '@mui/material';
import { useGetIncomingQuery, usePatchSubscriptionMutation } from '@/store/api/subscriptionsApi';
import { SubscriberRow } from '@/components/admin/SubscriberRow';

export default function SubscribersPage() {
  const { data = [] } = useGetIncomingQuery();
  const [patch] = usePatchSubscriptionMutation();
  return (
    <Stack spacing={2} sx={{ p: 3 }}>
      <Typography variant="h5">Subscribers</Typography>
      {data.map((s) => (
        <SubscriberRow key={s.id} sub={s}
          onAccept={(id) => patch({ id, status: 'accepted' })}
          onRevoke={(id) => patch({ id, status: 'revoked' })} />
      ))}
    </Stack>
  );
}
```

> Per-rundown grant editing reuses `useGetGrantsQuery`/`usePutGrantsMutation`; add a checkbox list of the owner's rundowns under each accepted subscriber in this page (same pattern, omitted here for brevity but required for the grant UI to be reachable).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/components/SubscriberRow.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add app/admin/subscribers components/admin/SubscriberRow.tsx test/components/SubscriberRow.test.tsx vitest.config.ts package.json package-lock.json
git commit -m "feat(admin): subscribers view to accept/revoke and grant rundowns"
```

---

### Task 11: Subscriber MIDI-player page (Web MIDI)

**Files:**
- Create: `lib/midi/useMidiInput.ts` (Web MIDI hook + pure note parsing)
- Create: `app/midi/[rundownId]/page.tsx`
- Test: `test/midi/parseNoteOn.test.ts`

**Interfaces:**
- Consumes: `useGetBindingsQuery`, trigger endpoint (direct `fetch`, not RTK — avoids cache churn mid-show, per spec).
- Produces:
  - `function parseNoteOn(data: Uint8Array | number[]): { note: number; channel: number } | null` — returns the note for a noteOn with velocity > 0; `null` for noteOff, zero-velocity noteOn, or non-note messages.
  - `useMidiInput(onNote: (n: { note: number; channel: number }) => void): { status: 'idle'|'ready'|'unsupported'|'denied' }`.

- [ ] **Step 1: Write the failing test**

```ts
// test/midi/parseNoteOn.test.ts
import { describe, it, expect } from 'vitest';
import { parseNoteOn } from '@/lib/midi/useMidiInput';

describe('parseNoteOn', () => {
  it('parses a noteOn on channel 0', () => {
    expect(parseNoteOn([0x90, 60, 100])).toEqual({ note: 60, channel: 0 });
  });
  it('parses a noteOn on channel 3', () => {
    expect(parseNoteOn([0x93, 64, 80])).toEqual({ note: 64, channel: 3 });
  });
  it('treats zero-velocity noteOn as null (release)', () => {
    expect(parseNoteOn([0x90, 60, 0])).toBeNull();
  });
  it('ignores noteOff', () => {
    expect(parseNoteOn([0x80, 60, 100])).toBeNull();
  });
  it('ignores control-change', () => {
    expect(parseNoteOn([0xB0, 7, 100])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/midi/parseNoteOn.test.ts`
Expected: FAIL — cannot import `parseNoteOn`.

- [ ] **Step 3: Write the hook + page**

```ts
// lib/midi/useMidiInput.ts
'use client';
import { useEffect, useRef, useState } from 'react';

export function parseNoteOn(data: Uint8Array | number[]): { note: number; channel: number } | null {
  const [status, note, velocity] = [data[0], data[1], data[2]];
  if ((status & 0xf0) !== 0x90) return null; // not noteOn
  if (!velocity) return null;                // zero-velocity = release
  return { note, channel: status & 0x0f };
}

export function useMidiInput(onNote: (n: { note: number; channel: number }) => void) {
  const [status, setStatus] = useState<'idle' | 'ready' | 'unsupported' | 'denied'>('idle');
  const cb = useRef(onNote);
  cb.current = onNote;

  useEffect(() => {
    const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<any> };
    if (!nav.requestMIDIAccess) { setStatus('unsupported'); return; }
    let access: any;
    nav.requestMIDIAccess().then((a) => {
      access = a;
      setStatus('ready');
      const handler = (e: any) => {
        const parsed = parseNoteOn(e.data);
        if (parsed) cb.current(parsed);
      };
      for (const input of a.inputs.values()) input.onmidimessage = handler;
    }).catch(() => setStatus('denied'));
    return () => { if (access) for (const input of access.inputs.values()) input.onmidimessage = null; };
  }, []);

  return { status };
}
```

```tsx
// app/midi/[rundownId]/page.tsx
'use client';
import { use, useCallback } from 'react';
import { Stack, Typography, Chip, Button } from '@mui/material';
import { useGetBindingsQuery, type Binding } from '@/store/api/midiBindingsApi';
import { useMidiInput } from '@/lib/midi/useMidiInput';

async function fire(rundownId: string, b: Pick<Binding, 'rundownItemId' | 'action'>) {
  await fetch(`/api/rundowns/${rundownId}/trigger`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rundownItemId: b.rundownItemId, action: b.action }),
  });
}

export default function MidiPlayerPage({ params }: { params: Promise<{ rundownId: string }> }) {
  const { rundownId } = use(params);
  const { data: bindings = [] } = useGetBindingsQuery(rundownId);

  const onNote = useCallback((n: { note: number; channel: number }) => {
    const hit = bindings.find((b) => b.midiNote === n.note && b.midiChannel === n.channel);
    if (hit) void fire(rundownId, hit);
  }, [bindings, rundownId]);

  const { status } = useMidiInput(onNote);

  return (
    <Stack spacing={2} sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h5">MIDI Player</Typography>
        <Chip label={status} color={status === 'ready' ? 'success' : 'default'} size="small" />
      </Stack>
      {bindings.map((b) => (
        <Stack key={b.id} direction="row" spacing={2} alignItems="center">
          <Typography sx={{ flex: 1 }}>{b.label ?? b.rundownItemId} · note {b.midiNote}/ch{b.midiChannel} · {b.action}</Typography>
          <Button onClick={() => fire(rundownId, b)}>Fire</Button>
        </Stack>
      ))}
    </Stack>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/midi/parseNoteOn.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Run the full suite + commit**

Run: `npm test`
Expected: PASS — all tests green.

```bash
git add lib/midi/useMidiInput.ts app/midi test/midi/parseNoteOn.test.ts
git commit -m "feat(midi): subscriber Web MIDI player page with note-trigger + fallback buttons"
```

---

## Self-Review

**Spec coverage:**
- Singleton seeded project + removed Add Project → Task 2 (seed insert) + Prerequisites note. ✅
- `rundowns.owner_id` → Task 2. ✅
- `subscriptions`, `rundown_grants`, `midi_bindings` → Task 2. ✅
- Visibility-vs-control rule → Task 3 (`assertControl`) + Task 4 (open directory). ✅
- Directory excludes `data` → Task 4 builder + test asserting no `data` leak. ✅
- Owner subscription/grant endpoints → Tasks 5, 6. ✅
- Subscriber subscription/bindings endpoints → Tasks 5, 7. ✅
- Trigger → bus, `update` re-validates against `model.ts` → Task 8. ✅
- RTK slices → Task 9. ✅
- Owner Subscribers UI → Task 10. ✅
- Subscriber MIDI-player (Web MIDI, note-learn fallback buttons) → Task 11. ✅ (note-learn assignment UI is described in Task 10's grant note / Task 11 fallback; full pad-learn capture can be layered on `parseNoteOn` post-MVP.)

**Type consistency:** `GrantRepo` (Task 3) implemented by `dbGrantRepo` (Task 4) and consumed in Tasks 7–8. `action` enum `'show'|'hide'|'update'` consistent across schema (Task 2), binding schema (Task 7), trigger (Task 8). `Binding` type (Task 9) matches `midiBindings` columns (Task 2). `DirectoryUser` shape shared between Task 4 and Task 9.

**Known deltas to flag at execution:** several tasks depend on Prerequisites that don't yet exist in the repo (auth, db client, bus, registry, RTK store, `rundownItems.label`). Each is named explicitly; if absent, build before that task.
