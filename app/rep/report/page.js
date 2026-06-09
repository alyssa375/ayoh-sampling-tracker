'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const AYOH_PRODUCTS = [
  'Ayoh! Harissa Hot Sauce',
  'Ayoh! Honey Garlic Hot Sauce',
  'Ayoh! Green Jalapeño Hot Sauce',
  'Ayoh! Smoky Chipotle Hot Sauce',
  'Other',
]

export default function EventReportPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    event_date: new Date().toISOString().split('T')[0],
    store_name: '',
    store_address: '',
    city: '',
    state: '',
    products_sampled: [],
    units_sampled: '',
    consumer_interactions: '',
    units_sold: '',
    notes: '',
  })

  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function toggleProduct(product) {
    setForm(prev => ({
      ...prev,
      products_sampled: prev.products_sampled.includes(product)
        ? prev.products_sampled.filter(p => p !== product)
        : [...prev.products_sampled, product],
    }))
  }

  async function uploadPhotos(files, userId) {
    const urls = []
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${userId}/events/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('receipts').upload(path, file)
      if (!error) urls.push(path)
    }
    return urls
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.store_name.trim()) {
      setMessage({ type: 'error', text: 'Store name is required.' })
      return
    }

    setLoading(true)
    setMessage(null)

    const { data: { user } } = await supabase.auth.getUser()

    let photoUrls = []
    if (photos.length > 0) {
      setUploading(true)
      photoUrls = await uploadPhotos(photos, user.id)
      setUploading(false)
    }

    const { error } = await supabase.from('event_reports').insert({
      user_id: user.id,
      event_date: form.event_date,
      store_name: form.store_name,
      store_address: form.store_address || null,
      city: form.city || null,
      state: form.state || null,
      products_sampled: form.products_sampled,
      units_sampled: parseInt(form.units_sampled) || 0,
      consumer_interactions: parseInt(form.consumer_interactions) || 0,
      units_sold: parseInt(form.units_sold) || 0,
      notes: form.notes || null,
      photo_urls: photoUrls,
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Event report submitted!' })
      setTimeout(() => router.push('/rep'), 1500)
    }

    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-ayoh-dark mb-6">Submit Event Report</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Date */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Event Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              name="event_date"
              value={form.event_date}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayoh-orange"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Store Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="store_name"
              value={form.store_name}
              onChange={handleChange}
              placeholder="e.g. Whole Foods Market"
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayoh-orange"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            <input
              type="text"
              name="store_address"
              value={form.store_address}
              onChange={handleChange}
              placeholder="123 Main St"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayoh-orange"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayoh-orange"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                name="state"
                value={form.state}
                onChange={handleChange}
                placeholder="IL"
                maxLength={2}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayoh-orange"
              />
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-700">Products Sampled</h2>
          <div className="flex flex-wrap gap-2">
            {AYOH_PRODUCTS.map(product => (
              <button
                key={product}
                type="button"
                onClick={() => toggleProduct(product)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  form.products_sampled.includes(product)
                    ? 'bg-ayoh-orange text-white border-ayoh-orange'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-ayoh-orange'
                }`}
              >
                {product}
              </button>
            ))}
          </div>
        </div>

        {/* Numbers */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Results</h2>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Units Sampled</label>
              <input
                type="number"
                name="units_sampled"
                value={form.units_sampled}
                onChange={handleChange}
                min="0"
                placeholder="0"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayoh-orange text-center"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interactions</label>
              <input
                type="number"
                name="consumer_interactions"
                value={form.consumer_interactions}
                onChange={handleChange}
                min="0"
                placeholder="0"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayoh-orange text-center"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Units Sold</label>
              <input
                type="number"
                name="units_sold"
                value={form.units_sold}
                onChange={handleChange}
                min="0"
                placeholder="0"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayoh-orange text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="How did it go? Any feedback from customers, store staff, issues..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayoh-orange resize-none"
            />
          </div>
        </div>

        {/* Photos */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-700">Event Photos (optional)</h2>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={e => setPhotos(Array.from(e.target.files))}
            className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-50 file:text-ayoh-orange file:font-medium hover:file:bg-orange-100"
          />
          {photos.length > 0 && (
            <p className="text-sm text-gray-500">{photos.length} photo{photos.length > 1 ? 's' : ''} selected</p>
          )}
        </div>

        {message && (
          <div className={`text-sm rounded-lg px-4 py-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || uploading}
          className="w-full bg-ayoh-orange text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {uploading ? 'Uploading photos...' : loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  )
}
