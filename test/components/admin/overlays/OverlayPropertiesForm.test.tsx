import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverlayPropertiesForm } from '@/components/admin/overlays/OverlayPropertiesForm'
import type { RundownOverlay } from '@/store/apis/rundownOverlaysApi'

const overlay: RundownOverlay = {
  id: 5, rundownId: 2, projectId: 3, model: 'general-text', category: 'general',
  template: 'Text', widgetName: 'Lower Third', layer: 4, color: 2, displayFilter: '',
  previewImg: null, isFullscreen: false, hasNextButton: false, order: 0,
  data: { widget: { text: 'hi' } },
}

describe('OverlayPropertiesForm', () => {
  it('renders the settings name and a widget field, and deletes', () => {
    const onDelete = vi.fn()
    render(<OverlayPropertiesForm overlay={overlay}
      onSaveSettings={vi.fn()}
      onSaveWidget={vi.fn()}
      onDelete={onDelete} />)
    expect(screen.getByDisplayValue('Lower Third')).toBeInTheDocument() // Name field
    expect(screen.getByDisplayValue('hi')).toBeInTheDocument() // widget text field
    screen.getByRole('button', { name: /delete/i }).click()
    expect(onDelete).toHaveBeenCalled()
  })

  it('saving settings reports the edited fields', () => {
    const onSaveSettings = vi.fn()
    render(<OverlayPropertiesForm overlay={overlay}
      onSaveSettings={onSaveSettings}
      onSaveWidget={vi.fn()}
      onDelete={vi.fn()} />)
    screen.getByRole('button', { name: /save settings/i }).click()
    expect(onSaveSettings).toHaveBeenCalledWith(expect.objectContaining({
      widgetName: 'Lower Third', layer: 4, color: 2,
    }))
  })
})
