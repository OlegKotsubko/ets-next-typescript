import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Providers } from '@/app/(admin)/providers'

describe('Providers', () => {
  it('renders children', () => {
    render(<Providers>
      <span>
hello
      </span>
    </Providers>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
