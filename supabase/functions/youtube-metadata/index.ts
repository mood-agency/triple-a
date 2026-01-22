import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VideoMetadata {
  videoId: string
  title: string
  channelName: string
  channelId: string
  thumbnailUrl: string
  duration: string
  publishedAt: string
  viewCount?: string
  description?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { videoId } = await req.json()
    if (!videoId || typeof videoId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'videoId is required', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate videoId format (11 characters, alphanumeric with - and _)
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid videoId format', code: 'INVALID_VIDEO_ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get YouTube API key from secrets
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY')
    if (!youtubeApiKey) {
      return new Response(
        JSON.stringify({ error: 'YouTube API not configured', code: 'NOT_CONFIGURED' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch video metadata from YouTube Data API v3
    const apiUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
    apiUrl.searchParams.set('part', 'snippet,contentDetails,statistics')
    apiUrl.searchParams.set('id', videoId)
    apiUrl.searchParams.set('key', youtubeApiKey)

    const response = await fetch(apiUrl.toString())
    const data = await response.json()

    if (!response.ok) {
      console.error('YouTube API error:', data)
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch video metadata',
          code: 'YOUTUBE_API_ERROR',
          details: data.error?.message
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!data.items || data.items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Video not found', code: 'VIDEO_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const video = data.items[0]
    const snippet = video.snippet
    const contentDetails = video.contentDetails
    const statistics = video.statistics

    const metadata: VideoMetadata = {
      videoId,
      title: snippet.title,
      channelName: snippet.channelTitle,
      channelId: snippet.channelId,
      thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
      duration: contentDetails.duration,
      publishedAt: snippet.publishedAt,
      viewCount: statistics?.viewCount,
      description: snippet.description,
    }

    return new Response(
      JSON.stringify(metadata),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in youtube-metadata function:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
