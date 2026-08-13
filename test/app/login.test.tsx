import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
const refresh = vi.fn()
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  redirect: (url: string) => redirect(url),
}))

const getSession = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

const signInEmail = vi.fn()
vi.mock('@/lib/auth-client', () => ({
  signIn: { email: (...args: unknown[]) => signInEmail(...args) },
}))

import LoginPage from '@/app/(admin)/login/page'
import LoginForm from '@/app/(admin)/login/LoginForm'
import { loginSchema } from '@/app/(admin)/login/schema'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loginSchema', () => {
  it('accepts a valid email + 8-char password', () => {
    expect(loginSchema.safeParse({ email: 'op@ets.tv', password: 'longenough' }).success).toBe(true)
  })
  it('rejects bad email and short password', () => {
    const r = loginSchema.safeParse({ email: 'nope', password: 'short' })
    expect(r.success).toBe(false)
  })
})

describe('LoginPage', () => {
  it('redirects to /admin when already signed in', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'op@ets.tv' } })
    await expect(LoginPage()).rejects.toThrow('NEXT_REDIRECT:/admin')
  })
  it('renders the login form when there is no session', async () => {
    getSession.mockResolvedValue(null)
    render(await LoginPage())
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })
})

describe('LoginForm', () => {
  it('shows validation errors without calling signIn', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.type(screen.getByLabelText(/password/i), 'short')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
    expect(signInEmail).not.toHaveBeenCalled()
  })

  it('signs in and navigates to /admin on success', async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i), 'op@ets.tv')
    await user.type(screen.getByLabelText(/password/i), 'longenough')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(signInEmail).toHaveBeenCalledWith({ email: 'op@ets.tv', password: 'longenough' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin'))
  })

  it('surfaces a server error from better-auth', async () => {
    signInEmail.mockResolvedValue({ data: null, error: { message: 'Invalid email or password' } })
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i), 'op@ets.tv')
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})
