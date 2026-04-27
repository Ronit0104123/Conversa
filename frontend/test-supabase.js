const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://gcqyvutkskdkckjuuqel.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcXl2dXRrc2tka2NranV1cWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MzcyNjQsImV4cCI6MjA5MjUxMzI2NH0.Xp4TQjfxdB8stIOykgxPCxz-DTkKpMn711BJmUtkUdk'

console.log('Testing connection to:', supabaseUrl)

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Connection failed (Auth):', error.message)
    } else {
      console.log('Auth check successful!')
    }
    
    const { count, error: dbError } = await supabase.from('chatbots').select('*', { count: 'exact', head: true })
    if (dbError) {
      console.error('Database check failed:', dbError.message)
    } else {
      console.log('Database check successful! Count:', count)
    }
  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

test()
