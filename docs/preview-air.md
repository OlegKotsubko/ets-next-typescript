# Preview and Air

`/preview/[rundownId]` and `/air/[rundownId]` are the two **broadcast render targets**. Both render the same title components fed by the same SSE event stream, and both render the full **live set** — every currently-shown title, stacked by layer — not just one. The difference is intent:

| Route | Audience | Typical viewer |
|---|---|---|
| `/preview/[rundownId]` | Operator: "what would I see if I clicked AIR right now?" | A second monitor next to the admin UI; an OBS Source on a hidden scene |
| `/air/[rundownId]` | The world: the on-air program feed | OBS / vMix browser source on the main scene |

Both are **public URLs** (no auth). Rundown IDs are UUIDs — unguessable, but not secrets. Treat them like share links.

## Route group: `app/(broadcast)/`

`/preview` and `/air` live in their own top-level route group with their own root layout, deliberately independent of `app/(admin)/layout.tsx`:

```tsx
// app/(broadcast)/layout.tsx
export const metadata = { title: 'ETS — Broadcast' };

export default function BroadcastRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: 'transparent' }}>{children}</body>
    </html>
  );
}
```

This exists because `app/(admin)/layout.tsx` pulls in MUI's `AppRouterCacheProvider`/`ThemeProvider`/`CssBaseline` and the Redux `Provider` — `CssBaseline` paints a non-transparent theme background onto `<body>`, which is fatal for a page OBS is supposed to key as transparent, and neither MUI nor Redux belongs on a broadcast page anyway (these pages don't use Redux at all — everything flows through the SSE-driven `useTitleStream` hook).

## Page shape

Each of `/preview/[rundownId]` and `/air/[rundownId]` is a layout + page pair. The layout resolves the rundown's package and injects its CSS; the page subscribes to the stream and renders the live set. Both routes are identical except for the SSE `channel` they pass:

```tsx
// app/(broadcast)/air/[rundownId]/layout.tsx
import { getBroadcastContext } from '@/lib/broadcast/getBroadcastContext';
import { PackageLabelProvider } from '@/lib/broadcast/PackageLabelContext';

export default async function AirLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ rundownId: string }> }) {
  const { rundownId } = await params;
  const ctx = await getBroadcastContext(rundownId);
  if (!ctx) return <div>Rundown not found</div>;

  return (
    <>
      {/* the folder is the package label, NOT the project UUID */}
      <link rel="stylesheet" href={`/projects/${ctx.packageLabel}/styles/project.css`} />
      {ctx.css && <style dangerouslySetInnerHTML={{ __html: ctx.css }} />}
      <PackageLabelProvider packageLabel={ctx.packageLabel}>
        {children}
      </PackageLabelProvider>
    </>
  );
}
```

```tsx
// app/(broadcast)/air/[rundownId]/page.tsx
'use client';

import { use } from 'react';
import { useTitleStream } from '@/lib/broadcast/useTitleStream';
import { TitleRenderer } from '@/lib/broadcast/TitleRenderer';
import { usePackageLabel } from '@/lib/broadcast/PackageLabelContext';

export default function AirPage({ params }: { params: Promise<{ rundownId: string }> }) {
  const { rundownId } = use(params);
  const packageLabel = usePackageLabel();
  const titles = useTitleStream(rundownId, 'air');
  return <TitleRenderer titles={titles} packageLabel={packageLabel} />;
}
```

`app/(broadcast)/preview/[rundownId]/layout.tsx` and `page.tsx` are the same code with `'air'` swapped for `'preview'` throughout.

`getBroadcastContext` (`lib/broadcast/getBroadcastContext.ts`) is a single query shared by both layouts — one round trip for the rundown, its project (`project.label` for the asset/CSS folder), and any custom `project_css` row:

```ts
export interface BroadcastContext {
  rundownId: string;
  rundownName: string;
  projectId: string;
  packageLabel: string; // project.label — the overlay-package folder, never the project UUID
  css: string;
}
```

It's built with `db.select().from(rundowns).innerJoin(projects, …).leftJoin(projectCss, …)` — a plain Drizzle query builder call, **not** `db.query.rundowns.findFirst({ with: { project: true } })`. This schema has no `relations()` definitions, so the relational-query API (`db.query.*`) isn't wired up anywhere in this codebase; every route, including this one, uses `db.select().innerJoin(...)`.

`packageLabel` reaches the client via `PackageLabelProvider`/`usePackageLabel` (`lib/broadcast/PackageLabelContext.tsx`), a small React context — the layout is a Server Component (it needs `getBroadcastContext`'s DB call) and the page is a Client Component (it needs `useTitleStream`'s `EventSource`), so the label has to cross that boundary via context rather than a prop.

The page itself has no chrome — no header, no footer, no body background. `TitleRenderer` renders each live title's own markup directly.

## The SSE contract

### Endpoint

```
GET /api/broadcast/[rundownId]/stream?channel=preview|air
```

`channel` defaults to `preview` for any value other than exactly `air`. Headers:
```
Content-Type: text/event-stream
Cache-Control: no-store
Connection: keep-alive
```

**`runtime = 'edge'`** is mandatory (see [deployment.md](./deployment.md#sse-runs-on-edge-functions)). The route is public and unauthenticated — rundown IDs are share-link tokens, per [rundowns.md](./rundowns.md).

### Event shape

`BroadcastEvent` (`lib/broadcast/liveSet.ts`) is the one definition — `lib/broadcast/bus.ts`, the SSE route, and `useTitleStream` all import it rather than redeclaring it:

```ts
export type BroadcastEvent =
  | { type: 'show'; itemId: string; titleKey: string; layer: number; position: number; data: unknown }
  | { type: 'hide'; itemId: string }
  | { type: 'update'; itemId: string; layer: number; position: number; data: unknown }
  | { type: 'command'; itemId: string; action: string; payload?: unknown };
```

- `layer` + `position` ride on `show`/`update` — higher `layer` renders on top; `position` breaks ties within a layer. (`rundown_items` has no `layer` column yet — that's a P5b migration. For now `layer`/`position` only exist in the event payload and the in-memory live set, never in the database.)
- `hide` only needs `itemId` — the title is removed from the live set.
- `command` is imperative and fire-and-forget: it's never folded into the live set (a late or duplicate `command` can't desync a reconnecting client's replay), and nothing currently delivers it to a mounted title's `onCommand` handler — that wiring is P5b.

Serialized as:
```
data: {"type":"show","itemId":"…","titleKey":"lower-third","layer":0,"position":0,"data":{"playerName":"Casey Liu"}}

```

(Each event ends with two newlines per the SSE spec. There's no `event:` line, so every frame arrives as the browser's default `message` event.)

### Reload recovery: the server-side snapshot

The bus (`lib/broadcast/bus.ts`) keeps a stateful snapshot per `(rundownId, channel)`, built by folding every published event through `applyEvent` (`lib/broadcast/liveSet.ts`). When a client connects (or reconnects — e.g. OBS restarts, or the browser tab reloads), the route replays that snapshot as a burst of synthetic `show` events **before** subscribing to live events:

```ts
// app/api/broadcast/[rundownId]/stream/route.ts (excerpt)
for (const t of getSnapshot(rundownId, channel)) {
  controller.enqueue(enc.encode(frame({ type: 'show', ...t })));
}
unsub = subscribe(rundownId, channel, (event) => {
  controller.enqueue(enc.encode(frame(event)));
});
```

This is why reloading `/air` restores whatever was on-air instead of coming up blank — the client doesn't need any separate "give me current state" request, it just gets a `show` event for every currently-live title as the very first frames on the stream.

### Heartbeats

The route sends a comment line every 15 seconds to keep intermediaries (Netlify CDN, corporate proxies) from closing an idle connection:

```
: beat

```

The client ignores comment lines automatically (`EventSource` never fires `onmessage` for them).

### Caveat: the bus does not (yet) cross the Edge/Node runtime split

**This is a real, deterministic limitation of the current code — distinct from, and stronger than, the [single-server pub/sub caveat](./rundowns.md#caveat-single-server-pubsub) documented in `docs/rundowns.md`.** Read this before wiring a Node-side publisher (P5b's AIR/TAKE routes).

`app/api/broadcast/[rundownId]/stream/route.ts` sets `export const runtime = 'edge'` (mandatory — see above). Next.js compiles Edge routes into a separate bundle/isolate from Node route handlers. Every other route under `/api/projects/` is a Node route (it needs `auth` + `db`, which don't run on Edge), and P5b's future AIR/TAKE routes will be Node routes for the same reason.

`lib/broadcast/bus.ts` holds its subscriber/snapshot state at module scope. When one module is loaded into two separate runtime bundles, each bundle gets **its own copy of that module-level state** — a Node-side `publish()` call and the Edge-side `subscribe()`/`getSnapshot()` calls are talking to two different in-memory maps that never see each other. This is nothing to do with the multi-region scaling scenario the single-server caveat describes; it's guaranteed to happen on a single instance, in one deployment, in one region — the moment a publisher lives in a Node route and a subscriber lives in an Edge route. On Netlify this is made worse still, since separate Edge Function invocations may each get a fresh isolate with no shared state at all, even invocation-to-invocation.

**Current state (this branch):** nothing publishes yet, so nothing is broken today — this is a forward-looking caveat, not a live bug.

**This needs to be resolved before or during P5b**, when a Node-side `publish()` call is introduced. Plausible options, to be decided when that plan is written (not decided here):
- Keep the publisher on Edge too (e.g. an Edge-runtime AIR/TAKE route that talks to `db`/`auth` via an HTTP-friendly path instead of the Node-only driver paths).
- Drop `runtime = 'edge'` from the SSE route and rely on `EventSource`'s automatic reconnect to paper over Netlify's 10s Node Function cap (reconnect churn instead of a hard 10s wall).
- Introduce a real cross-instance broker (Redis pub/sub, Postgres `LISTEN/NOTIFY`) that both runtimes talk to instead of sharing in-process state.

### Preview vs. Air channels

The bus is channel-aware: `publish`, `subscribe`, and `getSnapshot` (`lib/broadcast/bus.ts`) all take `(rundownId, channel, …)`, and the snapshot map is keyed per `${rundownId}:${channel}` — `preview` and `air` never share state, even for the same rundown. The intended controller behavior (built in P5b, not yet shipped) is:

- **Selecting/staging** a title in the editor → `preview` channel only.
- **Clicking AIR** → `air` channel (and typically `preview` too, so the operator's preview monitor reflects on-air).
- **Clicking HIDE** → `hide` on the channel(s) it's being pulled from.

The SSE endpoint and `useTitleStream` take the channel as a parameter; it's the same route and hook for both, just pointed at a different channel.

## Client: `useTitleStream`

Subscribes via `EventSource`, folds every event through the same `applyEvent`/`sortLiveSet` pair the server-side snapshot uses, and returns the current live set — ordered by `(layer, position)` — as plain state:

```ts
// lib/broadcast/useTitleStream.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { applyEvent, sortLiveSet, type LiveTitle, type BroadcastEvent } from './liveSet';

export function useTitleStream(rundownId: string, channel: 'preview' | 'air'): LiveTitle[] {
  const [titles, setTitles] = useState<LiveTitle[]>([]);
  const mapRef = useRef<Map<string, LiveTitle>>(new Map());

  useEffect(() => {
    const es = new EventSource(`/api/broadcast/${rundownId}/stream?channel=${channel}`);
    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as BroadcastEvent;
      mapRef.current = applyEvent(mapRef.current, event);
      setTitles(sortLiveSet(mapRef.current));
    };
    // EventSource auto-reconnects on network drop; no manual retry needed.
    return () => es.close();
  }, [rundownId, channel]);

  return titles;
}
```

(The real hook also resets `mapRef`/`titles` synchronously when `rundownId`/`channel` changes, so switching rundowns doesn't briefly show the previous rundown's titles.)

`LiveTitle` is the reducer's element type:

```ts
export interface LiveTitle {
  itemId: string;
  titleKey: string;
  layer: number;
  position: number;
  data: unknown;
}
```

There is **no client-side re-validation of `data` against the title's `model.ts`** at this layer — the hook trusts whatever the server published. Validation against `model.ts` happens where the data is *written* (the admin mutation route, still P5a/P5b), not where it's streamed.

## `TitleRenderer`

Maps the live set to rendered title components, resolving each one through the title registry by `(packageLabel, titleKey)`:

```tsx
// lib/broadcast/TitleRenderer.tsx
'use client';

import { getTitleEntry } from '@/lib/titles/registry';
import type { LiveTitle } from './liveSet';

export function TitleRenderer({
  titles, packageLabel,
}: { titles: LiveTitle[]; packageLabel: string }) {
  return (
    <>
      {titles.map((t) => {
        const entry = getTitleEntry(packageLabel, t.titleKey);
        if (!entry) return null;
        const Title = entry.Component as (props: { data: unknown }) => React.ReactNode;
        const { settings } = entry;
        const bg = settings.title_background
          && `/projects/${packageLabel}/assets/titles/backgrounds/${settings.title_background}`;
        return (
          <div key={t.itemId}
            className={settings.title_is_full_screen ? 'fixed inset-0' : undefined}
            style={{ zIndex: t.layer }}>
            {bg && <video src={bg} autoPlay muted loop className="fixed inset-0 -z-10 h-full w-full object-cover" />}
            <Title data={t.data} />
          </div>
        );
      })}
    </>
  );
}
```

Notes on what this does and doesn't do yet:

- `getTitleEntry(packageLabel, titleKey)` comes from `@/lib/titles/registry` (the build-time codegen registry — see [titles-system.md](./titles-system.md)), not a local `./registry` module — no such module exists in `lib/broadcast/`.
- An unresolvable `(packageLabel, titleKey)` pair (typo, or a rundown pointing at a different package than the title was authored for) renders nothing for that item — silently, with no console warning yet.
- Stacking uses `zIndex: t.layer` directly and CSS source order for `position` (titles arrive from `useTitleStream` already sorted by `(layer, position)`).
- `title_background` renders as a looping muted `<video>` behind the title if set. `title_stinger_in`/`title_stinger_out`/`title_video` are declared in `settings.ts`'s schema but **not yet consumed** by this renderer — stinger sequencing and a distinct on-air video bed are future work.
- `title_color` is **not** used here — it only tags the overlay in the operator's picker; rendered brand colors still come from `project.css` variables.

## OBS / vMix setup

### OBS

1. **+** in **Sources** → **Browser**.
2. **URL**: `https://yourapp.netlify.app/air/<rundownId>` (or `http://localhost:3000/air/<rundownId>` for local).
3. **Width** / **Height**: `1920` / `1080`.
4. **FPS**: `60` (or match your stream's frame rate).
5. **Custom CSS**: leave **empty**. The page loads its own `project.css`.
6. Check **Shutdown source when not visible** = **off**. Keep the SSE connection alive across scene switches.
7. Check **Refresh browser when scene becomes active** = **off**. Refreshing drops state on scene change.

### vMix

1. **Add Input** → **Web Browser**.
2. **URL**: `https://yourapp.netlify.app/air/<rundownId>`.
3. **Width** / **Height**: `1920` / `1080`.
4. Open settings → **Audio**: disable (titles are silent).
5. Keep the input active across the show; don't toggle it on/off between titles.

### Sanity-check

- Open the URL in a regular browser tab first. You should see a blank page with no console errors.
- In the admin, AIR a title. The browser tab should render the title within ~200ms. If not, see [troubleshooting](#troubleshooting).

## Local dev with OBS

OBS can load `http://localhost:3000/air/<rundownId>` directly — no tunnel required. The default Browser Source has `OBS Browser CEF` which honors localhost.

If you want a teammate to view your local rundown, use `ngrok http 3000` or Cloudflare Tunnel and hand them the public URL. The SSE stream survives the tunnel.

## Troubleshooting

- **`/air/<id>` shows "Rundown not found".** `getBroadcastContext` returned `null` — the rundown ID doesn't exist, or its `project_id` doesn't join to a `projects` row.
- **A title doesn't appear at all.** `getTitleEntry(packageLabel, titleKey)` returned `undefined` — check the `titleKey` published in the event matches an entry under the rundown's `packageLabel` in `lib/titles/generated.ts`. `TitleRenderer` skips it silently rather than throwing.
- **SSE connects but no events arrive, and it happens every time (not intermittently).** As of P5b (once a Node-side AIR/TAKE route calls `publish()`), this is the expected, deterministic result of the Edge/Node runtime split — the Node publisher and the Edge SSE route hold two separate copies of the bus's in-memory state and never see each other's events. See [the Edge/Node runtime-split caveat](#caveat-the-bus-does-not-yet-cross-the-edgenode-runtime-split) above; this is the primary cause once a Node-side publisher exists, and it is not fixed by picking a region.
- **SSE connects but no events arrive, and it's intermittent / only some sessions are affected.** The admin and the broadcast page are on different Edge regions, so the in-process pub/sub doesn't reach across. See the [single-server caveat](./rundowns.md#caveat-single-server-pubsub). (This is the pre-P5b failure mode, when everything publishing is still Edge-side.)
- **OBS shows a flash of system font before the real font.** `project.css` is using `font-display: swap` instead of `block`. See [projects-system.md](./projects-system.md#font-pipeline).
- **Title is positioned wrong.** Titles assume a 1920×1080 canvas. If the OBS Browser Source is set to a different size, fixed positions will be off.
- **Connection drops every 30 seconds.** Heartbeats aren't being sent. Check the SSE route's `setInterval` (it should emit `: beat\n\n` every 15s).
- **Reloading `/air` shows nothing even though a title was on-air.** Check the bus snapshot is actually being reached — the reload-recovery replay (see above) depends on the same in-process bus as live events, so this usually means the same cross-instance issue as the "no events arrive" case above.
