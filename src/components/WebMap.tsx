import { useEffect, useRef } from 'react'
import type { MarkerWithPhotos, MarkerConnection } from '@/db/types'

interface WebMapProps {
  latitude: number
  longitude: number
  scale: number
  markers: MarkerWithPhotos[]
  connections: MarkerConnection[]
  onScaleChange?: (scale: number) => void
  onMarkerTap?: (markerId: string) => void
  onLongPress?: (lat: number, lng: number) => void
}

// 高德瓦片图层 URL（公开网络，无需校园网）
const GAODE_TILE_URL =
  'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'

// 南京市鼓楼区中心坐标
const GULOU_CENTER_LAT = 32.062
const GULOU_CENTER_LNG = 118.783

// 南京市边界（西南 -> 东北）
const NANJING_SW_LAT = 31.25
const NANJING_SW_LNG = 118.35
const NANJING_NE_LAT = 32.55
const NANJING_NE_LNG = 119.25

// 地图可拖动范围（比南京市稍大，让用户能看到蒙版边缘过渡）
const PAN_BOUNDS: [[number, number], [number, number]] = [
  [30.8, 117.8],
  [33.2, 119.8]
]

// 反向遮罩：世界外轮廓（Web Mercator 安全范围，避开极点）
const WORLD_RING = [
  [-85, -180],
  [-85, 180],
  [85, 180],
  [85, -180],
  [-85, -180]
]

// 南京市轮廓（作为孔洞，经纬度闭合多边形）
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
  onScaleChange,
  onMarkerTap,
  onLongPress
}: WebMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerLayersRef = useRef<any[]>([])
  const polylineLayerRef = useRef<any>(null)

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
      // 滚轮/双指以鼠标/手指位置为中心缩放
      scrollWheelZoom: true,
      touchZoom: true,
      // 最小缩放可以看到整个南京市，最大可看到街道细节
      minZoom: 10,
      maxZoom: 20,
      // 限制拖动范围，超出南京市后可见蒙版
      maxBounds: PAN_BOUNDS,
      maxBoundsViscosity: 1.0
    })

    // 添加高德瓦片（公开可访问，不依赖校园网）
    L.tileLayer(GAODE_TILE_URL, {
      subdomains: '1234',
      maxZoom: 20,
      minZoom: 10
    }).addTo(map)

    // 南京市外反向遮罩：云雾效果
    L.polygon([WORLD_RING, NANJING_RING], {
      color: 'transparent',
      fillColor: '#e8e8e8',
      fillOpacity: 0.82,
      weight: 0,
      className: 'map-cloud-mask',
      interactive: false
    }).addTo(map)

    // 缩放事件
    map.on('zoomend', () => {
      onScaleChange?.(map.getZoom())
    })

    // 点击事件（模拟长按/创建新标记）
    let pressTimer: ReturnType<typeof setTimeout> | null = null
    map.on('mousedown', (e: any) => {
      pressTimer = setTimeout(() => {
        onLongPress?.(e.latlng.lat, e.latlng.lng)
      }, 600)
    })
    map.on('mouseup', () => {
      if (pressTimer) {
        clearTimeout(pressTimer)
        pressTimer = null
      }
    })
    map.on('mousemove', () => {
      if (pressTimer) {
        clearTimeout(pressTimer)
        pressTimer = null
      }
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

  // 更新标记点
  useEffect(() => {
    if (!mapRef.current) return
    const L = (window as any).L
    const map = mapRef.current

    // 清除旧标记
    markerLayersRef.current.forEach(m => map.removeLayer(m))
    markerLayersRef.current = []

    const SCALE_FOOTPRINT = 16
    const SCALE_AVATAR = 19

    markers.forEach(m => {
      const currentZoom = map.getZoom()
      const isAvatar = currentZoom >= SCALE_AVATAR
      const isFootprint = currentZoom >= SCALE_FOOTPRINT && currentZoom < SCALE_AVATAR

      if (currentZoom < 15) return

      let icon: any

      if (isAvatar && m.author?.avatar_url) {
        // 使用头像作为图标
        icon = L.divIcon({
          className: 'custom-avatar-marker',
          html: `<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid #4A315D;box-shadow:0 2px 6px rgba(0,0,0,0.2);">
            <img src="${m.author.avatar_url}" style="width:100%;height:100%;object-fit:cover;" />
          </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 40]
        })
      } else if (isFootprint) {
        icon = L.divIcon({
          className: 'custom-footprint-marker',
          html: `<div style="width:24px;height:24px;border-radius:50%;background:#B23A48;color:#F9F6F0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;box-shadow:0 2px 4px rgba(0,0,0,0.2);">步</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      } else {
        icon = L.divIcon({
          className: 'custom-dot-marker',
          html: `<div style="width:12px;height:12px;border-radius:50%;background:#4A315D;border:2px solid #F9F6F0;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }

      const marker = L.marker([m.latitude, m.longitude], { icon }).addTo(map)
      marker.on('click', () => {
        onMarkerTap?.(m.id)
      })

      // tooltip
      marker.bindTooltip(m.title, {
        direction: 'top',
        offset: [0, -10],
        className: 'bg-parchment text-violet-deep border border-violet-deep/20 px-2 py-1 rounded-sm shadow-md'
      })

      markerLayersRef.current.push(marker)
    })
  }, [markers, scale])

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
