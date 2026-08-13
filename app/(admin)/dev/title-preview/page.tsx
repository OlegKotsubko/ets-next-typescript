// DEV ONLY — iterate on titles visually before the rundown editor exists.
// Visit http://localhost:3000/dev/title-preview
// Not under app/_dev because Next's private-folder convention excludes that
// subtree from routing entirely; the notFound() guard below keeps this out
// of production instead.
'use client'

import { notFound } from 'next/navigation'
import { listTitles } from '@/lib/titles/registry'

const PACKAGE_LABEL = 'default'

export const SAMPLE_DATA: Record<string, unknown> = {
  'lower-third': { playerName: 'Casey Liu', teamName: 'Boom Squad' },
  'opening-timer': { hours: 0, minutes: 15, seconds: 0, main_text: 'Kickoff', subtitle: 'Main Stage' },
}

export default function TitlePreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <>
      <link
        rel="stylesheet"
        href={`/projects/${PACKAGE_LABEL}/styles/project.css`}
      />
      {listTitles(PACKAGE_LABEL).map((entry) => {
        const Title = entry.Component as (_props: { data: unknown }) => React.ReactNode
        return (
          <section key={entry.key}>
            <h2>
              {entry.settings.title_name}
            </h2>
            <Title data={SAMPLE_DATA[entry.key]} />
          </section>
        )
      })}
    </>
  )
}
