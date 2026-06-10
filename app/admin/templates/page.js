'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text / Notes' },
  { value: 'number', label: 'Number' },
  { value: 'checkbox', label: 'Yes/No Checkbox' },
  { value: 'select', label: 'Dropdown (pick one)' },
]

function emptyField() {
  return { label: '', field_type: 'text', required: false, options: [''], sort_order: 0 }
}

export default function TemplatesPage() {
  const supabase = createClient()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [tName, setTName] = useState('')
  const [tDesc, setTDesc] = useState('')
  const [fields, setFields] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [templateFields, setTemplateFields] = useState({})

  async function fetchTemplates() {
    setLoading(true)
    const { data } = await supabase.from('report_templates').select('*').order('created_at', { ascending: true })
    setTemplates(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchTemplates() }, [])

  async function loadFields(templateId) {
    if (templateFields[templateId]) {
      setExpandedId(expandedId === templateId ? null : templateId)
      return
    }
    const { data } = await supabase.from('template_fields').select('*').eq('template_id', templateId).order('sort_order', { ascending: true })
    setTemplateFields(prev => ({ ...prev, [templateId]: data || [] }))
    setExpandedId(expandedId === templateId ? null : templateId)
  }

  function openNew() {
    setEditing('new')
    setTName('')
    setTDesc('')
    setFields([emptyField()])
    setError('')
  }

  async function openEdit(t) {
    const { data } = await supabase.from('template_fields').select('*').eq('template_id', t.id).order('sort_order', { ascending: true })
    setEditing(t)
    setTName(t.name)
    setTDesc(t.description || '')
    setFields((data || []).map(f => ({ ...f, options: f.options?.length ? f.options : [''] })))
    setError('')
  }

  function addField() {
    setFields(prev => [...prev, { ...emptyField(), sort_order: prev.length }])
  }

  function removeField(idx) {
    setFields(prev => prev.filter((_, i) => i !== idx))
  }

  function updateField(idx, key, val) {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f))
  }

  function addOption(idx) {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, options: [...(f.options || []), ''] } : f))
  }

  function updateOption(idx, optIdx, val) {
    setFields(prev => prev.map((f, i) => {
      if (i !== idx) return f
      const opts = [...(f.options || [])]
      opts[optIdx] = val
      return { ...f, options: opts }
    }))
  }

  function removeOption(idx, optIdx) {
    setFields(prev => prev.map((f, i) => {
      if (i !== idx) return f
      return { ...f, options: f.options.filter((_, oi) => oi !== optIdx) }
    }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!tName.trim()) return setError('Template name is required')
    if (fields.some(f => !f.label.trim())) return setError('All questions need a label')
    setSaving(true)
    setError('')
    let templateId
    if (editing === 'new') {
      const { data, error: e1 } = await supabase.from('report_templates').insert({ name: tName.trim(), description: tDesc.trim() || null }).select().single()
      if (e1) { setSaving(false); return setError(e1.message) }
      templateId = data.id
    } else {
      const { error: e1 } = await supabase.from('report_templates').update({ name: tName.trim(), description: tDesc.trim() || null }).eq('id', editing.id)
      if (e1) { setSaving(false); return setError(e1.message) }
      templateId = editing.id
      await supabase.from('template_fields').delete().eq('template_id', templateId)
    }
    const fieldRows = fields.map((f, i) => ({
      template_id: templateId,
      label: f.label.trim(),
      field_type: f.field_type,
      required: f.required,
      options: f.field_type === 'select' ? f.options.filter(o => o.trim()) : [],
      sort_order: i,
    }))
    const { error: e2 } = await supabase.from('template_fields').insert(fieldRows)
    if (e2) { setSaving(false); return setError(e2.message) }
    setSaving(false)
    setEditing(null)
    setTemplateFields({})
    fetchTemplates()
  }

  async function toggleActive(t) {
    await supabase.from('report_templates').update({ active: !t.active }).eq('id', t.id)
    fetchTemplates()
  }

  if (editing !== null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700 text-xl">←</button>
          <h1 className="text-2xl font-bold text-gray-900">{editing === 'new' ? 'New Report Template' : 'Edit: ' + editing.name}</h1>
        </div>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
              <input type="text" value={tName} onChange={e => setTName(e.target.value)} placeholder="Standard Sampling Event" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input type="text" value={tDesc} onChange={e => setTDesc(e.target.value)} placeholder="Used for standard in-store sampling events" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-800">Custom Questions</h2>
            <p className="text-sm text-gray-500">These appear on the event report in addition to the standard fields.</p>
            {fields.map((f, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Question {idx + 1}</label>
                    <input type="text" value={f.label} onChange={e => updateField(idx, 'label', e.target.value)} placeholder="e.g. How was the store staff?" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  </div>
                  <button type="button" onClick={() => removeField(idx)} className="mt-5 text-gray-400 hover:text-red-500 text-xl leading-none">x</button>
                </div>
                <div className="flex flex-wrap gap-4 items-center">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                    <select value={f.field_type} onChange={e => updateField(idx, 'field_type', e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300">
                      {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 mt-4 cursor-pointer">
                    <input type="checkbox" checked={f.required} onChange={e => updateField(idx, 'required', e.target.checked)} className="w-4 h-4 accent-[#F26722]" />
                    <span className="text-sm text-gray-700">Required</span>
                  </label>
                </div>
                {f.field_type === 'select' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-500">Answer Options</label>
                    {(f.options || []).map((opt, oi) => (
                      <div key={oi} className="flex gap-2 items-center">
                        <input type="text" value={opt} onChange={e => updateOption(idx, oi, e.target.value)} placeholder={'Option ' + (oi + 1)} className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                        <button type="button" onClick={() => removeOption(idx, oi)} className="text-gray-400 hover:text-red-500">x</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addOption(idx)} className="text-sm text-[#F26722] hover:text-orange-700 font-medium">+ Add Option</button>
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={addField} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-orange-300 hover:text-orange-500 transition-colors font-medium">+ Add Question</button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-[#F26722] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">{saving ? 'Saving...' : 'Save Template'}</button>
            <button type="button" onClick={() => setEditing(null)} className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Build custom question sets for different event types</p>
        </div>
        <button onClick={openNew} className="bg-[#F26722] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">+ New Template</button>
      </div>
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-3">
          {templates.length === 0 && <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">No templates yet. Create your first one!</div>}
          {templates.map(t => (
            <div key={t.id} className={'bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ' + (!t.active ? 'opacity-60' : '')}>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800">{t.name}</p>
                    <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (t.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>{t.active ? 'Active' : 'Hidden'}</span>
                  </div>
                  {t.description && <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={() => loadFields(t.id)} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1">{expandedId === t.id ? 'Hide' : 'View'} questions</button>
                  <button onClick={() => openEdit(t)} className="text-sm text-[#F26722] hover:text-orange-700 font-medium px-2 py-1">Edit</button>
                  <button onClick={() => toggleActive(t)} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1">{t.active ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              {expandedId === t.id && templateFields[t.id] && (
                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                  {templateFields[t.id].length === 0 ? (
                    <p className="text-sm text-gray-400">No custom questions</p>
                  ) : (
                    <ol className="space-y-1">
                      {templateFields[t.id].map((f, i) => (
                        <li key={f.id} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-gray-400 font-medium w-5 shrink-0">{i + 1}.</span>
                          <span>{f.label} <span className="ml-2 text-xs text-gray-400">({FIELD_TYPES.find(x => x.value === f.field_type)?.label})</span>{f.required && <span className="ml-1 text-xs text-red-400">required</span>}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
