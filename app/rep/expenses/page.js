'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

const CATEGORIES = [
  { value: 'supplies', label: 'Supplies', icon: '🛒' },
  { value: 'travel', label: 'Travel', icon: '🚗' },
  { value: 'mileage', label: 'Mileage', icon: '📍' },
  { value: 'food', label: 'Food', icon: '🍽️' },
  { value: 'equipment', label: 'Equipment', icon: '🔧' },
  { value: 'other', label: 'Other', icon: '📦' },
]

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function ExpensesPage() {
  const supabase = createClient()
  const [expenses, setExpenses] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'supplies',
    amount: '',
    description: '',
  })
  const [receipt, setReceipt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadExpenses()
  }, [])

  async function loadExpenses() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('expense_date', { ascending: false })

    setExpenses(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid amount.' })
      return
    }

    setLoading(true)
    setMessage(null)

    const { data: { user } } = await supabase.auth.getUser()

    let receiptUrl = null

    if (receipt) {
      const ext = receipt.name.split('.').pop()
      const path = `${user.id}/receipts/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, receipt)

      if (uploadError) {
        setMessage({ type: 'error', text: 'Failed to upload receipt: ' + uploadError.message })
        setLoading(false)
        return
      }
      receiptUrl = path
    }

    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      expense_date: form.expense_date,
      category: form.category,
      amount: parseFloat(form.amount),
      description: form.description,
      receipt_url: receiptUrl,
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Expense submitted!' })
      setForm({
        expense_date: new Date().toISOString().split('T')[0],
        category: 'supplies',
        amount: '',
        description: '',
      })
      setReceipt(null)
      setShowForm(false)
      await loadExpenses()
    }

    setLoading(false)
  }

  async function getReceiptUrl(path) {
    const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const totalPending = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + parseFloat(e.amount), 0)
  const totalApproved = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + parseFloat(e.amount), 0)

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ayoh-dark">Expenses</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-ayoh-orange text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          + Add Expense
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
          <p className="text-sm text-yellow-700">Pending Reimbursement</p>
          <p className="text-xl font-bold text-yellow-800 mt-1">${totalPending.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-sm text-green-700">Approved</p>
          <p className="text-xl font-bold text-green-800 mt-1">${totalApproved.toFixed(2)}</p>
        </div>
      </div>

      {/* Add Expense Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-ayoh-orange rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">New Expense</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={form.expense_date}
                onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayoh-orange text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                step="0.01"
                min="0.01"
                placeholder="0.00"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayoh-orange text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, category: cat.value }))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    form.category === cat.value
                      ? 'bg-ayoh-orange text-white border-ayoh-orange'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-ayoh-orange'
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="What was this expense for?"
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayoh-orange"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Photo</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={e => setReceipt(e.target.files[0])}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-orange-50 file:text-ayoh-orange file:text-sm file:font-medium"
            />
          </div>

          {message && (
            <div className={`text-sm rounded-lg px-3 py-2 ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}>
              {message.text}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-ayoh-orange text-white py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      )}

      {/* Expense List */}
      {expenses.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">💰</p>
          <p>No expenses yet. Add your first one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map(expense => (
            <div key={expense.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {CATEGORIES.find(c => c.value === expense.category)?.icon || '📦'}
                    </span>
                    <div>
                      <p className="font-medium text-gray-800">{expense.description}</p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(expense.expense_date + 'T12:00:00'), 'MMM d, yyyy')} ·{' '}
                        {CATEGORIES.find(c => c.value === expense.category)?.label}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right ml-3">
                  <p className="font-bold text-gray-800">${parseFloat(expense.amount).toFixed(2)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[expense.status]}`}>
                    {expense.status}
                  </span>
                </div>
              </div>
              {expense.receipt_url && (
                <button
                  onClick={() => getReceiptUrl(expense.receipt_url)}
                  className="mt-2 text-xs text-ayoh-orange hover:underline"
                >
                  📎 View receipt
                </button>
              )}
              {expense.status === 'rejected' && expense.admin_notes && (
                <p className="mt-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                  Note: {expense.admin_notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
