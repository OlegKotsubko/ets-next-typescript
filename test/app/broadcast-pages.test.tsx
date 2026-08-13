import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const getBroadcastContextMock = vi.fn()
vi.mock('@/lib/broadcast/getBroadcastContext', () => ({
  getBroadcastContext: (...args: unknown[]) => getBroadcastContextMock(...args),
}))

const useTitleStreamMock = vi.fn((..._args: unknown[]) => [])
vi.mock('@/lib/broadcast/useTitleStream', () => ({
  useTitleStream: (...args: unknown[]) => useTitleStreamMock(...args),
}))

vi.mock('@/lib/broadcast/TitleRenderer', () => ({
  TitleRenderer: ({ packageLabel }: { packageLabel: string }) => (
    <div data-testid="renderer">
      {packageLabel}
    </div>
  ),
}))

const AirLayout = (await import('@/app/(broadcast)/air/[rundownId]/layout')).default
const AirPage = (await import('@/app/(broadcast)/air/[rundownId]/page')).default
const PreviewLayout = (await import('@/app/(broadcast)/preview/[rundownId]/layout')).default
const PreviewPage = (await import('@/app/(broadcast)/preview/[rundownId]/page')).default
const { PackageLabelProvider } = await import('@/lib/broadcast/PackageLabelContext')

const CTX = { rundownId: 'r1', rundownName: 'Finals', projectId: 'p1', packageLabel: 'default', css: '' }

describe('broadcast layouts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('AirLayout shows "Rundown not found" when the rundown does not exist', async () => {
    getBroadcastContextMock.mockResolvedValue(null)
    const el = await AirLayout({
      params: Promise.resolve({ rundownId: 'ghost' }),
      children: (
        <div>
          child
        </div>
      ),
    })
    render(el)
    expect(screen.getByText('Rundown not found')).toBeInTheDocument()
    expect(screen.queryByText('child')).not.toBeInTheDocument()
  })

  it('AirLayout loads the package stylesheet and renders its children', async () => {
    getBroadcastContextMock.mockResolvedValue(CTX)
    const el = await AirLayout({
      params: Promise.resolve({ rundownId: 'r1' }),
      children: (
        <div>
          child
        </div>
      ),
    })
    const { container } = render(el)
    expect(container.querySelector('link[rel="stylesheet"]')?.getAttribute('href'))
      .toBe('/projects/default/styles/project.css')
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('PreviewLayout does the same lookup and wiring', async () => {
    getBroadcastContextMock.mockResolvedValue(CTX)
    const el = await PreviewLayout({
      params: Promise.resolve({ rundownId: 'r1' }),
      children: (
        <div>
          child
        </div>
      ),
    })
    const { container } = render(el)
    expect(container.querySelector('link[rel="stylesheet"]')?.getAttribute('href'))
      .toBe('/projects/default/styles/project.css')
  })
})

describe('broadcast pages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('AirPage subscribes to the air channel and forwards params.rundownId and the provided packageLabel', async () => {
    // use(params) suspends on a fresh native Promise even though it's already
    // fulfilled (React only fast-paths a thenable it has previously attached
    // .status to, and .then() callbacks always defer to a microtask). Neither
    // AirPage nor its ancestors declare a <Suspense> boundary, so the retry
    // is only delivered once act() itself drains that microtask — an
    // unawaited render() + findBy* alone never resolves it.
    await act(async () => {
      render(
        <PackageLabelProvider packageLabel="default">
          <AirPage params={Promise.resolve({ rundownId: 'r1' })} />
        </PackageLabelProvider>,
      )
    })
    expect(screen.getByTestId('renderer')).toHaveTextContent('default')
    expect(useTitleStreamMock).toHaveBeenCalledWith('r1', 'air')
  })

  it('PreviewPage subscribes to the preview channel', async () => {
    await act(async () => {
      render(
        <PackageLabelProvider packageLabel="default">
          <PreviewPage params={Promise.resolve({ rundownId: 'r1' })} />
        </PackageLabelProvider>,
      )
    })
    expect(screen.getByTestId('renderer')).toBeInTheDocument()
    expect(useTitleStreamMock).toHaveBeenCalledWith('r1', 'preview')
  })
})
