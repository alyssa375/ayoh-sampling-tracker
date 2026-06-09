import { createClient } from '@/lib/supabase/server'
import { format, parseISO, startOfWeek, endOfWeek, subWeeks } from 'date-fns'

export default async function TimesheetsPage({ searchParams }) {
  const supabase = createClient()

  // Week selector — default to current week
  const weekOffset = parseInt(searchParams?.week || '0')
  const baseDate = subWeeks(new Date(), weekOffset)
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 })

  // Get all reps
  const { data: reps } = await supabase
    .from('profiles')
    .select('id, full_name, email, hourly_rate')
    .eq('role', 'rep')
    .order('full_name')

  // Get all clock events for this week
  const { data: clockEvents } = await supabase
    .from('clock_events')
    .select('*')
    .gte('timestamp', weekStart.toISOString())
    .lte('timestamp', weekEnd.toISOString())
    .order('timestamp', { ascending: true })

  // Build shifts per rep
  const repShifts = {}
  for (const rep of reps || []) {
    const events = (clockEvents || []).filter(e => e.user_id === rep.id)
    const shifts = []
    let currentIn = null

    for (const event of events) {
      if (event.event_type === 'clock_in') {
        currentIn = event
      } else if (event.event_type === 'clock_out' && currentIn) {
        const hours = (new Date(event.timestamp) - new Date(currentIn.timestamp)) / 3600000
        shifts.push({
          clockIn: currentIn,
          clockOut: event,
          hours: hours,
        })
        currentIn = null
      }
    }

    // Still clocked in
    if (currentIn) {
      shifts.push({
        clockIn: currentIn,
        clockOut: null,
        hours: (new Date() - new Date(currentIn.timestamp)) / 3600000,
        active: true,
      })
    }

    repShifts[rep.id] = shifts
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ayoh-dark">Timesheets</h1>
          <p className="text-gray-500">
            Week of {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center gap-2">
          <a
            href={`/admin/timesheets?week=${weekOffset + 1}`}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            ← Prev
          </a>
          {weekOffset > 0 && (
            <a
              href="/admin/timesheets"
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              This Week
            </a>
          )}
          {weekOffset > 0 && (
            <a
              href={`/admin/timesheets?week=${weekOffset - 1}`}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Next →
            </a>
          )}
        </div>
      </div>

      {/* Rep Timesheets */}
      <div className="space-y-4">
        {(reps || []).map(rep => {
          const shifts = repShifts[rep.id] || []
          const totalHours = shifts.reduce((s, sh) => s + sh.hours, 0)
          const grossPay = totalHours * (rep.hourly_rate || 0)

          return (
            <div key={rep.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              {/* Rep Header */}
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
                <div>
                  <p className="font-semibold text-gray-800">{rep.full_name}</p>
                  <p className="text-sm text-gray-400">{rep.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-ayoh-dark">{totalHours.toFixed(2)}h</p>
                  {rep.hourly_rate > 0 && (
                    <p className="text-sm text-green-600 font-medium">${grossPay.toFixed(2)} gross</p>
                  )}
                </div>
              </div>

              {/* Shifts Table */}
              {shifts.length === 0 ? (
                <p className="px-5 py-3 text-sm text-gray-400">No shifts this week</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {shifts.map((shift, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full mr-2 ${
                          shift.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {shift.active ? 'Active' : format(new Date(shift.clockIn.timestamp), 'EEE')}
                        </span>
                        <span className="text-gray-600">
                          {format(new Date(shift.clockIn.timestamp), 'h:mm a')}
                          {' → '}
                          {shift.clockOut
                            ? format(new Date(shift.clockOut.timestamp), 'h:mm a')
                            : 'now'}
                        </span>
                        {shift.clockIn.store_name && (
                          <span className="text-gray-400 ml-2">· {shift.clockIn.store_name}</span>
                        )}
                      </div>
                      <span className="font-medium text-gray-700">{shift.hours.toFixed(2)}h</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
