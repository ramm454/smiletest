import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { GuestSessionProvider } from '@/components/user/GuestSessionProvider'
import CookieBanner from '@/components/gdpr/CookieBanner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Yoga Spa Booking',
  description: 'Book yoga and spa sessions with AI voice assistant',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GuestSessionProvider>
          <nav className="bg-white shadow-lg">
            <div className="container mx-auto px-6 py-4">
              <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-blue-800">Yoga Spa</h1>
                <div className="space-x-4">
                  <a href="/" className="text-gray-600 hover:text-blue-600">Home</a>
                  <a href="/booking" className="text-gray-600 hover:text-blue-600">Booking</a>
                  <a href="/about" className="text-gray-600 hover:text-blue-600">About</a>
                </div>
              </div>
            </div>
          </nav>
          {children}
          <footer className="bg-gray-800 text-white py-8 mt-12">
            <div className="container mx-auto px-6 text-center">
              <p>© 2024 Yoga Spa Platform. All rights reserved.</p>
            </div>
          </footer>
          <CookieBanner />
        </GuestSessionProvider>
      </body>
    </html>
  )
}