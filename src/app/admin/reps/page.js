'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RepsPage() {
  const supabase = createClient()
  const [reps, setReps] = useState([])
  const [editing, setEditing] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [saving, setSaving] = useState(null)
  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState({ full_name: '', email: '', hourly_rate: '' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadReps()
  }, [])

  async function loadReps() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['rep', 'admin'])
      .order('full_name')
    setReps(data || [])
  }

  async function saveRep(id) {
    setSaving(id)
    await supabase.from('profiles').update({
      full_name: editValues.full_name,
      hourly_rate: parseFloat(editValues.hourly_rate) || 0,
      role: editValues.role,
    }).eq('id', id)
    setEditing(null)
    await loadReps()
    setSaving(null)
  }

  async function inviteRep() {
    if (!invite.email || !invite.full_name) {
      setMessage({ type: 'error', text: 'Name and email are required.' })
      return
    }
    setInviteLoading(true)
    setMessage(null)

    // Use Supabase admin invite (requires service role - handled via API route)
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: invite.email,
        full_name: invite.full_name,
        hourly_rate: parseFloat(invite.hourly_rate) || 0,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setMessage({ type: 'error', text: data.error || 'Failed to invite rep.' })
    } else {
      setMessage({ type: 'success', text: `Invite sent to ${invite.email}!` })
      setInvite({ full_name: '', email: '', hourly_rate: '' })
      setShowInvite(false)
      await loadReps()
    }
    setInviteLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ayoh-dark">Team</h1>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="bg-ayoh-orange text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          + Invite Rep
        </button>
      </div>

      {showInvite && (
        <div className="bg-white border border-ayoh-orange rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Invite a New Rep</h2>
          <p className="text-sm text-gray-500">They'll receive an email to set their password.</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={invite.full_name}
                onChange={e => setInvite(p => ({ ...p, full_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ayoh-orange"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={invite.email}
                onChange={e => setInvite(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ayoh-orange"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($)</label>
            <input
              type="number"
              value={invite.hourly_rate}
              onChange={e => setInvite(p => ({ ...p, hourly_rate: e.target.value }))}
              step="0.25"
              min="0"
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ayoh-orange"
            />
          </div>

          {message && (
            <div className={`text-sm rounded-lg px-3 py-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {message.text}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setShowInvite(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 text-sm">Cancel</button>
            <button onClick={inviteRep} disabled={inviteLoading} className="flex-1 py-2 bg-ayoh-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
              {inviteLoading ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Hourly Rate</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {reps.map(rep => (
              <tr key={rep.id} className="hover:bg-gray-50">
                {editing === rep.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        value={editValues.full_name}
                        onChange={e => setEditValues(p => ({ ...p, full_name: e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-gray-500">{rep.email}</td>
                    <td className="px-4 py-2">
                      <select
                        value={editValues.role}
                        onChange={e => setEditValues(p => ({ ...p, role: e.target.value }))}
                        className="border border-gray-200 rounded px-2 py-1 text-sm"
                      >
                        <option value="rep">Rep</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        value={editValues.hourly_rate}
                        onChange={e => setEditValues(p => ({ ...p, hourly_rate: e.target.value }))}
                        step="0.25"
                        className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-right"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => saveRep(rep.id)} disabled={saving === rep.id} className="text-ayoh-orange text-sm font-medium mr-2">Save</button>
                      <button onClick={() => setEditing(null)} className="text-gray-400 text-sm">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-gray-800">{rep.full_name}</td>
                    <td className="px-4 py-3 text-gray-500">{rep.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rep.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {rep.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {rep.hourly_rate > 0 ? `$${parseFloat(rep.hourly_rate).toFixed(2)}/hr` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setEditing(rep.id)
                          setEditValues({ full_name: rep.full_name, hourly_rate: rep.hourly_rate || 0, role: rep.role })
                        }}
                        className="text-gray-400 hover:text-ayoh-orange text-sm transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
