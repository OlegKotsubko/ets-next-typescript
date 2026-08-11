// Thin IO shell around lib/projects/registry-codegen.ts (which holds the testable logic).
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanPackageLabels, buildPackageRegistrySource } from '../lib/projects/registry-codegen'

const labels = scanPackageLabels()
const out = join(process.cwd(), 'lib', 'projects', 'generated.ts')
writeFileSync(out, buildPackageRegistrySource(labels))
console.log(`Generated ${labels.length} package(s) -> lib/projects/generated.ts`)
