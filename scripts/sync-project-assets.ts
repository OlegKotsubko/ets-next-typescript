import { join } from 'node:path'
import { watch } from 'node:fs'
import { syncProjectAssets } from '../lib/projects/assets'

const src = join(process.cwd(), 'projects')
const dst = join(process.cwd(), 'public', 'projects')

function run() {
  const copied = syncProjectAssets({ src, dst })
  console.log(`Synced ${copied.length} folder(s) -> public/projects/`)
}

run()

if (process.argv.includes('--watch')) {
  // Recursive watch is supported on macOS and Windows (the dev platforms);
  // CI/Netlify only ever runs the one-shot prebuild path.
  watch(src, { recursive: true }, () => run())
  console.log('Watching project assets…')
}
