# Rename `/admin` to `/projects` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the operator-facing admin app's URL from `/admin` to `/projects` — folder, route, redirects, the auth guard's protected prefix, and every internal link — so the URL matches what the page actually is (a project gallery), given the whole app now sits behind auth except `/login`, `/preview/*`, and `/air/*`.

**Architecture:** A pure rename, not a redesign. `app/(admin)/admin/` moves to `app/(admin)/projects/` (the `(admin)` **route group** name stays — it still accurately describes "the authenticated, MUI/Redux-backed section of the app," a broader architectural label distinct from `(broadcast)`, independent of which literal path segment lives inside it). Every `Admin`-prefixed identifier that names something under that folder is renamed to `Projects*` so code and URL agree (`AdminGallery` → `ProjectsGallery`, the `AdminPage` component → `ProjectsPage`). `lib/auth-guard.ts`'s `PROTECTED_PREFIXES` changes from `'/admin'` to `'/projects'` — its prefix-matching logic itself is untouched. No redirect from old `/admin` URLs is added: nothing is deployed or bookmarked yet, so there's no compatibility surface to preserve.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · Vitest 4 + `@testing-library/react`. No new dependencies.

## Global Constraints

- **`/projects` (the new UI route) and `/api/projects/*` (the existing REST API) are different, non-colliding path trees.** `guardRequest`'s existing prefix logic (`pathname === p || pathname.startsWith(`${p}/`)`) already treats them as separate entries in `PROTECTED_PREFIXES` — do not merge or special-case them.
- **No DB/schema changes.** This is a routing/UI rename only.
- **`components/admin/crud/*` is out of scope.** That's the shared CRUD component library used across the operator UI (a broader "admin" architectural label, per CLAUDE.md decision 7's "MUI for admin"), not tied to this specific route — leave every `@/components/admin/...` import path untouched.
- **`docs/superpowers/plans/*.md` and the dated `*-design.md` spec files are historical execution records — do not rewrite them.** Only living reference docs (`CLAUDE.md`, `README.md`, `docs/*.md` except `docs/superpowers/`) and the one living tracker (`docs/superpowers/specs/2026-06-18-base-app-scope.md`) get updated, per the precedent set in the P3 and P4 docs-sync tasks.
- House ESLint style: no semicolons, 2-space indent, single quotes, max-len 140. `npm run lint` must exit 0.
- Every task ends in a commit. Work on a branch off `main` (worktree).

---

### Task 1: Rename the route — folder, identifiers, links, guard, proxy, tests

**Files:**
- Move: `app/(admin)/admin/` → `app/(admin)/projects/` (whole subtree, 16 files)
- Move + rename: `app/(admin)/admin/AdminGallery.tsx` → `app/(admin)/projects/ProjectsGallery.tsx`
- Move + rename: `test/app/admin.test.tsx` → `test/app/projects.test.tsx`
- Modify: `app/(admin)/projects/page.tsx`, `app/(admin)/projects/ProjectsGallery.tsx`, `app/(admin)/projects/[projectId]/WorkspaceNav.tsx`, `app/(admin)/projects/[projectId]/layout.tsx`, `app/(admin)/projects/[projectId]/data/page.tsx`, `app/(admin)/projects/[projectId]/data/brackets/page.tsx`, `app/(admin)/projects/[projectId]/rundowns/page.tsx`, `app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx`, `app/(admin)/login/LoginForm.tsx`, `app/(admin)/login/page.tsx`, `proxy.ts`, `lib/auth-guard.ts`
- Modify: `test/app/projects.test.tsx` (post-move), `test/app/login.test.tsx`, `test/lib/auth-guard.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports. The public URL surface changes from `/admin`, `/admin/[projectId]/...` to `/projects`, `/projects/[projectId]/...`. `guardRequest`'s behavior is identical except the protected page-prefix string.

- [ ] **Step 1: Capture the baseline**

Run: `npm run build`
Record the route table — confirm it currently shows `/admin` and `/admin/[projectId]/...`, not `/projects`. You'll diff against this after the rename.

- [ ] **Step 2: Move the files**

```bash
git mv "app/(admin)/admin" "app/(admin)/projects"
git mv "app/(admin)/projects/AdminGallery.tsx" "app/(admin)/projects/ProjectsGallery.tsx"
git mv test/app/admin.test.tsx test/app/projects.test.tsx
```

- [ ] **Step 3: Rename identifiers and update every `/admin` string in app code**

In `app/(admin)/projects/page.tsx`:
```diff
-import AdminGallery from './AdminGallery'
+import ProjectsGallery from './ProjectsGallery'

 // proxy.ts only checks cookie presence; this is the authoritative check.
-export default async function AdminPage() {
+export default async function ProjectsPage() {
   const session = await auth.api.getSession({ headers: await headers() })
   if (!session) redirect('/login')

-  return <AdminGallery userEmail={session.user.email} />
+  return <ProjectsGallery userEmail={session.user.email} />
 }
```

In `app/(admin)/projects/ProjectsGallery.tsx`:
```diff
-export default function AdminGallery({ userEmail }: { userEmail: string }) {
+export default function ProjectsGallery({ userEmail }: { userEmail: string }) {
```
(Match whatever the real prop signature line is — rename only the function identifier, nothing else about the signature.) And the gallery card link:
```diff
-                href={`/admin/${p.id}/data`}>
+                href={`/projects/${p.id}/data`}>
```

In `app/(admin)/projects/[projectId]/WorkspaceNav.tsx`:
```diff
-  const dataHref = `/admin/${projectId}/data`
-  const rundownsHref = `/admin/${projectId}/rundowns`
+  const dataHref = `/projects/${projectId}/data`
+  const rundownsHref = `/projects/${projectId}/rundowns`
```

In `app/(admin)/projects/[projectId]/layout.tsx`:
```diff
 // proxy.ts only checks cookie presence; this is the authoritative check,
-// covering every page under /admin/[projectId]/* (data/*, rundowns/*).
+// covering every page under /projects/[projectId]/* (data/*, rundowns/*).
```

In `app/(admin)/projects/[projectId]/data/page.tsx`:
```diff
-            href={`/admin/${projectId}/data/${s.slug}`}>
+            href={`/projects/${projectId}/data/${s.slug}`}>
```

In `app/(admin)/projects/[projectId]/data/brackets/page.tsx`:
```diff
-            href={`/admin/${projectId}/data/brackets/${b.id}`}>
+            href={`/projects/${projectId}/data/brackets/${b.id}`}>
```

In `app/(admin)/projects/[projectId]/rundowns/page.tsx`:
```diff
-                href={`/admin/${projectId}/rundowns/${r.id}`}>
+                href={`/projects/${projectId}/rundowns/${r.id}`}>
```

In `app/(admin)/projects/[projectId]/rundowns/[rundownId]/page.tsx`:
```diff
-      router.push(`/admin/${projectId}/rundowns`)
+      router.push(`/projects/${projectId}/rundowns`)
```
```diff
-      <Link href={`/admin/${projectId}/rundowns`}>
+      <Link href={`/projects/${projectId}/rundowns`}>
```

In `app/(admin)/login/LoginForm.tsx`:
```diff
-    router.push('/admin')
+    router.push('/projects')
```

In `app/(admin)/login/page.tsx`:
```diff
-  if (session) redirect('/admin')
+  if (session) redirect('/projects')
```

- [ ] **Step 4: Update the auth guard and proxy matcher**

In `lib/auth-guard.ts`:
```diff
-const PROTECTED_PREFIXES = ['/admin', '/api/projects']
+const PROTECTED_PREFIXES = ['/projects', '/api/projects']
```

In `proxy.ts`:
```diff
 export const config = {
-  matcher: ['/admin/:path*', '/api/projects/:path*'],
+  matcher: ['/projects/:path*', '/api/projects/:path*'],
 }
```

- [ ] **Step 5: Update the tests**

In `test/app/projects.test.tsx` (post-move):
```diff
-import AdminPage from '@/app/(admin)/admin/page'
-import SignOutButton from '@/app/(admin)/admin/SignOutButton'
+import ProjectsPage from '@/app/(admin)/projects/page'
+import SignOutButton from '@/app/(admin)/projects/SignOutButton'
```
```diff
-describe('AdminPage', () => {
+describe('ProjectsPage', () => {
   it('redirects to /login when there is no session', async () => {
     getSession.mockResolvedValue(null)
-    await expect(AdminPage()).rejects.toThrow('NEXT_REDIRECT:/login')
+    await expect(ProjectsPage()).rejects.toThrow('NEXT_REDIRECT:/login')
   })
   it('renders the signed-in operator email', async () => {
     getSession.mockResolvedValue({ user: { id: 'u1', email: 'op@ets.tv', name: 'op@ets.tv' } })
-    renderWithStore(await AdminPage())
+    renderWithStore(await ProjectsPage())
     expect(screen.getByText(/op@ets\.tv/)).toBeInTheDocument()
   })
 })
```
(`SignOutButton`'s own describe block and assertions are unaffected — it never referenced `/admin`.)

In `test/app/login.test.tsx`:
```diff
-  it('redirects to /admin when already signed in', async () => {
+  it('redirects to /projects when already signed in', async () => {
     ...
-    await expect(LoginPage()).rejects.toThrow('NEXT_REDIRECT:/admin')
+    await expect(LoginPage()).rejects.toThrow('NEXT_REDIRECT:/projects')
```
```diff
-  it('signs in and navigates to /admin on success', async () => {
+  it('signs in and navigates to /projects on success', async () => {
     ...
-    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin'))
+    await waitFor(() => expect(push).toHaveBeenCalledWith('/projects'))
```

In `test/lib/auth-guard.test.ts`:
```diff
 describe('guardRequest', () => {
-  it('redirects logged-out page requests under /admin to login', () => {
-    expect(guardRequest('/admin', false)).toBe('redirect-login')
-    expect(guardRequest('/admin/some-project/data', false)).toBe('redirect-login')
+  it('redirects logged-out page requests under /projects to login', () => {
+    expect(guardRequest('/projects', false)).toBe('redirect-login')
+    expect(guardRequest('/projects/some-project/data', false)).toBe('redirect-login')
   })
   it('401s logged-out API requests under /api/projects', () => {
     expect(guardRequest('/api/projects', false)).toBe('unauthorized')
     expect(guardRequest('/api/projects/abc/players', false)).toBe('unauthorized')
   })
   it('allows protected paths when the session cookie is present', () => {
-    expect(guardRequest('/admin', true)).toBe('allow')
+    expect(guardRequest('/projects', true)).toBe('allow')
     expect(guardRequest('/api/projects/abc', true)).toBe('allow')
   })
   it('never touches public paths', () => {
     for (const p of ['/login', '/', '/preview/some-id', '/air/some-id', '/api/auth/sign-in/email', '/api/broadcast/x/stream']) {
       expect(guardRequest(p, false)).toBe('allow')
     }
   })
   it('does not treat prefix look-alikes as protected', () => {
-    expect(guardRequest('/administrator', false)).toBe('allow')
+    expect(guardRequest('/projectsx', false)).toBe('allow')
   })
 })
```

- [ ] **Step 6: Run the full verification**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 7: Diff the route table**

Compare the new `npm run build` route table against Step 1's baseline. Expected: `/admin` and `/admin/[projectId]/...` are gone; `/projects` and `/projects/[projectId]/...` (data/*, rundowns/*) are present in their place. Every other route (`/`, `/login`, `/dev/title-preview`, `/preview/[rundownId]`, `/air/[rundownId]`, `/api/*`) is unchanged.

- [ ] **Step 8: Commit**

```bash
git add "app/(admin)" proxy.ts lib/auth-guard.ts test/app/projects.test.tsx test/app/login.test.tsx test/lib/auth-guard.test.ts
git commit -m "refactor(admin): rename /admin to /projects

Everything behind auth now sits under /projects, matching what the page
actually is (a project gallery) now that only /login, /preview/*, and
/air/* are public. AdminGallery -> ProjectsGallery, the AdminPage
component -> ProjectsPage, so code and URL agree. No redirect from old
/admin URLs -- nothing is deployed or bookmarked yet. The (admin) route
group keeps its name; it still labels the whole MUI/Redux-backed
authenticated section, independent of the literal /projects segment
inside it."
```

---

### Task 2: Sync docs to the renamed route

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/architecture.md`, `docs/auth.md`, `docs/data-entities.md`, `docs/database.md`, `docs/projects-system.md`, `docs/roadmap.md`, `docs/rundowns.md`, `docs/superpowers/specs/2026-06-18-base-app-scope.md`

**Interfaces:**
- Consumes: Task 1's shipped rename.
- Produces: docs that don't mislead the next reader about the URL.

- [ ] **Step 1: Sweep every living doc for `/admin` and update to `/projects`**

Run: `grep -rn "/admin" CLAUDE.md README.md docs --include="*.md" --exclude-dir=superpowers`
Then separately: `grep -rn "/admin" docs/superpowers/specs/2026-06-18-base-app-scope.md`

For every match in the files listed above (**not** `docs/superpowers/plans/*.md` or the dated `*-design.md` spec files — those are historical and stay as-is), replace the `/admin` URL with `/projects`. This includes:
- Prose mentions (`the /admin gallery` → `the /projects gallery`, etc.)
- Route tables (`docs/architecture.md`'s route table, CLAUDE.md's route map)
- Code-sketch file-path comments that describe the real route (e.g. `docs/auth.md`'s `// app/admin/page.tsx` and `// app/admin/SignOutButton.tsx` sketches — update these to the real, current path: `app/(admin)/projects/page.tsx`, `app/(admin)/projects/SignOutButton.tsx`)
- `docs/superpowers/specs/2026-06-18-base-app-scope.md`'s historical narrative lines (e.g. "P2's plan had stalled...") — these describe real, already-executed history, so update the URL string (`/admin` → `/projects`) without rewriting the surrounding historical narrative itself.

- [ ] **Step 2: Leave two categories of pre-existing staleness alone — note them, don't fix them**

- `docs/architecture.md`, `docs/auth.md`, and `docs/rundowns.md` describe the rundown/controller route as `/admin/[projectId]/overlays` in places, but the real shipped route (per `app/(admin)/projects/[projectId]/rundowns/`) uses the URL segment `rundowns`, not `overlays` — `overlays` is only the UI tab label (WorkspaceNav's "Overlays" tab), not the URL. This mismatch **predates this task** and is out of scope here — only change `/admin` → `/projects` in these lines; do not also fix `overlays` → `rundowns`. Note it in your report as a pre-existing, separate doc gap for a future pass.
- `docs/state-management.md`'s `// app/admin/layout.tsx` code sketch is a fictional illustrative snippet (there's no real `AdminProviders` component — the real one is `app/(admin)/providers.tsx`'s `Providers`) that predates this task. Leave it alone; it was never accurate and this task doesn't need to fix it.

- [ ] **Step 3: Sweep for contradictions**

Run: `grep -rn "'/admin'\|\"/admin\"\|/admin/\[projectId\]\|/admin/\${" CLAUDE.md README.md docs --include="*.md" --exclude-dir=superpowers`
Expected: no matches (the two pre-existing-staleness lines from Step 2 don't match this pattern — they say `/admin/[projectId]/overlays` and a fictional file path, not a bare `/admin` URL reference).

- [ ] **Step 4: Final verification**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Expected: all green (docs changes shouldn't affect any of these, but confirm nothing else drifted).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md docs
git commit -m "docs: sync docs to the /admin -> /projects rename"
```

---

## Self-review notes

- **Spec coverage.** Every file the initial grep sweep found containing a real `/admin` URL reference (not a `@/components/admin/...` import path) is covered: 12 app-code files + `proxy.ts` + `lib/auth-guard.ts` in Task 1, 3 test files in Task 1, 10 doc files in Task 2.
- **Deliberately out of scope, and why.** `components/admin/crud/*` (a different "admin" — the shared CRUD component library, not this route) is untouched. `docs/superpowers/plans/*.md` and the dated `*-design.md` specs are historical execution records, not living docs — untouched. The `/admin/[projectId]/overlays` vs. real `rundowns` URL segment mismatch in `docs/architecture.md`/`docs/auth.md`/`docs/rundowns.md`, and `docs/state-management.md`'s fictional `AdminProviders` sketch, both predate this task and are explicitly left alone in Task 2 Step 2 rather than silently expanding scope.
- **No redirect from old `/admin` URLs.** Explicit decision, not an oversight: nothing is deployed yet, so there's no bookmark/compatibility surface to preserve. If this ever needs revisiting post-deployment, it would be a `proxy.ts` addition (redirect `/admin/:path*` → `/projects/:path*`), not a Task 1 concern.
- **`(admin)` route group name is unchanged, on purpose.** It labels the whole authenticated, MUI/Redux section of the app (parallel to `(broadcast)`), not the specific `/projects` segment inside it — renaming it would be a bigger, unrequested change with zero URL-visible effect (route groups are invisible in the URL).
