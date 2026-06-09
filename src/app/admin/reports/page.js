import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

export default async function AdminReportsPage({ searchParams }) {
  const supabase = createClient()

  const page = parseInt(searchParams?.page || '1')
  const pageSize = 20
  const from = (page - 1) * pageSize

  const { data: reports, count } = await supabase
    .from('event_reports')
    .select(`
      *,
      profiles:user_id (full_name, email)
    `, { count: 'exact' })
    .order('event_date', { ascending: false })
    .range(from, from + pageSize - 1)

  const totalPages = Math.ceil((count || 0) / pageSize)

  // Summary stats
  const { data: allReports } = await supabase
    .from('event_reports')
    .select('units_sampled, consumer_interactions, units_sold')

  const totals = (allReports || []).reduce((acc, r) => ({
    units_sampled: acc.units_sampled + (r.units_sampled || 0),
    consumer_interactions: acc.consumer_interactions + (r.consumer_interactions || 0),
    units_sold: acc.units_sold + (r.units_sold || 0),
  }), { units_sampled: 0, consumer_interactions: 0, units_sold: 0 })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ayoh-dark">Event Reports</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-sm text-gray-500">Total Events</p>
          <p className="text-2xl font-bold text-ayoh-dark mt-1">{count || 0}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-sm text-gray-500">Total Interactions</p>
          <p className="text-2xl font-bold text-ayoh-dark mt-1">{totals.consumer_interactions.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-sm text-gray-500">Units Sold via Demo</p>
          <p className="text-2xl font-bold text-ayoh-dark mt-1">{totals.units_sold.toLocaleString()}</p>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rep</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Store</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Sampled</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Interactions</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Sold</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Products</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(reports || []).map(report => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {format(new Date(report.event_date + 'T12:00:00'), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{report.profiles?.full_name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-800">{report.store_name}</p>
                    {(report.city || report.state) && (
                      <p className="text-xs text-gray-400">{[report.city, report.state].filter(Boolean).join(', ')}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{report.units_sampled || 0}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{report.consumer_interactions || 0}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{report.units_sold || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(report.products_sampled || []).map(p => (
                        <span key={p} className="text-xs bg-orange-50 text-ayoh-orange px-1.5 py-0.5 rounded">
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <a href={`/admin/reports?page=${page - 1}`} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                  ← Prev
                </a>
              )}
              {page < totalPages && (
                <a href={`/admin/reports?page=${page + 1}`} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Next →
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
