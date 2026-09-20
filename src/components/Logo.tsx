import { Link } from 'react-router-dom';
import logoImage from '../assets/logo-haero-toro.jpg';
import { SERVICE_NAME, SERVICE_SHORT_NAME, SERVICE_TAGLINE } from '../config';

/**
 * 텍스트 로고 + 해로·토로 일러스트. title을 넘기지 않으면 앱 이름(참도시농부)과 부제를 보여준다.
 * 이미지는 장식이라 alt를 비우고, 링크의 이름은 글자(또는 aria-label)가 맡는다.
 */
export function Logo({ to = '/', title, sub = '시연' }: { to?: string; title?: string; sub?: string }) {
  const isService = title === undefined;
  return (
    <Link to={to} aria-label={isService ? `${SERVICE_NAME} ${sub} 홈` : undefined} className="flex items-center gap-2.5 text-leaf-800 no-underline">
      <img
        src={logoImage}
        alt=""
        width={320}
        height={200}
        decoding="async"
        fetchPriority="high"
        className="aspect-[8/5] h-[52px] w-auto shrink-0 rounded-xl object-cover ring-1 ring-soil-200 sm:h-[60px]"
      />
      <span className="leading-tight">
        <span className="block text-lg font-extrabold">
          {title ?? SERVICE_SHORT_NAME}
          <span className="ml-1 rounded bg-clay-100 px-1.5 py-0.5 text-sm font-bold text-clay-700">{sub}</span>
        </span>
        {isService && <span className="block text-sm font-bold text-soil-700">{SERVICE_TAGLINE}</span>}
      </span>
    </Link>
  );
}
