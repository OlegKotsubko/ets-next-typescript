import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { assetsApi } from '@/store/apis/assetsApi'
import { AssetPickerField } from '@/components/admin/crud/AssetPickerField'

function renderWithStore(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { [assetsApi.reducerPath]: assetsApi.reducer },
    middleware: (gd) => gd().concat(assetsApi.middleware),
  })
  return render(<Provider store={store}>
    {ui}
  </Provider>)
}

describe('AssetPickerField', () => {
  it('renders a select control and an upload button', () => {
    renderWithStore(<AssetPickerField projectId="proj-1"
      value={null}
      onChange={vi.fn()}
      kind="logo" />)
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument()
  })
})
