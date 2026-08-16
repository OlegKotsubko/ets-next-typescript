import { catalog } from './catalog.generated'
import { components } from './components.generated'
import type { OverlayAnimation, OverlayComponent } from './types'

// Render-facing registry — the ONLY module importing overlay components +
// animations (the dev harness now, the broadcast pages later).
export type RenderEntry = {
  model: string
  Component: OverlayComponent
  animationIn: OverlayAnimation
  animationOut: OverlayAnimation
}

const compByKey = new Map(components.map((c) => [`${c.category}/${c.template}`, c]))

const byModel = new Map<string, RenderEntry>()
for (const row of catalog) {
  const comp = compByKey.get(`${row.category}/${row.template}`)
  if (comp) {
    byModel.set(row.settings.model, {
      model: row.settings.model,
      Component: comp.Component as unknown as OverlayComponent,
      animationIn: comp.animationIn as OverlayAnimation,
      animationOut: comp.animationOut as OverlayAnimation,
    })
  }
}

export function getOverlayRender(model: string): RenderEntry | undefined {
  return byModel.get(model)
}
