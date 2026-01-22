import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

interface EmailPayload {
  from: string
  to: string
  subject: string
  text?: string
  html?: string
  date?: string
  messageId?: string
  // Cloudflare Email Routing specific fields
  rawSize?: number
  headers?: Record<string, string>
}

/**
 * Email Webhook for Cloudflare Email Routing
 *
 * This endpoint receives emails forwarded by Cloudflare Email Routing
 * and creates tasks/notes in the user's account.
 *
 * The user is identified by matching the sender's email address (from)
 * with a registered user in the profiles table.
 *
 * Setup:
 * 1. Deploy this function to Supabase
 * 2. Set the following secret in Supabase:
 *    - EMAIL_WEBHOOK_SECRET: A secret key to verify webhook requests
 * 3. Configure Cloudflare Email Routing to POST to:
 *    https://<project>.supabase.co/functions/v1/email-webhook
 * 4. Add the webhook secret as a header: x-webhook-secret
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Verify webhook secret
    const webhookSecret = Deno.env.get('EMAIL_WEBHOOK_SECRET')
    const providedSecret = req.headers.get('x-webhook-secret')

    if (webhookSecret && providedSecret !== webhookSecret) {
      console.error('Invalid webhook secret')
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'INVALID_SECRET' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse the email payload
    const email: EmailPayload = await req.json()

    console.log('Received email:', {
      from: email.from,
      to: email.to,
      subject: email.subject,
      hasText: !!email.text,
      hasHtml: !!email.html,
    })

    // Validate required fields
    if (!email.from) {
      return new Response(
        JSON.stringify({ error: 'Email must have a sender (from)', code: 'INVALID_EMAIL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!email.subject && !email.text) {
      return new Response(
        JSON.stringify({ error: 'Email must have subject or body', code: 'INVALID_EMAIL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for inserting
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Extract email address from "from" field (handle formats like "Name <email@domain.com>")
    const fromEmail = extractEmail(email.from)
    if (!fromEmail) {
      return new Response(
        JSON.stringify({ error: 'Invalid sender email format', code: 'INVALID_EMAIL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up user by email in profiles table
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('email', fromEmail)
      .single()

    if (profileError || !profile) {
      console.error('User not found for email:', fromEmail)
      return new Response(
        JSON.stringify({ error: 'User not found', code: 'USER_NOT_FOUND', email: fromEmail }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = profile.id
    console.log('Found user:', userId, 'for email:', fromEmail)

    // Prepare the note content
    const noteContent = email.subject || 'Email task'
    const noteDescription = formatEmailDescription(email)
    const noteDate = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    // Get the minimum sort_order for the user's notes on this date
    const { data: existingNotes } = await supabaseClient
      .from('notes')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('date', noteDate)
      .order('sort_order', { ascending: true })
      .limit(1)

    const minSortOrder = existingNotes && existingNotes.length > 0
      ? (existingNotes[0].sort_order as number) - 1
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
      return new Response(
        JSON.stringify({ error: 'Failed to create task', code: 'INSERT_FAILED', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Created note from email:', note.id)

    return new Response(
      JSON.stringify({
        success: true,
        noteId: note.id,
        message: `Task created: ${noteContent}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in email-webhook function:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to process email',
        code: 'PROCESSING_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Format the email into a description for the note
 */
function formatEmailDescription(email: EmailPayload): string {
  const parts: string[] = []

  // Add sender info
  if (email.from) {
    parts.push(`From: ${email.from}`)
  }

  // Add date if available
  if (email.date) {
    parts.push(`Date: ${email.date}`)
  }

  // Add separator if we have metadata
  if (parts.length > 0) {
    parts.push('---')
  }

  // Add email body (prefer text over HTML)
  if (email.text) {
    // Trim and limit the text content
    const text = email.text.trim()
    const maxLength = 2000
    if (text.length > maxLength) {
      parts.push(text.substring(0, maxLength) + '...')
    } else {
      parts.push(text)
    }
  } else if (email.html) {
    // Strip HTML tags for a basic text representation
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

/**
 * Basic HTML tag stripping
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract email address from various formats:
 * - "email@domain.com"
 * - "Name <email@domain.com>"
 * - "<email@domain.com>"
 */
function extractEmail(from: string): string | null {
  if (!from) return null

  // Try to match email in angle brackets: "Name <email@domain.com>"
  const bracketMatch = from.match(/<([^>]+@[^>]+)>/)
  if (bracketMatch) {
    return bracketMatch[1].toLowerCase().trim()
  }

  // If no brackets, check if it's a plain email
  const emailMatch = from.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  if (emailMatch) {
    return from.toLowerCase().trim()
  }

  // Try to find any email-like pattern in the string
  const anyEmailMatch = from.match(/([^\s<>]+@[^\s<>]+\.[^\s<>]+)/)
  if (anyEmailMatch) {
    return anyEmailMatch[1].toLowerCase().trim()
  }

  return null
}
