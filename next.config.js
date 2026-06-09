/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://ejfiffogznxqrppvirxf.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqZmlmZm9nem54cXJwcHZpcnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMjA5NjgsImV4cCI6MjA5NjU5Njk2OH0.JkAkI-3TrlBSiB5f5foHsq9IAqWDE-c8Rnwd4KpB4SE',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
}

module.exports = nextConfig
