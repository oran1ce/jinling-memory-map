// @title 故事详情

import { useCallback, useEffect, useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Image } from '@tarojs/components'
import { withRouteGuard } from '@/components/RouteGuard'
import { useAuth } from '@/contexts/AuthContext'
import {
  fetchMarkerById,
  fetchConnectionsByMarkerId,
  deleteMarkerCompletely,
  checkLiked,
  checkFavorited,
  toggleLike,
  toggleFavorite,
  fetchMarkerLikeCount,
  fetchMarkerFavoriteCount
} from '@/db/api'
import type { MarkerWithPhotos, MarkerConnection } from '@/db/types'

function MarkerDetailPage() {
  const [marker, setMarker] = useState<MarkerWithPhotos | null>(null)
  const [connections, setConnections] = useState<MarkerConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [zoomImage, setZoomImage] = useState('')
  const { user } = useAuth()

  const markerId = useMemo(() => {
    const id = Taro.getCurrentInstance()?.router?.params?.id || ''
    return decodeURIComponent(id)
  }, [])

  const loadData = useCallback(async () => {
    if (!markerId) return
    setLoading(true)
    const [m, c] = await Promise.all([
      fetchMarkerById(markerId),
      fetchConnectionsByMarkerId(markerId, user?.id || '')
    ])
    setMarker(m)
    setConnections(c)

    if (m) {
      const [likes, favorites] = await Promise.all([
        fetchMarkerLikeCount(markerId),
        fetchMarkerFavoriteCount(markerId)
      ])
      setLikeCount(likes)
      setFavoriteCount(favorites)
    }

    if (user && m) {
      const [isLiked, isFavorited] = await Promise.all([
        checkLiked(user.id, markerId),
        checkFavorited(user.id, markerId)
      ])
      setLiked(isLiked)
      setFavorited(isFavorited)
    }

    setLoading(false)
  }, [markerId, user])

  useEffect(() => { loadData() }, [loadData])
  useDidShow(() => { loadData() })

  const handleBack = useCallback(() => {
    Taro.navigateBack()
  }, [])

  const handleViewStoryLine = useCallback(() => {
    if (!markerId) return
    Taro.navigateTo({
      url: `/pages/story-line/index?id=${encodeURIComponent(markerId)}`
    })
  }, [markerId])

  const isOwner = useMemo(() => {
    return user && marker && user.id === marker.user_id
  }, [user, marker])

  const handleDeleteMarker = useCallback(() => {
    if (!markerId || !isOwner) return
    Taro.showModal({
      title: '确认删除',
      content: '删除后不可恢复，是否确认？',
      confirmText: '删除',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          Taro.showLoading({ title: '删除中...' })
          const success = await deleteMarkerCompletely(markerId)
          Taro.hideLoading()
          if (success) {
            Taro.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => Taro.navigateBack(), 800)
          } else {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }, [markerId, isOwner])

  const handleToggleLike = useCallback(async () => {
    if (!user || !markerId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const result = await toggleLike(user.id, markerId)
    if (result.error) {
      Taro.showToast({ title: result.error, icon: 'none' })
    } else {
      setLiked(result.liked)
      setLikeCount(prev => result.liked ? prev + 1 : prev - 1)
    }
  }, [user, markerId])

  const handleToggleFavorite = useCallback(async () => {
    if (!user || !markerId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const result = await toggleFavorite(user.id, markerId)
    if (result.error) {
      Taro.showToast({ title: result.error, icon: 'none' })
    } else {
      setFavorited(result.favorited)
      setFavoriteCount(prev => result.favorited ? prev + 1 : prev - 1)
    }
  }, [user, markerId])

  const handleGoUserProfile = useCallback(() => {
    if (!marker?.author?.id) return
    Taro.navigateTo({
      url: `/pages/user-profile/index?id=${encodeURIComponent(marker.author.id)}`
    })
  }, [marker])

  if (loading) {
    return (
      <div className="min-h-screen bg-parchment flex items-center justify-center">
        <span className="text-xl text-muted-foreground">加载中...</span>
      </div>
    )
  }

  if (!marker) {
    return (
      <div className="min-h-screen bg-parchment flex flex-col items-center justify-center gap-4">
        <div className="i-mdi-alert-circle-outline text-muted-foreground text-4xl" />
        <span className="text-xl text-muted-foreground">故事不存在或已被删除</span>
        <button type="button" onClick={handleBack} className="mt-4 px-6 py-3 bg-violet-deep text-white rounded-sm text-xl">
          返回地图
        </button>
      </div>
    )
  }

  const hasStoryLine = connections.length > 0

  return (
    <div className="min-h-screen bg-parchment">
      {/* 头部 */}
      <div className="px-5 py-4 bg-parchment paper-shadow flex items-center justify-between sticky top-0 z-10">
        <button type="button" onClick={handleBack} className="flex items-center gap-1 text-xl text-muted-foreground">
          <div className="i-mdi-arrow-left" />
          <span>返回</span>
        </button>
        <span className="text-xl font-bold text-violet-deep">故事详情</span>
        {isOwner ? (
          <button type="button" onClick={handleDeleteMarker} className="text-xl text-destructive flex items-center gap-1">
            <div className="i-mdi-delete" />
            <span>删除</span>
          </button>
        ) : (
          <div className="w-12" />
        )}
      </div>

      <div className="px-5 py-6 flex flex-col gap-6">
        {/* 作者信息 */}
        <div className="flex items-center gap-3" onClick={handleGoUserProfile}>
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-violet-deep">
            {marker.author?.avatar_url ? (
              <Image src={marker.author.avatar_url} className="w-full h-full" mode="aspectFill" />
            ) : (
              <div className="w-full h-full bg-violet-deep flex items-center justify-center">
                <div className="i-mdi-account text-white text-xl" />
              </div>
            )}
          </div>
          <div>
            <div className="text-lg font-medium text-foreground">
              {marker.author?.nickname || marker.author?.username || '匿名用户'}
            </div>
            <div className="text-base text-muted-foreground">
              {new Date(marker.created_at).toLocaleDateString('zh-CN')}
            </div>
          </div>
        </div>

        {/* 可见性标签 */}
        <div className="flex items-center gap-2">
          {marker.is_public ? (
            <span className="px-2 py-1 bg-violet-deep/10 text-violet-deep text-base rounded-sm">公开</span>
          ) : (
            <span className="px-2 py-1 bg-muted text-muted-foreground text-base rounded-sm">私密</span>
          )}
        </div>

        {/* 位置 */}
        <div className="flex items-center gap-2 text-base text-muted-foreground">
          <div className="i-mdi-map-marker text-seal-red" />
          <span>纬度 {marker.latitude.toFixed(5)}，经度 {marker.longitude.toFixed(5)}</span>
        </div>

        {/* 标题 */}
        <h1 className="text-3xl font-bold text-violet-deep">{marker.title}</h1>

        {/* 内容 */}
        <div className="text-xl text-foreground leading-relaxed whitespace-pre-wrap">
          {marker.content || '暂无内容'}
        </div>

        {/* 照片 */}
        {marker.photos && marker.photos.length > 0 && (
          <div>
            <div className="text-lg font-medium text-foreground mb-3">照片</div>
            <div className="flex flex-col gap-3">
              {marker.photos.map((photo, idx) => (
                <div
                  key={idx}
                  onClick={() => setZoomImage(photo.photo_url)}
                  className="w-full rounded-sm overflow-hidden border-2 border-input bg-white p-2 paper-shadow"
                >
                  <Image
                    src={photo.photo_url}
                    className="w-full"
                    mode="widthFix"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 点赞 / 收藏 */}
        <div className="flex flex-row gap-3">
          <button
            type="button"
            onClick={handleToggleLike}
            className={`flex-1 py-3 rounded-sm text-xl font-medium flex items-center justify-center gap-2 paper-shadow ${liked ? 'bg-seal-red text-white' : 'bg-secondary text-violet-deep'}`}
          >
            <div className={liked ? 'i-mdi-heart' : 'i-mdi-heart-outline'} />
            <span>{liked ? '已赞' : '点赞'} {likeCount > 0 ? `(${likeCount})` : ''}</span>
          </button>
          <button
            type="button"
            onClick={handleToggleFavorite}
            className={`flex-1 py-3 rounded-sm text-xl font-medium flex items-center justify-center gap-2 paper-shadow ${favorited ? 'bg-violet-deep text-white' : 'bg-secondary text-violet-deep'}`}
          >
            <div className={favorited ? 'i-mdi-star' : 'i-mdi-star-outline'} />
            <span>{favorited ? '已收藏' : '收藏'} {favoriteCount > 0 ? `(${favoriteCount})` : ''}</span>
          </button>
        </div>

        {/* 故事线入口 */}
        {hasStoryLine && (
          <div className="mt-4">
            <button
              type="button"
              onClick={handleViewStoryLine}
              className="w-full py-4 bg-violet-deep text-white rounded-sm text-xl font-medium flex items-center justify-center gap-2 paper-shadow"
            >
              <div className="i-mdi-book-open-page-variant" />
              <span>阅读完整故事线</span>
              <div className="i-mdi-arrow-right" />
            </button>
          </div>
        )}
      </div>

      {/* 图片放大查看 */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setZoomImage('')}
        >
          <Image
            src={zoomImage}
            className="w-full"
            mode="aspectFit"
            style={{ maxHeight: '90vh' }}
          />
          <button
            type="button"
            onClick={() => setZoomImage('')}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"
          >
            <div className="i-mdi-close text-white text-xl" />
          </button>
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(MarkerDetailPage)
