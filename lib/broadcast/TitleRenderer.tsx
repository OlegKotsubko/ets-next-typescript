'use client'

import { getTitleEntry } from '@/lib/titles/registry'
import type { LiveTitle } from './liveSet'

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
        return (
          <div key={t.itemId}
            className={settings.title_is_full_screen ? 'fixed inset-0' : undefined}
            style={{ zIndex: t.layer }}>
            {bg && (
              <video src={bg}
                autoPlay
                muted
                loop
                className="fixed inset-0 -z-10 h-full w-full object-cover" />
            )}
            <Title data={t.data} />
          </div>
        )
      })}
    </>
  )
}
