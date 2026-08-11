import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { assetsApi } from '@/store/apis/assetsApi'
import { assetsEntityDef } from '@/lib/entities/assets'
import { CrudPage } from '@/components/admin/crud/CrudPage'

function renderWithStore(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { [assetsApi.reducerPath]: assetsApi.reducer },
    middleware: (gd) => gd().concat(assetsApi.middleware),
  })
  return render(<Provider store={store}>{ui}</Provider>)
}

describe('CrudPage', () => {
  it('renders an Add button for the entity', () => {
    renderWithStore(<CrudPage projectId="proj-1" entityDef={assetsEntityDef} api={assetsApi} />)
    expect(screen.getByRole('button', { name: /add asset/i })).toBeInTheDocument()
  })
})
