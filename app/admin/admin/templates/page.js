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
    const { data } = await supabase
      .from('report_templates')
      .select('*')
      .order('created_at', { ascending: true })
    setTemplates(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchTemplates() }, [])

  async function loadFields(templateId) {
    if (templateFields[templateId]) {
      setExpandedId(expandedId === templateId ? null : templateId)
      return
    }
    const { data } = await supabase
      .from('template_fields')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true })
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
    const { data } = await supabase
      .from('template_fields')
      .select('*')
      .eq('template_id', t.id)
      .order('sort_order', { ascending: true })
    setEditing(t)
    setTName(t.name)
    setTDesc(t.description || '')
    setFields(
      (data || []).map(f => ({
        ...f,
        options: f.options?.length ? f.options : [''],
      }))
    )
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
      const { data, error: e1 } = await supabase
        .from('report_templates')
        .insert({ name: tName.trim(), description: tDesc.trim() || null })
        .select()
        .single()
      if (e1) { setSaving(false); return setError(e1.message) }
      templateId = data.id
    } else {
      const { error: e1 } = await supabase
        .from('report_templates')
        .update({ name: tName.trim(), description: tDesc.trim() || null })
        .eq('id', editing.id)
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
          <h1 className="text-2xl font-bold text-gray-900">
            {editing === 'new' ? 'New Report Template' : `Edit: ${editing.name}`}
          </h1>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
              <input
                type="text"
                value={tName}
                onChange={e => setTName(e.target.value)}
                placeholder="Standard Sampling Event"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                value={tDesc}
                onChange={e => setTDesc(e.target.value)}
                placeholder="Used for standard in-store sampling events"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-gray-800">Custom Questions</h2>
            <p className="text-sm text-gray-500">These appear on the event report form
