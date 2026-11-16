import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Look, Product } from '../types';

interface PageRibbonSectionProps {
  shopName: string;
  looks: Look[];
  products: Product[];
}

type PageItem = {
  id: string;
  title: string;
  kicker: string;
  routeLabel: string;
};

const PAGES: readonly PageItem[] = [
  { id: 'men-studio', title: "Men's Studio", kicker: '01 / RUNWAY', routeLabel: 'trythelook.studio/mens' },
  { id: 'offcut-rail-section', title: '3D Hanger T-Shirts', kicker: '02 / CHROME RAIL', routeLabel: 'trythelook.studio/tees-3d' },
  { id: 'ladies-section', title: 'Ladies Collection', kicker: '03 / LOOKBOOK', routeLabel: 'trythelook.studio/ladies' },
  { id: 'ladies-rail-section', title: 'Maison Verrel — The Rail', kicker: '04 / GOLD RAIL', routeLabel: 'trythelook.studio/the-rail' },
  { id: 'virtual-studio', title: 'Western Model', kicker: '05 / WESTERN WEAR', routeLabel: 'trythelook.studio/western' },
  { id: 'western-orbit-studio', title: 'Virtual Styling Studio', kicker: '06 / WESTERN MODELS', routeLabel: 'trythelook.studio/styling-studio' },
  { id: 'circle-lookbook', title: 'All Looks Runway', kicker: '07 / FULL ARCHIVE', routeLabel: 'trythelook.studio/archive' },
  { id: 'product-collection', title: 'All Products', kicker: '08 / FULL COLLECTION', routeLabel: 'trythelook.studio/collection' },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const PageRibbonSection: React.FC<PageRibbonSectionProps> = ({ shopName }) => {
  const [viewMode, setViewMode] = useState<'circle' | 'flat'>('circle');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const phaseRef = useRef(0);
  const wheelRef = useRef(0);
  const dragRef = useRef<{ x: number; y: number; phase: number } | null>(null);
  const draggedRef = useRef(false);
  const cardHoveredRef = useRef(false);

  const pages = useMemo(() => [...PAGES], []);

  const navigateToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    window.history.pushState(null, '', '#' + sectionId);
    if (target) {
      const headerHeight =
        Number.parseFloat(
          window.getComputedStyle(document.documentElement).getPropertyValue('--header-h')
        ) || 64;
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 4;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  };

  // Load live preview iframes when section enters viewport
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const loadAllPreviews = () => {
      cardRefs.current.forEach((card) => {
        if (!card) return;
        const livePreview = card.querySelector<HTMLIFrameElement>('[data-live-src]');
        if (livePreview && livePreview.dataset.loaded !== 'true') {
          livePreview.src = livePreview.dataset.liveSrc || 'about:blank';
          livePreview.dataset.loaded = 'true';
        }
      });
    };

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              if (entry.isIntersecting) {
                loadAllPreviews();
              }
            },
            { threshold: 0.01 }
          );

    if (observer) observer.observe(stage);
    else loadAllPreviews();

    return () => observer?.disconnect();
  }, []);

  // 3D Rounding Circle animation loop (active only in 'circle' mode)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    if (viewMode === 'flat') {
      // Clear inline 3D orbital transforms so flat CSS layout sits crisp & still
      cardRefs.current.forEach((card) => {
        if (!card) return;
        card.style.transform = '';
        card.style.zIndex = '';
        card.style.opacity = '';
        card.style.filter = '';
      });
      return;
    }

    let frame = 0;
    let previousTime = 0;
    let visible = true;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    const updateMotionPreference = () => {
      reducedMotion = motionQuery.matches;
    };
    motionQuery.addEventListener?.('change', updateMotionPreference);

    const animate = (time: number) => {
      frame = 0;
      if (!visible || document.hidden) {
        previousTime = 0;
        return;
      }

      const delta = previousTime ? Math.min(48, time - previousTime) : 16;
      previousTime = time;
      const width = stage.clientWidth || window.innerWidth;
      const height = stage.clientHeight || window.innerHeight;
      const mobile = width < 720;

      if (!reducedMotion && !dragRef.current && !cardHoveredRef.current) {
        phaseRef.current += delta * 0.00024;
      }
      phaseRef.current += wheelRef.current;
      wheelRef.current *= 0.86;
      if (Math.abs(wheelRef.current) < 0.0001) wheelRef.current = 0;

      const count = pages.length;
      const rx = mobile ? Math.min(width * 0.36, 170) : Math.min(width * 0.34, 490);
      const ry = mobile ? Math.min(height * 0.13, 86) : Math.min(height * 0.16, 130);
      const rz = mobile ? 140 : 320;
      const cx = width / 2;
      const cy = height * (mobile ? 0.58 : 0.56);

      // Determine frontmost card for counter
      let bestFrontIdx = 0;
      let bestCos = -2;

      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const theta = ((index / count) * Math.PI * 2) - phaseRef.current * (Math.PI * 2 / count);
        const sinA = Math.sin(theta);
        const cosA = Math.cos(theta);

        if (cosA > bestCos) {
          bestCos = cosA;
          bestFrontIdx = index;
        }

        // Depth normalization: 1 = frontmost, 0 = backmost
        const depth = (cosA + 1) * 0.5;
        const floatY = reducedMotion ? 0 : Math.sin(time * 0.0018 + index * 1.1) * (mobile ? 3 : 7);

        const x = cx + sinA * rx;
        const y = cy + cosA * ry * 0.52 + floatY;
        const z = cosA * rz - rz * 0.35;
        const scale = (mobile ? 0.56 : 0.6) + (mobile ? 0.38 : 0.42) * depth;
        const rotateY = sinA * (mobile ? -20 : -28);
        const rotateZ = sinA * -2.2;
        const opacity = 0.34 + 0.66 * Math.pow(depth, 0.8);
        const blur = cosA < -0.25 ? Math.min(2.4, (-cosA - 0.25) * 3.2) : 0;

        card.style.transform =
          `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) ` +
          `translate(-50%, -50%) rotateY(${rotateY.toFixed(2)}deg) rotateZ(${rotateZ.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        card.style.zIndex = String(Math.round(depth * 100) + 10);
        card.style.opacity = opacity.toFixed(3);
        card.style.filter = blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : 'none';
      });

      const counter = stage.querySelector<HTMLElement>('.pr-counter');
      if (counter) {
        counter.textContent =
          String(bestFrontIdx + 1).padStart(2, '0') + ' / ' + String(count).padStart(2, '0');
      }

      frame = requestAnimationFrame(animate);
    };

    const start = () => {
      if (!frame && visible && !document.hidden) {
        previousTime = 0;
        frame = requestAnimationFrame(animate);
      }
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    };

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              visible = entry.isIntersecting;
              if (visible) start();
              else stop();
            },
            { threshold: 0.03 }
          );
    const onVisibilityChange = () => (document.hidden ? stop() : start());
    const releaseOutsideStage = () => {
      dragRef.current = null;
      cardHoveredRef.current = false;
      stage.classList.remove('is-dragging');
      window.setTimeout(() => {
        draggedRef.current = false;
      }, 60);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pointerup', releaseOutsideStage);
    window.addEventListener('pointercancel', releaseOutsideStage);
    if (observer) observer.observe(stage);
    else {
      visible = true;
      start();
    }

    return () => {
      stop();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pointerup', releaseOutsideStage);
      window.removeEventListener('pointercancel', releaseOutsideStage);
      motionQuery.removeEventListener?.('change', updateMotionPreference);
    };
  }, [pages.length, viewMode]);

  const handleWheel = (event: React.WheelEvent<HTMLElement>) => {
    if (viewMode !== 'circle') return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) {
      wheelRef.current += clamp(((event.deltaX || event.deltaY) / 380) * 0.36, -0.8, 0.8);
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (viewMode !== 'circle') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragRef.current = { x: event.clientX, y: event.clientY, phase: phaseRef.current };
    draggedRef.current = false;
    stageRef.current?.classList.add('is-dragging');
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (viewMode !== 'circle' || !dragRef.current) return;
    const distanceX = event.clientX - dragRef.current.x;
    const distanceY = event.clientY - dragRef.current.y;
    if (Math.abs(distanceX) > 14 && Math.abs(distanceX) > Math.abs(distanceY)) {
      draggedRef.current = true;
    }
    const width = stageRef.current?.clientWidth || window.innerWidth;
    const step = Math.min(width * (width < 680 ? 0.34 : 0.21), width < 680 ? 150 : 380);
    phaseRef.current = dragRef.current.phase - distanceX / step;
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    stageRef.current?.classList.remove('is-dragging');
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 80);
  };

  const handleCardClick = (event: React.MouseEvent<HTMLAnchorElement>, page: PageItem) => {
    if (draggedRef.current) {
      event.preventDefault();
      event.stopPropagation();
      draggedRef.current = false;
      return;
    }

    // Open the matching section on the first click, whether the cards are orbiting or flat.
    event.preventDefault();
    event.stopPropagation();
    navigateToSection(page.id);
  };

  return (
    <section
      className={`page-ribbon ${viewMode === 'flat' ? 'is-flat' : 'is-circle'}`}
      id="page-ribbon"
      aria-label={shopName + ' page previews'}
    >
      <div
        className={`pr-stage ${viewMode === 'flat' ? 'is-flat' : 'is-circle'}`}
        ref={stageRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="pr-noise" aria-hidden="true" />
        <header className="pr-topline">
          <span>
            <i /> {shopName.toUpperCase()} · PAGE INDEX
          </span>
          <span className="pr-topline-right">
            {viewMode === 'circle'
              ? 'ROUNDING CIRCLE · CLICK ANY PAGE TO OPEN IT'
              : 'FLAT GALLERY VIEW · CLICK ANY CARD TO JUMP TO PAGE'}
          </span>
        </header>

        <div className="pr-headline" aria-hidden="true">
          <span>THE STYLE</span>
          <span>UNIVERSE</span>
        </div>
        <p className="pr-intro">
          {viewMode === 'circle'
            ? 'Every page orbiting in 3D · Click a page to open it'
            : 'Click any page below to open that section'}
        </p>

        {viewMode === 'circle' && (
          <>
            <div className="pr-orbit pr-orbit-one" aria-hidden="true" />
            <div className="pr-orbit pr-orbit-two" aria-hidden="true" />
          </>
        )}

        {viewMode === 'flat' && (
          <div className="pr-flat-toolbar">
            <button
              type="button"
              className="pr-mode-btn"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPageId(null);
                setViewMode('circle');
              }}
            >
              ↺ Back to 3D Circle
            </button>
          </div>
        )}

        <div className={`pr-cards ${viewMode === 'flat' ? 'is-flat' : 'is-circle'}`}>
          {pages.map((page, idx) => {
            const isSelected = viewMode === 'flat' && selectedPageId === page.id;
            return (
              <a
                key={page.id}
                ref={(node) => {
                  cardRefs.current[idx] = node;
                }}
                className={`pr-card ${isSelected ? 'is-focused' : ''}`}
                href={'#' + page.id}
                onPointerEnter={() => {
                  if (viewMode === 'circle') cardHoveredRef.current = true;
                }}
                onPointerLeave={() => {
                  cardHoveredRef.current = false;
                }}
                onClick={(event) => handleCardClick(event, page)}
                aria-label={
                  viewMode === 'circle'
                    ? `Flatten view around ${page.title}`
                    : `Open ${page.title}`
                }
                draggable={false}
              >
                <div className="pr-browser-bar">
                  <span className="pr-window-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="pr-address">{page.routeLabel}</span>
                  <span className="pr-browser-icons" aria-hidden="true">
                    {viewMode === 'circle' ? '3D' : 'OPEN'}
                  </span>
                </div>
                <div className="pr-frame">
                  <iframe
                    className="pr-live-preview"
                    data-live-src={'/?ribbonPreview=' + page.id}
                    title={page.title + ' live preview'}
                    loading="eager"
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </div>
                <div className="pr-card-copy">
                  <span>{page.kicker}</span>
                  <strong>{page.title}</strong>
                  <b aria-hidden="true">{viewMode === 'flat' ? '↗' : '◎'}</b>
                </div>
              </a>
            );
          })}
        </div>

        <div className="pr-caption">
          <span>
            {viewMode === 'circle'
              ? 'DRAG TO SPIN CIRCLE · CLICK ANY PAGE TO OPEN IT'
              : `ALL ${pages.length} LIVE PAGES · CLICK A CARD TO NAVIGATE`}
          </span>
          <span className="pr-counter">
            {viewMode === 'flat'
              ? `${String(pages.length).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')} FLAT`
              : `01 / ${String(pages.length).padStart(2, '0')}`}
          </span>
        </div>
        <div className="pr-progress">
          <span />
        </div>
      </div>
    </section>
  );
};
