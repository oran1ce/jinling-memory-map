import { useEffect, useRef } from 'react'
import type { MarkerWithPhotos, MarkerConnection } from '@/db/types'

interface WebMapProps {
  latitude: number
  longitude: number
  scale: number
  markers: MarkerWithPhotos[]
  connections: MarkerConnection[]
  userLocation?: { lat: number; lng: number } | null
  onMarkerTap?: (markerId: string) => void
  onLongPress?: (lat: number, lng: number) => void
}

// 高德瓦片图层 URL（公开网络，无需校园网）
const GAODE_TILE_URL =
  'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'

// 南京市鼓楼区中心坐标
const GULOU_CENTER_LAT = 32.062
const GULOU_CENTER_LNG = 118.783

// 南京市边界
const NANJING_SW_LAT = 31.25
const NANJING_SW_LNG = 118.35
const NANJING_NE_LAT = 32.55
const NANJING_NE_LNG = 119.25

// 地图可拖动范围
const PAN_BOUNDS: [[number, number], [number, number]] = [
  [30.8, 117.8],
  [33.2, 119.8]
]

// 反向遮罩：世界外轮廓
const WORLD_RING = [
  [-85, -180],
  [-85, 180],
  [85, 180],
  [85, -180],
  [-85, -180]
]

// 南京市轮廓
const NANJING_RING = [
  [NANJING_NE_LAT, NANJING_SW_LNG],
  [NANJING_NE_LAT, NANJING_NE_LNG],
  [NANJING_SW_LAT, NANJING_NE_LNG],
  [NANJING_SW_LAT, NANJING_SW_LNG],
  [NANJING_NE_LAT, NANJING_SW_LNG]
]

export default function WebMap({
  latitude,
  longitude,
  scale,
  markers,
  connections,
  userLocation,
  onMarkerTap,
  onLongPress
}: WebMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerLayersRef = useRef<any[]>([])
  const polylineLayerRef = useRef<any>(null)
  const userLocMarkerRef = useRef<any>(null)
  const popupMarkerRef = useRef<any>(null)

  // 初始化地图
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const L = (window as any).L
    if (!L) return

    const map = L.map(containerRef.current, {
      center: [GULOU_CENTER_LAT, GULOU_CENTER_LNG],
      zoom: 17,
      attributionControl: false,
      zoomControl: false,
      scrollWheelZoom: true,
      touchZoom: true,
      minZoom: 10,
      maxZoom: 20,
      maxBounds: PAN_BOUNDS,
      maxBoundsViscosity: 1.0
    })

    // 高德瓦片
    L.tileLayer(GAODE_TILE_URL, {
      subdomains: '1234',
      maxZoom: 20,
      minZoom: 10
    }).addTo(map)

    // 南京市外云雾遮罩
    L.polygon([WORLD_RING, NANJING_RING], {
      color: 'transparent',
      fillColor: '#e8e8e8',
      fillOpacity: 0.82,
      weight: 0,
      className: 'map-cloud-mask',
      interactive: false
    }).addTo(map)

    // 长按创建新标记
    let pressTimer: ReturnType<typeof setTimeout> | null = null
    map.on('mousedown', (e: any) => {
      pressTimer = setTimeout(() => {
        onLongPress?.(e.latlng.lat, e.latlng.lng)
      }, 600)
    })
    map.on('mouseup', () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null }
    })
    map.on('mousemove', () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null }
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // 更新地图中心与缩放
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const center = map.getCenter()
    if (Math.abs(center.lat - latitude) > 0.0001 || Math.abs(center.lng - longitude) > 0.0001) {
      map.setView([latitude, longitude], scale, { animate: false })
    } else if (map.getZoom() !== scale) {
      map.setZoom(scale, { animate: false })
    }
  }, [latitude, longitude, scale])

  // 更新用户定位标记
  useEffect(() => {
    if (!mapRef.current) return
    const L = (window as any).L
    const map = mapRef.current

    if (userLocMarkerRef.current) {
      map.removeLayer(userLocMarkerRef.current)
      userLocMarkerRef.current = null
    }

    if (userLocation) {
      const icon = L.divIcon({
        className: 'user-location-marker',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 8px rgba(59,130,246,0.6);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
      userLocMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon }).addTo(map)
    }
  }, [userLocation])

  // 更新标记点：始终显示脚印，点击弹窗显示头像
  useEffect(() => {
    if (!mapRef.current) return
    const L = (window as any).L
    const map = mapRef.current

    // 清除旧标记
    markerLayersRef.current.forEach(m => map.removeLayer(m))
    markerLayersRef.current = []

    // 清除旧弹窗
    if (popupMarkerRef.current) {
      map.closePopup(popupMarkerRef.current)
      popupMarkerRef.current = null
    }

    markers.forEach(m => {
      const authorName = m.author?.nickname || m.author?.username || '匿名用户'
      const avatarUrl = m.author?.avatar_url || ''

      // 脚印图标
      const icon = L.divIcon({
        className: 'custom-footprint-marker',
        html: `<div style="width:28px;height:28px;border-radius:50%;background:#B23A48;color:#F9F6F0;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.3);">👣</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })

      const marker = L.marker([m.latitude, m.longitude], { icon }).addTo(map)

      // 点击弹窗显示头像
      marker.on('click', () => {
        const popupHtml = avatarUrl
          ? `<div style="display:flex;align-items:center;gap:10px;padding:4px;">
               <img src="${avatarUrl}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #4A315D;flex-shrink:0;" />
               <div style="display:flex;flex-direction:column;gap:2px;">
                 <div style="font-weight:bold;font-size:16px;color:#4A315D;">${authorName}</div>
                 <div style="font-size:14px;color:#666;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.title}</div>
                 <button id="popup-btn-${m.id}" style="margin-top:4px;padding:4px 10px;background:#4A315D;color:#fff;border:none;border-radius:4px;font-size:13px;cursor:pointer;">查看详情</button>
               </div>
             </div>`
          : `<div style="display:flex;align-items:center;gap:10px;padding:4px;">
               <div style="width:48px;height:48px;border-radius:50%;background:#4A315D;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                 <span style="color:#fff;font-size:20px;">👤</span>
               </div>
               <div style="display:flex;flex-direction:column;gap:2px;">
                 <div style="font-weight:bold;font-size:16px;color:#4A315D;">${authorName}</div>
                 <div style="font-size:14px;color:#666;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.title}</div>
                 <button id="popup-btn-${m.id}" style="margin-top:4px;padding:4px 10px;background:#4A315D;color:#fff;border:none;border-radius:4px;font-size:13px;cursor:pointer;">查看详情</button>
               </div>
             </div>`

        const popup = L.popup({
          closeButton: true,
          className: 'avatar-popup',
          offset: [0, -14]
        })
          .setLatLng([m.latitude, m.longitude])
          .setContent(popupHtml)
          .openOn(map)

        popupMarkerRef.current = popup

        // 绑定"查看详情"按钮点击事件
        setTimeout(() => {
          const btn = document.getElementById(`popup-btn-${m.id}`)
          if (btn) {
            btn.addEventListener('click', (e) => {
              e.stopPropagation()
              map.closePopup(popup)
              onMarkerTap?.(m.id)
            })
          }
        }, 0)
      })

      markerLayersRef.current.push(marker)
    })
  }, [markers])

  // 更新连线
  useEffect(() => {
    if (!mapRef.current) return
    const L = (window as any).L
    const map = mapRef.current

    if (polylineLayerRef.current) {
      map.removeLayer(polylineLayerRef.current)
      polylineLayerRef.current = null
    }

    const latlngs: any[] = []
    for (const conn of connections) {
      const from = markers.find(m => m.id === conn.from_marker_id)
      const to = markers.find(m => m.id === conn.to_marker_id)
      if (from && to) {
        latlngs.push([[from.latitude, from.longitude], [to.latitude, to.longitude]])
      }
    }

    if (latlngs.length > 0) {
      const group = L.layerGroup()
      latlngs.forEach(line => {
        L.polyline(line, {
          color: '#B23A48',
          weight: 2,
          dashArray: '5, 5',
          opacity: 0.8
        }).addTo(group)
      })
      group.addTo(map)
      polylineLayerRef.current = group
    }
  }, [connections, markers])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
