import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { startOfWeek, endOfWeek } from 'date-fns'

export default async function AdminDashboard() {
  const supabase = createClient()

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })

  // Total reps
  const { count: repCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'rep')

  // Events this week
  const { count: eventCount } = await supabase
    .from('event_reports')
    .select('*', { count: 'exact', head: true })
    .gte('event_date', weekStart.toISOString().split('T')[0])

  // Pending expenses
  const { data: pendingExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('status', 'pending')

  const pendingTotal = (pendingExpenses || []).reduce((s, e) => s + parseFloat(e.amount), 0)

  // Currently clocked in
  const { data: recentClocks } = await supabase
    .from('clock_events')
    .select('user_id, event_type')
    .order('timestamp', { ascending: false })

  const lastByUser = {}
  for (const e of recentClocks || []) {
    if (!lastByUser[e.user_id]) lastByUser[e.user_id] = e.event_type
  }
  const clockedInCount = Object.values(lastByUser).filter(t => t === 'clock_in').length

  const stats = [
    { label: 'Active Reps', value: repCount || 0, icon: '👥', href: '/admin/timesheets' },
    { label: 'Clocked In Now', value: clockedInCount, icon: '🟢', href: '/admin/timesheets' },
    { label: 'Events This Week', value: eventCount || 0, icon: '📋', href: '/admin/reports' },
    { label: 'Pending Expenses', value: `$${pendingTotal.toFixed(2)}`, icon: '💰', href: '/admin/expenses' },
  ]

  const quickLinks = [
    { href: '/admin/timesheets', label: 'View Timesheets', desc: 'Hours per rep', icon: '🕐' },
    { href: '/admin/reports', label: 'Event Reports', desc: 'Sampling results', icon: '📋' },
    { href: '/admin/expenses', label: 'Review Expenses', desc: 'Approve & reject', icon: '💰' },
    { href: '/admin/payroll', label: 'Export Payroll', desc: 'Download CSV', icon: '💵' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ayoh-dark">Admin Dashboard</h1>
        <p className="text-gray-500">Ayoh Foods Sampling Program</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(stat => (
          <Link key={stat.label} href={stat.href} className="bg-white border border-gray-100 rounded-xl p-4 hover:border-ayoh-orange transition-colors">
            <span className="text-2xl">{stat.icon}</span>
            <p className="text-2xl font-bold text-ayoh-dark mt-2">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickLinks.map(link => (
            <Link key={link.href} href={link.href} className="bg-white border border-gray-100 rounded-xl p-4 hover:border-ayoh-orange hover:shadow-sm transition-all group">
              <span className="text-2xl">{link.icon}</span>
              <p className="font-semibold text-gray-800 mt-2 group-hover:text-ayoh-orange">{link.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
