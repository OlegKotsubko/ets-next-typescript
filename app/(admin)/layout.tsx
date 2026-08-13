import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter'
import { Providers } from './providers'

export const metadata = { title: 'ETS', description: 'Broadcast graphics' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <Providers>
            {children}
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}
