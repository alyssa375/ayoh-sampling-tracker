'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

export default function ClockPage() {
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [lastEvent, setLastEvent] = useState(null)
  const [clockEvents, setClockEvents] = useState([])
  const [storeName, setStoreName] = useState('')
  const [location, setLocation] = useState(null)
  const [locationName, setLocationName] = useState('')
  const [locationError, setLocationError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [message, setMessage] = useState(null)
  const supabase = createClient()

  useEffect(() => {
    loadClockEvents()
  }, [])

  async function loadClockEvents() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('clock_events')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(20)

    if (data) {
      setClockEvents(data)
      const last = data[0]
      setLastEvent(last)
      setIsClockedIn(last?.event_type === 'clock_in')
    }
  }

  async function getLocation() {
    setGettingLocation(true)
    setLocationError(null)

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        setLocationError('Geolocation is not supported by your browser')
        setGettingLocation(false)
        reject('Not supported')
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          setLocation({ latitude, longitude })

          // Reverse geocode using browser (no API key needed)
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            )
            const data = await res.json()
            const address = data.address
            const name = [
              address.road,
              address.city || address.town || address.village,
              address.state,
            ].filter(Boolean).join(', ')
            setLocationName(name)
          } catch {
            setLocationName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
          }

          setGettingLocation(false)
          resolve({ latitude, longitude })
        },
        (err) => {
          setLocationError('Could not get location. Please enable location permissions.')
          setGettingLocation(false)
          reject(err)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }

  async function handleClockEvent(eventType) {
    if (eventType === 'clock_in' && !storeName.trim()) {
      setMessage({ type: 'error', text: 'Please enter the store name before clocking in.' })
      return
    }

    setLoading(true)
    setMessage(null)

    let coords = location
    let locName = locationName

    try {
      const pos = await getLocation()
      coords = pos
      locName = locationName
    } catch {
      // proceed without GPS if denied
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('clock_events').insert({
      user_id: user.id,
      event_type: eventType,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      location_name: locName || null,
      store_name: storeName || lastEvent?.store_name,
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({
        type: 'success',
        text: eventType === 'clock_in'
          ? `Clocked in at ${storeName}!`
          : 'Clocked out successfully!'
      })
      setStoreName('')
      setLocation(null)
      setLocationName('')
      await loadClockEvents()
    }

    setLoading(false)
  }

  // Calculate elapsed time if clocked in
  function getElapsed() {
    if (!isClockedIn || !lastEvent) return null
    const diff = new Date() - new Date(lastEvent.timestamp)
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  const [elapsed, setElapsed] = useState(getElapsed())
  useEffect(() => {
    if (!isClockedIn) return
    const interval = setInterval(() => setElapsed(getElapsed()), 30000)
    return () => clearInterval(interval)
  }, [isClockedIn, lastEvent])

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-ayoh-dark">Clock In / Out</h1>

      {/* Current Status */}
      <div className={`rounded-2xl p-6 text-center ${
        isClockedIn ? 'bg-green-50 border-2 border-green-200' : 'bg-gray-50 border-2 border-gray-200'
      }`}>
        <div className={`w-4 h-4 rounded-full mx-auto mb-3 ${
          isClockedIn ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
        }`} />
        <p className="text-lg font-semibold text-gray-800">
          {isClockedIn ? 'You are clocked in' : 'You are clocked out'}
        </p>
        {isClockedIn && lastEvent && (
          <div className="mt-2 text-sm text-gray-500 space-y-1">
            <p>Since {format(new Date(lastEvent.timestamp), 'h:mm a, MMM d')}</p>
            {lastEvent.store_name && <p>📍 {lastEvent.store_name}</p>}
            {elapsed && <p className="font-medium text-green-600">⏱ {elapsed}</p>}
          </div>
        )}
      </div>

      {/* Action Form */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        {!isClockedIn && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Store Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="e.g. Whole Foods - Lincoln Park"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayoh-orange"
            />
          </div>
        )}

        {locationName && (
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <span>📍</span>
            <span>{locationName}</span>
          </div>
        )}

        {locationError && (
          <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            ⚠️ {locationError} — your clock-in will still be recorded without GPS.
          </p>
        )}

        {message && (
          <div className={`text-sm rounded-lg px-4 py-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}>
            {message.text}
          </div>
        )}

        <button
          onClick={() => handleClockEvent(isClockedIn ? 'clock_out' : 'clock_in')}
          disabled={loading || gettingLocation}
          className={`w-full py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 ${
            isClockedIn
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-ayoh-orange hover:bg-orange-600'
          }`}
        >
          {loading || gettingLocation
            ? 'Getting location...'
            : isClockedIn
            ? '🔴 Clock Out'
            : '🟢 Clock In'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Your GPS location is recorded with each clock event.
        </p>
      </div>

      {/* Recent Events */}
      {clockEvents.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Recent Clock Events</h2>
          <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
            {clockEvents.slice(0, 10).map(event => (
              <div key={event.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    event.event_type === 'clock_in'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {event.event_type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                  </span>
                  {event.store_name && (
                    <span className="ml-2 text-sm text-gray-600">{event.store_name}</span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{format(new Date(event.timestamp), 'h:mm a')}</p>
                  <p className="text-xs text-gray-400">{format(new Date(event.timestamp), 'MMM d')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
