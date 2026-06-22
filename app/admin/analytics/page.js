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
    const start = new Date(today); start.setDate(today.getDate() - today.getDay())
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { start, end }
  }
  if (preset === 'month') {
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getFullYear(), today.getMonth() + 1, 0) }
  }
  if (preset === '30days') {
    const start = new Date(today); start.setDate(today.getDate() - 29)
    return { start, end: today }
  }
  if (preset === '90days') {
    const start = new Date(today); start.setDate(today.getDate() - 89)
    return { start, end: today }
  }
  if (preset === 'custom' && customStart && customEnd) {
    return { start: new Date(customStart), end: new Date(customEnd) }
  }
  return { start: today, end: today }
}

function fmt(date) { return date.toISOString().split('T')[0] }

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title }) {
  return (
    <div className="px-5 py-4 border-b border-gray-100">
      <h2 className="font-semibold text-gray-800">{title}</h2>
    </div>
  )
}

// Tally values from custom_responses by field label substring
function tallyField(reports, labelSubstring) {
  const counts = {}
  for (const r of reports) {
    const cr = r.custom_responses || {}
    const entry = Object.entries(cr).find(([, v]) => {
      // find by matching the field id via template_fields lookup — we use label match below
      return false
    })
  }
  return counts
}

// Match custom_responses by field label using the fields index
function buildFieldIndex(fields) {
  const index = {}
  for (const f of fields) index[f.id] = f
  return index
}

function tallyByLabel(reports, fieldIndex, labelSubstring) {
  const counts = {}
  const matchingIds = Object.entries(fieldIndex)
    .filter(([, f]) => f.label.toLowerCase().includes(labelSubstring.toLowerCase()))
    .map(([id]) => id)

  for (const r of reports) {
    const cr = r.custom_responses || {}
    for (const id of matchingIds) {
      const val = cr[id]
      if (!val) continue
      if (Array.isArray(val)) {
        for (const v of val) {
          counts[v] = (counts[v] || 0) + 1
        }
      } else {
        counts[val] = (counts[val] || 0) + 1
      }
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

function accountabilityRate(reports, fieldIndex, labelSubstring, passingValues) {
  const matchingIds = Object.entries(fieldIndex)
    .filter(([, f]) => f.label.toLowerCase().includes(labelSubstring.toLowerCase()))
    .map(([id]) => id)
  if (!matchingIds.length) return null
  let answered = 0, passed = 0
  for (const r of reports) {
    const cr = r.custom_responses || {}
    for (const id of matchingIds) {
      const val = cr[id]
      if (val !== undefined && val !== null && val !== '') {
        answered++
        if (passingValues.some(p => val.toString().toLowerCase().includes(p.toLowerCase()))) passed++
      }
    }
  }
  if (!answered) return null
  return Math.round((passed / answered) * 100)
}

function BarRow({ label, count, max, color = 'bg-[#F26722]' }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-sm text-gray-700 w-48 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: pct + '%' }} />
      </div>
      <span className="text-sm text-gray-500 w-8 text-right">{count}</span>
    </div>
  )
}

function AccountabilityBar({ label, pct }) {
  const color = pct === null ? 'bg-gray-200' : pct >= 80 ? 'bg-green-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-sm text-gray-700 w-56 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: (pct ?? 0) + '%' }} />
      </div>
      <span className={`text-sm font-medium w-10 text-right ${pct === null ? 'text-gray-300' : pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
        {pct === null ? '—' : pct + '%'}
      </span>
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
  const [fieldIndex, setFieldIndex] = useState({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { start, end } = getDateRange(preset, customStart, customEnd)

    const [{ data: reportsData }, { data: fieldsData }] = await Promise.all([
      supabase
        .from('event_reports')
        .select(`id, store_name, event_date, units_sold, dollars_sold, mileage, mileage_pay, custom_responses, template_id, profiles ( full_name, email )`)
        .gte('event_date', fmt(start))
        .lte('event_date', fmt(end))
        .order('event_date', { ascending: false }),
      supabase
        .from('template_fields')
        .select('id, label, field_type')
    ])

    const allReports = reportsData || []
    setReports(allReports)

    const idx = buildFieldIndex(fieldsData || [])
    setFieldIndex(idx)

    const byRep = {}
    for (const r of allReports) {
      const key = r.profiles?.email || 'Unknown'
      if (!byRep[key]) {
        byRep[key] = { name: r.profiles?.full_name || r.profiles?.email || 'Unknown', events: 0, units: 0, dollars: 0, mileage: 0 }
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

  // Flavor performance
  const flavorTally = tallyByLabel(reports, fieldIndex, 'most sampled flavor')
  const flavorMax = flavorTally[0]?.[1] || 1

  // Shopper insights
  const objectionTally = tallyByLabel(reports, fieldIndex, 'top reason shoppers did not buy')
  const objectionMax = objectionTally[0]?.[1] || 1

  const ageTally = tallyByLabel(reports, fieldIndex, 'estimated age range')
  const ageMax = ageTally[0]?.[1] || 1

  const questionTally = tallyByLabel(reports, fieldIndex, 'most common question shoppers asked')
  const questionMax = questionTally[0]?.[1] || 1

  // Retailer intel
  const shelfTally = tallyByLabel(reports, fieldIndex, 'shelf placement')
  const shelfMax = shelfTally[0]?.[1] || 1

  const competitorTally = tallyByLabel(reports, fieldIndex, 'competitor products')
  const competitorMax = competitorTally[0]?.[1] || 1

  const repeatTally = tallyByLabel(reports, fieldIndex, 'recommend this store')
  const repeatMax = repeatTally[0]?.[1] || 1

  // Accountability
  const acctManagerContact = accountabilityRate(reports, fieldIndex, 'contact the grocery manager', ['yes'])
  const acctEarlyArrival = accountabilityRate(reports, fieldIndex, 'arrive at least 15', ['yes'])
  const acctStock = accountabilityRate(reports, fieldIndex, 'product in stock', ['yes, fully', 'partially', 'flagged'])
  const acctShelfFacing = accountabilityRate(reports, fieldIndex, 'face and organize product', ['yes'])
  const acctBreakRoom = accountabilityRate(reports, fieldIndex, 'offer leftover samples', ['yes', 'no leftovers'])

  const hasNewData = totalEvents > 0 && Object.keys(fieldIndex).length > 0 && flavorTally.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <button onClick={fetchData} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg">↻ Refresh</button>
      </div>

      {/* Date filter */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 items-center">
          {PRESETS.map(p => (
            <button key={p.value} onClick={() => setPreset(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${preset === p.value ? 'bg-[#F26722] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p.label}
            </button>
          ))}
          {preset === 'custom' && (
            <div className="flex items-center gap-2 mt-2 w-full">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
              <span className="text-gray-400">→</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
              <button onClick={fetchData} className="bg-[#F26722] text-white px-4 py-1.5 rounded-lg text-sm font-medium">Apply</button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Events" value={totalEvents} sub="sampling events" />
            <StatCard label="Units Sold" value={totalUnits.toLocaleString()} sub="bottles / units" />
            <StatCard label="Revenue" value={`$${totalDollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="units × price" />
            <StatCard label="Miles Driven" value={totalMileage.toFixed(0)} sub={`$${totalMileagePay.toFixed(2)} reimbursed`} />
          </div>

          {!hasNewData && totalEvents > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-4 text-sm text-amber-700">
              Reports in this period were submitted before the new template was active. Flavor, shopper, and accountability data will appear once reps submit reports using the new form.
            </div>
          )}

          {/* Flavor performance */}
          {flavorTally.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <SectionHeader title="Flavor performance" />
              <div className="px-5 py-4">
                {flavorTally.map(([label, count]) => (
                  <BarRow key={label} label={label} count={count} max={flavorMax} />
                ))}
              </div>
            </div>
          )}

          {/* Accountability */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <SectionHeader title="Accountability — field guide compliance" />
            <div className="px-5 py-4">
              <AccountabilityBar label="Manager contacted before demo" pct={acctManagerContact} />
              <AccountabilityBar label="Arrived 15+ min early" pct={acctEarlyArrival} />
              <AccountabilityBar label="Product in stock / flagged" pct={acctStock} />
              <AccountabilityBar label="Shelf faced before leaving" pct={acctShelfFacing} />
              <AccountabilityBar label="Break room offer made" pct={acctBreakRoom} />
              <p className="text-xs text-gray-400 mt-3">Green = 80%+, amber = 50–79%, red = below 50%</p>
            </div>
          </div>

          {/* Shopper insights */}
          {(objectionTally.length > 0 || ageTally.length > 0 || questionTally.length > 0) && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <SectionHeader title="Shopper insights" />
              <div className="px-5 py-4 space-y-6">
                {objectionTally.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Top reason shoppers didn't buy</p>
                    {objectionTally.map(([label, count]) => (
                      <BarRow key={label} label={label} count={count} max={objectionMax} color="bg-red-400" />
                    ))}
                  </div>
                )}
                {ageTally.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Age range of most engaged shoppers</p>
                    {ageTally.map(([label, count]) => (
                      <BarRow key={label} label={label} count={count} max={ageMax} color="bg-blue-400" />
                    ))}
                  </div>
                )}
                {questionTally.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Most common shopper question</p>
                    {questionTally.map(([label, count]) => (
                      <BarRow key={label} label={label} count={count} max={questionMax} color="bg-purple-400" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Retailer intel */}
          {(shelfTally.length > 0 || competitorTally.length > 0 || repeatTally.length > 0) && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <SectionHeader title="Retailer intel" />
              <div className="px-5 py-4 space-y-6">
                {shelfTally.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Shelf placement</p>
                    {shelfTally.map(([label, count]) => (
                      <BarRow key={label} label={label} count={count} max={shelfMax} color="bg-teal-400" />
                    ))}
                  </div>
                )}
                {competitorTally.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Competitor products spotted on shelf</p>
                    {competitorTally.map(([label, count]) => (
                      <BarRow key={label} label={label} count={count} max={competitorMax} color="bg-amber-400" />
                    ))}
                  </div>
                )}
                {repeatTally.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Repeat demo recommendation</p>
                    {repeatTally.map(([label, count]) => (
                      <BarRow key={label} label={label} count={count} max={repeatMax} color="bg-green-400" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* By rep */}
          {repBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <SectionHeader title="By rep" />
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

          {/* Event detail */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <SectionHeader title={`Event detail (${totalEvents})`} />
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
