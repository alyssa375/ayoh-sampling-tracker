'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RepProfilePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ full_name: '', home_address: '' })
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupMsg, setLookupMsg] = useState('')

  async function fetchProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('profiles')
      .select('full_name, home_address, home_lat, home_lng')
      .eq('id', user.id)
      .single()
    if (data) {
      setForm({
        full_name: data.full_name || '',
        home_address: data.home_address || '',
      })
    }
    setLoading(false)
  }

  useEffect(() => { fetchProfile() }, [])

  async function geocodeAddress(address) {
    setLookingUp(true)
    setLookupMsg('')
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
      const data = await res.json()
      if (!data || data.length === 0) {
        setLookupMsg('Address not found — please double-check it')
        return null
      }
      setLookupMsg(`✓ Found: ${data[0].display_name}`)
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    } catch {
      setLookupMsg('Could not look up address')
      return null
    } finally {
      setLookingUp(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.full_name.trim()) return setError('Name is required')
    setSaving(true)
    setError('')
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()

    let updatePayload = {
      full_name: form.full_name.trim(),
      home_address: form.home_address.trim() || null,
    }

    if (form.home_address.trim()) {
      const coords = await geocodeAddress(form.home_address.trim())
      if (coords) {
        updatePayload.home_lat = coords.lat
        updatePayload.home_lng = coords.lng
      }
    }

    const { error: err } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id)

    setSaving(false)
    if (err) return setError(err.message)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Loading…</div>

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Keep your home address up to date for accurate mileage reimbursement</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
          <input
            type="text"
            value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            placeholder="Jane Smith"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Home Address</label>
          <input
            type="text"
            value={form.home_address}
            onChange={e => {
              setForm(f => ({ ...f, home_address: e.target.value }))
              setLookupMsg('')
            }}
            placeholder="123 Main St, Portland, OR 97201"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          {lookupMsg && (
            <p className={`text-xs mt-1 ${lookupMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
              {lookupMsg}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Used to calculate mileage from your home to each event store. Include city and state for best results.
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving || lookingUp}
            className="bg-[#F26722] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
        </div>
      </form>

      <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-gray-700">
        <p className="font-medium text-[#F26722] mb-1">About mileage reimbursement</p>
        <p className="text-gray-600">
          When you submit an event report, the app automatically calculates the distance from your home to the event store. You'll be reimbursed per mile at the rate set by your admin.
        </p>
      </div>
    </div>
  )
}
