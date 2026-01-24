/**
 * Cloudflare Email Worker
 *
 * Receives emails via Cloudflare Email Routing and creates tasks in Supabase.
 *
 * Setup:
 * 1. Configure Email Routing in Cloudflare dashboard
 * 2. Set environment variables in wrangler.toml or Cloudflare dashboard
 * 3. Deploy with: wrangler deploy
 */

import PostalMime from 'postal-mime';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface EmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}

interface ParsedEmail {
  from?: { address?: string; name?: string };
  to?: Array<{ address?: string; name?: string }>;
  subject?: string;
  text?: string;
  html?: string;
  date?: string;
}

export default {
  async email(message: EmailMessage, env: Env): Promise<void> {
    console.log('📧 Received email from:', message.from, 'to:', message.to);

    try {
      // Parse the email
      const rawEmail = await streamToArrayBuffer(message.raw, message.rawSize);
      const parser = new PostalMime();
      const parsed: ParsedEmail = await parser.parse(rawEmail);

      console.log('📧 Parsed email:', {
        from: parsed.from?.address,
        subject: parsed.subject,
        hasText: !!parsed.text,
        hasHtml: !!parsed.html,
      });

      // Validate sender
      const fromEmail = extractEmail(message.from);
      if (!fromEmail) {
        console.error('❌ Invalid sender email format');
        message.setReject('Invalid sender email format');
        return;
      }

      // Validate content
      if (!parsed.subject && !parsed.text) {
        console.error('❌ Email must have subject or body');
        message.setReject('Email must have subject or body');
        return;
      }

      // Check Supabase config
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ Supabase not configured');
        message.setReject('Server not configured');
        return;
      }

      // Create Supabase client
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

      // Look up user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', fromEmail)
        .single();

      if (profileError || !profile) {
        console.error('❌ User not found for email:', fromEmail);
        // Don't reject - just log. The email is still delivered but no task is created.
        // This allows unknown senders to email without causing bounce errors.
        console.log('⚠️ Email received but no user found, skipping task creation');
        return;
      }

      const userId = profile.id;
      console.log('✅ Found user:', userId, 'for email:', fromEmail);

      // Create the note
      const noteId = await createNote(supabase, userId, parsed);
      console.log('✅ Created note from email:', noteId);

    } catch (error) {
      console.error('❌ Error processing email:', error);
      // Don't reject on processing errors - log and continue
      // This prevents emails from bouncing due to temporary issues
    }
  },
};

/**
 * Creates a note in Supabase from the parsed email
 */
async function createNote(
  supabase: SupabaseClient,
  userId: string,
  email: ParsedEmail
): Promise<string> {
  const noteContent = email.subject || 'Email task';
  const noteDescription = formatEmailDescription(email);
  const noteDate = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  // Get minimum sort_order for today's notes
  const { data: existingNotes } = await supabase
    .from('notes')
    .select('sort_order')
    .eq('user_id', userId)
    .eq('date', noteDate)
    .order('sort_order', { ascending: true })
    .limit(1);

  const minSortOrder = existingNotes && existingNotes.length > 0
    ? existingNotes[0].sort_order - 1
    : 0;

  // Insert the note
  const { data: note, error: insertError } = await supabase
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
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Failed to create note: ${insertError.message}`);
  }

  return note.id;
}

/**
 * Formats the email into a description for the note
 */
function formatEmailDescription(email: ParsedEmail): string | null {
  const parts: string[] = [];

  if (email.from?.address) {
    const fromStr = email.from.name
      ? `${email.from.name} <${email.from.address}>`
      : email.from.address;
    parts.push(`From: ${fromStr}`);
  }

  if (email.date) {
    parts.push(`Date: ${email.date}`);
  }

  if (parts.length > 0) {
    parts.push('---');
  }

  const maxLength = 2000;

  if (email.text) {
    const text = email.text.trim();
    if (text.length > maxLength) {
      parts.push(text.substring(0, maxLength) + '...');
    } else {
      parts.push(text);
    }
  } else if (email.html) {
    const text = stripHtml(email.html).trim();
    if (text.length > maxLength) {
      parts.push(text.substring(0, maxLength) + '...');
    } else {
      parts.push(text);
    }
  }

  return parts.join('\n') || null;
}

/**
 * Strips HTML tags from a string
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a clean email address from various formats
 */
function extractEmail(from: string | undefined): string | null {
  if (!from) return null;

  // Match email in angle brackets: "Name <email@example.com>"
  const bracketMatch = from.match(/<([^>]+@[^>]+)>/);
  if (bracketMatch) {
    return bracketMatch[1].toLowerCase().trim();
  }

  // Match plain email: "email@example.com"
  const emailMatch = from.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  if (emailMatch) {
    return from.toLowerCase().trim();
  }

  // Match any email in the string
  const anyEmailMatch = from.match(/([^\s<>]+@[^\s<>]+\.[^\s<>]+)/);
  if (anyEmailMatch) {
    return anyEmailMatch[1].toLowerCase().trim();
  }

  return null;
}

/**
 * Converts a ReadableStream to ArrayBuffer
 */
async function streamToArrayBuffer(
  stream: ReadableStream<Uint8Array>,
  streamSize: number
): Promise<ArrayBuffer> {
  const result = new Uint8Array(streamSize);
  let bytesRead = 0;
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result.set(value, bytesRead);
    bytesRead += value.length;
  }

  return result.buffer;
}
