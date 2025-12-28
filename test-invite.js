// Test script to invoke the Edge Function directly
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://winfoubqhkrigtgjwrpm.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbmZvdWJxaGtyaWd0Z2p3cnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0Mjg3NzksImV4cCI6MjA4MTAwNDc3OX0.H-sCbSDnwnlu6LxFNDyDsc1eu9VaaJkkqgn7xScFFX8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testInvite() {
  console.log('Testing Edge Function...')

  // First, check if we're authenticated
  const { data: { session } } = await supabase.auth.getSession()
  console.log('Session:', session ? 'Found' : 'Not found')

  if (!session) {
    console.error('No active session! Please login first.')
    return
  }

  // Try to invoke the function
  console.log('Invoking invite-user function...')

  try {
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: {
        email: 'paul.katereggaqboaug@gmail.com',
        fullName: 'Paul Kateregga',
        role: 'submitter',
        projects: []
      }
    })

    if (error) {
      console.error('Edge Function Error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
    } else {
      console.log('Success!', data)
    }
  } catch (err) {
    console.error('Caught exception:', err)
  }
}

testInvite()
