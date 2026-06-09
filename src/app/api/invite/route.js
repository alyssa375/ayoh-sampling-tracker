import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(request) {
  // Verify the requesting user is an admin
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, full_name, hourly_rate } = await request.json()

  if (!email || !full_name) {
    return NextResponse.json({ error: 'Email and name required' }, { status: 400 })
  }

  // Use service role to invite user
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name,
      role: 'rep',
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Update the hourly rate in the profile (profile is auto-created by trigger)
  if (hourly_rate && data.user) {
    await adminSupabase
      .from('profiles')
      .update({ hourly_rate, full_name })
      .eq('id', data.user.id)
  }

  return NextResponse.json({ success: true })
}
