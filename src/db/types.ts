export type UserRole = 'user' | 'admin'

export interface Profile {
  id: string
  email: string | null
  phone: string | null
  role: UserRole
  openid: string | null
  username: string | null
  avatar_url: string | null
  nickname: string | null
  created_at: string
}

export interface PublicProfile {
  id: string
  nickname: string | null
  avatar_url: string | null
  username: string | null
}

export interface Marker {
  id: string
  user_id: string
  latitude: number
  longitude: number
  title: string
  content: string
  created_at: string
  is_public: boolean
}

export interface MarkerWithPhotos extends Marker {
  photos: MarkerPhoto[]
  author: PublicProfile | null
}

export interface MarkerPhoto {
  id: string
  marker_id: string
  photo_url: string
  created_at: string
}

export interface MarkerConnection {
  id: string
  from_marker_id: string
  to_marker_id: string
  order_index: number
  created_at: string
}

export interface StoryLine {
  id: string
  title: string
  content: string
  latitude: number
  longitude: number
  photos: MarkerPhoto[]
  author: PublicProfile | null
  connections: MarkerConnection[]
}

export interface Like {
  id: string
  user_id: string
  marker_id: string
  created_at: string
}

export interface Favorite {
  id: string
  user_id: string
  marker_id: string
  created_at: string
}
