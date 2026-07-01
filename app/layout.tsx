import { Providers } from './providers';

export const metadata = { title: 'ETS', description: 'Broadcast graphics' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
