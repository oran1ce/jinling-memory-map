import { supabase } from '@/client/supabase'
import type { Marker, MarkerPhoto, MarkerConnection, MarkerWithPhotos, PublicProfile, Like, Favorite } from './types'

// ============ Markers ============

export async function fetchMarkers(): Promise<MarkerWithPhotos[]> {
  const { data, error } = await supabase
    .from('markers')
    .select(`
      *,
      photos:marker_photos(*),
      author:public_profiles!markers_user_id_fkey(*)
    `)
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch markers:', error)
    return []
  }

  return Array.isArray(data) ? data.map(m => ({
    ...m,
    photos: Array.isArray(m.photos) ? m.photos : [],
    author: m.author && !Array.isArray(m.author) ? m.author as PublicProfile : null
  })) as MarkerWithPhotos[] : []
}

export async function fetchMarkerById(id: string): Promise<MarkerWithPhotos | null> {
  const { data, error } = await supabase
    .from('markers')
    .select(`
      *,
      photos:marker_photos(*),
      author:public_profiles!markers_user_id_fkey(*)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    console.error('Failed to fetch marker:', error)
    return null
  }

  return {
    ...data,
    photos: Array.isArray(data.photos) ? data.photos : [],
    author: data.author && !Array.isArray(data.author) ? data.author as PublicProfile : null
  } as MarkerWithPhotos
}

export async function fetchUserMarkers(userId: string): Promise<MarkerWithPhotos[]> {
  const { data, error } = await supabase
    .from('markers')
    .select(`
      *,
      photos:marker_photos(*),
      author:public_profiles!markers_user_id_fkey(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch user markers:', error)
    return []
  }

  return Array.isArray(data) ? data.map(m => ({
    ...m,
    photos: Array.isArray(m.photos) ? m.photos : [],
    author: m.author && !Array.isArray(m.author) ? m.author as PublicProfile : null
  })) as MarkerWithPhotos[] : []
}

/** 获取某用户的公开足迹（供他人查看） */
export async function fetchPublicMarkersByUserId(userId: string): Promise<MarkerWithPhotos[]> {
  const { data, error } = await supabase
    .from('markers')
    .select(`
      *,
      photos:marker_photos(*),
      author:public_profiles!markers_user_id_fkey(*)
    `)
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch public user markers:', error)
    return []
  }

  return Array.isArray(data) ? data.map(m => ({
    ...m,
    photos: Array.isArray(m.photos) ? m.photos : [],
    author: m.author && !Array.isArray(m.author) ? m.author as PublicProfile : null
  })) as MarkerWithPhotos[] : []
}

export async function createMarker(marker: Omit<Marker, 'id' | 'created_at'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('markers')
    .insert(marker)
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create marker:', error)
    return null
  }

  return data?.id || null
}

export async function updateMarker(id: string, updates: Partial<Marker>): Promise<boolean> {
  const { error } = await supabase
    .from('markers')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('Failed to update marker:', error)
    return false
  }

  return true
}

/** 彻底删除 marker，同时清理 storage 中的图片 */
export async function deleteMarkerCompletely(id: string): Promise<boolean> {
  const { data: photos, error: photoErr } = await supabase
    .from('marker_photos')
    .select('photo_url')
    .eq('marker_id', id)

  if (photoErr) {
    console.error('Failed to fetch marker photos:', photoErr)
  }

  const { error } = await supabase
    .from('markers')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete marker:', error)
    return false
  }

  if (photos && photos.length > 0) {
    const paths = photos
      .map((p: any) => {
        try {
          const url = new URL(p.photo_url)
          const segments = url.pathname.split('/')
          return segments.slice(segments.indexOf('marker-photos') + 1).join('/')
        } catch {
          return ''
        }
      })
      .filter(Boolean)

    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage
        .from('marker-photos')
        .remove(paths)
      if (storageErr) {
        console.warn('Failed to remove storage files:', storageErr)
      }
    }
  }

  return true
}

// ============ Marker Photos ============

export async function createMarkerPhoto(photo: Omit<MarkerPhoto, 'id' | 'created_at'>): Promise<boolean> {
  const { error } = await supabase
    .from('marker_photos')
    .insert(photo)

  if (error) {
    console.error('Failed to create marker photo:', error)
    return false
  }

  return true
}

export async function deleteMarkerPhoto(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('marker_photos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete marker photo:', error)
    return false
  }

  return true
}

// ============ Marker Connections ============

export async function fetchConnections(): Promise<MarkerConnection[]> {
  const { data, error } = await supabase
    .from('marker_connections')
    .select('*')
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Failed to fetch connections:', error)
    return []
  }

  return Array.isArray(data) ? data : []
}

export async function fetchConnectionsByMarkerId(markerId: string): Promise<MarkerConnection[]> {
  const { data, error } = await supabase
    .from('marker_connections')
    .select('*')
    .or(`from_marker_id.eq.${markerId},to_marker_id.eq.${markerId}`)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Failed to fetch connections:', error)
    return []
  }

  return Array.isArray(data) ? data : []
}

export async function createConnection(connection: Omit<MarkerConnection, 'id' | 'created_at'>): Promise<boolean> {
  const { error } = await supabase
    .from('marker_connections')
    .insert(connection)

  if (error) {
    console.error('Failed to create connection:', error)
    return false
  }

  return true
}

export async function deleteConnection(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('marker_connections')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete connection:', error)
    return false
  }

  return true
}

// ============ Story Line ============

export async function fetchStoryLine(startMarkerId: string): Promise<MarkerWithPhotos[]> {
  const visited = new Set<string>()
  const result: MarkerWithPhotos[] = []
  const queue: string[] = [startMarkerId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    const marker = await fetchMarkerById(currentId)
    if (marker) {
      result.push(marker)

      const { data: connections } = await supabase
        .from('marker_connections')
        .select('*')
        .eq('from_marker_id', currentId)
        .order('order_index', { ascending: true })

      if (connections) {
        for (const conn of connections) {
          if (!visited.has(conn.to_marker_id)) {
            queue.push(conn.to_marker_id)
          }
        }
      }
    }
  }

  return result
}

// ============ Likes ============

export async function toggleLike(userId: string, markerId: string): Promise<{ liked: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('marker_id', markerId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('user_id', userId)
      .eq('marker_id', markerId)
    if (error) return { liked: true, error: error.message }
    return { liked: false }
  }

  const { error } = await supabase
    .from('likes')
    .insert({ user_id: userId, marker_id: markerId })

  if (error) return { liked: false, error: error.message }
  return { liked: true }
}

export async function checkLiked(userId: string, markerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('marker_id', markerId)
    .maybeSingle()
  return !!data
}

export async function fetchUserLikes(userId: string): Promise<MarkerWithPhotos[]> {
  const { data, error } = await supabase
    .from('likes')
    .select(`
      marker:markers!likes_marker_id_fkey(
        *,
        photos:marker_photos(*),
        author:public_profiles!markers_user_id_fkey(*)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch user likes:', error)
    return []
  }

  return Array.isArray(data)
    ? data
      .map((row: any) => row.marker)
      .filter(Boolean)
      .map((m: any) => ({
        ...m,
        photos: Array.isArray(m.photos) ? m.photos : [],
        author: m.author && !Array.isArray(m.author) ? m.author as PublicProfile : null
      })) as MarkerWithPhotos[]
    : []
}

// ============ Favorites ============

export async function toggleFavorite(userId: string, markerId: string): Promise<{ favorited: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('marker_id', markerId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('marker_id', markerId)
    if (error) return { favorited: true, error: error.message }
    return { favorited: false }
  }

  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, marker_id: markerId })

  if (error) return { favorited: false, error: error.message }
  return { favorited: true }
}

export async function checkFavorited(userId: string, markerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('marker_id', markerId)
    .maybeSingle()
  return !!data
}

export async function fetchUserFavorites(userId: string): Promise<MarkerWithPhotos[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select(`
      marker:markers!favorites_marker_id_fkey(
        *,
        photos:marker_photos(*),
        author:public_profiles!markers_user_id_fkey(*)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch user favorites:', error)
    return []
  }

  return Array.isArray(data)
    ? data
      .map((row: any) => row.marker)
      .filter(Boolean)
      .map((m: any) => ({
        ...m,
        photos: Array.isArray(m.photos) ? m.photos : [],
        author: m.author && !Array.isArray(m.author) ? m.author as PublicProfile : null
      })) as MarkerWithPhotos[]
    : []
}

// ============ User Profile ============

export async function updateProfileAvatar(userId: string, avatarUrl: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)

  if (error) {
    console.error('Failed to update avatar:', error)
    return false
  }
  return true
}

/** 删除用户所有数据（markers、级联 photos/connections、storage 图片、profile） */
export async function deleteAllUserData(userId: string): Promise<boolean> {
  const { data: markers } = await supabase
    .from('markers')
    .select('id, photos:marker_photos(photo_url)')
    .eq('user_id', userId)

  const paths: string[] = []
  if (markers) {
    for (const m of markers) {
      const photos = (m as any).photos || []
      for (const p of photos) {
        try {
          const url = new URL(p.photo_url)
          const segments = url.pathname.split('/')
          const path = segments.slice(segments.indexOf('marker-photos') + 1).join('/')
          if (path) paths.push(path)
        } catch {
          // ignore
        }
      }
    }
  }

  const { error: markerErr } = await supabase
    .from('markers')
    .delete()
    .eq('user_id', userId)

  if (markerErr) {
    console.error('Failed to delete user markers:', markerErr)
    return false
  }

  if (paths.length > 0) {
    const { error: storageErr } = await supabase.storage
      .from('marker-photos')
      .remove(paths)
    if (storageErr) {
      console.warn('Failed to remove storage files:', storageErr)
    }
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (profileErr) {
    console.error('Failed to delete user profile:', profileErr)
    return false
  }

  return true
}
