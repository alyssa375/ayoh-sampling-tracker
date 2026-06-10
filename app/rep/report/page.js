'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function RepReportPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [templates, setTemplates] = useState([])
  const [products, setProducts] = useState([])
  const [mileageRate, setMileageRate] = useState(0.67)
  const [profile, setProfile] = useState(null)

  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [templateFields, setTemplateFields] = useState([])
  const [customResponses, setCustomResponses] = useState({})
  const [storeName, setStoreName] = useState('')
  const [storeAddress, setStoreAddress] = useState('')
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0])
  const [interactions, setInteractions] = useState('')
  const [notes, setNotes] = useState('')
  const [unitsSold, setUnitsSold] = useState({})
  const [photos, setPhotos] = useState([])
  const [photoFiles, setPhotoFiles] = useState([])

  const [mileageLoading, setMileageLoading] = useState(false)
  const [mileageData, setMileageData] = useState(null)
  const [mileageError, setMileageError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      const [profileRes, templatesRes, productsRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('full_name, home_address, home_lat, home_lng').eq('id', user.id).single(),
        supabase.from('report_templates').select('*').eq('active', true).order('created_at'),
        supabase.from('products').select('*').eq('active', true).order('sort_order'),
        supabase.from('app_settings').select('key, value'),
      ])

      setProfile(profileRes.data)
      setTemplates(templatesRes.data || [])
      setProducts(productsRes.data || [])

      const settings = {}
      for (const s of (settingsRes.data || [])) settings[s.key] = s.value
      if (settings.mileage_rate) setMileageRate(parseFloat(settings.mileage_rate))

      if (templatesRes.data?.length) {
        const first = templatesRes.data[0]
        setSelectedTemplate(first.id)
        await loadTemplateFields(first.id)
      }

      setLoading(false)
    }
    load()
  }, [])

  async function loadTemplateFields(templateId) {
    if (!templateId) { setTemplateFields([]); return }
    const { data } = await supabase
      .from('template_fields')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order')
    setTemplateFields(data || [])
    setCustomResponses({})
  }

  async function handleTemplateChange(id) {
    setSelectedTemplate(id)
    await loadTemplateFields(id)
  }

  async function calculateMileage() {
    if (!profile?.home_address) {
      setMileageError('Please add your home address in My Profile first.')
      return
    }
    if (!storeAddress.trim()) {
      setMileageError('Enter the store address first.')
      return
    }
    setMileageLoading(true)
    setMileageError('')
    setMileageData(null)

    try {
      const res = await fetch('/api/mileage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: profile.home_address, destination: storeAddress }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMileageError(data.error || 'Failed to calculate mileage')
      } else {
        setMileageData(data)
      }
    } catch {
      setMileageError('Network error calculating mileage')
    }
    setMileageLoading(false)
  }

  function handlePhotoChange(e) {
    const files = Array.from(e.target.files)
    setPhotoFiles(files)
    setPhotos(files.map(f => URL.createObjectURL(f)))
  }

  function setUnits(productId, val) {
    setUnitsSold(prev => ({ ...prev, [productId]: val }))
  }

  function setCustomResponse(fieldId, val) {
    setCustomResponses(prev => ({ ...prev, [fieldId]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!storeName.trim()) return setError('Store name is required')
    if (!eventDate) return setError('Event date is required')

    for (const f of templateFields) {
      if (f.required && !customResponses[f.id]?.toString().trim()) {
        return setError(`"${f.label}" is required`)
      }
    }

    setSubmitting(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const totalUnits = Object.values(unitsSold).reduce((s, v) => s + (parseInt(v) || 0), 0)
    let dollarsSold = 0
    for (const [productId, qty] of Object.entries(unitsSold)) {
      const product = products.find(p => p.id === productId)
      if (product && qty) dollarsSold += product.price_per_unit * (parseInt(qty) || 0)
    }

    const productsSoldList = products
      .filter(p => unitsSold[p.id] && parseInt(unitsSold[p.id]) > 0)
      .map(p => `${p.name}: ${unitsSold[p.id]}`)

    const miles = mileageData?.miles || 0
    const mileagePay = Math.round(miles * mileageRate * 100) / 100

    const photoUrls = []
    for (const file of photoFiles) {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`
      const { error: upErr } = await supabase.storage.from('receipts').upload(path, file)
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)
        photoUrls.push(publicUrl)
      }
    }

    const { error: err } = await supabase.from('event_reports').insert({
      rep_id: user.id,
      store_name: storeName.trim(),
      store_address: storeAddress.trim() || null,
      event_date: eventDate,
      interactions_count: parseInt(interactions) || 0,
      notes: notes.trim() || null,
      units_sold: totalUnits,
      dollars_sold: dollarsSold,
      products_sold: productsSoldList.join(', ') || null,
      photo_urls: photoUrls.length ? photoUrls : null,
      template_id: selectedTemplate || null,
      custom_responses: customResponses,
      mileage: miles,
      mileage_pay: mileagePay,
      origin_address: profile?.home_address || null,
    })

    setSubmitting(false)
    if (err) return setError(err.message)
    setSuccess(true)
    setTimeout(() => router.push('/rep'), 2000)
  }

  if (loading) return <div className="text-center py-16 text-gray-400">Loading…</div>

  if (success) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">✅</div>
        <p className="text-xl font-semibold text-gray-800">Report submitted!</p>
        <p className="text-gray-500 mt-1">Redirecting to dashboard…</p>
      </div>
    )
  }

  const totalUnitCount = Object.values(unitsSold).reduce((s, v) => s + (parseInt(v) || 0), 0)
  const totalRevenue = products.reduce((s, p) => {
    return s + (p.price_per_unit * (parseInt(unitsSold[p.id]) || 0))
  }, 0)

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Event Report</h1>
        <p className="text-sm text-gray-500 mt-0.5">Submit your sampling event details</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {templates.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select
              value={selectedTemplate}
              onChange={e => handleTemplateChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-800">Event Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
              <input
                type="text"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                placeholder="Whole Foods Market"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Date *</label>
              <input
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={storeAddress}
                onChange={e => { setStoreAddress(e.target.value); setMileageData(null); setMileageError('') }}
                placeholder="123 Main St, Portland, OR"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <button
                type="button"
                onClick={calculateMileage}
                disabled={mileageLoading || !storeAddress.trim()}
                className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap"
              >
                {mileageLoading ? 'Calculating…' : '📍 Calc Miles'}
              </button>
            </div>
            {mileageError && <p className="text-xs text-red-500 mt-1">{mileageError}</p>}
            {mileageData && (
              <div className="mt-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-[#F26722]">{mileageData.distanceText} from home</span>
                <span className="text-gray-500 ml-2">→ ${(mileageData.miles * mileageRate).toFixed(2)} reimbursement</span>
              </div>
            )}
            {!profile?.home_address && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠ Add your home address in <a href="/rep/profile" className="underline">My Profile</a> to enable mileage calculation.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Interactions</label>
            <input
              type="number"
              min="0"
              value={interactions}
              onChange={e => setInteractions(e.target.value)}
              placeholder="0"
              className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
        </div>

        {products.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-3">
            <h2 className="font-semibold text-gray-800">Units Sold</h2>
            <div className="space-y-3">
              {products.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400">${p.price_per_unit} / unit</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={unitsSold[p.id] || ''}
                    onChange={e => setUnits(p.id, e.target.value)}
                    placeholder="0"
                    className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
              ))}
            </div>
            {totalUnitCount > 0 && (
              <div className="border-t border-gray-100 pt-3 flex justify-between text-sm font-medium">
                <span className="text-gray-700">Total: {totalUnitCount} units</span>
                <span className="text-[#F26722]">${totalRevenue.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {templateFields.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-800">Additional Questions</h2>
            {templateFields.map(f => (
              <div key={f.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {f.label}
                  {f.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {f.field_type === 'text' && (
                  <input type="text" value={customResponses[f.id] || ''} onChange={e => setCustomResponse(f.id, e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                )}
                {f.field_type === 'textarea' && (
                  <textarea value={customResponses[f.id] || ''} onChange={e => setCustomResponse(f.id, e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                )}
                {f.field_type === 'number' && (
                  <input type="number" value={customResponses[f.id] || ''} onChange={e => setCustomResponse(f.id, e.target.value)} className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                )}
                {f.field_type === 'checkbox' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!customResponses[f.id]} onChange={e => setCustomResponse(f.id, e.target.checked)} className="w-4 h-4 accent-[#F26722]" />
                    <span className="text-sm text-gray-700">Yes</span>
                  </label>
                )}
                {f.field_type === 'select' && (
                  <select value={customResponses[f.id] || ''} onChange={e => setCustomResponse(f.id, e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300">
                    <option value="">Select…</option>
                    {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Any additional notes about the event…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">Event Photos (optional)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            className="block text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-[#F26722] hover:file:bg-orange-100"
          />
          {photos.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {photos.map((url, i) => (
                <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#F26722] text-white py-3 rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit Event Report'}
        </button>
      </form>
    </div>
  )
}
