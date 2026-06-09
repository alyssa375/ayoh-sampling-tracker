'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NavBar({ role, userName }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const isAdmin = role === 'admin'

  const repLinks = [
    { href: '/rep', label: 'Dashboard', icon: '🏠' },
    { href: '/rep/clock', label: 'Clock In/Out', icon: '🕐' },
    { href: '/rep/report', label: 'Event Report', icon: '📋' },
    { href: '/rep/expenses', label: 'Expenses', icon: '💰' },
  ]

  const adminLinks = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/timesheets', label: 'Timesheets', icon: '🕐' },
    { href: '/admin/reports', label: 'Event Reports', icon: '📋' },
    { href: '/admin/expenses', label: 'Expenses', icon: '💰' },
    { href: '/admin/payroll', label: 'Payroll Export', icon: '💵' },
    { href: '/admin/reps', label: 'Team', icon: '👥' },
  ]

  const links = isAdmin ? adminLinks : repLinks

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-ayoh-orange flex items-center justify-center">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <span className="font-bold text-ayoh-dark hidden sm:block">Ayoh Sampling</span>
          </div>

          {/* Nav Links */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  pathname === link.href
                    ? 'bg-orange-50 text-ayoh-orange'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{link.icon}</span>
                <span className="hidden sm:block">{link.label}</span>
              </Link>
            ))}
          </div>

          {/* User + Sign Out */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 hidden md:block">{userName}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1 rounded transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
