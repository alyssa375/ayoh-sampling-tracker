import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request) {
  try {
    const { origin, destination } = await request.json()

    if (!origin || !destination) {
      return NextResponse.json({ error: 'origin and destination required' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'google_maps_api_key')
      .single()

    const apiKey = setting?.value

    if (!apiKey) {
      return NextResponse.json({ error: 'Google Maps API key not configured. Set it in Admin → Settings.' }, { status: 400 })
    }

    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
    url.searchParams.set('origins', origin)
    url.searchParams.set('destinations', destination)
    url.searchParams.set('units', 'imperial')
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== 'OK') {
      return NextResponse.json({ error: `Google Maps error: ${data.status}` }, { status: 400 })
    }

    const element = data.rows?.[0]?.elements?.[0]
    if (!element || element.status !== 'OK') {
      return NextResponse.json({ error: 'Could not calculate distance. Check that both addresses are valid.' }, { status: 400 })
    }

    const meters = element.distance.value
    const miles = meters / 1609.344

    return NextResponse.json({
      miles: Math.round(miles * 100) / 100,
      distanceText: element.distance.text,
      durationText: element.duration.text,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
