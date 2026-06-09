'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns'

export default function PayrollExportPage() {
  const supabase = createClient()
  const [period, setPeriod] = useState('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [includeExpenses, setIncludeExpenses] = useState(true)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [message, setMessage] = useState(null)

  function getDateRange() {
    const now = new Date()
    if (period === 'week') {
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      }
    }
    if (period === 'last_week') {
      const last = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
      return {
        start: startOfWeek(last, { weekStartsOn: 1 }),
        end: endOfWeek(last, { weekStartsOn: 1 }),
      }
    }
    if (period === 'month') {
      return { start: startOfMonth(now), end: endOfMonth(now) }
    }
    if (period === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
    }
    if (period === 'custom' && customStart && customEnd) {
      return { start: parseISO(customStart), end: parseISO(customEnd + 'T23:59:59') }
    }
    return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
  }

  async function buildPayrollData() {
    const { start, end } = getDateRange()

    const { data: reps } = await supabase
      .from('profiles')
      .select('id, full_name, email, hourly_rate, phone')
      .eq('role', 'rep')
      .order('full_name')

    const { data: clockEvents } = await supabase
      .from('clock_events')
      .select('*')
      .gte('timestamp', start.toISOString())
      .lte('timestamp', end.toISOString())
      .order('timestamp', { ascending: true })

    let expenseData = []
    if (includeExpenses) {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .eq('status', 'approved')
        .gte('expense_date', start.toISOString().split('T')[0])
        .lte('expense_date', end.toISOString().split('T')[0])

      expenseData = data || []
    }

    const rows = []

    for (const rep of reps || []) {
      const events = (clockEvents || []).filter(e => e.user_id === rep.id)

      // Calculate hours
      let totalHours = 0
      let clockInTime = null
      const shifts = []

      for (const event of events) {
        if (event.event_type === 'clock_in') {
          clockInTime = new Date(event.timestamp)
        } else if (event.event_type === 'clock_out' && clockInTime) {
          const h = (new Date(event.timestamp) - clockInTime) / 3600000
          totalHours += h
          shifts.push(`${format(clockInTime, 'MM/dd h:mma')}-${format(new Date(event.timestamp), 'h:mma')}(${h.toFixed(2)}h)`)
          clockInTime = null
        }
      }

      const repExpenses = expenseData.filter(e => e.user_id === rep.id)
      const expenseTotal = repExpenses.reduce((s, e) => s + parseFloat(e.amount), 0)
      const grossPay = totalHours * (rep.hourly_rate || 0)
      const totalDue = grossPay + expenseTotal

      if (totalHours > 0 || expenseTotal > 0) {
        rows.push({
          name: rep.full_name,
          email: rep.email,
          hourly_rate: rep.hourly_rate || 0,
          hours_worked: totalHours,
          gross_wages: grossPay,
          approved_expenses: expenseTotal,
          total_due: totalDue,
          shifts: shifts.join(' | '),
          expense_count: repExpenses.length,
        })
      }
    }

    return { rows, start, end }
  }

  async function handlePreview() {
    setLoading(true)
    setMessage(null)
    try {
      const result = await buildPayrollData()
      setPreview(result)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
    setLoading(false)
  }

  function downloadCSV() {
    if (!preview) return

    const headers = [
      'Name', 'Email', 'Hourly Rate', 'Hours Worked', 'Gross Wages',
      'Approved Expenses', 'Total Due', 'Shift Details'
    ]

    const totalRow = preview.rows.reduce((acc, r) => ({
      hours: acc.hours + r.hours_worked,
      wages: acc.wages + r.gross_wages,
      expenses: acc.expenses + r.approved_expenses,
      total: acc.total + r.total_due,
    }), { hours: 0, wages: 0, expenses: 0, total: 0 })

    const csvRows = [
      [`Ayoh Foods Payroll Report`],
      [`Period: ${format(preview.start, 'MMM d')} - ${format(preview.end, 'MMM d, yyyy')}`],
      [`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`],
      [],
      headers,
      ...preview.rows.map(r => [
        r.name,
        r.email,
        `$${r.hourly_rate.toFixed(2)}`,
        r.hours_worked.toFixed(2),
        `$${r.gross_wages.toFixed(2)}`,
        `$${r.approved_expenses.toFixed(2)}`,
        `$${r.total_due.toFixed(2)}`,
        r.shifts,
      ]),
      [],
      ['TOTALS', '', '',
        totalRow.hours.toFixed(2),
        `$${totalRow.wages.toFixed(2)}`,
        `$${totalRow.expenses.toFixed(2)}`,
        `$${totalRow.total.toFixed(2)}`,
        ''
      ],
    ]

    const csv = csvRows
      .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ayoh-payroll-${format(preview.start, 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalDue = (preview?.rows || []).reduce((s, r) => s + r.total_due, 0)
  const totalHours = (preview?.rows || []).reduce((s, r) => s + r.hours_worked, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ayoh-dark">Payroll Export</h1>

      {/* Config */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-5">
        <h2 className="font-semibold text-gray-700">Report Settings</h2>

        {/* Period */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Pay Period</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'week', label: 'This Week' },
              { value: 'last_week', label: 'Last Week' },
              { value: 'month', label: 'This Month' },
              { value: 'last_month', label: 'Last Month' },
              { value: 'custom', label: 'Custom' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  period === opt.value
                    ? 'bg-ayoh-orange text-white border-ayoh-orange'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-ayoh-orange'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom dates */}
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ayoh-orange"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ayoh-orange"
              />
            </div>
          </div>
        )}

        {/* Include expenses toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setIncludeExpenses(!includeExpenses)}
            className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${includeExpenses ? 'bg-ayoh-orange' : 'bg-gray-200'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${includeExpenses ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm font-medium text-gray-700">Include approved expenses</span>
        </label>

        <button
          onClick={handlePreview}
          disabled={loading}
          className="bg-ayoh-orange text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'Calculating...' : 'Generate Report'}
        </button>
      </div>

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-gray-800">
                {format(preview.start, 'MMM d')} – {format(preview.end, 'MMM d, yyyy')}
              </h2>
              <p className="text-sm text-gray-500">
                {preview.rows.length} rep{preview.rows.length !== 1 ? 's' : ''} ·{' '}
                {totalHours.toFixed(1)}h total · ${totalDue.toFixed(2)} total due
              </p>
            </div>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-green-700 transition-colors"
            >
              ⬇️ Download CSV
            </button>
          </div>

          {preview.rows.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400">
              No data for this period
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Rep</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Rate</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Hours</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Wages</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Expenses</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 font-bold">Total Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{row.name}</p>
                          <p className="text-xs text-gray-400">{row.email}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          ${row.hourly_rate.toFixed(2)}/hr
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {row.hours_worked.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          ${row.gross_wages.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {row.expense_count > 0 ? `$${row.approved_expenses.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-ayoh-dark">
                          ${row.total_due.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-gray-700">Total</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right font-semibold text-gray-700">
                        {totalHours.toFixed(2)}h
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-700">
                        ${preview.rows.reduce((s, r) => s + r.gross_wages, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-700">
                        ${preview.rows.reduce((s, r) => s + r.approved_expenses, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-ayoh-orange text-base">
                        ${totalDue.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
