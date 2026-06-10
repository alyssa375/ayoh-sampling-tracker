'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const PRESETS = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last 30 Days', value: '30days' },
  { label: 'Last 90 Days', value: '90days' },
  { label: 'Custom', value: 'custom' },
]

function getDateRange(preset, customStart, customEnd) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (preset === 'week') {
    const day = today.getDay()
    const start = new Date(today)
    start.setDate(today.getDate() - day)
    const end = new Date(today)
    end.setDate(start.getDate() + 6)
    return { start, end }
  }
  if (preset === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return { start, end }
  }
  if (preset === '30days') {
    const start = new Date(today)
    start.setDate(today.getDate() - 29)
    return { start, end: today }
  }
  if (preset === '90days') {
    const start = new Date(today)
    start.setDate(today.getDate() - 89)
    return { start, end: today }
  }
  if (preset === 'custom' && customStart && customEnd) {
    return { start: new Date(customStart), end: new Date(customEnd) }
  }
  return { start: today, end: today }
}

function fmt(date) {
  return date.toISOString().split('T')[0]
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const [preset, setPreset] = useState('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState([])
  const [repBreakdown, setRepBreakdown] = useState([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { start, end } = getDateRange(preset, customStart, customEnd)
    const endOfDay = new Date(end)
    endOfDay.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('event_reports')
      .select(`
        id,
        store_name,
        event_date,
        units_sold,
        dollars_sold,
        mileage,
        mileage_pay,
        profiles ( full_name, email )
      `)
      .gte('event_date', fmt(start))
      .lte('event_date', fmt(end))
      .order('event_date', { ascending: false })

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    setReports(data || [])

    const byRep = {}
    for (const r of data || []) {
      const key = r.profiles?.email || 'Unknown'
      if (!byRep[key]) {
        byRep[key] = {
          name: r.profiles?.full_name || r.profiles?.email || 'Unknown',
          events: 0,
          units: 0,
          dollars: 0,
          mileage: 0,
        }
      }
      byRep[key].events++
      byRep[key].units += r.units_sold || 0
      byRep[key].dollars += r.dollars_sold || 0
      byRep[key].mileage += r.mileage || 0
    }
    setRepBreakdown(Object.values(byRep).sort((a, b) => b.events - a.events))
    setLoading(false)
  }, [preset, customStart, customEnd])

  useEffect(() => { fetchData() }, [fetchData])

  const totalEvents = reports.length
  const totalUnits = reports.reduce((s, r) => s + (r.units_sold || 0), 0)
  const totalDollars = reports.reduce((s, r) => s + (r.dollars_sold || 0), 0)
  const totalMileage = reports.reduce((s, r) => s + (r.mileage || 0), 0)
  const totalMileagePay = reports.reduce((s, r) => s + (r.mileage_pay || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <button
          onClick={fetchData}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 items-center">
          {PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                preset === p.value
                  ? 'bg-[#F26722] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
          {preset === 'custom' && (
            <div className="flex items-center gap-2 mt-2 w-full">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              />
              <span className="text-gray-400">→</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              />
              <button
                onClick={fetchData}
                className="bg-[#F26722] text-white px-4 py-1.5 rounded-lg text-sm font-medium"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Events" value={totalEvents} sub="sampling events" />
            <StatCard label="Units Sold" value={totalUnits.toLocaleString()} sub="bottles / units" />
            <StatCard label="Revenue" value={`$${totalDollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="units × price" />
            <StatCard label="Miles Driven" value={totalMileage.toFixed(0)} sub={`$${totalMileagePay.toFixed(2)} reimbursed`} />
          </div>

          {repBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">By Rep</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-5 py-3">Rep</th>
                    <th className="px-5 py-3 text-right">Events</th>
                    <th className="px-5 py-3 text-right">Units</th>
                    <th className="px-5 py-3 text-right">Revenue</th>
                    <th className="px-5 py-3 text-right">Miles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {repBreakdown.map((rep, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">{rep.name}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{rep.events}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{rep.units}</td>
                      <td className="px-5 py-3 text-right text-gray-600">${rep.dollars.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{rep.mileage.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Event Detail ({totalEvents})</h2>
            </div>
            {reports.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No events in this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Store</th>
                      <th className="px-5 py-3">Rep</th>
                      <th className="px-5 py-3 text-right">Units</th>
                      <th className="px-5 py-3 text-right">Revenue</th>
                      <th className="px-5 py-3 text-right">Miles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {reports.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{r.event_date}</td>
                        <td className="px-5 py-3 font-medium text-gray-800">{r.store_name || '—'}</td>
                        <td className="px-5 py-3 text-gray-600">{r.profiles?.full_name || r.profiles?.email || '—'}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{r.units_sold || 0}</td>
                        <td className="px-5 py-3 text-right text-gray-600">${(r.dollars_sold || 0).toFixed(2)}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{(r.mileage || 0).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
