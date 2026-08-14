import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TitleDataForm } from '@/components/admin/rundown/TitleDataForm'
import type { FieldDescriptor } from '@/lib/titles/describeModel'

const fields: FieldDescriptor[] = [
  { name: 'playerName', label: 'Player Name', kind: 'string', required: true, minLength: 1, maxLength: 40, multiline: false },
  { name: 'position', label: 'Position', kind: 'enum', required: false, options: ['guard', 'forward'] },
]

it('renders one input per descriptor and submits values', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<TitleDataForm fields={fields} defaultValues={{ playerName: 'Jo', position: 'guard' }} onSubmit={onSubmit} />)
  expect(screen.getByLabelText('Player Name')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /save/i }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ playerName: 'Jo', position: 'guard' })))
})

it('shows a field badge when onSubmit returns fieldErrors', async () => {
  const onSubmit = vi.fn().mockResolvedValue({ fieldErrors: { playerName: ['Required'] } })
  render(<TitleDataForm fields={fields} defaultValues={{ playerName: '' }} onSubmit={onSubmit} />)
  fireEvent.click(screen.getByRole('button', { name: /save/i }))
  await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument())
})
