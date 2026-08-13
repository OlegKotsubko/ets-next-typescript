'use client'

import type { CSSProperties } from 'react'
import { getTitleEntry } from '@/lib/titles/registry'
import type { LiveTitle } from './liveSet'

// This project has no Tailwind (SCSS modules + CSS variables only, per
// CLAUDE.md decision 7), so wrapper/background positioning is done with real
// inline styles rather than utility class names that would otherwise be
// inert strings with no matching CSS anywhere in the repo.
const backgroundVideoStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: -1,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}

export function TitleRenderer({
  titles, packageLabel,
}: { titles: LiveTitle[]; packageLabel: string }) {
  return (
    <>
      {titles.map((t) => {
        const entry = getTitleEntry(packageLabel, t.titleKey)
        if (!entry) return null
        const Title = entry.Component as (props: { data: unknown }) => React.ReactNode
        const { settings } = entry
        const bg = settings.title_background
          && `/projects/${packageLabel}/assets/titles/backgrounds/${settings.title_background}`
        // The wrapper needs an explicit `position` for `zIndex` to have any
        // effect (z-index is a no-op on statically positioned elements).
        // Each title's own SCSS root already sets `position: fixed` with
        // its own placement (lower-third: corner-anchored; opening-timer:
        // `inset: 0`), so the wrapper doesn't need to duplicate layout —
        // it just needs to be a positioned element so layering by `layer`
        // is real. Full-screen titles get `fixed`/`inset: 0` to match
        // their own root's footprint; others get `relative` so `zIndex`
        // applies without imposing any positioning of their own.
        const wrapperStyle: CSSProperties = settings.title_is_full_screen
          ? { position: 'fixed', inset: 0, zIndex: t.layer }
          : { position: 'relative', zIndex: t.layer }
        return (
          <div key={t.itemId}
            style={wrapperStyle}>
            {bg && (
              <video src={bg}
                autoPlay
                muted
                loop
                style={backgroundVideoStyle} />
            )}
            <Title data={t.data} />
          </div>
        )
      })}
    </>
  )
}
