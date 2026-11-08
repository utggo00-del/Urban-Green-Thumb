// 지도: Leaflet + OpenStreetMap 타일(API 키 불필요).
// 실서비스에서는 카카오맵으로 교체 예정 — 이 컴포넌트만 바꾸면 되도록 props를 단순하게 유지했다.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { Notice } from './Badge';
import type { GardenView } from '../lib/gardens';
import type { RealFarm } from '../data/realFarms';

/** 시흥시청 부근 */
const SIHEUNG_CENTER: L.LatLngTuple = [37.38, 126.8];
const KIND_LETTER = { 공공: '공', 민간: '민', 개인: '개' } as const;

interface Props {
  items: GardenView[];
  /** 앱 밖에서 실제 운영 중인 텃밭 (모양·색이 다른 '실' 마커) */
  farms?: RealFarm[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** 상세 화면처럼 텃밭 1곳을 크게 보여줄 때 */
  zoomToSingle?: boolean;
  className?: string;
  label?: string;
}

export default function GardenMap({ items, farms = [], selectedId, onSelect, zoomToSingle, className = 'h-[26rem]', label = '텃밭 위치 지도' }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [tileFailed, setTileFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // 지도 생성 (StrictMode의 이중 실행에도 안전하도록 cleanup에서 제거)
  useEffect(() => {
    const m = L.map(el.current!, { center: SIHEUNG_CENTER, zoom: 12, scrollWheelZoom: false });
    const osm = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자';
    const layers = {
      '기본 지도': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: osm }),
      '기본 지도(독일 서버)': L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', { maxZoom: 18, attribution: `${osm} · 타일 openstreetmap.de` }),
      지형도: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: `${osm} · 지도 스타일 &copy; OpenTopoMap (CC-BY-SA)` }),
    };
    for (const t of Object.values(layers)) t.on('tileerror', () => setTileFailed(true));
    // index10.html처럼 파일로 열면(file://) 요청에 사이트 주소(Referer)가 없어 openstreetmap.org가 "Access blocked" 타일을 보낼 수 있다.
    // 그래서 파일로 열 때는 이런 요청도 받아 주는 독일 OSM 서버를 기본으로 쓴다. 안 보이면 오른쪽 위에서 다른 지도를 고를 수 있다.
    (location.protocol === 'file:' ? layers['기본 지도(독일 서버)'] : layers['기본 지도']).addTo(m);
    L.control.layers(layers, undefined, { position: 'topright' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  // 마커 갱신
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const v of items) {
      const { garden } = v;
      const icon = L.divIcon({
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        html: `<span class="garden-pin" data-kind="${garden.type}" data-selected="${garden.id === selectedId}" aria-hidden="true">${KIND_LETTER[garden.type]}</span>`,
      });
      L.marker([garden.lat, garden.lng], { icon, title: `${garden.name} (${garden.type} 텃밭)`, keyboard: true })
        .on('click', () => onSelectRef.current?.(garden.id))
        .addTo(g);
    }
    for (const f of farms) {
      const icon = L.divIcon({
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        html: `<span class="garden-pin" data-kind="실제" data-selected="${f.id === selectedId}" aria-hidden="true">실</span>`,
      });
      L.marker([f.lat, f.lng], { icon, title: `${f.name} (실제 운영 텃밭)`, keyboard: true })
        .on('click', () => onSelectRef.current?.(f.id))
        .addTo(g);
    }
  }, [items, farms, selectedId]);

  // 보이는 범위 조정: 목록이 바뀔 때만 (선택이 바뀔 때는 화면을 움직이지 않는다)
  const points: L.LatLngTuple[] = [...items.map((v) => [v.garden.lat, v.garden.lng] as L.LatLngTuple), ...farms.map((f) => [f.lat, f.lng] as L.LatLngTuple)];
  const key = [...items.map((v) => v.garden.id), ...farms.map((f) => f.id)].join(',');
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (points.length === 0) m.setView(SIHEUNG_CENTER, 12);
    else if (zoomToSingle && points.length === 1) m.setView(points[0], 15);
    else m.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 });
    // items 자체가 아니라 id 목록이 바뀔 때만 다시 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, zoomToSingle]);

  return (
    <div className="space-y-2">
      <div ref={el} role="region" aria-label={label} className={`z-0 w-full overflow-hidden rounded-xl border border-soil-200 ${className}`} />
      {tileFailed && (
        <Notice tone="warn">
          <p className="font-bold">지도 배경을 불러오지 못했어요.</p>
          <p className="text-sm">인터넷 연결을 확인하거나 “목록 보기”를 이용해 주세요. 텃밭 정보는 목록에서 모두 볼 수 있어요.</p>
        </Notice>
      )}
    </div>
  );
}
