import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddTemplateModal } from '@/components/admin/rundown/AddTemplateModal'
import type { TitleOption } from '@/lib/titles/listTitleOptions'

const options: TitleOption[] = [
  { key: 'lower-third', name: 'Lower Third', color: 'red', isFullScreen: false, fields: [], defaults: { playerName: '' } },
]

it('creates an item with the chosen title and its defaults', async () => {
  const onCreate = vi.fn().mockResolvedValue(undefined)
  render(<AddTemplateModal open options={options} onClose={vi.fn()} onCreate={onCreate} />)
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /template/i }))
  fireEvent.click(await screen.findByText('Lower Third'))
  fireEvent.click(screen.getByRole('button', { name: /add/i }))
  await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ titleKey: 'lower-third', data: { playerName: '' } })))
})
