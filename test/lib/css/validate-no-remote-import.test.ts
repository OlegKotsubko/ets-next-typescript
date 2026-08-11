import { describe, it, expect } from 'vitest'
import { validateNoRemoteImport } from '@/lib/css/validate-no-remote-import'

describe('validateNoRemoteImport', () => {
  it('accepts plain CSS with no @import', () => {
    expect(validateNoRemoteImport('.foo { color: red; }')).toBe(true)
  })

  it('rejects @import url(...) of a remote stylesheet', () => {
    expect(validateNoRemoteImport("@import url('https://evil.example/x.css');")).toBe(false)
  })

  it('rejects @import "..." (quoted form, no url())', () => {
    expect(validateNoRemoteImport('@import "https://evil.example/x.css";')).toBe(false)
  })
})
