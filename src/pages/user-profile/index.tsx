// @title 用户足迹

import { useCallback, useEffect, useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Image } from '@tarojs/components'
import { withRouteGuard } from '@/components/RouteGuard'
import { fetchPublicMarkersByUserId } from '@/db/api'
import { supabase } from '@/client/supabase'
import type { MarkerWithPhotos, PublicProfile } from '@/db/types'

function UserProfilePage() {
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [markers, setMarkers] = useState<MarkerWithPhotos[]>([])
  const [loading, setLoading] = useState(true)

  const routerParams = useMemo(() => Taro.getCurrentInstance()?.router?.params || {}, [])

  useEffect(() => {
    const id = decodeURIComponent(routerParams.id || '')
    setUserId(id)
  }, [routerParams])

  const loadProfile = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()
  
    if (data) setProfile(data as PublicProfile)
  }, [])

  const loadData = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    await Promise.all([
      loadProfile(id),
      fetchPublicMarkersByUserId(id).then(setMarkers)
    ])
    setLoading(false)
  }, [loadProfile])

  useEffect(() => { if (userId) loadData(userId) }, [userId, loadData])
  useDidShow(() => { if (userId) loadData(userId) })

  const handleBack = useCallback(() => {
    Taro.navigateBack()
  }, [])

  const goMarkerDetail = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/marker-detail/index?id=${encodeURIComponent(id)}` })
  }, [])

  return (
    <div className="min-h-screen bg-parchment">
      {/* 头部 */}
      <div className="px-5 py-4 bg-parchment paper-shadow flex items-center justify-between sticky top-0 z-10">
        <button type="button" onClick={handleBack} className="flex items-center gap-1 text-xl text-muted-foreground">
          <div className="i-mdi-arrow-left" />
          <span>返回</span>
        </button>
        <span className="text-xl font-bold text-violet-deep">用户足迹</span>
        <div className="w-12" />
      </div>

      {/* 用户信息 */}
      <div className="px-6 py-8 bg-parchment paper-shadow">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-violet-deep">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} className="w-full h-full" mode="aspectFill" />
            ) : (
              <div className="w-full h-full bg-violet-deep flex items-center justify-center">
                <div className="i-mdi-account text-white text-3xl" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-violet-deep mb-1">
              {profile?.nickname || profile?.username || '未知用户'}
            </div>
            <div className="text-lg text-muted-foreground">
              {markers.length} 条足迹
            </div>
          </div>
        </div>
      </div>

      {/* 足迹列表 */}
      <div className="px-5 py-6 flex flex-col gap-4">
        {loading && (
          <div className="text-center py-6 text-lg text-muted-foreground">加载中...</div>
        )}

        {!loading && markers.length === 0 && (
          <div className="text-center py-6 text-lg text-muted-foreground">
            该用户暂无公开足迹
          </div>
        )}

        {markers.map((m) => (
          <div
            key={m.id}
            onClick={() => goMarkerDetail(m.id)}
            className="bg-background rounded-sm paper-shadow overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-input">
              <span className="text-base text-muted-foreground">
                {new Date(m.created_at).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 text-base text-muted-foreground mb-2">
                <div className="i-mdi-map-marker text-seal-red" />
                <span>纬度 {m.latitude.toFixed(4)}，经度 {m.longitude.toFixed(4)}</span>
              </div>
              <div className="text-xl font-bold text-violet-deep mb-2">{m.title}</div>
              <div className="text-lg text-foreground leading-relaxed line-clamp-3">
                {m.content || '暂无内容'}
              </div>
              {m.photos && m.photos.length > 0 && (
                <div className="flex flex-row gap-2 mt-3 overflow-x-auto">
                  {m.photos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="flex-shrink-0 w-24 h-24 rounded-sm overflow-hidden border border-input"
                    >
                      <Image
                        src={photo.photo_url}
                        className="w-full h-full"
                        mode="aspectFill"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default withRouteGuard(UserProfilePage)
