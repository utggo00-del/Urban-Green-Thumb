// 지도: Leaflet + OpenStreetMap 타일(API 키 불필요).
// 실서비스에서는 카카오맵으로 교체 예정 — 이 컴포넌트만 바꾸면 되도록 props를 단순하게 유지했다.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { Notice } from './Badge';
import type { GardenView } from '../lib/gardens';

/** 시흥시청 부근 */
const SIHEUNG_CENTER: L.LatLngTuple = [37.38, 126.8];
const KIND_LETTER = { 공공: '공', 민간: '민', 개인: '개' } as const;

interface Props {
  items: GardenView[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** 상세 화면처럼 텃밭 1곳을 크게 보여줄 때 */
  zoomToSingle?: boolean;
  className?: string;
  label?: string;
}

export default function GardenMap({ items, selectedId, onSelect, zoomToSingle, className = 'h-[26rem]', label = '텃밭 위치 지도' }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [tileFailed, setTileFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // 지도 생성 (StrictMode의 이중 실행에도 안전하도록 cleanup에서 제거)
  useEffect(() => {
    const m = L.map(el.current!, { center: SIHEUNG_CENTER, zoom: 12, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자',
    })
      .on('tileerror', () => setTileFailed(true))
      .addTo(m);
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
  }, [items, selectedId]);

  // 보이는 범위 조정: 목록이 바뀔 때만 (선택이 바뀔 때는 화면을 움직이지 않는다)
  const key = items.map((v) => v.garden.id).join(',');
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (items.length === 0) m.setView(SIHEUNG_CENTER, 12);
    else if (zoomToSingle && items.length === 1) m.setView([items[0].garden.lat, items[0].garden.lng], 15);
    else m.fitBounds(L.latLngBounds(items.map((v) => [v.garden.lat, v.garden.lng] as L.LatLngTuple)), { padding: [48, 48], maxZoom: 14 });
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
