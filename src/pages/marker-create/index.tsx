// @title 留下故事

import { useCallback, useEffect, useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Image } from '@tarojs/components'
import { useAuth } from '@/contexts/AuthContext'
import { withRouteGuard } from '@/components/RouteGuard'
import { createMarker, createMarkerPhoto, fetchUserMarkers, createConnection } from '@/db/api'
import { supabase } from '@/client/supabase'
import { selectMediaFiles, uploadToSupabase } from '@/utils/upload'
import type { MarkerWithPhotos } from '@/db/types'

function MarkerCreatePage() {
  const { user } = useAuth()
  const [lat, setLat] = useState(32.0615)
  const [lng, setLng] = useState(118.7820)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [myMarkers, setMyMarkers] = useState<MarkerWithPhotos[]>([])
  const [selectedConnectId, setSelectedConnectId] = useState<string>('')
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)

  const params = useMemo(() => {
    const router = Taro.getCurrentInstance()?.router
    return {
      lat: parseFloat(router?.params?.lat || '32.0615'),
      lng: parseFloat(router?.params?.lng || '118.7820')
    }
  }, [])

  useEffect(() => {
    setLat(params.lat)
    setLng(params.lng)
  }, [params])

  const loadMyMarkers = useCallback(async () => {
    if (!user) return
    const mine = await fetchUserMarkers(user.id)
    setMyMarkers(mine)
  }, [user])

  useEffect(() => { loadMyMarkers() }, [loadMyMarkers])
  useDidShow(() => { loadMyMarkers() })

  const handleAddPhoto = useCallback(async () => {
    const files = await selectMediaFiles({ count: 1, mediaType: ['image'] })
    if (!files.length) return

    const file = files[0]
    const { success, data, error } = await uploadToSupabase(file, {
      bucket: 'marker-photos',
      userId: user?.id
    })

    if (success && data?.path) {
      const { data: urlData } = await supabase.storage.from('marker-photos').getPublicUrl(data.path)
      if (urlData?.publicUrl) {
        setPhotos(prev => [...prev, urlData.publicUrl])
      }
    } else {
      Taro.showToast({ title: error || '上传失败', icon: 'none' })
    }
  }, [user])

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      Taro.showToast({ title: '请输入故事标题', icon: 'none' })
      return
    }
    if (!user) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    setSaving(true)
    const markerId = await createMarker({
      user_id: user.id,
      latitude: lat,
      longitude: lng,
      title: title.trim(),
      content: content.trim(),
      is_public: isPublic
    })

    if (!markerId) {
      Taro.showToast({ title: '保存失败', icon: 'none' })
      setSaving(false)
      return
    }

    // 保存照片
    for (const photoUrl of photos) {
      await createMarkerPhoto({ marker_id: markerId, photo_url: photoUrl })
    }

    // 创建关联
    if (selectedConnectId) {
      await createConnection({
        from_marker_id: selectedConnectId,
        to_marker_id: markerId,
        order_index: 0
      })
    }

    setSaving(false)
    Taro.showToast({ title: '故事已保存', icon: 'success' })
    setTimeout(() => {
      Taro.navigateBack()
    }, 800)
  }, [title, content, user, lat, lng, photos, selectedConnectId])

  const handleCancel = useCallback(() => {
    Taro.navigateBack()
  }, [])

  return (
    <div className="min-h-screen bg-parchment">
      {/* 头部 */}
      <div className="px-5 py-4 bg-parchment paper-shadow flex items-center justify-between">
        <button type="button" onClick={handleCancel} className="text-xl text-muted-foreground">
          取消
        </button>
        <span className="text-xl font-bold text-violet-deep">留下故事</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-xl text-violet-deep font-medium disabled:opacity-50"
        >
          {saving ? '保存中' : '保存'}
        </button>
      </div>

      <div className="px-5 py-6 flex flex-col gap-6">
        {/* 位置信息 */}
        <div className="bg-card p-4 rounded-sm paper-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-mdi-map-marker text-seal-red text-xl" />
            <span className="text-lg font-medium text-foreground">当前位置</span>
          </div>
          <div className="text-base text-muted-foreground">
            纬度 {lat.toFixed(5)}，经度 {lng.toFixed(5)}
          </div>
        </div>

        {/* 标题输入 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-lg font-medium text-foreground">故事标题</span>
            <span className="text-seal-red">*</span>
          </div>
          <div className="border-2 border-input rounded-sm px-4 py-3 bg-background overflow-hidden">
            <input
              className="w-full text-xl text-foreground bg-transparent outline-none"
              placeholder="给这个故事起个名字"
              value={title}
              onInput={(e) => { const ev = e as any; setTitle(ev.detail?.value ?? ev.target?.value ?? '') }}
            />
          </div>
        </div>

        {/* 内容输入 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-lg font-medium text-foreground">故事内容</span>
          </div>
          <div className="border-2 border-input rounded-sm px-4 py-3 bg-background overflow-hidden">
            <textarea
              className="w-full text-xl text-foreground bg-transparent outline-none"
              style={{ height: '30vh' }}
              placeholder="记录你在这里的亲身经历与生活故事..."
              value={content}
              onInput={(e) => { const ev = e as any; setContent(ev.detail?.value ?? ev.target?.value ?? '') }}
            />
          </div>
        </div>

        {/* 照片上传 */}
        <div>
          <div className="flex items-center gap-1 mb-3">
            <span className="text-lg font-medium text-foreground">照片</span>
            <span className="text-base text-muted-foreground">（可选）</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {photos.map((url, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-sm overflow-hidden border-2 border-input">
                <Image src={url} className="w-full h-full" mode="aspectFill" />
                <div
                  onClick={() => handleRemovePhoto(idx)}
                  className="absolute top-1 right-1 w-6 h-6 bg-destructive rounded-full flex items-center justify-center"
                >
                  <div className="i-mdi-close text-white text-sm" />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddPhoto}
              className="w-24 h-24 rounded-sm border-2 border-dashed border-input flex flex-col items-center justify-center gap-1 bg-background"
            >
              <div className="i-mdi-camera text-muted-foreground text-2xl" />
              <span className="text-base text-muted-foreground">添加</span>
            </button>
          </div>
        </div>

        {/* 公开/私密选项 */}
        <div>
          <div className="flex items-center gap-1 mb-3">
            <span className="text-lg font-medium text-foreground">可见范围</span>
          </div>
          <div className="flex flex-col gap-2">
            <div
              onClick={() => setIsPublic(true)}
              className={`p-3 rounded-sm border-2 cursor-pointer flex items-center gap-2 ${isPublic ? 'border-violet-deep bg-violet-deep/5' : 'border-input'}`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isPublic ? 'border-violet-deep' : 'border-input'}`}>
                {isPublic && <div className="w-3 h-3 rounded-full bg-violet-deep" />}
              </div>
              <div className="flex flex-col">
                <span className="text-lg text-foreground">公开</span>
                <span className="text-base text-muted-foreground">地图上所有人可见</span>
              </div>
            </div>
            <div
              onClick={() => setIsPublic(false)}
              className={`p-3 rounded-sm border-2 cursor-pointer flex items-center gap-2 ${!isPublic ? 'border-violet-deep bg-violet-deep/5' : 'border-input'}`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!isPublic ? 'border-violet-deep' : 'border-input'}`}>
                {!isPublic && <div className="w-3 h-3 rounded-full bg-violet-deep" />}
              </div>
              <div className="flex flex-col">
                <span className="text-lg text-foreground">私密</span>
                <span className="text-base text-muted-foreground">仅自己可见，他人无法查看</span>
              </div>
            </div>
          </div>
        </div>

        {/* 关联已有点位 */}
        {myMarkers.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-3">
              <span className="text-lg font-medium text-foreground">关联到已有故事</span>
              <span className="text-base text-muted-foreground">（可选，构建故事线）</span>
            </div>
            <div className="flex flex-col gap-2">
              <div
                onClick={() => setSelectedConnectId('')}
                className={`p-3 rounded-sm border-2 cursor-pointer flex items-center gap-2 ${selectedConnectId === '' ? 'border-violet-deep bg-violet-deep/5' : 'border-input'}`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedConnectId === '' ? 'border-violet-deep' : 'border-input'}`}>
                  {selectedConnectId === '' && <div className="w-3 h-3 rounded-full bg-violet-deep" />}
                </div>
                <span className="text-lg text-foreground">不关联（独立故事）</span>
              </div>
              {myMarkers.map(m => (
                <div
                  key={m.id}
                  onClick={() => setSelectedConnectId(m.id)}
                  className={`p-3 rounded-sm border-2 cursor-pointer flex items-center gap-2 ${selectedConnectId === m.id ? 'border-violet-deep bg-violet-deep/5' : 'border-input'}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedConnectId === m.id ? 'border-violet-deep' : 'border-input'}`}>
                    {selectedConnectId === m.id && <div className="w-3 h-3 rounded-full bg-violet-deep" />}
                  </div>
                  <span className="text-lg text-foreground truncate">{m.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default withRouteGuard(MarkerCreatePage)
