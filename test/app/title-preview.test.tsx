import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TitlePreviewPage, { SAMPLE_DATA } from '@/app/dev/title-preview/page'

describe('TitlePreviewPage', () => {
  it('renders a section per registered title', () => {
    render(<TitlePreviewPage />)
    expect(screen.getByRole('heading', { name: 'Lower Third' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Opening Timer' })).toBeInTheDocument()
  })

  it('renders each title against its sample data', () => {
    render(<TitlePreviewPage />)
    expect(screen.getByText('Casey Liu')).toBeInTheDocument()
    expect(screen.getByText('Kickoff')).toBeInTheDocument()
  })

  it('keeps sample data valid against every title model', async () => {
    const { getTitleModel } = await import('@/lib/titles/registry')
    Object.entries(SAMPLE_DATA).forEach(([key, data]) => {
      expect(getTitleModel('default', key)?.safeParse(data).success).toBe(true)
    })
  })

  it('loads the package stylesheet so CSS variables resolve', () => {
    const { container } = render(<TitlePreviewPage />)
    const link = container.querySelector('link[rel="stylesheet"]')
    expect(link?.getAttribute('href')).toBe('/projects/default/styles/project.css')
  })
})
