import './globals.css'

export const metadata = {
  title: 'Ayoh Sampling Tracker',
  description: 'In-store sampling program management for Ayoh Foods',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
