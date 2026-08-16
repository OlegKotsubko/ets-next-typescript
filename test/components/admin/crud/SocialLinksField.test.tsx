import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SocialLinksField } from '@/components/admin/crud/SocialLinksField'

describe('SocialLinksField', () => {
  it('shows existing links and can add a new typed row', () => {
    const onChange = vi.fn()
    render(<SocialLinksField value={{ twitter: 'https://t/x' }}
      onChange={onChange} />)
    expect(screen.getByDisplayValue('twitter')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://t/x')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add link/i }))
    const typeInputs = screen.getAllByLabelText('Type')
    expect(typeInputs).toHaveLength(2)

    fireEvent.change(typeInputs[1], { target: { value: 'discord' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ twitter: 'https://t/x', discord: '' }),
    )
  })

  it('removing a row drops it from the emitted map', () => {
    const onChange = vi.fn()
    render(<SocialLinksField value={{ twitter: 'x' }}
      onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /remove link/i }))
    expect(onChange).toHaveBeenLastCalledWith({})
  })
})
