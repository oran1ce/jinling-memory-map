// @title 故事线

import { useCallback, useEffect, useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Image } from '@tarojs/components'
import { withRouteGuard } from '@/components/RouteGuard'
import { useAuth } from '@/contexts/AuthContext'
import { fetchStoryLine } from '@/db/api'
import type { MarkerWithPhotos } from '@/db/types'

function StoryLinePage() {
  const [storyMarkers, setStoryMarkers] = useState<MarkerWithPhotos[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const { user } = useAuth()

  const startMarkerId = useMemo(() => {
    const id = Taro.getCurrentInstance()?.router?.params?.id || ''
    return decodeURIComponent(id)
  }, [])

  const loadData = useCallback(async () => {
    if (!startMarkerId || !user) return
    setLoading(true)
    const data = await fetchStoryLine(startMarkerId, user.id)
    setStoryMarkers(data)
    setLoading(false)
  }, [startMarkerId, user])

  useEffect(() => { loadData() }, [loadData])
  useDidShow(() => { loadData() })

  const handleBack = useCallback(() => {
    Taro.navigateBack()
  }, [])

  const goToMarker = useCallback((markerId: string) => {
    Taro.navigateTo({
      url: `/pages/marker-detail/index?id=${encodeURIComponent(markerId)}`
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-parchment flex items-center justify-center">
        <span className="text-xl text-muted-foreground">加载中...</span>
      </div>
    )
  }

  if (storyMarkers.length === 0) {
    return (
      <div className="min-h-screen bg-parchment flex flex-col items-center justify-center gap-4">
        <div className="i-mdi-book-open-blank-variant text-muted-foreground text-4xl" />
        <span className="text-xl text-muted-foreground">暂无故事线内容</span>
        <button type="button" onClick={handleBack} className="mt-4 px-6 py-3 bg-violet-deep text-white rounded-sm text-xl">
          返回
        </button>
      </div>
    )
  }

  const currentMarker = storyMarkers[currentIndex]

  return (
    <div className="min-h-screen bg-parchment">
      {/* 头部 */}
      <div className="px-5 py-4 bg-parchment paper-shadow flex items-center justify-between sticky top-0 z-10">
        <button type="button" onClick={handleBack} className="flex items-center gap-1 text-xl text-muted-foreground">
          <div className="i-mdi-arrow-left" />
          <span>返回</span>
        </button>
        <span className="text-xl font-bold text-violet-deep">故事线</span>
        <div className="text-lg text-muted-foreground">
          {currentIndex + 1} / {storyMarkers.length}
        </div>
      </div>

      <div className="px-5 py-6 flex flex-col gap-6">
        {/* 进度条 */}
        <div className="flex items-center gap-2">
          {storyMarkers.map((_, idx) => (
            <div
              key={idx}
              className={`flex-1 h-2 rounded-full ${idx <= currentIndex ? 'bg-violet-deep' : 'bg-input'}`}
            />
          ))}
        </div>

        {/* 点位导航 */}
        <div className="flex flex-wrap gap-2">
          {storyMarkers.map((m, idx) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`px-3 py-2 rounded-sm text-lg break-keep ${
                idx === currentIndex
                  ? 'bg-violet-deep text-white'
                  : 'bg-secondary text-violet-deep'
              }`}
            >
              {idx + 1}. {m.title}
            </button>
          ))}
        </div>

        {/* 当前点位内容 */}
        {currentMarker && (
          <div className="flex flex-col gap-5">
            {/* 作者 */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-violet-deep">
                {currentMarker.author?.avatar_url ? (
                  <Image src={currentMarker.author.avatar_url} className="w-full h-full" mode="aspectFill" />
                ) : (
                  <div className="w-full h-full bg-violet-deep flex items-center justify-center">
                    <div className="i-mdi-account text-white text-xl" />
                  </div>
                )}
              </div>
              <div>
                <div className="text-lg font-medium text-foreground">
                  {currentMarker.author?.nickname || currentMarker.author?.username || '匿名用户'}
                </div>
                <div className="text-base text-muted-foreground">
                  {new Date(currentMarker.created_at).toLocaleDateString('zh-CN')}
                </div>
              </div>
            </div>

            {/* 位置 */}
            <div className="flex items-center gap-2 text-base text-muted-foreground">
              <div className="i-mdi-map-marker text-seal-red" />
              <span>纬度 {currentMarker.latitude.toFixed(5)}，经度 {currentMarker.longitude.toFixed(5)}</span>
            </div>

            {/* 标题 */}
            <h2 className="text-3xl font-bold text-violet-deep">{currentMarker.title}</h2>

            {/* 内容 */}
            <div className="text-xl text-foreground leading-relaxed whitespace-pre-wrap">
              {currentMarker.content || '暂无内容'}
            </div>

            {/* 照片 */}
            {currentMarker.photos && currentMarker.photos.length > 0 && (
              <div>
                <div className="text-lg font-medium text-foreground mb-3">照片</div>
                <div className="flex flex-col gap-3">
                  {currentMarker.photos.map((photo, idx) => (
                    <div key={idx} className="w-full rounded-sm overflow-hidden border-2 border-input bg-white p-2 paper-shadow">
                      <Image
                        src={photo.photo_url}
                        className="w-full"
                        mode="widthFix"
                        style={{ maxHeight: '60vh' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 查看详情 */}
            <button
              type="button"
              onClick={() => goToMarker(currentMarker.id)}
              className="w-full py-3 bg-secondary text-violet-deep rounded-sm text-xl font-medium flex items-center justify-center gap-2"
            >
              <div className="i-mdi-eye" />
              <span>查看点位详情</span>
            </button>
          </div>
        )}

        {/* 翻页控制 */}
        <div className="flex flex-row gap-3 mt-4">
          <button
            type="button"
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="flex-1 py-3 bg-secondary text-violet-deep rounded-sm text-xl font-medium flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <div className="i-mdi-arrow-left" />
            <span>上一篇</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex(i => Math.min(storyMarkers.length - 1, i + 1))}
            disabled={currentIndex === storyMarkers.length - 1}
            className="flex-1 py-3 bg-violet-deep text-white rounded-sm text-xl font-medium flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <span>下一篇</span>
            <div className="i-mdi-arrow-right" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default withRouteGuard(StoryLinePage)
