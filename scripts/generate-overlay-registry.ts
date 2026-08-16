import { writeFileSync } from 'node:fs'
import { scanOverlayDirs, buildSources } from '../lib/overlays/codegen'

const dirs = scanOverlayDirs()
const { catalog, components } = buildSources(dirs)
writeFileSync('lib/overlays/catalog.generated.ts', catalog)
writeFileSync('lib/overlays/components.generated.ts', components)
console.log(`Generated overlay registry for ${dirs.length} overlays: ${dirs.map((d) => `${d.category}/${d.template}`).join(', ')}`)
