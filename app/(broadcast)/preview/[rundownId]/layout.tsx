import { getBroadcastContext } from '@/lib/broadcast/getBroadcastContext'
import { PackageLabelProvider } from '@/lib/broadcast/PackageLabelContext'

export default async function PreviewLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ rundownId: string }> }) {
  const { rundownId } = await params
  const ctx = await getBroadcastContext(rundownId)
  if (!ctx) {
    return (
      <div>
        Rundown not found
      </div>
    )
  }

  return (
    <>
      <link rel="stylesheet"
        href={`/projects/${ctx.packageLabel}/styles/project.css`} />
      {ctx.css && <style dangerouslySetInnerHTML={{ __html: ctx.css }} />}
      <PackageLabelProvider packageLabel={ctx.packageLabel}>
        {children}
      </PackageLabelProvider>
    </>
  )
}
