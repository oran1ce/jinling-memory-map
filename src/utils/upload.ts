import { supabase } from "@/client/supabase";

/**
 * MIME type mappings for common file extensions
 */
export const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  json: 'application/json',
  xml: 'application/xml',
  csv: 'text/csv'
} as const

/**
 * Options for selecting media files
 */
export interface SelectMediaOptions {
  /** Maximum number of files to select */
  count?: number
  /** Media types to select */
  mediaType?: ('image' | 'video' | 'mix')[]
  /** Source type for file selection */
  sourceType?: ('album' | 'camera')[]
}

/**
 * Options for selecting message files
 */
export interface SelectMessageFileOptions {
  /** Maximum number of files to select */
  count?: number
  /** File type filter */
  type?: 'all' | 'video' | 'image' | 'file'
  /** File extensions to allow */
  extension?: string[]
}

/** File upload configuration options */
export interface FileInputOptions {
  bucket: string
  userId?: string
}

/**
 * Generate unique storage file name
 */
export function generateFileName(ext: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}-${random}.${ext}`
}

/**
 * Get MIME type for a file extension
 */
export function getMimeType(ext: string): string {
  return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream'
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadToSupabase(
  file: File,
  options: FileInputOptions
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { bucket, userId  } = options

    // Generate storage path
    const ext = file?.name?.split('.')?.pop() || 'file'
    const storageName = `${userId || 'public'}/${generateFileName(ext)}`

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storageName, file, { contentType: file.type, upsert: false })

    if (error) {
      throw error
    }

    return { success: true, data }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Upload failed'
    }
  }
}

/**
 * Select media files (images/videos) from device via HTML file input
 */
export async function selectMediaFiles(
  options: SelectMediaOptions = {}
): Promise<File[]> {
  const {
    count = 1,
    mediaType = ['image', 'video']
  } = options

  const accept = mediaType.includes('mix')
    ? 'image/*,video/*'
    : mediaType.includes('video')
      ? 'video/*'
      : 'image/*'

  return new Promise<File[]>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    if (count > 1) {
      input.multiple = true
    }
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement
      const files = target.files ? Array.from(target.files).slice(0, count) : []
      input.remove()
      resolve(files)
    }
    input.oncancel = () => {
      input.remove()
      resolve([])
    }
    input.click()
  })
}

/**
 * Select a file (document) from local storage via HTML file input
 */
export async function selectMessageFile(
  options: SelectMessageFileOptions = {}
): Promise<File | null> {
  const {
    extension = ['pdf']
  } = options

  return new Promise<File | null>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = extension.map(ext => `.${ext}`).join(',')
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement
      const selectedFile = target.files?.[0]
      input.remove()
      resolve(selectedFile || null)
    }
    input.oncancel = () => {
      input.remove()
      resolve(null)
    }
    input.click()
  })
}
