/**
 * Express server for Railway deployment
 * Serves static files and handles email webhook endpoint
 */

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Parse JSON bodies
app.use(express.json())

// CORS headers for webhook
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

// Email webhook CORS preflight
app.options('/api/email-webhook', (req, res) => {
  res.set(corsHeaders).status(200).send('ok')
})

// Email webhook endpoint
app.post('/api/email-webhook', async (req, res) => {
  res.set(corsHeaders)

  try {
    // Verify webhook secret
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET
    const providedSecret = req.headers['x-webhook-secret']

    if (webhookSecret && providedSecret !== webhookSecret) {
      console.error('Invalid webhook secret')
      return res.status(401).json({ error: 'Unauthorized', code: 'INVALID_SECRET' })
    }

    const email = req.body

    console.log('Received email:', {
      from: email.from,
      to: email.to,
      subject: email.subject,
      hasText: !!email.text,
      hasHtml: !!email.html,
    })

    // Validate required fields
    if (!email.from) {
      return res.status(400).json({ error: 'Email must have a sender (from)', code: 'INVALID_EMAIL' })
    }

    if (!email.subject && !email.text) {
      return res.status(400).json({ error: 'Email must have subject or body', code: 'INVALID_EMAIL' })
    }

    // Check Supabase config
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase not configured')
      return res.status(500).json({ error: 'Server not configured', code: 'NOT_CONFIGURED' })
    }

    // Create Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Extract email address
    const fromEmail = extractEmail(email.from)
    if (!fromEmail) {
      return res.status(400).json({ error: 'Invalid sender email format', code: 'INVALID_EMAIL' })
    }

    // Look up user by email
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('email', fromEmail)
      .single()

    if (profileError || !profile) {
      console.error('User not found for email:', fromEmail)
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND', email: fromEmail })
    }

    const userId = profile.id
    console.log('Found user:', userId, 'for email:', fromEmail)

    // Prepare the note
    const noteContent = email.subject || 'Email task'
    const noteDescription = formatEmailDescription(email)
    const noteDate = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    // Get minimum sort_order
    const { data: existingNotes } = await supabaseClient
      .from('notes')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('date', noteDate)
      .order('sort_order', { ascending: true })
      .limit(1)

    const minSortOrder = existingNotes && existingNotes.length > 0
      ? existingNotes[0].sort_order - 1
      : 0

    // Insert the note
    const { data: note, error: insertError } = await supabaseClient
      .from('notes')
      .insert({
        user_id: userId,
        date: noteDate,
        content: noteContent,
        description: noteDescription,
        category: 'todo',
        completed: false,
        pinned: false,
        sort_order: minSortOrder,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create note:', insertError)
      return res.status(500).json({ error: 'Failed to create task', code: 'INSERT_FAILED', details: insertError.message })
    }

    console.log('Created note from email:', note.id)

    return res.status(200).json({
      success: true,
      noteId: note.id,
      message: `Task created: ${noteContent}`
    })

  } catch (error) {
    console.error('Error in email-webhook:', error)
    return res.status(500).json({
      error: 'Failed to process email',
      code: 'PROCESSING_FAILED',
      details: error.message
    })
  }
})

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

// Helper functions
function formatEmailDescription(email) {
  const parts = []

  if (email.from) {
    parts.push(`From: ${email.from}`)
  }

  if (email.date) {
    parts.push(`Date: ${email.date}`)
  }

  if (parts.length > 0) {
    parts.push('---')
  }

  if (email.text) {
    const text = email.text.trim()
    const maxLength = 2000
    if (text.length > maxLength) {
      parts.push(text.substring(0, maxLength) + '...')
    } else {
      parts.push(text)
    }
  } else if (email.html) {
    const text = stripHtml(email.html).trim()
    const maxLength = 2000
    if (text.length > maxLength) {
      parts.push(text.substring(0, maxLength) + '...')
    } else {
      parts.push(text)
    }
  }

  return parts.join('\n') || null
}

function stripHtml(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractEmail(from) {
  if (!from) return null

  const bracketMatch = from.match(/<([^>]+@[^>]+)>/)
  if (bracketMatch) {
    return bracketMatch[1].toLowerCase().trim()
  }

  const emailMatch = from.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  if (emailMatch) {
    return from.toLowerCase().trim()
  }

  const anyEmailMatch = from.match(/([^\s<>]+@[^\s<>]+\.[^\s<>]+)/)
  if (anyEmailMatch) {
    return anyEmailMatch[1].toLowerCase().trim()
  }

  return null
}
