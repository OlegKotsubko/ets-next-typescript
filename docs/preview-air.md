# Preview and Air

`/preview/[rundownId]` and `/air/[rundownId]` are the two **broadcast render targets**. Both render the same title components fed by the same SSE event stream. The difference is intent:

| Route | Audience | Typical viewer |
|---|---|---|
| `/preview/[rundownId]` | Operator: "what would I see if I clicked AIR right now?" | A second monitor next to the admin UI; an OBS Source on a hidden scene |
| `/air/[rundownId]` | The world: the on-air program feed | OBS / vMix browser source on the main scene |

Both are **public URLs** (no auth). Rundown IDs are UUIDs — unguessable, but not secrets. Treat them like share links.

## Page shape

A minimal full-bleed transparent page:

```tsx
// app/(broadcast)/air/[rundownId]/page.tsx
'use client';

import { useTitleStream } from '@/lib/broadcast/useTitleStream';
import { TitleRenderer } from '@/lib/broadcast/TitleRenderer';

export default function AirPage({ params }: { params: { rundownId: string } }) {
  const current = useTitleStream(params.rundownId, 'air');
  return <TitleRenderer current={current} />;
}
```

```tsx
// app/(broadcast)/air/[rundownId]/layout.tsx
import { db } from '@/db';
import { rundowns, projectCss } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function AirLayout({
  children, params,
}: { children: React.ReactNode; params: { rundownId: string } }) {
  const rundown = await db.query.rundowns.findFirst({
    where: eq(rundowns.id, params.rundownId),
    with: { project: true },                       // need project.label (folder) and project.id (for CSS lookup)
  });
  if (!rundown) return <div>Rundown not found</div>;

  const cssRow = await db.query.projectCss.findFirst({ where: eq(projectCss.projectId, rundown.projectId) });

  return (
    <html lang="en">
      <head>
        {/* package folder = project.label, NOT the project UUID */}
        <link rel="stylesheet" href={`/projects/${rundown.project.label}/styles/project.css`} />
        {cssRow?.css && <style dangerouslySetInnerHTML={{ __html: cssRow.css }} />}
      </head>
      <body className="bg-transparent">{children}</body>
    </html>
  );
}
```

The page intentionally lacks any chrome — no header, no footer, no body background. OBS/vMix consumes a transparent canvas.

## The SSE contract

### Endpoint

```
GET /api/broadcast/[rundownId]/stream
```

Headers:
```
Content-Type: text/event-stream
Cache-Control: no-store
Connection: keep-alive
```

**`runtime = 'edge'`** is mandatory (see [deployment.md](./deployment.md#sse-runs-on-edge-functions)).

### Event shape

Every event is a JSON object:

```ts
type BroadcastEvent =
  | { type: 'show'; rundownId: string; itemId: string; titleKey: string; data: unknown }
  | { type: 'hide'; rundownId: string; itemId: string }
  | { type: 'update'; rundownId: string; itemId: string; data: unknown };
```

Serialized as:
```
data: {"type":"show","rundownId":"…","itemId":"…","titleKey":"lower-third","data":{"playerName":"Casey Liu"}}

```

(Each event ends with two newlines per the SSE spec.)

### Heartbeats

Send a comment line every 15 seconds to keep intermediaries (Netlify CDN, corporate proxies) from closing the connection:

```
: beat

```

The client ignores comment lines automatically.

### Preview vs. Air channels — the only difference

The bus topology is per-channel. The admin emits events on either the `preview` or `air` channel:

- **Selecting** a title in the editor → `preview` channel.
- **Clicking AIR** → both `preview` and `air` channels (the operator sees what's live on their preview monitor too).
- **Clicking HIDE** → `hide` on both channels.

The SSE endpoint takes a `channel` query parameter:

```
GET /api/broadcast/[rundownId]/stream?channel=preview
GET /api/broadcast/[rundownId]/stream?channel=air
```

The route handler subscribes to the matching channel. Same code path, two streams.

## Client: `useTitleStream`

A small hook that subscribes via `EventSource`, validates the payload against the title's `model.ts` Zod schema, and exposes the current title.

```ts
// lib/broadcast/useTitleStream.ts
'use client';

import { useEffect, useState } from 'react';
import { getTitle } from './registry';

export type CurrentTitle = { titleKey: string; data: unknown } | null;

export function useTitleStream(rundownId: string, channel: 'preview' | 'air'): CurrentTitle {
  const [current, setCurrent] = useState<CurrentTitle>(null);

  useEffect(() => {
    const es = new EventSource(`/api/broadcast/${rundownId}/stream?channel=${channel}`);

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === 'show' || event.type === 'update') {
        const title = getTitle(event.titleKey);
        if (!title) {
          console.warn(`Unknown title: ${event.titleKey}`);
          return;
        }
        const parsed = title.model.safeParse(event.data);
        if (!parsed.success) {
          console.warn('Invalid title data', parsed.error);
          return;
        }
        setCurrent({ titleKey: event.titleKey, data: parsed.data });
      } else if (event.type === 'hide') {
        setCurrent(null);
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; no action needed
    };

    return () => es.close();
  }, [rundownId, channel]);

  return current;
}
```

```tsx
// lib/broadcast/TitleRenderer.tsx
'use client';

import { getTitle } from './registry';
import type { CurrentTitle } from './useTitleStream';

export function TitleRenderer({ current }: { current: CurrentTitle }) {
  if (!current) return null;
  const title = getTitle(current.titleKey);
  if (!title) return null;
  const Component = title.Component;
  return <Component data={current.data} />;
}
```

## Applying overlay settings

The SSE payload carries only `{ titleKey, data }`. Everything about *how* an overlay presents — its enter/exit stingers, its background/video bed, whether it's a full-screen splash — comes from the overlay's `settings.ts`, which the renderer looks up in the registry by `titleKey` (settings are author-time and identical for every show, so they don't belong in the stream). See [titles-system.md](./titles-system.md#settingsts--presentation-settings).

A fuller `TitleRenderer` resolves package-relative media URLs and sequences the transition:

```tsx
// lib/broadcast/TitleRenderer.tsx (with settings)
export function TitleRenderer({ current, packageLabel }: { current: CurrentTitle; packageLabel: string }) {
  if (!current) return null;
  const title = getTitle(current.titleKey);
  if (!title) return null;

  const s = title.settings;
  const v = (file?: string) => file && `/projects/${packageLabel}/assets/titles/videos/${file}`;
  const bg = s.title_background && `/projects/${packageLabel}/assets/titles/backgrounds/${s.title_background}`;
  const Component = title.Component;

  // Sketch: play v(s.title_stinger_in) on mount, v(s.title_stinger_out) on hide;
  // render <Component> over `bg` / v(s.title_video); if s.title_is_full_screen, occupy the full 1920×1080 canvas.
  return (
    <div className={s.title_is_full_screen ? 'fixed inset-0' : undefined}>
      {bg && <video src={bg} autoPlay muted loop className="fixed inset-0 -z-10 h-full w-full object-cover" />}
      <Component data={current.data} />
    </div>
  );
}
```

`packageLabel` comes from the layout's `rundown.project.label`. `title_color` is **not** used here — it only tags the overlay in the operator's picker; rendered brand colors still come from `project.css` variables.

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

- **`/air/<id>` is blank.** Open the URL in a regular browser and check the console. Most common: the rundown ID doesn't exist (404 from the layout's `db.query.rundowns.findFirst`).
- **Title appears for 1 second then vanishes.** The `data` failed Zod validation on the client. Check the console for the validation error and fix the title's `model.ts` or the operator's input.
- **SSE connects but no events arrive.** The admin and the broadcast page are on different Edge regions, so the in-process pub/sub doesn't reach across. See the [single-server caveat](./rundowns.md#caveat-single-server-pubsub).
- **OBS shows a flash of system font before the real font.** `project.css` is using `font-display: swap` instead of `block`. See [projects-system.md](./projects-system.md#font-pipeline).
- **Title is positioned wrong.** Titles assume a 1920×1080 canvas. If the OBS Browser Source is set to a different size, fixed positions will be off.
- **Connection drops every 30 seconds.** Heartbeats aren't being sent. Check the SSE route's `setInterval` (it should emit `: beat\n\n` every 15s).
