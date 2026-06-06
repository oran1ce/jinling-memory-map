// @title 我的

import { useCallback, useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Image } from '@tarojs/components'
import { useAuth } from '@/contexts/AuthContext'
import { withRouteGuard } from '@/components/RouteGuard'
import {
  fetchUserMarkers,
  deleteMarkerCompletely,
  deleteAllUserData,
  updateProfileAvatar,
  fetchUserLikes,
  fetchUserFavorites,
  fetchMarkerLikeCount,
  fetchMarkerFavoriteCount
} from '@/db/api'
import { supabase } from '@/client/supabase'
import { selectMediaFiles, uploadToSupabase } from '@/utils/upload'
import type { MarkerWithPhotos } from '@/db/types'

type TabKey = 'footprints' | 'likes' | 'favorites'

interface MarkerCounts {
  likes: number
  favorites: number
}

function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>('footprints')
  const [footprints, setFootprints] = useState<MarkerWithPhotos[]>([])
  const [likes, setLikes] = useState<MarkerWithPhotos[]>([])
  const [favorites, setFavorites] = useState<MarkerWithPhotos[]>([])
  const [countsMap, setCountsMap] = useState<Record<string, MarkerCounts>>({})
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const loadFootprints = useCallback(async () => {
    if (!user) { setFootprints([]); setCountsMap({}); return }
    setLoading(true)
    const data = await fetchUserMarkers(user.id)
    setFootprints(data)

    // 获取每条足迹的点赞和收藏数
    const counts: Record<string, MarkerCounts> = {}
    await Promise.all(
      data.map(async (m) => {
        const [likeCount, favoriteCount] = await Promise.all([
          fetchMarkerLikeCount(m.id),
          fetchMarkerFavoriteCount(m.id)
        ])
        counts[m.id] = { likes: likeCount, favorites: favoriteCount }
      })
    )
    setCountsMap(counts)
    setLoading(false)
  }, [user])

  const loadLikes = useCallback(async () => {
    if (!user) { setLikes([]); return }
    setLoading(true)
    const data = await fetchUserLikes(user.id)
    setLikes(data)
    setLoading(false)
  }, [user])

  const loadFavorites = useCallback(async () => {
    if (!user) { setFavorites([]); return }
    setLoading(true)
    const data = await fetchUserFavorites(user.id)
    setFavorites(data)
    setLoading(false)
  }, [user])

  const loadActive = useCallback(() => {
    if (activeTab === 'footprints') loadFootprints()
    else if (activeTab === 'likes') loadLikes()
    else loadFavorites()
  }, [activeTab, loadFootprints, loadLikes, loadFavorites])

  useEffect(() => { loadActive() }, [loadActive])
  useDidShow(() => { loadActive() })

  const handleLogout = useCallback(async () => {
    await signOut()
    Taro.showToast({ title: '已退出登录', icon: 'success' })
    Taro.reLaunch({ url: '/pages/login/index' })
  }, [signOut])

  const goLogin = useCallback(() => {
    Taro.navigateTo({ url: '/pages/login/index' })
  }, [])

  const handleSwitchAccount = useCallback(() => {
    handleLogout()
  }, [handleLogout])

  const handleDeleteAccountConfirm = useCallback(async () => {
    if (!user) return
    setShowDeleteConfirm(false)
    Taro.showLoading({ title: '正在注销...' })
    const success = await deleteAllUserData(user.id)
    if (!success) {
      Taro.hideLoading()
      Taro.showToast({ title: '注销失败，请重试', icon: 'none' })
      return
    }
    await signOut()
    Taro.hideLoading()
    Taro.showToast({ title: '账号已注销', icon: 'success' })
    Taro.reLaunch({ url: '/pages/login/index' })
  }, [user, signOut])

  const handleDeleteMarker = useCallback(async (markerId: string) => {
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
            setFootprints(prev => prev.filter(m => m.id !== markerId))
          } else {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }, [])

  const handleUploadAvatar = useCallback(async () => {
    if (!user) return
    const files = await selectMediaFiles({ count: 1, mediaType: ['image'] })
    if (!files.length) return

    const file = files[0]
    const { success, data, error } = await uploadToSupabase(file, {
      bucket: 'avatars',
      userId: user.id
    })

    if (success && data?.path) {
      const { data: urlData } = await supabase.storage.from('avatars').getPublicUrl(data.path)
      if (urlData?.publicUrl) {
        const ok = await updateProfileAvatar(user.id, urlData.publicUrl)
        if (ok) {
          await refreshProfile()
          Taro.showToast({ title: '头像已更新', icon: 'success' })
        } else {
          Taro.showToast({ title: '更新失败', icon: 'none' })
        }
      }
    } else {
      Taro.showToast({ title: error || '上传失败', icon: 'none' })
    }
  }, [user, refreshProfile])

  const goMarkerDetail = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/marker-detail/index?id=${encodeURIComponent(id)}` })
  }, [])

  const currentList = activeTab === 'footprints' ? footprints
    : activeTab === 'likes' ? likes
      : favorites

  const tabItems: { key: TabKey; label: string; icon: string }[] = [
    { key: 'footprints', label: '我的足迹', icon: 'i-mdi-footprint' },
    { key: 'likes', label: '赞过', icon: 'i-mdi-heart' },
    { key: 'favorites', label: '收藏', icon: 'i-mdi-star' }
  ]

  return (
    <div className="min-h-screen bg-parchment">
      {/* 头部信息 */}
      <div className="px-6 py-10 bg-parchment paper-shadow">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-3 border-violet-deep">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} className="w-full h-full" mode="aspectFill" />
            ) : (
              <div className="w-full h-full bg-violet-deep flex items-center justify-center">
                <div className="i-mdi-account text-white text-3xl" />
              </div>
            )}
            {user && (
              <div
                onClick={handleUploadAvatar}
                className="absolute inset-0 bg-black/30 flex items-center justify-center"
              >
                <div className="i-mdi-camera text-white text-xl" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-violet-deep mb-1">
              {profile?.nickname || profile?.username || '未命名用户'}
            </div>
            <div className="text-lg text-muted-foreground">
              {user ? '已登录' : '未登录'}
            </div>
          </div>
        </div>
      </div>

      {/* 功能按钮 */}
      <div className="px-5 py-4 flex flex-col gap-3">
        {!user && (
          <button
            type="button"
            onClick={goLogin}
            className="w-full py-4 bg-violet-deep text-white rounded-sm text-xl font-medium flex items-center justify-center gap-2 paper-shadow"
          >
            <div className="i-mdi-login" />
            <span>登录 / 注册</span>
          </button>
        )}

        {user && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSwitchAccount}
              className="w-full py-4 bg-secondary text-violet-deep rounded-sm text-xl font-medium flex items-center justify-center gap-2 paper-shadow"
            >
              <div className="i-mdi-account-switch" />
              <span>切换账号</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-4 bg-destructive text-white rounded-sm text-xl font-medium flex items-center justify-center gap-2 paper-shadow"
            >
              <div className="i-mdi-account-off" />
              <span>注销账号</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab 切换 */}
      {user && (
        <div className="px-5 py-2">
          <div className="flex flex-row gap-2">
            {tabItems.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`flex-1 py-3 rounded-sm text-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === item.key
                    ? 'bg-violet-deep text-white'
                    : 'bg-secondary text-violet-deep'
                }`}
              >
                <div className={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 列表内容 */}
      {user && (
        <div className="px-5 pb-8 pt-4">
          {loading && (
            <div className="text-center py-6 text-lg text-muted-foreground">加载中...</div>
          )}

          {!loading && currentList.length === 0 && (
            <div className="text-center py-6 text-lg text-muted-foreground">
              {activeTab === 'footprints' && '还没有留下足迹，去地图上写一个故事吧'}
              {activeTab === 'likes' && '还没有点赞任何足迹'}
              {activeTab === 'favorites' && '还没有收藏任何足迹'}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {currentList.map((m) => (
              <div
                key={m.id}
                className="bg-background rounded-sm paper-shadow overflow-hidden"
              >
                {/* 头部：时间 + 删除按钮（仅足迹） */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-input">
                  <span className="text-base text-muted-foreground">
                    {new Date(m.created_at).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  {activeTab === 'footprints' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteMarker(m.id) }}
                      className="text-destructive text-base flex items-center gap-1"
                    >
                      <div className="i-mdi-delete" />
                      <span>删除</span>
                    </button>
                  )}
                </div>

                {/* 内容区域 */}
                <div onClick={() => goMarkerDetail(m.id)} className="px-4 py-4">
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

                  {/* 点赞 / 收藏统计（仅足迹列表） */}
                  {activeTab === 'footprints' && countsMap[m.id] && (
                    <div className="flex items-center gap-4 mt-3 text-base text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="i-mdi-heart text-seal-red" />
                        <span>{countsMap[m.id].likes} 赞</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="i-mdi-star text-violet-deep" />
                        <span>{countsMap[m.id].favorites} 收藏</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 应用信息 */}
      <div className="px-6 py-8 text-center">
        <div className="text-lg text-muted-foreground mb-2">金陵拾光记</div>
        <div className="text-base text-muted-foreground/60">用真实地理承载原汁原味的真人实事</div>
      </div>

      {/* 注销确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-sm mx-6 w-full max-w-sm p-6 flex flex-col gap-5">
            <div className="text-2xl font-bold text-foreground text-center">
              是否注销该账号
            </div>
            <div className="text-lg text-muted-foreground text-center leading-relaxed">
              确认后原账号所有信息将被全部删除，此操作不可撤销。
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleDeleteAccountConfirm}
                className="w-full py-3 bg-destructive text-white rounded-sm text-xl font-medium flex items-center justify-center gap-2"
              >
                <span>确认</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-3 bg-secondary text-foreground rounded-sm text-xl font-medium flex items-center justify-center gap-2"
              >
                <span>取消</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default withRouteGuard(ProfilePage)
