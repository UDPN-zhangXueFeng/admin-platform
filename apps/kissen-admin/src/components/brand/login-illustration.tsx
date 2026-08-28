'use client';

/**
 * LoginIllustration —— kissen-admin 品牌插画：等距清算立方体。
 *
 * 自 public/login-illustration.svg 内联（LP 06 §2.3：<img> 加载的 SVG 是隔离
 * 文档，解析不了页面 CSS 变量）。颜色绑定 6 个 --illus-* 主题 token，全部带
 * 原蓝系 hex fallback——脱离主题上下文（无 themes 配置的复用方）按原样渲染。
 * 动画类名 ka-* 前缀防全局冲突；保留 prefers-reduced-motion 降级。
 */
export function LoginIllustration() {
  return (
    <svg
      width="720"
      height="560"
      viewBox="0 0 720 560"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `.ka-float-a{animation:ka-float-a 5s ease-in-out infinite}.ka-float-b{animation:ka-float-b 6s ease-in-out infinite}.ka-pulse{animation:ka-pulse 3.2s ease-in-out infinite}.ka-flow{animation:ka-flow 6s linear infinite}@keyframes ka-float-a{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes ka-float-b{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}@keyframes ka-pulse{0%,100%{opacity:.35}50%{opacity:.9}}@keyframes ka-flow{to{stroke-dashoffset:-80}}@media(prefers-reduced-motion:reduce){.ka-float-a,.ka-float-b,.ka-pulse,.ka-flow{animation:none}}`,
        }}
      />
      <defs>
      <linearGradient id="ka-top" x1="0" y1="0" x2="1" y2="1"><stop style={{ 'stopColor': 'var(--illus-soft,#7c9bff)' }}/><stop offset="1" style={{ 'stopColor': 'var(--illus-mid,#4d6be5)' }}/></linearGradient>
      <linearGradient id="ka-side-a" x1="0" y1="0" x2="0" y2="1"><stop stopOpacity=".76" style={{ 'stopColor': 'var(--illus-mid,#6b8ef5)' }}/><stop offset="1" stopOpacity=".36" style={{ 'stopColor': 'var(--illus-deep,#4f5dd8)' }}/></linearGradient>
      <linearGradient id="ka-side-b" x1="0" y1="0" x2="0" y2="1"><stop stopOpacity=".65" style={{ 'stopColor': 'var(--illus-mid,#5b7ee8)' }}/><stop offset="1" stopOpacity=".28" style={{ 'stopColor': 'var(--illus-deep,#3848c8)' }}/></linearGradient>
      <linearGradient id="ka-floor" x1="0" y1="0" x2="1" y2="1"><stop stopOpacity=".44" style={{ 'stopColor': 'var(--illus-soft,#8ba8ff)' }}/><stop offset="1" stopOpacity=".28" style={{ 'stopColor': 'var(--illus-deep,#3848c8)' }}/></linearGradient>
      <filter id="ka-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="14" stdDeviation="10" floodOpacity=".25" style={{ 'floodColor': 'var(--illus-line,#161d55)' }}/></filter>
      </defs>

      <ellipse cx="360" cy="346" rx="312" ry="190" strokeOpacity=".58" strokeWidth="2" style={{ 'stroke': 'var(--illus-deep,#2a3490)' }}/>
      <ellipse className="ka-pulse" cx="360" cy="346" rx="260" ry="151" strokeOpacity=".55" strokeWidth="2" style={{ 'stroke': 'var(--illus-accent,#38f4ee)' }}/>
      <path className="ka-flow" d="M93 354C142 259 247 209 359 209C484 209 593 272 628 372" strokeOpacity=".6" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 12" style={{ 'stroke': 'var(--illus-soft,#7b96f0)' }}/>

      <g opacity=".75">
      <path d="M139 387L247 326L354 387L247 448L139 387Z" fill="url(#ka-floor)" strokeOpacity=".55" style={{ 'stroke': 'var(--illus-deep,#3848b5)' }}/>
      <path d="M247 448V475L139 414V387L247 448Z" fillOpacity=".25" style={{ 'fill': 'var(--illus-deep,#3657db)' }}/>
      <path d="M247 448L354 387V414L247 475V448Z" fillOpacity=".25" style={{ 'fill': 'var(--illus-deep,#2032a8)' }}/>
      <path d="M257 438L365 377L472 438L365 499L257 438Z" fill="url(#ka-floor)" strokeOpacity=".5" style={{ 'stroke': 'var(--illus-deep,#3848b5)' }}/>
      <path d="M365 499V525L257 465V438L365 499Z" fillOpacity=".23" style={{ 'fill': 'var(--illus-deep,#3657db)' }}/>
      <path d="M365 499L472 438V465L365 525V499Z" fillOpacity=".23" style={{ 'fill': 'var(--illus-deep,#2032a8)' }}/>
      <path d="M367 385L475 324L582 385L475 446L367 385Z" fill="url(#ka-floor)" strokeOpacity=".55" style={{ 'stroke': 'var(--illus-deep,#3848b5)' }}/>
      <path d="M475 446V473L367 412V385L475 446Z" fillOpacity=".25" style={{ 'fill': 'var(--illus-deep,#3657db)' }}/>
      <path d="M475 446L582 385V412L475 473V446Z" fillOpacity=".25" style={{ 'fill': 'var(--illus-deep,#2032a8)' }}/>
      </g>

      <g className="ka-float-a" filter="url(#ka-shadow)">
      <path d="M289 117L360 77L431 117L360 158L289 117Z" style={{ 'fill': 'var(--illus-line,#172065)' }}/>
      <path d="M297 117L360 82L423 117L360 153L297 117Z" fill="url(#ka-top)" strokeWidth="2" style={{ 'stroke': 'var(--illus-soft,#8ba5ff)' }}/>
      <path d="M289 117L360 158V276L289 235V117Z" fill="url(#ka-side-a)" strokeWidth="3" style={{ 'stroke': 'var(--illus-deep,#2d3890)' }}/>
      <path d="M431 117L360 158V276L431 235V117Z" fill="url(#ka-side-b)" strokeWidth="3" style={{ 'stroke': 'var(--illus-deep,#2d3890)' }}/>
      <path d="M300 232L360 267L420 232L360 198L300 232Z" fillOpacity=".28" style={{ 'fill': 'var(--illus-mid,#5b7ed8)' }}/>
      <path d="M320 223L360 246L400 223L360 200L320 223Z" fillOpacity=".22" style={{ 'fill': 'var(--illus-soft,#7b9eff)' }}/>
      </g>

      <g className="ka-float-b" filter="url(#ka-shadow)">
      <path d="M103 245L174 204L245 245L174 286L103 245Z" style={{ 'fill': 'var(--illus-line,#172065)' }}/>
      <path d="M111 245L174 209L237 245L174 281L111 245Z" fill="url(#ka-top)" strokeWidth="2" style={{ 'stroke': 'var(--illus-soft,#8ba5ff)' }}/>
      <path d="M103 245L174 286V395L103 354V245Z" fill="url(#ka-side-a)" strokeWidth="3" style={{ 'stroke': 'var(--illus-deep,#2d3890)' }}/>
      <path d="M245 245L174 286V395L245 354V245Z" fill="url(#ka-side-b)" strokeWidth="3" style={{ 'stroke': 'var(--illus-deep,#2d3890)' }}/>
      <path d="M113 351L174 386L235 351L174 316L113 351Z" fillOpacity=".27" style={{ 'fill': 'var(--illus-mid,#6b8ee5)' }}/>
      </g>

      <g className="ka-float-b" filter="url(#ka-shadow)">
      <path d="M475 245L546 204L617 245L546 286L475 245Z" style={{ 'fill': 'var(--illus-line,#172065)' }}/>
      <path d="M483 245L546 209L609 245L546 281L483 245Z" fill="url(#ka-top)" strokeWidth="2" style={{ 'stroke': 'var(--illus-soft,#8ba5ff)' }}/>
      <path d="M475 245L546 286V395L475 354V245Z" fill="url(#ka-side-a)" strokeWidth="3" style={{ 'stroke': 'var(--illus-deep,#2d3890)' }}/>
      <path d="M617 245L546 286V395L617 354V245Z" fill="url(#ka-side-b)" strokeWidth="3" style={{ 'stroke': 'var(--illus-deep,#2d3890)' }}/>
      <path d="M485 351L546 386L607 351L546 316L485 351Z" fillOpacity=".27" style={{ 'fill': 'var(--illus-mid,#6b8ee5)' }}/>
      </g>

      <g className="ka-float-a" filter="url(#ka-shadow)">
      <path d="M289 328L360 287L431 328L360 369L289 328Z" style={{ 'fill': 'var(--illus-line,#172065)' }}/>
      <path d="M297 328L360 292L423 328L360 364L297 328Z" fill="url(#ka-top)" strokeWidth="2" style={{ 'stroke': 'var(--illus-soft,#8ba5ff)' }}/>
      <path d="M289 328L360 369V458L289 417V328Z" fill="url(#ka-side-a)" strokeWidth="3" style={{ 'stroke': 'var(--illus-deep,#2d3890)' }}/>
      <path d="M431 328L360 369V458L431 417V328Z" fill="url(#ka-side-b)" strokeWidth="3" style={{ 'stroke': 'var(--illus-deep,#2d3890)' }}/>
      <path d="M301 414L360 448L419 414L360 380L301 414Z" fillOpacity=".27" style={{ 'fill': 'var(--illus-mid,#6b8ee5)' }}/>
      </g>

      <g style={{ 'fill': 'var(--illus-soft,#9cb0ff)' }}>
      <circle className="ka-pulse" cx="82" cy="354" r="5"/><circle className="ka-pulse" cx="638" cy="372" r="5"/><circle className="ka-pulse" cx="360" cy="77" r="5"/>
      </g>
    </svg>
  );
}
