import { supabase } from '@/lib/supabase'
import { nanoid } from 'nanoid'

const BUCKET_NAME = 'note-attachments'

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export interface UploadResult {
  url: string
  path: string
  name: string
  size: number
  type: string
}

export class StorageError extends Error {
  code: 'NO_SUPABASE' | 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'UPLOAD_FAILED' | 'DELETE_FAILED' | 'NOT_AUTHENTICATED';

  constructor(
    message: string,
    code: 'NO_SUPABASE' | 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'UPLOAD_FAILED' | 'DELETE_FAILED' | 'NOT_AUTHENTICATED'
  ) {
    super(message)
    this.name = 'StorageError'
    this.code = code
  }
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()! : ''
}

export async function uploadNoteAttachment(
  file: File,
  noteId: string
): Promise<UploadResult> {
  if (!supabase) {
    throw new StorageError('Supabase not configured', 'NO_SUPABASE')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new StorageError('User not authenticated', 'NOT_AUTHENTICATED')
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new StorageError(
      `File type ${file.type} not allowed. Allowed types: images, PDF, DOCX, XLSX`,
      'INVALID_TYPE'
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new StorageError(
      `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      'FILE_TOO_LARGE'
    )
  }

  const ext = getFileExtension(file.name)
  const uniqueId = nanoid(10)
  const fileName = ext ? `${uniqueId}.${ext}` : uniqueId
  const filePath = `${user.id}/${noteId}/${fileName}`

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw new StorageError(`Upload failed: ${error.message}`, 'UPLOAD_FAILED')
  }

  // Use signed URL for private bucket (expires in 1 year)
  const { data: urlData, error: urlError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 31536000) // 1 year in seconds

  if (urlError) {
    throw new StorageError(`Failed to generate URL: ${urlError.message}`, 'UPLOAD_FAILED')
  }

  return {
    url: urlData.signedUrl,
    path: filePath,
    name: file.name,
    size: file.size,
    type: file.type,
  }
}

export async function deleteNoteAttachment(path: string): Promise<void> {
  if (!supabase) {
    throw new StorageError('Supabase not configured', 'NO_SUPABASE')
  }

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path])

  if (error) {
    throw new StorageError(`Delete failed: ${error.message}`, 'DELETE_FAILED')
  }
}

export async function getAttachmentUrl(path: string): Promise<string> {
  if (!supabase) {
    return ''
  }

  try {
    // Use signed URL for private bucket (expires in 1 year)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 31536000) // 1 year in seconds

    if (error) {
      console.error('Failed to get signed URL:', error)
      return ''
    }

    return data.signedUrl
  } catch (error) {
    console.error('Failed to get attachment URL:', error)
    return ''
  }
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  if (!supabase) {
    throw new StorageError('Supabase not configured', 'NO_SUPABASE')
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn)

  if (error) {
    throw new StorageError(`Failed to create signed URL: ${error.message}`, 'UPLOAD_FAILED')
  }

  return data.signedUrl
}

export function isImageFile(type: string): boolean {
  return type.startsWith('image/')
}

export function getFileTypeLabel(type: string): string {
  if (type.startsWith('image/')) return 'Image'
  if (type === 'application/pdf') return 'PDF'
  if (type.includes('wordprocessingml')) return 'Word Document'
  if (type.includes('spreadsheetml')) return 'Excel Spreadsheet'
  return 'File'
}
