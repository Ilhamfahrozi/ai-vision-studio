import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { AuthProvider } from '@/lib/AuthContext'
import AuthModal from '@/lib/AuthModal'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <AuthModal />
      <Component {...pageProps} />
    </AuthProvider>
  )
}
