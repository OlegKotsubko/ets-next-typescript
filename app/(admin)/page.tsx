import { redirect } from 'next/navigation'

// The app has no public landing page — everything lives behind /login.
export default function Home() {
  redirect('/login')
}
