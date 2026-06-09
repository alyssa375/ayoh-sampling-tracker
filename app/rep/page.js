import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek } from 'date-fns'

export default async function RepDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get clock events for this week
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })

  const { data: clockEvents } = await supabase
    .from('clock_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('timestamp', weekStart.toISOString())
    .lte('timestamp', weekEnd.toISOString())
    .order('timestamp', { ascending: true })

  // Calculate hours worked this week
  let totalHours = 0
  let clockInTime = null
  for (const event of clockEvents || []) {
    if (event.event_type === 'clock_in') {
      clockInTime = new Date(event.timestamp)
    } else if (event.event_type === 'clock_out' && clockInTime) {
      totalHours += (new Date(event.timestamp) - clockInTime) / 3600000
      clockInTime = null
    }
  }

  // Check if currently clocked in
  const lastEvent = clockEvents?.[clockEvents.length - 1]
  const isClockedIn = lastEvent?.event_type === 'clock_in'

  // Get recent event reports
  const { data: recentReports } = await supabase
    .from('event_reports')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3)

  // Get pending expenses
  const { data: pendingExpenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')

  const pendingTotal = (pendingExpenses || []).reduce((sum, e) => sum + parseFloat(e.amount), 0)

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-ayoh-dark">
          Hey, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {/* Status Banner */}
      <div className={`rounded-2xl p-5 flex items-center justify-between ${
        isClockedIn
          ? 'bg-green-50 border border-green-200'
          : 'bg-gray-100 border border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isClockedIn ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <div>
            <p className="font-semibold text-gray-800">
              {isClockedIn ? 'Currently Clocked In' : 'Not Clocked In'}
            </p>
            {isClockedIn && (
              <p className="text-sm text-gray-500">
                Since {format(new Date(lastEvent.timestamp), 'h:mm a')}
                {lastEvent.store_name ? ` · ${lastEvent.store_name}` : ''}
              </p>
            )}
          </div>
        </div>
        <Link
          href="/rep/clock"
          className="bg-ayoh-orange text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          {isClockedIn ? 'Clock Out' : 'Clock In'}
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Hours This Week</p>
          <p className="text-2xl font-bold text-ayoh-dark mt-1">{totalHours.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Events This Week</p>
          <p className="text-2xl font-bold text-ayoh-dark mt-1">
            {(recentReports || []).filter(r => new Date(r.event_date) >= weekStart).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Pending Expenses</p>
          <p className="text-2xl font-bold text-ayoh-dark mt-1">${pendingTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link href="/rep/clock" className="bg-white border border-gray-100 rounded-xl p-4 hover:border-ayoh-orange hover:shadow-sm transition-all group">
            <span className="text-2xl">🕐</span>
            <p className="font-semibold text-gray-800 mt-2 group-hover:text-ayoh-orange">Clock In/Out</p>
            <p className="text-xs text-gray-400 mt-0.5">Record your time</p>
          </Link>
          <Link href="/rep/report" className="bg-white border border-gray-100 rounded-xl p-4 hover:border-ayoh-orange hover:shadow-sm transition-all group">
            <span className="text-2xl">📋</span>
            <p className="font-semibold text-gray-800 mt-2 group-hover:text-ayoh-orange">Submit Report</p>
            <p className="text-xs text-gray-400 mt-0.5">After your event</p>
          </Link>
          <Link href="/rep/expenses" className="bg-white border border-gray-100 rounded-xl p-4 hover:border-ayoh-orange hover:shadow-sm transition-all group">
            <span className="text-2xl">💰</span>
            <p className="font-semibold text-gray-800 mt-2 group-hover:text-ayoh-orange">Add Expense</p>
            <p className="text-xs text-gray-400 mt-0.5">Upload a receipt</p>
          </Link>
        </div>
      </div>

      {/* Recent Reports */}
      {recentReports && recentReports.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Recent Events</h2>
          <div className="space-y-2">
            {recentReports.map(report => (
              <div key={report.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-800">{report.store_name}</p>
                  <p className="text-sm text-gray-400">
                    {format(new Date(report.event_date + 'T12:00:00'), 'MMM d')} ·{' '}
                    {report.consumer_interactions} interactions · {report.units_sampled} units sampled
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
