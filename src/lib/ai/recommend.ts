// 텃밭 추천 도우미 (SPEC 9-1). 규칙 기반 점수 계산이며, 같은 입력이면 항상 같은 결과가 나온다.
// 실제 AI 모델로 바꾸더라도 화면은 이 결과 형태(HelperResult)만 알면 된다.
import { DONG_CENTERS, FACILITY_LABELS } from '../../config';
import { currentSeasonKey, isPublished } from '../../data/selectors';
import type { Db, FacilityKey, Garden, SeasonName } from '../../types';
import { CROPS, DIFFICULTY_LABEL, type Crop, type CropGroup } from './crops';
import { gardenApplyBlock } from '../application';
import { toGardenView } from '../gardens';

export type Transport = '도보' | '대중교통' | '자가용' | '휠체어·보행 보조';
export type Experience = '처음이에요' | '조금 해봤어요' | '경험이 많아요';

export interface HelperInput {
  /** 거주 행정동 */
  dong: string;
  transport: Transport;
  experience: Experience;
  /** 관심 작물 종류 */
  interests: CropGroup[];
  /** true면 이용료가 없는 텃밭만 추천 */
  freeOnly: boolean;
}

export interface GardenPick {
  gardenId: string;
  name: string;
  score: number;
  /** 집에서 텃밭까지 직선거리(km) */
  distanceKm: number;
  reasons: string[];
  cautions: string[];
  /** 지금 신청 가능한지(모집 중) */
  recruiting: boolean;
}

export interface CropPick {
  crop: Crop;
  reasons: string[];
}

export interface HelperResult {
  season: SeasonName;
  gardens: GardenPick[];
  crops: CropPick[];
  /** 추천 후보가 모집 중인 텃밭이 아니라 지정 텃밭 전체였는지 */
  fallbackToPublished: boolean;
  /** 조건에 맞는 텃밭이 없을 때의 안내 */
  message?: string;
}

/** 두 지점 사이 직선거리(km, 하버사인) */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const fmtKm = (km: number) => (km < 1 ? `${Math.max(1, Math.round(km * 10) * 100)}m` : `${km.toFixed(1)}km`);

interface Scored {
  garden: Garden;
  score: number;
  km: number;
  reasons: string[];
  cautions: string[];
  recruiting: boolean;
}

function scoreGarden(db: Db, g: Garden, input: HelperInput, home: [number, number] | undefined, recruiting: boolean): Scored {
  const reasons: string[] = [];
  const cautions: string[] = [];
  let score = 30; // 기본점
  const km = home ? distanceKm(home, [g.lat, g.lng]) : 5;

  // ① 거리 (0~40점). 걸어서 다니는 분·보행 보조가 필요한 분은 거리를 더 무겁게 본다.
  const near = input.transport === '도보' || input.transport === '휠체어·보행 보조';
  const limits = near ? [1, 2, 3.5, 6] : input.transport === '자가용' ? [3, 6, 10, 15] : [1.5, 3, 5, 8];
  const distScore = km <= limits[0] ? 40 : km <= limits[1] ? 32 : km <= limits[2] ? 22 : km <= limits[3] ? 12 : 4;
  score += distScore;
  if (g.dong === input.dong) {
    score += 6;
    reasons.push(`같은 ${g.dong}이라 가까워요 (약 ${fmtKm(km)})`);
  } else if (distScore >= 32) {
    reasons.push(`가까운 편이에요 (약 ${fmtKm(km)})`);
  } else if (distScore <= 12) {
    cautions.push(`집에서 조금 멀어요 (약 ${fmtKm(km)})`);
  }

  // ② 이동수단과 시설
  const has = (f: FacilityKey) => g.facilities.includes(f);
  if (input.transport === '자가용') {
    if (has('parking')) {
      score += 10;
      reasons.push('주차 공간이 있어요');
    } else cautions.push('주차 공간 정보가 없어요');
  }
  if (input.transport === '휠체어·보행 보조') {
    if (has('wheelchair')) {
      score += 22;
      reasons.push('휠체어 접근이 가능해요');
    } else {
      score -= 25;
      cautions.push(`${FACILITY_LABELS.wheelchair} 시설이 없어요`);
    }
    if (has('restroom')) {
      score += 4;
      reasons.push('화장실이 있어요');
    }
  }
  if (has('water')) score += 4;

  // ③ 경험
  if (input.experience === '처음이에요') {
    if (g.ordinanceType === '상자텃밭' || g.ordinanceType === '학습·생태체험텃밭') {
      score += 8;
      reasons.push(`${g.ordinanceType}이라 처음 시작하기 좋아요`);
    }
    if (g.plotAreaM2 <= 11) {
      score += 6;
      reasons.push(`구획이 작아(${g.plotAreaM2}㎡) 관리 부담이 적어요`);
    }
    if (has('water') && has('toolShed')) {
      score += 6;
      reasons.push('급수 시설과 농기구함이 있어요');
    } else if (!has('water')) cautions.push('급수 시설이 없어 물을 직접 챙겨야 해요');
  } else if (input.experience === '경험이 많아요' && g.plotAreaM2 >= 13) {
    score += 6;
    reasons.push(`구획이 넉넉해요(${g.plotAreaM2}㎡)`);
  }

  // ④ 이용료
  if (g.fee === 0) {
    score += input.freeOnly ? 15 : 6;
    reasons.push('이용료가 없어요');
  } else if (input.freeOnly) {
    score -= 40;
    cautions.push(`이용료가 있어요 (${g.fee.toLocaleString('ko-KR')}원/시즌)`);
  }

  // ⑤ 경쟁 정도 (지금 모집 중일 때만)
  if (recruiting) {
    const v = toGardenView(db, g);
    if (v.recruitment) {
      if (v.applicants <= v.recruitment.plotsOffered) {
        score += 8;
        reasons.push('지금까지 신청이 모집 구획보다 적어 당첨 가능성이 높아요');
      } else if (v.applicants > v.recruitment.plotsOffered * 2) {
        cautions.push(`경쟁이 치열해요 (신청 ${v.applicants}명 / 모집 ${v.recruitment.plotsOffered}구획)`);
      }
    }
  } else {
    cautions.push('지금은 모집하지 않는 텃밭이에요');
  }

  return { garden: g, score: Math.max(0, Math.min(100, Math.round(score))), km, reasons, cautions, recruiting };
}

/** 이번 시즌에 어울리는 작물: 관심 종류·경험 수준에 맞춰 고른다 */
export function recommendCrops(season: SeasonName, input: Pick<HelperInput, 'interests' | 'experience'>, limit = 4): CropPick[] {
  const maxDifficulty = input.experience === '처음이에요' ? 1 : input.experience === '조금 해봤어요' ? 2 : 3;
  return CROPS.filter((c) => c.seasons.includes(season) && c.difficulty <= maxDifficulty)
    .map((c) => {
      const reasons: string[] = [];
      let s = 10 - c.difficulty * 2;
      if (input.interests.includes(c.group)) {
        s += 10;
        reasons.push(`관심 있는 ${c.group}이에요`);
      }
      reasons.push(`${season}에 심기 좋고 재배 난이도는 “${DIFFICULTY_LABEL[c.difficulty]}”이에요`);
      return { crop: c, reasons, s };
    })
    .sort((a, b) => b.s - a.s || a.crop.difficulty - b.crop.difficulty || a.crop.name.localeCompare(b.crop.name, 'ko'))
    .slice(0, limit)
    .map(({ crop, reasons }) => ({ crop, reasons }));
}

/** 텃밭 추천: 지금 신청할 수 있는 텃밭(모집 중인 지정 텃밭)을 우선하고, 없으면 지정 텃밭 전체에서 고른다. */
export function recommend(db: Db, input: HelperInput, limit = 3): HelperResult {
  const season = currentSeasonKey(db).slice(5) as SeasonName;
  const home = DONG_CENTERS[input.dong];
  const published = db.gardens.filter(isPublished);
  const open = published.filter((g) => gardenApplyBlock(db, g.id) === null);
  const pool = open.length > 0 ? open : published;
  const scored = pool
    .map((g) => scoreGarden(db, g, input, home, open.includes(g)))
    .sort((a, b) => b.score - a.score || a.km - b.km || a.garden.name.localeCompare(b.garden.name, 'ko'))
    .slice(0, limit);

  return {
    season,
    fallbackToPublished: open.length === 0 && published.length > 0,
    crops: recommendCrops(season, input),
    gardens: scored.map((s) => ({ gardenId: s.garden.id, name: s.garden.name, score: s.score, distanceKm: Math.round(s.km * 10) / 10, reasons: s.reasons, cautions: s.cautions, recruiting: s.recruiting })),
    message: published.length === 0 ? '아직 지정된 텃밭이 없어요.' : open.length === 0 ? '지금 모집 중인 텃밭이 없어서 지정된 텃밭 중에서 골랐어요. 모집 일정은 홈에서 확인하세요.' : undefined,
  };
}
