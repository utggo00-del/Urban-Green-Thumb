import { ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Notice } from '../../components/Badge';
import { DEPARTMENT, SERVICE_NAME } from '../../config';
import { usePageTitle } from '../../lib/usePageTitle';

const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: '1. 개인정보를 처리하는 목적',
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>텃밭 분양 신청 접수, 추첨, 결과 안내, 이용 관리(경고·회수 포함)</li>
        <li>텃밭 등록 신청의 서류 검수와 도시농업위원회 심의 진행</li>
        <li>공지·알림 발송과 문의 응대</li>
      </ul>
    ),
  },
  {
    title: '2. 수집하는 개인정보 항목 (최소한만 받아요)',
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>분양 신청자</strong>: 이름, 거주 행정동, 연락처, 우선 배정(다자녀·취약계층·노인) 자기신고 여부
        </li>
        <li>
          <strong>텃밭 제공자</strong>: 이름, 연락처, 텃밭 주소, 이용료 받을 계좌(이용료가 있는 경우), 토지 서류·소유자 동의서
        </li>
        <li>주민등록번호 등 고유식별정보는 받지 않아요. (시연에서는 파일명만 저장하고 파일 내용은 저장하지 않아요)</li>
      </ul>
    ),
  },
  {
    title: '3. 보유 및 이용 기간 (예시)',
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>분양 신청 정보: 해당 시즌 종료 후 1년</li>
        <li>텃밭 등록 서류: 지정 해제 또는 제공 종료 후 1년</li>
        <li>추첨 감사 로그(시각·시드값·결과): 공정성 확인을 위해 3년</li>
      </ul>
    ),
  },
  {
    title: '4. 공개와 제3자 제공',
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>텃밭 소유자의 이름과 연락처는 시민에게 공개하지 않아요. 문의는 “앱 내 문의”로 연결돼요.</li>
        <li>제공자의 이용료 계좌는 <strong>당첨 후 수락한 이용자에게만</strong> “내 텃밭”에서 보여줘요. 이용료는 제공자에게 직접 송금하며 시는 결제에 관여하지 않아요.</li>
        <li>위원회 심의위원에게는 소유자 이름 일부만 가려서 보여주고, 이용자의 개인정보·추첨·경고 화면은 볼 수 없어요.</li>
        <li>법령에 근거가 있는 경우를 빼고 수집한 정보를 외부에 제공하지 않아요.</li>
      </ul>
    ),
  },
  {
    title: '5. 이용자의 권리',
    body: <p>언제든지 자신의 개인정보를 열람하고 정정·삭제·처리정지를 요구할 수 있어요. {DEPARTMENT}로 요청해 주세요. 본인 확인 후 지체 없이 처리해요.</p>,
  },
  {
    title: '6. 안전성 확보 조치 (예시)',
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>역할에 따른 접근 권한 분리(시민·제공자·관리자·심의위원)</li>
        <li>개인정보 처리 담당자 최소화와 접근 기록 관리</li>
        <li>추첨 실행·폐기 등 주요 작업의 감사 로그 보관</li>
      </ul>
    ),
  },
  {
    title: '7. 개인정보 보호 책임 부서',
    body: <p>{DEPARTMENT} · 문의: 시흥시 대표전화(시연용 예시)</p>,
  },
];

export default function Privacy() {
  usePageTitle('개인정보 처리방침');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <ShieldCheck aria-hidden className="size-7 text-leaf-700" /> 개인정보 처리방침
        </h1>
        <p className="muted">{SERVICE_NAME} · 운영·개인정보 책임 부서 {DEPARTMENT}</p>
      </div>

      <Notice tone="warn">
        <p className="font-bold">이 문서는 예시 문구예요.</p>
        <p className="text-sm">
          대회 출품용 프로토타입이라 실제 처리방침이 아니에요. 이용자·제공자·위원의 이름·연락처·계좌는 <strong>가상 데이터</strong>예요. “시흥시 실제 운영 텃밭”의 농장 이름·전화번호·홈페이지만 공개된 출처에서 가져온 실제 정보예요. 입력한 내용은 이 브라우저(localStorage)에만 저장되고 서버로 전송되지 않아요. 실제 개인정보는 입력하지 마세요.
        </p>
      </Notice>

      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <section key={s.title} className="card space-y-2">
            <h2 className="text-lg font-extrabold">{s.title}</h2>
            {s.body}
          </section>
        ))}
      </div>
    </div>
  );
}
