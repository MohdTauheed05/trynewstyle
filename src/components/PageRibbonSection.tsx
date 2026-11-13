import React, { useEffect, useRef } from 'react';

interface PageRibbonSectionProps {
  shopName: string;
}

const PAGES = [
  { id: 'men-studio', title: "Men's Studio", kicker: '01 / RUNWAY' },
  { id: 'offcut-rail-section', title: '3D Hanger T-Shirts', kicker: '02 / CHROME RAIL' },
  { id: 'ladies-section', title: 'Ladies Collection', kicker: '03 / LOOKBOOK' },
  { id: 'ladies-rail-section', title: '3D Hanger Dresses', kicker: '04 / LADIES RAIL' },
  { id: 'virtual-studio', title: 'Western Model', kicker: '05 / WESTERN WEAR' },
  { id: 'circle-lookbook', title: 'Circle Model Page', kicker: '06 / CIRCLE LOOKBOOK' },
  { id: 'product-collection', title: 'All Products', kicker: '07 / FULL COLLECTION' },
];

export const PageRibbonSection: React.FC<PageRibbonSectionProps> = ({ shopName }) => {
  const stageRef = useRef<HTMLElement | null>(null);
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const phaseRef = useRef(0);
  const wheelRef = useRef(0);
  const dragRef = useRef<{ x: number; phase: number } | null>(null);
  const draggedRef = useRef(false);

  const pages = PAGES;
  const counterRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frame = 0;
    let previousTime = 0;
    let visible = true;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    const updateMotionPreference = () => { reducedMotion = motionQuery.matches; };
    motionQuery.addEventListener?.('change', updateMotionPreference);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) previousTime = 0;
    }, { threshold: 0.05 });
    observer?.observe(stage);

    const animate = (time: number) => {
      frame = requestAnimationFrame(animate);
      if (!visible || document.hidden) {
        previousTime = time;
        return;
      }
      const delta = previousTime ? Math.min(48, time - previousTime) : 16;
      previousTime = time;
      const width = stage.clientWidth || window.innerWidth;
      const height = stage.clientHeight || window.innerHeight;
      const step = Math.min(width * (width < 680 ? 0.34 : 0.21), 380);
      if (!reducedMotion && !dragRef.current) phaseRef.current += delta * 0.00028;
      phaseRef.current += wheelRef.current;
      wheelRef.current *= 0.86;
      if (Math.abs(wheelRef.current) < 0.0001) wheelRef.current = 0;

      const count = pages.length;
      phaseRef.current = ((phaseRef.current % count) + count) % count;
      const activeIndex = ((Math.round(phaseRef.current) % count) + count) % count;
      if (counterRef.current) counterRef.current.textContent = String(activeIndex + 1).padStart(2, '0') + ' / ' + String(count).padStart(2, '0');
      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const half = count / 2;
        const relative = ((((index - phaseRef.current + half) % count) + count) % count) - half;
        const distance = Math.abs(relative);
        const x = width / 2 + relative * step;
        const float = Math.sin(time * 0.0015 + index * 1.37) * 9;
        const y = height * 0.55 + Math.sin(relative * 0.72) * Math.min(62, height * 0.08) + float;
        const z = -Math.min(distance, 4) * 82;
        const rotateY = relative * -14;
        const rotateZ = Math.sin(relative * 0.6) * -2.8 + Math.sin(time * 0.001 + index) * 0.4;
        const scale = 1 - Math.min(distance, 4) * 0.085;
        const opacity = Math.max(0.36, 1 - Math.max(0, distance - 2.4) * 0.23);
        card.style.transform = 'translate3d(' + x + 'px,' + y + 'px,' + z + 'px) translate(-50%,-50%) rotateY(' + rotateY + 'deg) rotateZ(' + rotateZ + 'deg) scale(' + scale + ')';
        card.style.zIndex = String(100 - Math.round(distance * 10));
        card.style.opacity = String(opacity);
      });
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      motionQuery.removeEventListener?.('change', updateMotionPreference);
    };
  }, [pages.length]);

  const handleWheel = (event: React.WheelEvent<HTMLElement>) => {
    wheelRef.current += (event.deltaY || event.deltaX) / 380 * 0.34;
  };
  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    dragRef.current = { x: event.clientX, phase: phaseRef.current };
    draggedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add('is-dragging');
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    const distance = event.clientX - dragRef.current.x;
    if (Math.abs(distance) > 5) draggedRef.current = true;
    const stageWidth = stageRef.current?.clientWidth || window.innerWidth;
    const step = Math.min(stageWidth * (stageWidth < 680 ? 0.34 : 0.21), 380);
    phaseRef.current = dragRef.current.phase - distance / step;
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    dragRef.current = null;
    event.currentTarget.classList.remove('is-dragging');
    window.setTimeout(() => { draggedRef.current = false; }, 0);
  };
  return (
    <section className="page-ribbon" id="page-ribbon" aria-label={shopName + ' page previews'}>
      <div className="pr-stage" ref={stageRef} onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
        <div className="pr-noise" aria-hidden="true" />
        <header className="pr-topline">
          <span><i /> {shopName.toUpperCase()} · PAGE INDEX</span>
          <span>DRAG OR SCROLL TO EXPLORE</span>
        </header>
        <div className="pr-headline" aria-hidden="true"><span>THE STYLE</span><span>UNIVERSE</span></div>
        <p className="pr-intro">Every page. Every look. One collection.</p>
        <div className="pr-orbit pr-orbit-one" aria-hidden="true" />
        <div className="pr-orbit pr-orbit-two" aria-hidden="true" />
        <div className="pr-cards">
          {pages.map((page, index) => (
            <a
              key={page.id}
              ref={(node) => { cardRefs.current[index] = node; }}
              className="pr-card"
              href={'#' + page.id}
              onClick={(event) => {
                if (draggedRef.current) {
                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }
                event.preventDefault();
                const target = document.getElementById(page.id);
                if (!target) return;
                const headerHeight = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;
                window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - headerHeight - 8, behavior: 'smooth' });
              }}
              aria-label={'Open ' + page.title}
            >
              <div className="pr-browser-bar">
                <span className="pr-window-dots"><i /><i /><i /></span>
                <span className="pr-address">{page.title}</span>
                <span className="pr-browser-icons">⌕　◻</span>
              </div>
              <div className="pr-frame">
                <iframe
                  src={'/?pagePreview=' + encodeURIComponent(page.id)}
                  title={page.title + ' page preview'}
                  loading="lazy"
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{ pointerEvents: 'none' }}
                />
              </div>
              <div className="pr-card-copy"><span>{page.kicker}</span><strong>{page.title}</strong><b aria-hidden="true">↗</b></div>
            </a>
          ))}
        </div>
        <div className="pr-caption">
          <span>CONTINUOUS PAGE TOUR</span>
          <span ref={counterRef}>01 / 07</span>
        </div>
        <div className="pr-progress"><span /></div>
      </div>
    </section>
  );
};
