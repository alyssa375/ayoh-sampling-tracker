'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

const CATEGORIES = {
  supplies: { label: 'Supplies', icon: '🛒' },
  travel: { label: 'Travel', icon: '🚗' },
  mileage: { label: 'Mileage', icon: '📍' },
  food: { label: 'Food', icon: '🍽️' },
  equipment: { label: 'Equipment', icon: '🔧' },
  other: { label: 'Other', icon: '📦' },
}

export default function AdminExpensesPage() {
  const supabase = createClient()
  const [expenses, setExpenses] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [noteModal, setNoteModal] = useState(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    loadExpenses()
  }, [filter])

  async function loadExpenses() {
    setLoading(true)
    let query = supabase
      .from('expenses')
      .select(`*, profiles:user_id (full_name, email)`)
      .order('expense_date', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    setExpenses(data || [])
    setLoading(false)
  }

  async function updateStatus(expenseId, status, adminNotes) {
    setActionLoading(expenseId)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('expenses').update({
      status,
      admin_notes: adminNotes || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', expenseId)

    await loadExpenses()
    setActionLoading(null)
    setNoteModal(null)
    setNote('')
  }

  async function viewReceipt(path) {
    const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const pending = expenses.filter(e => e.status === 'pending')
  const pendingTotal = pending.reduce((s, e) => s + parseFloat(e.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ayoh-dark">Expenses</h1>
          {filter === 'pending' && (
            <p className="text-gray-500">${pendingTotal.toFixed(2)} pending review</p>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {['pending', 'approved', 'rejected', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">✅</p>
          <p>No {filter === 'all' ? '' : filter} expenses</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map(expense => (
            <div key={expense.id} className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="text-2xl">
                  {CATEGORIES[expense.category]?.icon || '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-800">{expense.description}</p>
                      <p className="text-sm text-gray-500">
                        {expense.profiles?.full_name} ·{' '}
                        {format(new Date(expense.expense_date + 'T12:00:00'), 'MMM d, yyyy')} ·{' '}
                        {CATEGORIES[expense.category]?.label}
                      </p>
                    </div>
                    <p className="text-xl font-bold text-gray-800 whitespace-nowrap">
                      ${parseFloat(expense.amount).toFixed(2)}
                    </p>
                  </div>

                  {expense.receipt_url && (
                    <button
                      onClick={() => viewReceipt(expense.receipt_url)}
                      className="mt-2 text-sm text-ayoh-orange hover:underline"
                    >
                      📎 View receipt
                    </button>
                  )}

                  {expense.admin_notes && (
                    <p className="mt-2 text-sm text-gray-500 bg-gray-50 rounded px-3 py-1.5">
                      Note: {expense.admin_notes}
                    </p>
                  )}

                  {/* Actions */}
                  {expense.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => updateStatus(expense.id, 'approved')}
                        disabled={actionLoading === expense.id}
                        className="px-4 py-1.5 bg-green-500 text-white text-sm rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => { setNoteModal(expense.id); setNote('') }}
                        disabled={actionLoading === expense.id}
                        className="px-4 py-1.5 bg-red-100 text-red-600 text-sm rounded-lg font-medium hover:bg-red-200 transition-colors"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}

                  {expense.status !== 'pending' && (
                    <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                      expense.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {expense.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-gray-800">Reject Expense</h3>
            <p className="text-sm text-gray-500">Add a note for the rep (optional)</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setNoteModal(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatus(noteModal, 'rejected', note)}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
