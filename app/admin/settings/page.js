'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function fetchSettings() {
    setLoading(true)
    const { data } = await supabase.from('app_settings').select('*')
    const map = {}
    for (const row of data || []) map[row.key] = row.value
    setSettings(map)
    setLoading(false)
  }

  useEffect(() => { fetchSettings() }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    const updates = Object.entries(settings).map(([key, value]) => ({
      key,
      value: value ?? '',
      updated_at: new Date().toISOString(),
    }))
    const { error: err } = await supabase
      .from('app_settings')
      .upsert(updates, { onConflict: 'key' })
    setSaving(false)
    if (err) return setError(err.message)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function set(key, val) {
    setSettings(prev => ({ ...prev, [key]: val }))
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Loading...</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure mileage rates and integrations</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Mileage Reimbursement</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate ($ per mile)</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={settings.mileage_rate || ''}
                onChange={e => set('mileage_rate', e.target.value)}
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <span className="text-gray-500 text-sm">/ mile</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">IRS standard rate 2024: $0.67/mile</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Google Maps Integration</h2>
          <p className="text-sm text-gray-500">Required for automatic mileage calculation from rep home address to event store.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps API Key</label>
            <input
              type="text"
              value={settings.google_maps_api_key || ''}
              onChange={e => set('google_maps_api_key', e.target.value)}
              placeholder="AIzaSy..."
              className="w-full font-mono text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-sm space-y-1">
            <p className="font-medium text-[#F26722]">How to get an API key:</p>
            <p className="text-gray-600">1. Go to console.cloud.google.com</p>
            <p className="text-gray-600">2. Create or select a project</p>
            <p className="text-gray-600">3. Enable the Distance Matrix API</p>
            <p className="text-gray-600">4. Go to Credentials and create an API Key</p>
            <p className="text-gray-600">5. Paste it above and save</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#F26722] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        </div>
      </form>
    </div>
  )
}
