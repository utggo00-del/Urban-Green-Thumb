import { ExternalLink, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Notice } from '../../components/Badge';
import { COMMITTEE_RULES, DEPARTMENT, ORDINANCE } from '../../config';
import { useDb } from '../../data/useDb';
import { usePageTitle } from '../../lib/usePageTitle';

// 조례 원문(시행 2025. 10. 2., 조례 제2528호)을 읽고 요약했다. 원문을 그대로 옮기지는 않으며, 정확한 문구는 원문을 확인해야 한다.
const ARTICLES: { no: string; title: string; summary: string; feature: string; to?: string; toLabel?: string }[] = [
  {
    no: '제2조',
    title: '정의',
    summary:
      '도시농업, 도시텃밭, 상자텃밭, 학습·생태체험텃밭, 친환경 농법, 도시텃밭운영자 등의 뜻을 정합니다. 상자텃밭은 상자에 흙을 담아 만든 텃밭이고, 학습·생태체험텃밭은 학교·기관이 학습·교육 목적으로 운영하는 텃밭이에요. 도시텃밭운영자는 「농어촌정비법」에 따른 주말농원사업자예요.',
    feature: '텃밭 찾기의 “조례상 유형” 필터·배지, 텃밭 등록 신청의 유형 선택, 민간 텃밭의 주말농원사업자(도시텃밭운영자) 여부 표시',
    to: '/gardens',
    toLabel: '텃밭 찾기',
  },
  {
    no: '제3조',
    title: '기본원칙',
    summary: '도시농업에 참여하는 경작자는 친환경 농법(합성농약·화학비료·화학자재를 쓰지 않는 농법)으로 경작해야 해요.',
    feature: '기본 이용 규칙의 “유기농 원칙”, 초보 농부 안내와 추천 작물의 친환경 재배 팁',
  },
  {
    no: '제4조',
    title: '위원회 구성',
    summary: `도시농업위원회는 위원장 1명·부위원장 1명을 포함해 ${COMMITTEE_RULES.maxMembers}명 이내로 구성해요. 시의회 추천 1명, 농업기술센터 소장(당연직), 도시농업 관련 기관·단체 임직원, 학식과 경험이 풍부한 사람, 그 밖에 시장이 필요하다고 인정하는 사람 중에서 시장이 위촉하고, 위원장·부위원장은 위원 중에서 호선해요. 임기는 ${COMMITTEE_RULES.termYears}년이며 연임할 수 있어요.`,
    feature: '위원회 관리의 위원 명단(15명 이내, 구성 분류, 임기)',
  },
  {
    no: '제5조',
    title: '위원회의 기능',
    summary: '위원회는 ① 도시농업 활성화·지원 계획의 수립과 변경 ② 도시텃밭 지정과 상자텃밭 등의 보급 ③ 도시농업의 과제 발굴과 대안 제시 ④ 그 밖에 도시농업 활성화에 관한 사항을 심의해요.',
    feature: '모든 등록 텃밭은 실무 검수 후 위원회 심의를 거쳐 “지정”되어야 공개·모집할 수 있음. 안건 유형(도시텃밭 지정, 상자텃밭 보급, 계획 수립·변경, 기타)',
    to: '/admin/committee',
    toLabel: '위원회 관리(간사)',
  },
  {
    no: '제6조',
    title: '위원장의 직무',
    summary: '위원장은 위원회를 대표하고 업무를 총괄해요. 위원장이 부득이하면 부위원장이, 둘 다 어려우면 위원장이 미리 지명한 위원이 직무를 대행해요.',
    feature: '회의 출석 화면의 주재자 표시(위원장 부재 시 부위원장 직무 대행). 지명 위원 대행은 프로토타입에서 다루지 않아요.',
  },
  {
    no: '제8조',
    title: '회의',
    summary: `위원장이 회의를 소집하고 의장이 돼요. 정례회의는 상반기·하반기로 나누어 연 ${COMMITTEE_RULES.regularMeetingsPerYear}회 열고, 위원장이 필요하다고 인정할 때도 소집해요. 재적위원 과반수 출석으로 개회하고 출석위원 과반수 찬성으로 의결해요.`,
    feature: '회의 등록(회차는 연도별 자동 부여), 개회 요건·가결 요건 자동 판정, 요건 미달 시 의결 차단, 의결 후 수정 잠금',
    to: '/admin/committee',
    toLabel: '위원회 관리(간사)',
  },
  {
    no: '제9조',
    title: '간사',
    summary: '위원회의 사무를 처리할 간사 1명을 두며, 간사는 도시농업 업무 담당 주무관이 맡아요.',
    feature: '관리자 중 “위원회 간사” 계정만 회의·안건·의결을 다룰 수 있음 (부서명 “텃밭지원과”는 이 앱의 가칭)',
  },
  {
    no: '제11조',
    title: '도시텃밭의 조성',
    summary: '시 소유 유휴지, 공공기관의 유휴 공간, 그 밖에 소유자의 동의를 구한 토지·공간에 위원회의 심의를 거쳐 도시텃밭을 조성하고 경작활동을 지원할 수 있어요.',
    feature: '공공·민간·개인 텃밭 공통 등록 절차, 소유자 동의서 첨부 필수, “위원회 심의 완료(○년 제○회, 일자)” 배지',
    to: '/register',
    toLabel: '텃밭 등록 신청',
  },
  {
    no: '제12조 제2항',
    title: '상자텃밭 참여자의 관리 의무',
    summary: '상자텃밭 참여자는 텃밭 관리를 소홀히 하거나 방치해 도시 미관을 해치지 않도록 주의해야 해요. 방치했을 때의 회수 기준(경고 횟수 등)은 조례에 정해져 있지 않아요.',
    feature: '미경작 점검 → 경고 → 3회 누적 시 회수. 이 취지를 참고한 운영지침 사항이에요. (아래 표 참고)',
  },
  {
    no: '제17조',
    title: '시행규칙',
    summary: '이 조례의 시행에 필요한 사항은 규칙으로 정해요. 아래의 신청 자격·추첨·이용료·회수 같은 세부 정책이 조례에 없는 이유예요.',
    feature: '“조례에 규정이 없는 정책”은 모두 설정값으로 분리했고, 실제 도입 시 시행규칙 또는 운영지침 확인이 필요해요.',
  },
];

export default function Ordinance() {
  usePageTitle('근거 조례');
  const db = useDb();
  const s = db.settings;
  const pct = Math.round(s.priorityQuotaRatio * 100);

  const policies: [string, string][] = [
    ['신청 자격', s.residentOnly ? '시흥시민만 신청 가능 (거주지가 시흥시인 경우)' : '거주지 제한 없음'],
    ['분양 방식', '추첨제 (희망 텃밭 지망 순위는 최대 ' + s.maxChoices + '곳)'],
    ['우선 배정', `다자녀·취약계층·노인은 전체 구획의 ${pct}%(정책에 따라 조정 가능)를 먼저 추첨하며, 당첨 확률을 높이는 가중치는 없음`],
    ['민간·개인 텃밭 이용료', '당첨자가 제공자의 등록 계좌로 직접 송금. 앱은 표시만 하고 결제·정산에 관여하지 않음'],
    ['미경작 텃밭 회수', `경고 ${s.warningLimit}회 누적 시 회수`],
    ['모집 주기', `연 2회 — 봄 ${s.seasonWindows.봄.startMonth}~${s.seasonWindows.봄.endMonth}월, 가을 ${s.seasonWindows.가을.startMonth}~${s.seasonWindows.가을.endMonth}월 (위원회 심의를 통과한 텃밭만 모집)`],
    ['당첨 수락 기한', `${s.acceptDeadlineDays}일 (기한이 지나면 대기자에게 승계)`],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <Scale aria-hidden className="size-7 text-leaf-700" /> 근거 조례
        </h1>
        <p className="mt-1 text-lg font-bold">
          「{ORDINANCE.name}」 ({ORDINANCE.number}, {ORDINANCE.effectiveFrom} 시행)
        </p>
        <p className="muted">
          이 서비스는 위 조례에 따라 <strong>도시텃밭 지정은 도시농업위원회 심의를 거치는</strong> 절차를 화면과 데이터로 구현했어요. 아래는 조례 원문(시행 2025. 10. 2.)을 읽고 정리한 <strong>요약</strong>이며, 정확한 문구는 원문을 확인해 주세요.
        </p>
        <a href={ORDINANCE.lawUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-12 items-center gap-1 font-bold">
          국가법령정보센터에서 원문 보기 <ExternalLink aria-hidden className="size-4" />
          <span className="sr-only">(새 창)</span>
        </a>
        <p className="muted text-sm">링크가 열리지 않으면 국가법령정보센터에서 조례명으로 검색해 주세요.</p>
      </div>

      <section aria-labelledby="articles" className="space-y-3">
        <h2 id="articles" className="text-xl font-bold">
          주요 조문과 앱 기능
        </h2>
        <ul className="space-y-3">
          {ARTICLES.map((a) => (
            <li key={a.no} className="card space-y-2">
              <h3 className="flex flex-wrap items-baseline gap-2 text-lg font-extrabold">
                <span className="rounded bg-leaf-100 px-2 py-0.5 text-leaf-800">조례 {a.no}</span> {a.title}
              </h3>
              <p>{a.summary}</p>
              <p className="rounded-lg bg-soil-100 p-3">
                <span className="font-bold">앱에서는 </span>
                {a.feature}
                {a.to && (
                  <>
                    {' '}
                    → <Link to={a.to}>{a.toLabel}</Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="policy" className="space-y-3">
        <h2 id="policy" className="text-xl font-bold">
          조례에 규정이 없는 정책 (시행규칙·운영지침 사항)
        </h2>
        <Notice tone="warn">
          <p className="font-bold">아래 정책은 조례에 정해져 있지 않아요.</p>
          <p className="text-sm">
            이 앱은 대회 출품용 기획이므로 모두 <strong>설정값</strong>으로 두었고, 실제로 도입하려면 시행규칙 또는 운영지침으로 정해야 해요. 부서명 “{DEPARTMENT}”은 가칭입니다.
          </p>
        </Notice>
        <dl className="card divide-y divide-soil-200 !p-0">
          {policies.map(([k, v]) => (
            <div key={k} className="grid gap-1 p-4 sm:grid-cols-[11rem_1fr]">
              <dt className="font-bold">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="out" className="card space-y-2">
        <h2 id="out" className="text-xl font-bold">
          이번 프로토타입에서 다루지 않는 조항
        </h2>
        <ul className="list-disc pl-5">
          <li>위원 위촉·해촉·수당 지급 (제4조, 제7조, 제10조)</li>
          <li>교육훈련 신청 (제13조)</li>
          <li>전문가 의견 청취(제8조 제4항), 기술 교류·홍보(제14조)</li>
          <li>도시농업 보조금 신청·지급 (제15조)</li>
        </ul>
        <p className="muted text-sm">실서비스에서 연동할 예정입니다.</p>
      </section>
    </div>
  );
}
