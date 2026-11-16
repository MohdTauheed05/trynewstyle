import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LadiesRailItem,
  MV_CROPS,
  MV_SHEET_H,
  MV_SHEET_W,
  MV_SHEETS,
  MvSheetView,
  getMvCropBox,
  getStoredLadiesRailItems,
  preloadMaisonVerrelSheets,
} from '../services/ladiesRailStorage';
import {
  addBagItem,
  getBagCount,
  getStoredBag,
  removeFromBag,
  updateBagQuantity,
} from '../services/bagStorage';
import { BagItem } from '../types';
import { useScrollLock } from '../services/scrollLock';
import { cleanCurrencySymbol } from '../services/storeSettings';
import { ProductThumb } from './ProductThumb';

interface LadiesRailSectionProps {
  shopName?: string;
  currencySymbol?: string;
  whatsappNumber?: string;
  onOpenBag?: () => void;
}

const TAG_ANGLES = [-5, 4, -3, 6, -4, 3, -6, 4, -3, 5];
const PUSH_OFFSETS = [0, 50, 24, 9, 0];

type FlyPayload = {
  key: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
  dx: number;
  dy: number;
  item: LadiesRailItem;
  activeView: 'front' | 'back';
};

/** Renders either a cropped transparent Maison Verrel sprite or a custom hanging garment */
const GarmentVisual: React.FC<{
  item: LadiesRailItem;
  view: MvSheetView;
  className?: string;
  draggable?: boolean;
}> = ({ item, view, className = '', draggable = false }) => {
  if (typeof item.sheetIndex === 'number') {
    const k = ((item.sheetIndex % 8) + 8) % 8;
    const [y, h, hookX] = MV_CROPS[view][k];
    const cropX = hookX - 170;
    const cropW = 340;
    const cropH = h + 6;
    const widthPct = (MV_SHEET_W / cropW) * 100;
    const heightPct = (MV_SHEET_H / cropH) * 100;
    const leftPct = -(cropX / cropW) * 100;
    const topPct = -(y / cropH) * 100;

    return (
      <div
        className={`relative overflow-hidden select-none ${className}`}
        style={{ aspectRatio: `${cropW} / ${cropH}` }}
      >
        <img
          src={MV_SHEETS[view]}
          alt={item.name}
          draggable={draggable}
          decoding="async"
          style={{
            position: 'absolute',
            width: `${widthPct}%`,
            height: `${heightPct}%`,
            left: `${leftPct}%`,
            top: `${topPct}%`,
            maxWidth: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  }

  // Fallback for custom admin-uploaded garment image: render with wooden hanger + brass hook
  const imgSrc = view === 'back' && item.backImage ? item.backImage : item.image;
  return (
    <div
      className={`relative flex flex-col items-center select-none ${className}`}
      style={{ aspectRatio: '340 / 740' }}
    >
      <svg
        viewBox="0 0 120 56"
        className="w-[46%] shrink-0 -mb-[5%] z-10 pointer-events-none drop-shadow-sm"
        aria-hidden="true"
      >
        {/* Brass hook */}
        <path
          d="M60 2 C60 2, 69 4, 68 12 C67 19, 60 19, 60 24"
          fill="none"
          stroke="#B99B63"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx="60" cy="24" r="2.8" fill="#8C6E3F" />
        {/* Dark wooden shoulders */}
        <path
          d="M60 24 L12 46 C9 47.5, 10 52, 14 52 L106 52 C110 52, 111 47.5, 108 46 Z"
          fill="#4A3222"
          stroke="#2E1D12"
          strokeWidth="1.5"
        />
        <path d="M18 47 L102 47" stroke="#6B4A34" strokeWidth="1.4" opacity="0.7" />
      </svg>
      <div className="w-full flex-1 min-h-0 flex items-start justify-center px-2">
        <img
          src={imgSrc}
          alt={item.name}
          draggable={draggable}
          className="w-full h-full object-contain object-top pointer-events-none drop-shadow-lg"
        />
      </div>
    </div>
  );
};

export const LadiesRailSection: React.FC<LadiesRailSectionProps> = ({
    currencySymbol = '$',
  onOpenBag,
}) => {
  const curr = cleanCurrencySymbol(currencySymbol) || '$';

  const [railItems, setRailItems] = useState<LadiesRailItem[]>(() =>
    getStoredLadiesRailItems()
  );
  const [bagItems, setBagItems] = useState<BagItem[]>(() => getStoredBag());
  const [bagCount, setBagCount] = useState<number>(() => getBagCount());

  const [stageSize, setStageSize] = useState({ width: 1440, height: 860 });
  const [ready, setReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hovIdx, setHovIdx] = useState<number>(-1);
  const [tappedIdx, setTappedIdx] = useState<number>(-1);

  const [qvIdx, setQvIdx] = useState<number>(-1);
  const [qvView, setQvView] = useState<'front' | 'back'>('front');
  const [qvSize, setQvSize] = useState<string>('S');
  const [qvAdding, setQvAdding] = useState(false);
  const [qvClosing, setQvClosing] = useState(false);
  const [qvLaunchRect, setQvLaunchRect] = useState<DOMRect | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bagPulse, setBagPulse] = useState(false);
  const [flyPayload, setFlyPayload] = useState<FlyPayload | null>(null);

  const sectionRef = useRef<HTMLElement | null>(null);
  const trackWrapRef = useRef<HTMLDivElement | null>(null);
  const trackInnerRef = useRef<HTMLDivElement | null>(null);
  const bagBtnRef = useRef<HTMLButtonElement | null>(null);
  const qvStageImgRef = useRef<HTMLDivElement | null>(null);
  const garmentRefs = useRef<Array<HTMLDivElement | null>>([]);
  const tagRefs = useRef<Array<HTMLDivElement | null>>([]);

  const physRef = useRef({
    scrollCurrent: 0,
    scrollTarget: 0,
    scrollVel: 0,
    lastVel: 0,
    maxScroll: 1400,
    dragging: false,
    dragMoved: false,
    startX: 0,
    startScroll: 0,
    samples: [] as Array<{ x: number; t: number }>,
    swayAngle: [] as number[],
    swayVel: [] as number[],
    pushOffset: [] as number[],
    dropProgress: [] as number[],
    entered: false,
    introStart: 0,
    hovIdx: -1,
    tappedIdx: -1,
    isPhone: false,
    u: 1,
    railTop: 270,
    railSag: 74,
    gap: 121,
    gs: 0.455,
    start: 113,
    W: 1440,
    reDropIdx: -1,
    reDropTime: 0,
  });

  // Sync admin CRUD changes
  useEffect(() => {
    const syncRail = () => setRailItems(getStoredLadiesRailItems());
    window.addEventListener('runway:ladies_rail_updated', syncRail);
    return () => window.removeEventListener('runway:ladies_rail_updated', syncRail);
  }, []);

  // Sync bag changes across storefront
  useEffect(() => {
    const syncBag = () => {
      setBagItems(getStoredBag());
      setBagCount(getBagCount());
    };
    window.addEventListener('runway:bag_updated', syncBag);
    return () => window.removeEventListener('runway:bag_updated', syncBag);
  }, []);

  // Preload all 3 Maison Verrel sheets + fonts + 2.5s failsafe
  useEffect(() => {
    let active = true;
    const failsafe = window.setTimeout(() => {
      if (active) setReady(true);
    }, 2500);

    const fontReady =
      typeof document !== 'undefined' && (document as any).fonts?.ready
        ? (document as any).fonts.ready.catch(() => undefined)
        : Promise.resolve();

    Promise.all([preloadMaisonVerrelSheets(), fontReady]).then(() => {
      if (active) {
        window.clearTimeout(failsafe);
        setReady(true);
      }
    });

    return () => {
      active = false;
      window.clearTimeout(failsafe);
    };
  }, []);

  // Measure section container for --u scaling
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      setStageSize({ width: w, height: h });
    };

    updateSize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
    ro?.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const isPhone = stageSize.width <= 820;
  const u = isPhone
    ? Math.max(0.72, Math.min(stageSize.width / 390, stageSize.height / 780))
    : Math.max(0.48, Math.min(stageSize.width / 1440, stageSize.height / 900));

  const railTop = isPhone ? 46 : 58;
  const railSag = isPhone ? 30 : 74;
  const gap = isPhone ? 80 : 121;
  const gs = isPhone ? 0.3 : 0.455;
  const startOffset = isPhone ? 46 : 113;

  const N = railItems.length;
  const totalTrackPx = (startOffset * 2 + Math.max(1, N - 1) * gap) * u;
  const maxScroll = Math.max(0, totalTrackPx - stageSize.width + 60 * u);

  useEffect(() => {
    const p = physRef.current;
    p.isPhone = isPhone;
    p.u = u;
    p.railTop = railTop;
    p.railSag = railSag;
    p.gap = gap;
    p.gs = gs;
    p.start = startOffset;
    p.W = stageSize.width;
    p.maxScroll = maxScroll;
    p.scrollTarget = Math.max(0, Math.min(maxScroll, p.scrollTarget));
    p.scrollCurrent = Math.max(0, Math.min(maxScroll, p.scrollCurrent));
  }, [isPhone, u, railTop, railSag, gap, gs, startOffset, stageSize.width, maxScroll]);

  useEffect(() => {
    physRef.current.hovIdx = hovIdx;
  }, [hovIdx]);

  useEffect(() => {
    physRef.current.tappedIdx = tappedIdx;
  }, [tappedIdx]);

  // Initialize per-garment physics arrays when item count changes
  useEffect(() => {
    const p = physRef.current;
    p.swayAngle = Array.from({ length: N }, (_, i) => p.swayAngle[i] ?? 0);
    p.swayVel = Array.from({ length: N }, (_, i) => p.swayVel[i] ?? 0);
    p.pushOffset = Array.from({ length: N }, (_, i) => p.pushOffset[i] ?? 0);
    p.dropProgress = Array.from({ length: N }, (_, i) => p.dropProgress[i] ?? (ready && p.entered ? 1 : 0));
  }, [N, ready]);

  // Trigger intro drop-in when visible and ready
  useEffect(() => {
    if (!ready) return;
    const el = sectionRef.current;
    if (!el) return;

    const triggerEnter = () => {
      if (!physRef.current.entered) {
        physRef.current.entered = true;
        physRef.current.introStart = performance.now();
      }
    };

    if (typeof IntersectionObserver === 'undefined') {
      triggerEnter();
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          triggerEnter();
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ready]);

  useScrollLock(qvIdx >= 0 || drawerOpen);

  // Curve helper matching quadratic Bezier rail M 0 y0 Q W/2 yc W y0
  const getCurveY = useCallback(
    (screenX: number, W: number, topPx: number, sagPx: number) => {
      const t = Math.max(0, Math.min(1, W > 0 ? screenX / W : 0.5));
      const y0 = topPx;
      const yc = topPx + 2 * sagPx;
      return (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * yc + t * t * y0;
    },
    []
  );

  // Main 60fps spring / inertia / curve placement / pendulum loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const loop = (now: number) => {
      const dt = Math.min(0.036, (now - lastTime) / 1000 || 1 / 60);
      lastTime = now;

      const p = physRef.current;

      // Inertia / spring scroll
      if (!p.dragging) {
        p.scrollTarget += p.scrollVel * dt;
        p.scrollVel *= Math.pow(0.08, dt);
        if (Math.abs(p.scrollVel) < 2) p.scrollVel = 0;
        p.scrollTarget = Math.max(0, Math.min(p.maxScroll, p.scrollTarget));
      }

      const prevScroll = p.scrollCurrent;
      p.scrollCurrent += (p.scrollTarget - p.scrollCurrent) * Math.min(1, dt * 14);
      const instantVel = dt > 0 ? (p.scrollCurrent - prevScroll) / dt : 0;
      const accel = (instantVel - p.lastVel) / Math.max(0.008, dt);
      p.lastVel = instantVel;

      const activeFocus = p.hovIdx >= 0 ? p.hovIdx : p.tappedIdx;
      const elapsedIntro = p.entered ? now - p.introStart : -1;

      for (let i = 0; i < N; i += 1) {
        const node = garmentRefs.current[i];
        if (!node) continue;

        // 1. Intro staggered drop + initial pendulum excitation
        let dropScaleY = 1;
        let dropTranslateY = 0;
        let opacity = ready ? 1 : 0;

        if (!reducedMotion && ready) {
          if (!p.entered) {
            dropTranslateY = -42 * p.u;
            opacity = 0;
          } else {
            const localT = Math.max(0, (elapsedIntro - i * 42) / 520);
            if (localT < 1) {
              const easeOut = 1 - Math.pow(1 - localT, 3);
              dropTranslateY = (1 - easeOut) * -46 * p.u;
              opacity = Math.min(1, localT * 1.4);
              if (localT < 0.15 && Math.abs(p.swayVel[i] || 0) < 0.1) {
                p.swayVel[i] = (i % 2 === 0 ? 1 : -1) * 0.45;
              }
            }
          }
        }

        // Re-drop gentle bounce after closing quick-view & adding to cart
        if (!reducedMotion && p.reDropIdx === i && now - p.reDropTime < 600) {
          const tDrop = (now - p.reDropTime) / 600;
          dropTranslateY = -Math.sin((1 - tDrop) * Math.PI) * 26 * p.u;
          dropScaleY = 0.96 + 0.04 * tDrop;
        }

        // 2. Neighbor push-aside offset
        let targetPush = 0;
        if (activeFocus >= 0 && activeFocus !== i) {
          const dist = Math.abs(i - activeFocus);
          const mag = PUSH_OFFSETS[Math.min(4, dist)] || 0;
          targetPush = (i < activeFocus ? -1 : 1) * mag * p.u;
        }
        p.pushOffset[i] = (p.pushOffset[i] || 0) + (targetPush - (p.pushOffset[i] || 0)) * Math.min(1, dt * 11);

        // 3. Position along curved gold rail
        const baseWorldX = (p.start + i * p.gap) * p.u + p.pushOffset[i];
        const screenX = baseWorldX - p.scrollCurrent;
        const hookY = getCurveY(screenX, p.W, p.railTop * p.u, p.railSag * p.u);

        // 4. Damped harmonic pendulum sway around hook (0, 0)
        if (!reducedMotion) {
          const k = 32;
          const damp = 4.4;
          const drive = Math.max(-2.8, Math.min(2.8, -accel * 0.00028));
          const ang = p.swayAngle[i] || 0;
          let angVel = p.swayVel[i] || 0;
          angVel += (-k * ang - damp * angVel + drive) * dt;
          let nextAng = ang + angVel * dt;
          nextAng = Math.max(-14, Math.min(14, nextAng));
          p.swayAngle[i] = nextAng;
          p.swayVel[i] = angVel;
        } else {
          p.swayAngle[i] = 0;
          p.swayVel[i] = 0;
        }

        const tiltDeg = activeFocus === i ? p.swayAngle[i] * 0.25 : p.swayAngle[i];

        node.style.transform = `translate3d(${screenX.toFixed(2)}px, ${(hookY + dropTranslateY).toFixed(2)}px, 0) rotate(${tiltDeg.toFixed(2)}deg) scaleY(${dropScaleY.toFixed(3)})`;
        node.style.opacity = opacity.toFixed(3);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [N, ready, getCurveY]);

  // Search filtering / auto-scroll to first matching garment
  const matchedIndices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const set = new Set<number>();
    railItems.forEach((item, idx) => {
      if (
        item.name.toLowerCase().includes(q) ||
        (item.fitDescription || '').toLowerCase().includes(q)
      ) {
        set.add(idx);
      }
    });
    return set;
  }, [railItems, searchQuery]);

  useEffect(() => {
    if (!matchedIndices || matchedIndices.size === 0) return;
    const firstMatch = Array.from(matchedIndices)[0];
    const p = physRef.current;
    const targetWorldX = (p.start + firstMatch * p.gap) * p.u;
    const desiredScroll = Math.max(0, Math.min(p.maxScroll, targetWorldX - p.W * 0.5));
    p.scrollTarget = desiredScroll;
  }, [matchedIndices]);

  // Scroll controls
  const scrollBy = useCallback((deltaPx: number) => {
    const p = physRef.current;
    p.scrollTarget = Math.max(0, Math.min(p.maxScroll, p.scrollTarget + deltaPx));
  }, []);

  const handleTrackWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Allow normal vertical page scrolling unless horizontal trackpad gesture or Shift+Wheel
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
    if (!horizontal) return;
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const p = physRef.current;
    p.scrollTarget = Math.max(0, Math.min(p.maxScroll, p.scrollTarget + delta * 1.15));
  };

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input')) return;
    const p = physRef.current;
    p.dragging = true;
    p.dragMoved = false;
    p.startX = e.clientX;
    p.startScroll = p.scrollTarget;
    p.samples = [{ x: e.clientX, t: performance.now() }];
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = physRef.current;
    if (!p.dragging) return;
    const dx = e.clientX - p.startX;
    if (Math.abs(dx) > 6) p.dragMoved = true;
    p.scrollTarget = Math.max(0, Math.min(p.maxScroll, p.startScroll - dx));
    const now = performance.now();
    p.samples.push({ x: e.clientX, t: now });
    if (p.samples.length > 6) p.samples.shift();
  };

  const handleTrackPointerUp = () => {
    const p = physRef.current;
    if (!p.dragging) return;
    p.dragging = false;
    if (p.samples.length >= 2) {
      const first = p.samples[0];
      const last = p.samples[p.samples.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt > 0.005) {
        const vx = (last.x - first.x) / dt;
        p.scrollVel = Math.max(-2400, Math.min(2400, -vx * 0.72));
      }
    }
    window.setTimeout(() => {
      physRef.current.dragMoved = false;
    }, 80);
  };

  const openQuickView = (idx: number, sourceEl: HTMLElement | null) => {
    const item = railItems[idx];
    if (!item) return;
    setQvIdx(idx);
    setQvView('front');
    setQvSize(item.sizes?.[0] || 'S');
    setQvAdding(false);
    setQvClosing(false);
    setQvLaunchRect(sourceEl ? sourceEl.getBoundingClientRect() : null);
  };

  const handleGarmentClick = (idx: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (physRef.current.dragMoved) return;
    const isTouchEnv =
      typeof window !== 'undefined' &&
      (window.matchMedia('(hover: none)').matches || physRef.current.isPhone);

    if (isTouchEnv && tappedIdx !== idx) {
      // Touch: 1st tap turns to face & centers smoothly; 2nd tap opens Quick View
      setTappedIdx(idx);
      const p = physRef.current;
      const targetX = (p.start + idx * p.gap) * p.u;
      p.scrollTarget = Math.max(0, Math.min(p.maxScroll, targetX - p.W * 0.5));
      return;
    }

    openQuickView(idx, e.currentTarget);
  };

  const closeQuickView = (triggerReDrop = false, targetIdx = qvIdx) => {
    setQvClosing(true);
    window.setTimeout(() => {
      if (triggerReDrop && targetIdx >= 0) {
        physRef.current.reDropIdx = targetIdx;
        physRef.current.reDropTime = performance.now();
        physRef.current.swayVel[targetIdx] = 2.4;
      }
      setQvIdx(-1);
      setQvClosing(false);
      setQvAdding(false);
    }, 240);
  };

  // Handle Keyboard navigation when Quick-View or Drawer is open
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (qvIdx >= 0) closeQuickView(false);
        else if (drawerOpen) setDrawerOpen(false);
      } else if (qvIdx >= 0 && !qvAdding) {
        if (e.key === 'ArrowRight') {
          setQvIdx((prev) => (prev + 1) % N);
        } else if (e.key === 'ArrowLeft') {
          setQvIdx((prev) => (prev - 1 + N) % N);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [qvIdx, qvAdding, drawerOpen, N]);

  // Add to cart with 1000ms Adding spinner + flying arc to Bag
  const handleQuickViewAddToCart = () => {
    if (qvIdx < 0 || qvAdding) return;
    const item = railItems[qvIdx];
    if (!item) return;

    setQvAdding(true);

    window.setTimeout(() => {
      const crop =
        item.crop ||
        (typeof item.sheetIndex === 'number'
          ? getMvCropBox('front', item.sheetIndex)
          : undefined);

      addBagItem({
        productId: item.id,
        name: item.name,
        size: qvSize,
        price: item.price,
        image: item.image,
        quantity: 1,
        crop,
      });

      // Launch flying garment clone from Quick-View visual into Bag icon
      const stageRect = qvStageImgRef.current?.getBoundingClientRect();
      const bagEl = bagBtnRef.current || document.getElementById('open-bag');
      const bagRect = bagEl?.getBoundingClientRect();

      if (stageRect && bagRect) {
        const destX = bagRect.left + bagRect.width / 2;
        const destY = bagRect.top + bagRect.height / 2;
        const startCenterX = stageRect.left + stageRect.width / 2;
        const startCenterY = stageRect.top + stageRect.height / 2;

        setFlyPayload({
          key: Date.now(),
          startX: stageRect.left,
          startY: stageRect.top,
          width: stageRect.width,
          height: stageRect.height,
          dx: destX - startCenterX,
          dy: destY - startCenterY,
          item,
          activeView: qvView,
        });

        window.setTimeout(() => {
          setBagPulse(true);
          window.setTimeout(() => setBagPulse(false), 620);
        }, 560);

        window.setTimeout(() => {
          setFlyPayload(null);
        }, 880);
      } else {
        setBagPulse(true);
        window.setTimeout(() => setBagPulse(false), 620);
      }

      closeQuickView(true, qvIdx);
    }, 950);
  };

  // Compute SVG gold rail path geometry
  const W = stageSize.width;
  const railY0 = railTop * u;
  const railYc = (railTop + 2 * railSag) * u;
  const railSvgH = Math.max(120, Math.ceil((railTop + railSag + 36) * u));
  const railPath = `M 0 ${railY0.toFixed(1)} Q ${(W / 2).toFixed(1)} ${railYc.toFixed(1)} ${W.toFixed(1)} ${railY0.toFixed(1)}`;

  const activeQvItem = qvIdx >= 0 ? railItems[qvIdx] : null;
  const qvSizes = activeQvItem?.sizes?.length ? activeQvItem.sizes : ['S', 'M', 'L', 'XL'];
  const bagSubtotal = bagItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <section
      ref={sectionRef}
      id="ladies-rail-section"
      className="mv-section relative w-full overflow-hidden select-none"
      style={{
        ['--mv-u' as any]: `${u}px`,
        height: isPhone ? 'min(92svh, 790px)' : 'min(92svh, 900px)',
        minHeight: isPhone ? '640px' : '660px',
        backgroundColor: '#ffffff',
        color: '#1A1716',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
      aria-label="Ladies collection 3D rail"
    >
      <style>{`
        .mv-section * { box-sizing: border-box; }
        .mv-serif { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; }
        .mv-page {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          transition: transform .52s cubic-bezier(.16,1,.3,1);
        }
        .mv-page.is-shifted {
          transform: translateX(-180px);
        }
        @media (max-width: 820px) {
          .mv-page.is-shifted { transform: none; }
        }
        .mv-garment {
          position: absolute;
          top: 0;
          left: 0;
          width: 0;
          height: 0;
          transform-origin: 0 0;
          cursor: pointer;
          will-change: transform, opacity;
        }
        .mv-garment-inner {
          position: relative;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          transform-style: preserve-3d;
        }
        .mv-face {
          backface-visibility: hidden;
          transition: transform 230ms cubic-bezier(.4, 0, .2, 1), opacity 220ms ease;
        }
        .mv-face--side {
          transform: rotateY(0deg);
          opacity: 1;
        }
        .mv-face--front {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%) rotateY(90deg);
          opacity: 0;
        }
        .mv-garment.is-faced .mv-face--side {
          transform: rotateY(-90deg);
          opacity: 0;
        }
        .mv-garment.is-faced .mv-face--front {
          transform: translateX(-50%) rotateY(0deg);
          opacity: 1;
        }
        .mv-tag {
          transition: transform 240ms cubic-bezier(.16,1,.3,1), opacity 200ms ease;
        }
        .mv-garment.is-faced .mv-tag {
          transform: rotate(0deg) scale(1.06) !important;
          border-color: #1A1716;
        }
        @keyframes mvQvFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes mvQvFlyIn {
          from { opacity: 0; transform: translateY(-28px) scale(0.84); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mvFlyToBag {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
          65% { transform: translate3d(calc(var(--fly-dx) * 0.72), calc(var(--fly-dy) * 0.52 - 60px), 0) scale(0.45); opacity: 0.95; }
          100% { transform: translate3d(var(--fly-dx), var(--fly-dy), 0) scale(0.08); opacity: 0.15; }
        }
        @keyframes mvBagBounce {
          0% { transform: scale(1); }
          35% { transform: scale(1.22); }
          65% { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
        .mv-fly-clone {
          animation: mvFlyToBag 820ms cubic-bezier(.22, .85, .36, 1) forwards;
        }
        .mv-bag-bounce {
          animation: mvBagBounce 560ms cubic-bezier(.34, 1.56, .64, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .mv-garment, .mv-face, .mv-tag, .mv-page, .mv-fly-clone {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>

      <div className={`mv-page ${drawerOpen && !isPhone ? 'is-shifted' : ''}`}>
        {/* Shared site navigation stays in the sticky global header. */}
        {/* 3. Studio Headline + Editorial Subtitle */}
        <div className="relative z-20 pointer-events-none px-4 sm:px-10 pt-5 sm:pt-7 flex flex-col sm:flex-row sm:items-end justify-between gap-1">
          <div>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[#746A5E] m-0">
              Curated Wardrobe · The Gold Rail
            </p>
            <h2 className="mv-serif text-3xl sm:text-5xl text-[#1A1716] leading-none mt-1 tracking-tight">
              The Autumn Edit
            </h2>
          </div>
          <p className="text-[10px] sm:text-[11px] tracking-[0.16em] uppercase text-[#746A5E] m-0">
            {isPhone
              ? 'Drag sideways · Tap to turn · Tap again to inspect'
              : 'Hover piece to turn · Drag sideways · Click to inspect & add to bag'}
          </p>
        </div>

        {/* 4. Full-Width Curved Gold Rail & Hanging Garments Stage */}
        <div
          ref={trackWrapRef}
          className="relative flex-1 w-full overflow-hidden cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'pan-y' }}
          onWheel={handleTrackWheel}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          onPointerCancel={handleTrackPointerUp}
        >
          {/* Curved 3-stroke SVG Gold Rail */}
          <svg
            width={W}
            height={railSvgH}
            viewBox={`0 0 ${W} ${railSvgH}`}
            className="absolute top-0 left-0 w-full pointer-events-none z-10 overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="mvGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7F6743" />
                <stop offset="22%" stopColor="#C2A877" />
                <stop offset="50%" stopColor="#E9DCBC" />
                <stop offset="78%" stopColor="#C2A877" />
                <stop offset="100%" stopColor="#7F6743" />
              </linearGradient>
              <filter id="mvRailShadow" x="-10%" y="-40%" width="120%" height="220%">
                <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#1A1716" floodOpacity="0.14" />
              </filter>
            </defs>
            {/* Base brass shadow stroke */}
            <path
              d={railPath}
              fill="none"
              stroke="#7F6743"
              strokeWidth={Math.max(3, 5.5 * u)}
              strokeLinecap="round"
              filter="url(#mvRailShadow)"
            />
            {/* Main brushed gold body stroke */}
            <path
              d={railPath}
              fill="none"
              stroke="url(#mvGoldGrad)"
              strokeWidth={Math.max(2.2, 3.8 * u)}
              strokeLinecap="round"
            />
            {/* Top specular highlight stroke */}
            <path
              d={railPath}
              fill="none"
              stroke="#F7EED8"
              strokeWidth={Math.max(1, 1.3 * u)}
              strokeLinecap="round"
              opacity="0.85"
              transform={`translate(0, ${(-1 * u).toFixed(1)})`}
            />
          </svg>

          {/* Hanging Garments Track */}
          <div
            ref={trackInnerRef}
            className="absolute inset-0 z-20"
          >
            {railItems.map((item, idx) => {
              const isFaced = hovIdx === idx || tappedIdx === idx;
              const isDimmed = Boolean(matchedIndices && !matchedIndices.has(idx));
              const tagAngle = TAG_ANGLES[idx % TAG_ANGLES.length];

              // Garment width = 340 * gs * u (for 1360x2048 crop)
              const widthPx = 340 * gs * u;

              return (
                <div
                  key={item.id}
                  ref={(node) => {
                    garmentRefs.current[idx] = node;
                  }}
                  className={`mv-garment ${isFaced ? 'is-faced' : ''}`}
                  style={{
                    zIndex: isFaced ? 80 : 20 + (idx % 10),
                    opacity: isDimmed ? 0.25 : 1,
                    filter: isDimmed ? 'grayscale(0.6)' : 'none',
                  }}
                  onPointerEnter={() => {
                    if (!isPhone) setHovIdx(idx);
                  }}
                  onPointerLeave={() => {
                    if (!isPhone && hovIdx === idx) setHovIdx(-1);
                  }}
                  onClick={(e) => handleGarmentClick(idx, e)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.name} — ${curr}${item.price}. Click to inspect`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openQuickView(idx, e.currentTarget);
                    }
                  }}
                >
                  <div
                    className="mv-garment-inner"
                    style={{
                      width: `${widthPx.toFixed(1)}px`,
                      filter: isFaced
                        ? 'drop-shadow(0 22px 26px rgba(26,23,22,0.18))'
                        : 'drop-shadow(0 12px 14px rgba(26,23,22,0.1))',
                    }}
                  >
                    {/* Side-view face (default hanging edge-on) */}
                    <div className="mv-face mv-face--side w-full">
                      <GarmentVisual item={item} view="side" className="w-full" />
                    </div>

                    {/* Front-view face (turns to face viewer on hover / tap) */}
                    <div className="mv-face mv-face--front w-full">
                      <GarmentVisual item={item} view="front" className="w-full" />
                    </div>

                    {/* Small Cream Price Tag attached at shoulder/hanger */}
                    <div
                      ref={(node) => {
                        tagRefs.current[idx] = node;
                      }}
                      className="mv-tag pointer-events-none absolute flex items-center gap-1 px-1.5 py-0.5 border border-[#DDD5C9] shadow-sm"
                      style={{
                        top: `${(44 * u).toFixed(0)}px`,
                        right: `${(isPhone ? 24 : 36) * u}px`,
                        backgroundColor: '#ffffff',
                        color: '#1A1716',
                        fontSize: `${Math.max(8, 10 * u)}px`,
                        letterSpacing: '0.06em',
                        fontWeight: 500,
                        transform: `rotate(${tagAngle}deg)`,
                      }}
                    >
                      <span className="w-1 h-1 rounded-full bg-[#C2A877]" />
                      <span>
                        {curr}
                        {Math.round(item.price)}
                      </span>
                    </div>

                    {/* Active hover caption & prompt */}
                    {isFaced && (
                      <div
                        className="mt-1.5 px-2.5 py-1 rounded-full border border-[#DDD5C9] shadow-sm whitespace-nowrap text-center pointer-events-none"
                        style={{ backgroundColor: '#FAF7F2' }}
                      >
                        <span className="block text-[10px] font-medium text-[#1A1716] tracking-[0.04em]">
                          {item.name}
                        </span>
                        <span className="block text-[9px] uppercase tracking-[0.14em] text-[#746A5E]">
                          {isPhone ? 'Tap again to open' : 'Click to inspect'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Bottom Rail Status & Quick Index */}
        <div
          className="relative z-20 shrink-0 border-t border-[#DDD5C9] px-4 sm:px-10 py-2.5 flex items-center justify-between text-[10px] tracking-[0.16em] uppercase"
          style={{ backgroundColor: '#FAF7F2', color: '#746A5E' }}
        >
          <span>
            {hovIdx >= 0
              ? `${railItems[hovIdx]?.name} · ${curr}${railItems[hovIdx]?.price.toFixed(2)}`
              : tappedIdx >= 0
              ? `${railItems[tappedIdx]?.name} · Tap again for details`
              : `${N} Pieces on Rail · Interactive Studio`}
          </span>
          <button
            type="button"
            onClick={() => {
              const mid = Math.floor(N / 2);
              openQuickView(hovIdx >= 0 ? hovIdx : tappedIdx >= 0 ? tappedIdx : mid, null);
            }}
            className="underline underline-offset-4 hover:text-[#1A1716] cursor-pointer"
          >
            Inspect Look →
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* FULL-SCREEN QUICK-VIEW MODAL (PORTAL)                              */}
      {/* ================================================================== */}
      {qvIdx >= 0 &&
        activeQvItem &&
        createPortal(
          <div
            className="fixed inset-0 z-[9998] flex flex-col overflow-y-auto"
            style={{
              backgroundColor: '#FAF7F2',
              color: '#1A1716',
              animation: 'mvQvFadeIn 220ms ease-out',
              opacity: qvClosing ? 0 : 1,
              transition: 'opacity 220ms ease',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
            role="dialog"
            aria-modal="true"
            aria-label={activeQvItem.name}
          >
            {/* Quick-view Gold Hanging Rod along top */}
            <div
              className="w-full h-1.5 shrink-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, #7F6743, #E9DCBC 50%, #7F6743)',
                boxShadow: '0 4px 12px rgba(26,23,22,0.12)',
              }}
            />

            {/* Header bar inside Quick-View */}
            <div className="flex items-center justify-between px-5 sm:px-10 py-4 border-b border-[#DDD5C9]">
              <div className="flex items-center gap-3">
                
                <span className="text-[10px] tracking-[0.18em] uppercase text-[#746A5E]">
                  Piece {String(qvIdx + 1).padStart(2, '0')} / {String(N).padStart(2, '0')}
                </span>
              </div>

              <button
                type="button"
                onClick={() => closeQuickView(false)}
                className="w-10 h-10 rounded-full border border-[#DDD5C9] hover:border-[#1A1716] grid place-items-center text-lg cursor-pointer transition-colors"
                aria-label="Close quick view"
              >
                ×
              </button>
            </div>

            {/* Body Grid: Hanging Garment Stage (Left) + Specs/Size/CTA (Right) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 max-w-6xl w-full mx-auto px-5 sm:px-10 py-6 gap-8 items-center">
              {/* Garment Preview with Front / Back crossfade */}
              <div className="lg:col-span-7 flex flex-col items-center justify-center relative">
                <div
                  ref={qvStageImgRef}
                  className="relative w-full max-w-[340px] sm:max-w-[380px] flex items-center justify-center"
                  style={{
                    minHeight: '380px',
                    maxHeight: '62vh',
                    animation: qvLaunchRect ? 'mvQvFlyIn 380ms cubic-bezier(.16,1,.3,1)' : undefined,
                    filter: 'drop-shadow(0 28px 34px rgba(26,23,22,0.14))',
                  }}
                >
                  <div
                    className="w-[260px] sm:w-[300px] transition-opacity duration-300"
                    style={{ opacity: qvView === 'front' ? 1 : 0 }}
                  >
                    <GarmentVisual item={activeQvItem} view="front" className="w-full" />
                  </div>
                  <div
                    className="w-[260px] sm:w-[300px] absolute transition-opacity duration-300"
                    style={{ opacity: qvView === 'back' ? 1 : 0 }}
                  >
                    <GarmentVisual item={activeQvItem} view="back" className="w-full" />
                  </div>
                </div>

                {/* Front / Back View Switcher */}
                <div className="flex items-center gap-2 mt-4 p-1 rounded-full border border-[#DDD5C9] bg-[#EFEBE4]">
                  <button
                    type="button"
                    onClick={() => setQvView('front')}
                    className={`px-4 py-1.5 rounded-full text-[11px] uppercase tracking-[0.14em] transition-colors cursor-pointer ${
                      qvView === 'front'
                        ? 'bg-[#0E0D0C] text-[#FAF7F2]'
                        : 'text-[#746A5E] hover:text-[#1A1716]'
                    }`}
                  >
                    Front View
                  </button>
                  <button
                    type="button"
                    onClick={() => setQvView('back')}
                    className={`px-4 py-1.5 rounded-full text-[11px] uppercase tracking-[0.14em] transition-colors cursor-pointer ${
                      qvView === 'back'
                        ? 'bg-[#0E0D0C] text-[#FAF7F2]'
                        : 'text-[#746A5E] hover:text-[#1A1716]'
                    }`}
                  >
                    Back View
                  </button>
                </div>
              </div>

              {/* Right Details Column */}
              <div className="lg:col-span-5 flex flex-col gap-5 max-w-md w-full mx-auto">
                <div>
                  <span className="text-[10px] tracking-[0.2em] uppercase text-[#746A5E] block mb-1.5">
                    Product details
                  </span>
                  <h3 className="mv-serif text-3xl sm:text-4xl text-[#1A1716] leading-tight">
                    {activeQvItem.name}
                  </h3>
                  <div className="text-lg font-medium text-[#1A1716] mt-2 tabular-nums">
                    {curr}
                    {activeQvItem.price.toFixed(2)}
                  </div>
                </div>

                {activeQvItem.fitDescription && (
                  <p className="text-xs sm:text-sm text-[#746A5E] leading-relaxed border-t border-b border-[#DDD5C9] py-4">
                    {activeQvItem.fitDescription}
                  </p>
                )}

                {/* Size Picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-[#746A5E] font-medium">
                      Select Size
                    </span>
                    <span className="text-[11px] text-[#1A1716] font-medium">{qvSize}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {qvSizes.map((sz) => {
                      const active = qvSize === sz;
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setQvSize(sz)}
                          className={`h-10 border text-xs font-medium tracking-[0.1em] uppercase transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#0E0D0C] text-[#FAF7F2] border-[#0E0D0C]'
                              : 'bg-[#FAF7F2] text-[#1A1716] border-[#DDD5C9] hover:border-[#1A1716]'
                          }`}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Add to Cart Button */}
                <button
                  type="button"
                  disabled={qvAdding}
                  onClick={handleQuickViewAddToCart}
                  className="h-12 w-full flex items-center justify-center gap-2.5 text-xs font-medium tracking-[0.18em] uppercase transition-opacity cursor-pointer disabled:opacity-75"
                  style={{ backgroundColor: '#0E0D0C', color: '#FAF7F2' }}
                >
                  {qvAdding ? (
                    <>
                      <svg
                        className="animate-spin"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 3a9 9 0 1 1-9 9" />
                      </svg>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <span>
                      Add to cart · {curr}
                      {activeQvItem.price.toFixed(2)}
                    </span>
                  )}
                </button>

                {/* Prev / Next Piece switcher */}
                <div className="flex items-center justify-between pt-2 text-[11px] tracking-[0.14em] uppercase text-[#746A5E]">
                  <button
                    type="button"
                    onClick={() => setQvIdx((prev) => (prev - 1 + N) % N)}
                    className="hover:text-[#1A1716] cursor-pointer py-1"
                  >
                    ← Previous Piece
                  </button>
                  <button
                    type="button"
                    onClick={() => setQvIdx((prev) => (prev + 1) % N)}
                    className="hover:text-[#1A1716] cursor-pointer py-1"
                  >
                    Next Piece →
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ================================================================== */}
      {/* FLY-TO-BAG ANIMATION CLONE (PORTAL)                                */}
      {/* ================================================================== */}
      {flyPayload &&
        createPortal(
          <div
            key={flyPayload.key}
            className="fixed pointer-events-none z-[10020] mv-fly-clone flex items-center justify-center"
            style={{
              left: flyPayload.startX,
              top: flyPayload.startY,
              width: flyPayload.width,
              height: flyPayload.height,
              ['--fly-dx' as any]: `${flyPayload.dx}px`,
              ['--fly-dy' as any]: `${flyPayload.dy}px`,
            }}
          >
            <div className="w-[240px]">
              <GarmentVisual item={flyPayload.item} view={flyPayload.activeView} />
            </div>
          </div>,
          document.body
        )}

      {/* ================================================================== */}
      {/* SLIDE-IN CART DRAWER FROM RIGHT (PORTAL)                           */}
      {/* ================================================================== */}
      {drawerOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex justify-end">
            <div
              className="absolute inset-0 bg-[#1A1716]/35 backdrop-blur-[2px]"
              onClick={() => setDrawerOpen(false)}
            />
            <aside
              className="relative z-10 w-full max-w-[440px] h-full flex flex-col border-l border-[#DDD5C9] shadow-2xl"
              style={{
                backgroundColor: '#FAF7F2',
                color: '#1A1716',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
              aria-label="Shopping Bag Drawer"
            >
              <div className="px-6 py-5 border-b border-[#DDD5C9] flex items-center justify-between">
                <div>
                  <span className="text-[10px] tracking-[0.2em] uppercase text-[#746A5E] block">
                    Shopping bag
                  </span>
                  <h3 className="mv-serif text-2xl text-[#1A1716] mt-0.5">
                    Your Bag ({bagCount})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-9 h-9 rounded-full border border-[#DDD5C9] hover:border-[#1A1716] grid place-items-center text-lg cursor-pointer"
                  aria-label="Close bag drawer"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-[#DDD5C9]">
                {bagItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12 text-[#746A5E]">
                    <p className="text-sm mb-2 text-[#1A1716]">Your wardrobe bag is empty.</p>
                    <p className="text-xs max-w-xs leading-relaxed">
                      Click any garment hanging from the rail to inspect it and add your size.
                    </p>
                  </div>
                ) : (
                  bagItems.map((item) => (
                    <div key={item.id} className="py-4 flex gap-4 items-center">
                      <div className="w-16 h-20 shrink-0 bg-[#EFEBE4] border border-[#DDD5C9] flex items-center justify-center p-1">
                        <ProductThumb item={item} className="w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-[#1A1716] truncate">
                          {item.name}
                        </h4>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-[#746A5E] mt-0.5">
                          Size: {item.size}
                        </p>
                        <div className="text-xs font-medium text-[#1A1716] mt-1 tabular-nums">
                          {curr}
                          {(item.price * item.quantity).toFixed(2)}
                        </div>

                        <div className="flex items-center gap-3 mt-2.5">
                          <div className="inline-flex items-center border border-[#DDD5C9] bg-[#FAF7F2]">
                            <button
                              type="button"
                              onClick={() => updateBagQuantity(item.id, item.quantity - 1)}
                              className="w-7 h-7 grid place-items-center text-xs hover:bg-[#EFEBE4] cursor-pointer"
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="px-2.5 text-xs tabular-nums">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateBagQuantity(item.id, item.quantity + 1)}
                              className="w-7 h-7 grid place-items-center text-xs hover:bg-[#EFEBE4] cursor-pointer"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromBag(item.id)}
                            className="text-[11px] uppercase tracking-[0.12em] text-[#746A5E] hover:text-[#1A1716] underline underline-offset-4 cursor-pointer"
                            aria-label={`Remove ${item.name}`}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {bagItems.length > 0 && (
                <div className="px-6 py-5 border-t border-[#DDD5C9] bg-[#EFEBE4] space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#746A5E] uppercase tracking-[0.14em] text-xs">
                      Estimated Total
                    </span>
                    <span className="font-semibold text-base tabular-nums text-[#1A1716]">
                      {curr}
                      {bagSubtotal.toFixed(2)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      onOpenBag?.();
                    }}
                    className="w-full h-12 text-xs font-medium tracking-[0.18em] uppercase cursor-pointer"
                    style={{ backgroundColor: '#0E0D0C', color: '#FAF7F2' }}
                  >
                    Checkout · Order Slip
                  </button>
                </div>
              )}
            </aside>
          </div>,
          document.body
        )}
    </section>
  );
};
