'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ProductsPage() {
  const supabase = createClient()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', sku: '', price_per_unit: '', active: true })
  const [error, setError] = useState('')

  async function fetchProducts() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('sort_order', { ascending: true })
    setProducts(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchProducts() }, [])

  function openNew() {
    setEditId(null)
    setForm({ name: '', sku: '', price_per_unit: '', active: true })
    setError('')
    setShowForm(true)
  }

  function openEdit(p) {
    setEditId(p.id)
    setForm({ name: p.name, sku: p.sku || '', price_per_unit: p.price_per_unit, active: p.active })
    setError('')
    setShowForm(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Product name is required')
    const price = parseFloat(form.price_per_unit)
    if (isNaN(price) || price < 0) return setError('Enter a valid price')
    setSaving(true)
    setError('')
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      price_per_unit: price,
      active: form.active,
    }
    let err
    if (editId) {
      const res = await supabase.from('products').update(payload).eq('id', editId)
      err = res.error
    } else {
      const maxOrder = products.length ? Math.max(...products.map(p => p.sort_order)) + 1 : 1
      const res = await supabase.from('products').insert({ ...payload, sort_order: maxOrder })
      err = res.error
    }
    setSaving(false)
    if (err) return setError(err.message)
    setShowForm(false)
    fetchProducts()
  }

  async function toggleActive(p) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id)
    fetchProducts()
  }

  async function moveUp(p) {
    const idx = products.findIndex(x => x.id === p.id)
    if (idx === 0) return
    const other = products[idx - 1]
    await supabase.from('products').update({ sort_order: other.sort_order }).eq('id', p.id)
    await supabase.from('products').update({ sort_order: p.sort_order }).eq('id', other.id)
    fetchProducts()
  }

  async function moveDown(p) {
    const idx = products.findIndex(x => x.id === p.id)
    if (idx === products.length - 1) return
    const other = products[idx + 1]
    await supabase.from('products').update({ sort_order: other.sort_order }).eq('id', p.id)
    await supabase.from('products').update({ sort_order: p.sort_order }).eq('id', other.id)
    fetchProducts()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products and Flavors</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage Ayoh products and set per-unit prices for sales tracking</p>
        </div>
        <button onClick={openNew} className="bg-[#F26722] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
          + Add Product
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">{editId ? 'Edit Product' : 'New Product'}</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ayoh! Harissa Hot Sauce"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU (optional)</label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder="AYO-001"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            </div>
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price per Unit ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price_per_unit}
                  onChange={e => setForm(f => ({ ...f, price_per_unit: e.target.value }))}
                  placeholder="9.99"
                  className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4 accent-[#F26722]"
                />
                <span className="text-sm text-gray-700">Active (show in rep forms)</span>
              </label>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="bg-[#F26722] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Product'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {products.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No products yet. Add your first Ayoh flavor!</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3 text-right">Price / Unit</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p, i) => (
                  <tr key={p.id} className={`hover:bg-gray-50 ${!p.active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveUp(p)}
                          disabled={i === 0}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs px-1"
                        >
                          Up
                        </button>
                        <button
                          onClick={() => moveDown(p)}
                          disabled={i === products.length - 1}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs px-1"
                        >
                          Dn
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-800">{p.name}</td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.sku || '-'}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-700">${p.price_per_unit}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggleActive(p)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {p.active ? 'Active' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="text-sm text-[#F26722] hover:text-orange-700 font-medium">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
