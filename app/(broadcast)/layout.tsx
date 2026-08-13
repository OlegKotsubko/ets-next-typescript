// Root layout for /preview and /air — deliberately independent of
// app/(admin)/layout.tsx. OBS/vMix needs a genuinely transparent canvas;
// the admin root layout pulls in MUI's CssBaseline (paints a non-transparent
// theme background onto <body>) and the Redux Provider, neither of which
// belongs on a broadcast page.
export const metadata = { title: 'ETS — Broadcast' }

export default function BroadcastRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: 'transparent' }}>
        {children}
      </body>
    </html>
  )
}
