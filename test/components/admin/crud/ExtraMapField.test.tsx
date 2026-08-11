import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExtraMapField } from '@/components/admin/crud/ExtraMapField'

describe('ExtraMapField', () => {
  it('renders one row per existing key/value pair', () => {
    render(<ExtraMapField value={{ jersey: '23' }} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('jersey')).toBeInTheDocument()
    expect(screen.getByDisplayValue('23')).toBeInTheDocument()
  })

  it('calls onChange with a new empty row when Add field is clicked', () => {
    const onChange = vi.fn()
    render(<ExtraMapField value={{}} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /add field/i }))
    expect(onChange).toHaveBeenCalledWith({ '': '' })
  })
})
