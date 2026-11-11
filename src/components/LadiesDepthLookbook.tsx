import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LadiesPiece, LadiesSectionSettings } from '../types';
import {
  LADIES_MODELS_SHEET,
  LADIES_PIECES_SHEET,
  LADIES_LOOK_BOUNDS,
  LADIES_MODEL_Y0,
  LADIES_MODEL_Y1,
  getStoredLadiesPieces,
  getStoredLadiesSettings,
} from '../services/ladiesStorage';
import { addBagItem } from '../services/bagStorage';
import { formatCurrency } from '../services/storeSettings';

interface LadiesDepthLookbookProps {
  shopName: string;
  currencySymbol: string;
  cartCount: number;
  onOpenBag: () => void;
  onNavigateHome?: () => void;
}

const KX = [1.2, 0.744, 0.496, 0.346, 0.235, 0.15, 0.085];
const KF = [1.14, 0.89, 0.777, 0.704, 0.651, 0.616, 0.59];
const KH = [1.18, 0.832, 0.574, 0.436, 0.334, 0.258, 0.19];
const KB = [0, 0, 1.5, 4, 8, 12, 17];
const KO = [1, 1, 1, 1, 0.86, 0.5, 0];

const N = LADIES_LOOK_BOUNDS.length; // 6 looks
const wrap = (x: number, n: number) => ((x % n) + n) % n;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export const LadiesDepthLookbook: React.FC<LadiesDepthLookbookProps> = ({
  shopName,
  currencySymbol,
  cartCount,
  onOpenBag,
  onNavigateHome,
}) => {
  const [pieces, setPieces] = useState<LadiesPiece[]>(() => getStoredLadiesPieces());
  const [ladiesSettings, setLadiesSettings] = useState<LadiesSectionSettings>(() =>
    getStoredLadiesSettings()
  );
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const stageRef = useRef<HTMLElement | null>(null);
  const railRef = useRef<HTMLElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const rollRef = useRef<HTMLSpanElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const peopleRefs = useRef<Array<{ el: HTMLDivElement; r: number; f: string; o: string }>>([]);
  const cardRefs = useRef<HTMLElement[]>([]);

  // Physics & Animation state refs
  const stateRef = useRef({
    p: 0,
    target: 0,
    last: 0,
    dirty: true,
    W: 0,
    H: 0,
    base: 0,
    cardS: 0,
    side: false,
    mx: 0,
    my: 0,
    cx: 0,
    cy: 0,
    down: false,
    sx: 0,
    st: 0,
    moved: 0,
    wheelTimer: 0,
  });

  // Listen to external updates from Admin panel
  useEffect(() => {
    const handleUpdate = () => {
      setPieces(getStoredLadiesPieces());
      setLadiesSettings(getStoredLadiesSettings());
      stateRef.current.dirty = true;
    };
    window.addEventListener('runway:ladies_updated', handleUpdate);
    return () => window.removeEventListener('runway:ladies_updated', handleUpdate);
  }, []);

  const firstLookNumber = ladiesSettings.firstLookNumber || 15;

  // Render SVG cropped piece or model
  const renderCroppedSvg = (
    href: string,
    x0: number,
    y0: number,
    w: number,
    h: number,
    sheetW: number,
    sheetH: number
  ) => {
    return (
      <svg viewBox={`${x0} ${y0} ${w} ${h}`} aria-hidden="true" className="w-full h-full block">
        <svg x={x0} y={y0} width={w} height={h} viewBox={`${x0} ${y0} ${w} ${h}`}>
          <image href={href} width={sheetW} height={sheetH} />
        </svg>
      </svg>
    );
  };

  // Add individual piece to cart
  const handleAddPieceToCart = (piece: LadiesPiece) => {
    const imageUrl = piece.customImage || LADIES_PIECES_SHEET;
    addBagItem({
      productId: piece.id,
      name: piece.name,
      size: 'One Size',
      price: piece.price,
      image: imageUrl,
      quantity: 1,
      crop:
        !piece.customImage && piece.box
          ? {
              x: piece.box[0],
              y: piece.box[2],
              w: piece.box[1] - piece.box[0],
              h: piece.box[3] - piece.box[2],
              sheetW: 960,
              sheetH: 720,
            }
          : undefined,
    });
  };

  // "Shop the look" adds both pieces for the current look
  const handleShopCurrentLook = () => {
    const currentLookIdx = Math.round(wrap(stateRef.current.p, N)) % N;
    const targetLookNum = firstLookNumber + currentLookIdx;
    const matchingPieces = pieces.filter((p) => p.lookNumber === targetLookNum);

    if (matchingPieces.length > 0) {
      matchingPieces.forEach((piece) => {
        handleAddPieceToCart(piece);
      });
    } else if (pieces.length > 0) {
      // Fallback: add next piece
      handleAddPieceToCart(pieces[0]);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = (pieceId: string) => {
    setFavorites((prev) => ({
      ...prev,
      [pieceId]: !prev[pieceId],
    }));
  };

  // Sizing measurement function
  const size = useCallback(() => {
    const stage = stageRef.current;
    const rail = railRef.current;
    const roll = rollRef.current;
    if (!stage || !rail || !roll) return;

    const s = stateRef.current;
    s.W = stage.clientWidth;
    s.H = stage.clientHeight;
    s.base = s.H * 1.2;
    s.side = window.innerWidth <= 820;

    peopleRefs.current.forEach((m) => {
      if (m.el) {
        m.el.style.width = `${s.base * m.r}px`;
        m.el.style.height = `${s.base}px`;
      }
    });

    s.cardS = s.side ? 160 : rail.clientHeight / 3;
    cardRefs.current.forEach((c) => {
      if (c) {
        c.style.height = s.side ? '100%' : `${s.cardS}px`;
      }
    });

    s.dirty = true;
  }, []);

  // Painting depth positions and looping card transforms
  const paint = useCallback(() => {
    const s = stateRef.current;
    const { p, W, H, base, cardS, side } = s;

    // Paint Models
    peopleRefs.current.forEach((m, i) => {
      if (!m.el) return;
      let d = wrap(i - p, N);
      if (d > N - 1) d -= N;

      const k = clamp(d + 1, 0, 6);
      const a = Math.floor(k);
      const b = Math.min(6, a + 1);
      const t = k - a;
      const mix = (A: number[]) => A[a] + (A[b] - A[a]) * t;

      const h = mix(KH) * H;
      const scale = h / (base || 1);
      const w = h * m.r;
      const x = mix(KX) * W - w / 2;
      const y = mix(KF) * H - h;

      m.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${scale.toFixed(4)})`;

      const blurVal = mix(KB) / (scale || 1);
      const fs = blurVal < 0.2 ? 'none' : `blur(${blurVal.toFixed(1)}px)`;
      const op = mix(KO).toFixed(3);

      if (fs !== m.f) {
        m.f = fs;
        m.el.style.filter = fs;
      }
      if (op !== m.o) {
        m.o = op;
        m.el.style.opacity = op;
      }
      m.el.style.zIndex = `${100 - Math.round(d * 10)}`;
    });

    // Paint Product Cards
    const totalCards = cardRefs.current.length || pieces.length;
    const all = cardS * totalCards;
    cardRefs.current.forEach((c, i) => {
      if (!c) return;
      let y = wrap(i * cardS - p * 2 * cardS, all);
      if (y > all - cardS) y -= all;
      c.style.transform = side
        ? `translate3d(${y.toFixed(1)}px,0,0)`
        : `translate3d(0,${y.toFixed(1)}px,0)`;
    });

    // Paint Rolling Look Number
    const roll = rollRef.current;
    if (roll && roll.firstChild) {
      const itemHeight = (roll.firstChild as HTMLElement).offsetHeight || 38;
      roll.style.transform = `translate3d(0,${(-wrap(p, N) * itemHeight).toFixed(1)}px,0)`;
    }
  }, [pieces.length]);

  // Main animation frame loop
  useEffect(() => {
    let animId: number;
    const calm = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

    const frame = (now: number) => {
      const s = stateRef.current;
      const dt = Math.min(50, now - s.last) || 16;
      s.last = now;

      const was = s.p;
      if (calm) {
        s.p = s.target;
      } else {
        s.p += (s.target - s.p) * (1 - Math.exp(-dt * 0.0072));
      }

      if (Math.abs(s.target - s.p) < 0.0004) {
        s.p = s.target;
      }

      if (s.p !== was || s.dirty) {
        s.dirty = false;
        paint();
      }

      // Smooth custom cursor tracking
      s.cx += (s.mx - s.cx) * 0.32;
      s.cy += (s.my - s.cy) * 0.32;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${s.cx.toFixed(1)}px,${s.cy.toFixed(1)}px,0)`;
      }

      animId = requestAnimationFrame(frame);
    };

    size();
    animId = requestAnimationFrame(frame);

    const handleResize = () => size();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [size, paint]);

  // Pointer & Drag handlers
  const handlePointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && ringRef.current) {
      ringRef.current.classList.add('show');
    }
  };

  const handlePointerLeave = () => {
    if (ringRef.current) {
      ringRef.current.classList.remove('show');
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const s = stateRef.current;
    s.mx = e.clientX - rect.left;
    s.my = e.clientY - rect.top;

    if (!s.down) return;
    const dx = e.clientX - s.sx;
    s.moved = Math.max(s.moved, Math.abs(dx));
    const PULL = Math.max(150, s.W * 0.2);
    s.target = s.st + dx / PULL;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    const s = stateRef.current;
    s.down = true;
    s.sx = e.clientX;
    s.st = s.target;
    s.moved = 0;
    if (stageRef.current) {
      try {
        stageRef.current.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    if (ringRef.current) {
      ringRef.current.classList.add('drag');
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const s = stateRef.current;
    if (!s.down) return;
    s.down = false;
    if (ringRef.current) {
      ringRef.current.classList.remove('drag');
    }

    if (s.moved < 6) {
      // Click jump to model
      const hit = document
        .elementsFromPoint(e.clientX, e.clientY)
        .find((x) => x.classList && x.classList.contains('m'));
      if (hit) {
        const idx = Number((hit as HTMLElement).dataset.i);
        if (!isNaN(idx)) {
          let d = wrap(idx - s.target, N);
          d = Math.round(d);
          if (d > 0 && d < N) {
            s.target = Math.round(s.target) + d;
          }
        }
      }
    } else {
      s.target = Math.round(s.target);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const s = stateRef.current;
    s.target += clamp(e.deltaY + e.deltaX, -120, 120) / 420;
    clearTimeout(s.wheelTimer);
    s.wheelTimer = window.setTimeout(() => {
      s.target = Math.round(s.target);
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const s = stateRef.current;
    if (['ArrowRight', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      s.target = Math.round(s.target) + 1;
    }
    if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      s.target = Math.round(s.target) - 1;
    }
  };

  return (
    <section
      id="ladies-section"
      className="ll-root relative isolate w-full bg-white text-[#16191f] select-none"
      style={
        {
          '--u': 'min(calc(100vw / 1600), calc(100vh / 900))',
          '--ink': '#16191f',
          '--mid': '#737b86',
          '--dim': '#a4adb8',
          '--line': '#e6ebf0',
          '--ice': '#e9f0f7',
        } as React.CSSProperties
      }
    >
      {/* ================================================================== */}
      {/* Main 3D Depth Lookbook Stage & Product Rail Track                  */}
      {/* ================================================================== */}
      <main className="relative grid grid-cols-1 md:grid-cols-[1fr_calc(372*var(--u))] min-h-0 flex-1 w-full h-full overflow-hidden">
        {/* Stage Area */}
        <section
          ref={stageRef}
          id="stage"
          tabIndex={0}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          aria-label="Runway looks. Drag, scroll or use arrow keys to change look."
          className="stage relative overflow-hidden min-w-0 touch-pan-y user-select-none cursor-default md:cursor-none h-[calc(100vh-270px)] md:h-full"
          style={{
            background:
              'linear-gradient(transparent 60%, rgba(255,255,255,0.72) 100%), linear-gradient(90deg, #f1f5fa 0%, #e7eff6 38%, #eef4f9 62%, #f6f9fc 100%)',
          }}
        >
          {/* Models Line Container */}
          <div ref={lineRef} className="line absolute inset-0 pointer-events-none">
            {LADIES_LOOK_BOUNDS.map(([a, b], i) => {
              const r = (b - a) / (LADIES_MODEL_Y1 - LADIES_MODEL_Y0);
              return (
                <div
                  key={i}
                  data-i={i}
                  ref={(el) => {
                    if (el) {
                      peopleRefs.current[i] = { el, r, f: '', o: '' };
                    }
                  }}
                  className="m absolute left-0 top-0 cursor-pointer pointer-events-auto will-change-transform"
                  style={{
                    transformOrigin: '0 0',
                  }}
                >
                  {/* Floor Shadow */}
                  <div
                    className="absolute left-[8%] right-[8%] -bottom-[1.6%] h-[3.6%] rounded-full pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(closest-side, rgba(70,85,105,0.24), transparent)',
                    }}
                  />
                  {/* Model SVG Visual */}
                  <div className="w-full h-full relative">
                    {renderCroppedSvg(
                      LADIES_MODELS_SHEET,
                      a,
                      LADIES_MODEL_Y0,
                      b - a,
                      LADIES_MODEL_Y1 - LADIES_MODEL_Y0,
                      960,
                      540
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Intro Text Overlay (Top Left) */}
          <div className="intro absolute z-10 left-4 sm:left-[calc(46*var(--u))] top-4 sm:top-[calc(36*var(--u))] max-w-[calc(100%-32px)] sm:max-w-[calc(390*var(--u))] pointer-events-none">
            <h2 className="font-['Michroma'] uppercase font-normal text-sm sm:text-[calc(22*var(--u))] leading-tight tracking-[0.16em] text-[#16191f]">
              {ladiesSettings.seasonTitle || 'Spring Summer 2027'}
            </h2>
            <p className="hidden sm:block mt-[calc(16*var(--u))] text-xs sm:text-[calc(14*var(--u))] leading-[1.62] tracking-[0.012em] text-[#737b86]">
              {ladiesSettings.subtitle ||
                'A study in softness and strength. The new season collection blends delicate textures and modern silhouettes, crafted for a more beautiful tomorrow.'}
            </p>
          </div>

          {/* Tag Overlay & Look Number Roll (Bottom Left) */}
          <div className="tag absolute z-10 left-4 sm:left-[calc(46*var(--u))] bottom-4 sm:bottom-[calc(44*var(--u))]">
            <div
              className="look flex font-['Michroma'] uppercase text-lg sm:text-[calc(29*var(--u))] leading-[30px] sm:leading-[calc(38*var(--u))] tracking-[0.14em] gap-2 pointer-events-none text-[#16191f]"
              aria-live="polite"
            >
              <span>Look</span>
              <span className="win h-[30px] sm:h-[calc(38*var(--u))] overflow-hidden block">
                <span
                  ref={rollRef}
                  id="roll"
                  className="roll block will-change-transform"
                >
                  {Array.from({ length: N + 1 }).map((_, idx) => (
                    <b
                      key={idx}
                      className="block font-normal h-[30px] sm:h-[calc(38*var(--u))] text-[#16191f]"
                    >
                      {firstLookNumber + (idx % N)}
                    </b>
                  ))}
                </span>
              </span>
            </div>

            {/* Shop the Look Action */}
            <button
              type="button"
              onClick={handleShopCurrentLook}
              className="shop inline-block mt-2 sm:mt-[calc(13*var(--u))] font-['Michroma'] uppercase text-[10px] sm:text-[calc(9.5*var(--u))] tracking-[0.14em] pb-[2px] sm:pb-[calc(4*var(--u))] border-b border-current text-[#16191f] hover:text-[#737b86] transition-colors cursor-pointer"
            >
              Shop the look ↗
            </button>
          </div>

          {/* Custom Mouse Follower Ring */}
          <div
            ref={ringRef}
            id="ring"
            className="ring hidden md:block absolute z-30 left-0 top-0 w-[calc(46*var(--u))] h-[calc(46*var(--u))] -ml-[calc(23*var(--u))] -mt-[calc(23*var(--u))] border-[calc(2.5*var(--u))] border-[#16191f] rounded-full pointer-events-none opacity-0 transition-all duration-200"
          />
        </section>

        {/* ================================================================== */}
        {/* Looping Product Rail (Right Column on Desktop, Bottom on Mobile)   */}
        {/* ================================================================== */}
        <aside
          ref={railRef}
          id="rail"
          aria-label="Pieces in this look"
          className="rail relative overflow-hidden bg-[#f3f6fa] min-h-0 h-[190px] md:h-full border-t md:border-t-0 md:border-l border-[#e6ebf0]"
        >
          {pieces.map((piece, i) => {
            const isFav = !!favorites[piece.id];
            const isAlt = i % 2 === 1;

            return (
              <article
                key={piece.id}
                ref={(el) => {
                  if (el) cardRefs.current[i] = el;
                }}
                className={`card absolute left-0 top-0 flex flex-col will-change-transform transition-colors ${
                  isAlt ? 'bg-white' : 'bg-[#f3f6fa]'
                } p-3 sm:p-[calc(18*var(--u))] sm:px-[calc(24*var(--u))]`}
                style={{
                  width: '100%',
                }}
              >
                {/* Favorite Heart Button */}
                <button
                  type="button"
                  aria-pressed={isFav}
                  aria-label={`Save ${piece.name}`}
                  onClick={() => handleToggleFavorite(piece.id)}
                  className="fav absolute left-2.5 sm:left-[calc(22*var(--u))] top-2.5 sm:top-[calc(18*var(--u))] w-5 h-5 sm:w-[calc(22*var(--u))] sm:h-[calc(22*var(--u))] z-10 text-[#16191f] cursor-pointer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-full h-full stroke-current stroke-[1.4] transition-colors"
                    style={{
                      fill: isFav ? '#d8a7a0' : 'none',
                      stroke: isFav ? '#b98179' : 'currentColor',
                    }}
                  >
                    <path d="M12 20S3.5 15 3.5 9A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20.5 9C20.5 15 12 20 12 20Z" />
                  </svg>
                </button>

                {/* Product Image Shot */}
                <span className="shot flex-1 min-h-0 block w-full relative overflow-hidden py-1">
                  {piece.customImage ? (
                    <img
                      src={piece.customImage}
                      alt={piece.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : piece.box ? (
                    renderCroppedSvg(
                      LADIES_PIECES_SHEET,
                      piece.box[0],
                      piece.box[2],
                      piece.box[1] - piece.box[0],
                      piece.box[3] - piece.box[2],
                      960,
                      720
                    )
                  ) : null}
                </span>

                {/* Product Meta & Plus Action */}
                <div className="meta grid grid-cols-[1fr_auto] items-end mt-1 sm:mt-[calc(8*var(--u))]">
                  <h3 className="font-['Michroma'] uppercase font-normal text-[9px] sm:text-[calc(9.5*var(--u))] tracking-[0.14em] text-[#16191f] line-clamp-1">
                    {piece.name}
                  </h3>
                  <span className="block col-start-1 mt-0.5 sm:mt-[calc(6*var(--u))] text-[11px] sm:text-[calc(12.5*var(--u))] text-[#737b86] tracking-[0.03em] font-medium font-sans">
                    {formatCurrency(piece.price, currencySymbol)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Add ${piece.name} to cart`}
                    onClick={() => handleAddPieceToCart(piece)}
                    className="add col-start-2 row-start-1 row-end-3 w-6 h-6 sm:w-[calc(26*var(--u))] sm:h-[calc(26*var(--u))] relative cursor-pointer active:scale-95 group transition-transform"
                  >
                    <span className="absolute left-1/2 top-1/2 w-3 sm:w-[calc(15*var(--u))] h-[1.5px] -ml-1.5 sm:-ml-[calc(7.5*var(--u))] -mt-[0.75px] bg-[#16191f] group-hover:rotate-90 transition-transform duration-200" />
                    <span className="absolute left-1/2 top-1/2 w-3 sm:w-[calc(15*var(--u))] h-[1.5px] -ml-1.5 sm:-ml-[calc(7.5*var(--u))] -mt-[0.75px] bg-[#16191f] rotate-90" />
                  </button>
                </div>
              </article>
            );
          })}
        </aside>
      </main>
    </section>
  );
};
