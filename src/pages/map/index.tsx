// @title 记忆地图

import { useCallback, useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Image } from '@tarojs/components'
import { useAuth } from '@/contexts/AuthContext'
import { withRouteGuard } from '@/components/RouteGuard'
import { fetchMarkers, fetchConnections } from '@/db/api'
import type { MarkerWithPhotos, MarkerConnection } from '@/db/types'
import WebMap from '@/components/WebMap'

// 南京市鼓楼区中心坐标（初始视图定位点）
const GULOU_CENTER = { latitude: 32.062, longitude: 118.783 }

function MapPage() {
  const { user, profile } = useAuth()
  const [markers, setMarkers] = useState<MarkerWithPhotos[]>([])
  const [connections, setConnections] = useState<MarkerConnection[]>([])
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [markerData, connData] = await Promise.all([
      fetchMarkers(),
      user ? fetchConnections(user.id) : Promise.resolve([])
    ])
    setMarkers(markerData)
    setConnections(connData)
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])
  useDidShow(() => { loadData() })

  const handleMarkerTap = useCallback((markerId: string) => {
    Taro.navigateTo({
      url: `/pages/marker-detail/index?id=${encodeURIComponent(markerId)}`
    })
  }, [])

  const handleLongPress = useCallback((lat: number, lng: number) => {
    Taro.navigateTo({
      url: `/pages/marker-create/index?lat=${lat}&lng=${lng}`
    })
  }, [])

  const handleCenterCampus = useCallback(() => {
    setUserLocation(null)
    Taro.showToast({ title: '已定位到南大鼓楼', icon: 'none' })
  }, [])

  const handleGetLocation = useCallback(() => {
    Taro.getLocation({
      type: 'wgs84',
      success: (res) => {
        setUserLocation({ lat: res.latitude, lng: res.longitude })
        Taro.showToast({ title: '已定位到当前位置', icon: 'success' })
      },
      fail: () => {
        Taro.showToast({ title: '定位失败，请检查权限', icon: 'none' })
      }
    })
  }, [])

  const goProfile = useCallback(() => {
    Taro.switchTab({ url: '/pages/profile/index' })
  }, [])

  return (
    <div className="h-screen flex flex-col bg-parchment">
      {/* 顶部栏 */}
      <div className="px-5 py-4 flex items-center justify-between bg-parchment paper-shadow z-10">
        <div className="flex items-center gap-2">
          <div className="i-mdi-map-marker text-seal-red text-2xl" />
          <span className="text-xl font-bold text-violet-deep">金陵拾光记</span>
        </div>
        <div onClick={goProfile} className="w-10 h-10 rounded-full overflow-hidden border-2 border-violet-deep">
          {profile?.avatar_url ? (
            <Image src={profile.avatar_url} className="w-full h-full" mode="aspectFill" />
          ) : (
            <div className="w-full h-full bg-violet-deep flex items-center justify-center">
              <div className="i-mdi-account text-white text-xl" />
            </div>
          )}
        </div>
      </div>

      {/* 地图区域 */}
      <div className="flex-1 relative overflow-hidden">
        <WebMap
          latitude={GULOU_CENTER.latitude}
          longitude={GULOU_CENTER.longitude}
          scale={17}
          markers={markers}
          connections={connections}
          userLocation={userLocation}
          currentUserId={user?.id || null}
          onMarkerTap={handleMarkerTap}
          onLongPress={handleLongPress}
        />

        {/* 加载状态 */}
        {loading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-parchment/90 px-4 py-2 rounded-sm paper-shadow">
            <span className="text-lg text-muted-foreground">加载中...</span>
          </div>
        )}

        {/* 左下角定位按钮 */}
        <button
          type="button"
          onClick={handleGetLocation}
          className="absolute bottom-4 left-4 w-12 h-12 rounded-full bg-background paper-shadow flex items-center justify-center z-10"
        >
          <div className="i-mdi-crosshairs-gps text-violet-deep text-2xl" />
        </button>
      </div>

      {/* 底部操作区 */}
      <div className="px-5 py-4 bg-parchment paper-shadow z-10">
        <div className="text-center text-lg text-muted-foreground mb-3">
          长按地图任意位置，留下你的故事
        </div>
        <div className="flex flex-row gap-3">
          <button
            type="button"
            onClick={handleCenterCampus}
            className="flex-1 py-3 bg-secondary text-violet-deep rounded-sm text-xl font-medium flex items-center justify-center gap-2"
          >
            <div className="i-mdi-home-map-marker" />
            <span>定位校园</span>
          </button>
          {user && (
            <button
              type="button"
              onClick={() => Taro.navigateTo({ url: `/pages/marker-create/index?lat=${GULOU_CENTER.latitude}&lng=${GULOU_CENTER.longitude}` })}
              className="flex-1 py-3 bg-violet-deep text-white rounded-sm text-xl font-medium flex items-center justify-center gap-2"
            >
              <div className="i-mdi-plus" />
              <span>写故事</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default withRouteGuard(MapPage)
