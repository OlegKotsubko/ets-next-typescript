export const metadata = { title: 'ETS Broadcast' }

// Second root layout (no app/layout.tsx). Genuinely transparent, MUI-free — OBS
// needs a transparent canvas, so no CssBaseline painting <body>.
export default function BroadcastLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: 'transparent' }}>
        {children}
      </body>
    </html>
  )
}
