import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { projectsApi } from '@/store/apis/projectsApi'
import { overlayPackagesApi } from '@/store/apis/overlayPackagesApi'

const getSession = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

const push = vi.fn()
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  redirect: (url: string) => redirect(url),
}))

const signOut = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/auth-client', () => ({ signOut: () => signOut() }))

import AdminPage from '@/app/(admin)/admin/page'
import SignOutButton from '@/app/(admin)/admin/SignOutButton'

beforeEach(() => {
  vi.clearAllMocks()
})

function renderWithStore(ui: React.ReactElement) {
  const store = configureStore({
    reducer: {
      [projectsApi.reducerPath]: projectsApi.reducer,
      [overlayPackagesApi.reducerPath]: overlayPackagesApi.reducer,
    },
    middleware: (gd) => gd().concat(projectsApi.middleware, overlayPackagesApi.middleware),
  })
  return render(<Provider store={store}>
    {ui}
  </Provider>)
}

describe('AdminPage', () => {
  it('redirects to /login when there is no session', async () => {
    getSession.mockResolvedValue(null)
    await expect(AdminPage()).rejects.toThrow('NEXT_REDIRECT:/login')
  })
  it('renders the signed-in operator email', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'op@ets.tv', name: 'op@ets.tv' } })
    renderWithStore(await AdminPage())
    expect(screen.getByText(/op@ets\.tv/)).toBeInTheDocument()
  })
})

describe('SignOutButton', () => {
  it('signs out then navigates to /login', async () => {
    const user = userEvent.setup()
    render(<SignOutButton />)
    await user.click(screen.getByRole('button', { name: /sign out/i }))
    expect(signOut).toHaveBeenCalled()
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
  })
})
