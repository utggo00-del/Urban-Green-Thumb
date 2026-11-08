// index10.html 만들기: 서버 없이 더블클릭으로 열 수 있도록 JS·CSS·이미지를 HTML 파일 하나에 모두 넣는다.
// (file://로 열면 브라우저가 외부 모듈 스크립트를 막기 때문에, 코드 분할 없이 한 덩어리로 빌드해 인라인한다.)
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'dist-single');

await build({
  root,
  configFile: join(root, 'vite.config.ts'),
  logLevel: 'warn',
  build: {
    outDir,
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER, // 이미지도 data URI로
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 4096, // 한 파일로 묶으므로 크기 경고는 끈다
    rolldownOptions: { output: { codeSplitting: false } }, // 지도(Leaflet)도 한 파일에
  },
});

const assets = join(outDir, 'assets');
const files = readdirSync(assets);
const read = (ext) => files.filter((f) => f.endsWith(ext)).map((f) => readFileSync(join(assets, f), 'utf8'));
const js = read('.js');
const css = read('.css');
if (js.length !== 1) throw new Error(`JS 파일이 하나여야 합니다: ${files.join(', ')}`);

let html = readFileSync(join(outDir, 'index.html'), 'utf8')
  .replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>\s*/g, '')
  .replace(/<link rel="stylesheet"[^>]*>\s*/g, '')
  .replace(/<link rel="modulepreload"[^>]*>\s*/g, '');

// 본문 뒤에 스크립트를 넣는다 (#root가 먼저 있어야 한다). "</script" 문자열은 HTML 파서가 끊지 않게 바꾼다.
const style = `<style>\n${css.join('\n')}\n</style>\n`;
const script = `<script type="module">\n${js[0].replace(/<\/script/gi, '<\\/script')}\n</script>\n`;
// 함수로 넘겨야 번들 안의 "$&"·"$'" 같은 문자열이 치환 패턴으로 해석되지 않는다.
html = html.replace('</head>', () => `${style}</head>`).replace('</body>', () => `${script}</body>`);

writeFileSync(join(root, 'index10.html'), html);
rmSync(outDir, { recursive: true, force: true });
console.log(`index10.html 생성 완료 (${Math.round(html.length / 1024)}KB)`);
