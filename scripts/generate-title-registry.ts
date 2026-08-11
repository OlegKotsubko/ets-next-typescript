// Thin IO shell around lib/titles/codegen.ts (which holds the testable logic).
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanTitleDirs, buildRegistrySource } from '../lib/titles/codegen'

const locations = scanTitleDirs()
const out = join(process.cwd(), 'lib', 'titles', 'generated.ts')
writeFileSync(out, buildRegistrySource(locations))
console.log(`Generated ${locations.length} title(s) -> lib/titles/generated.ts`)
