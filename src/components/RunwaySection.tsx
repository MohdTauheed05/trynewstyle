import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Look, Product } from '../types';
import { addToBag } from '../services/bagStorage';
import { formatCurrency } from '../services/storeSettings';

interface RunwaySectionProps {
  looks: Look[];
  products: Product[];
  shopName?: string;
  shopTagline?: string;
  currencySymbol?: string;
  onOpenBag: () => void;
  onNavigateToAdmin?: () => void;
}

export const RunwaySection: React.FC<RunwaySectionProps> = ({
  looks,
  products,
  shopName = 'Try the Look.',
  shopTagline = 'Six looks, styled head to toe. Tap a pin to see the piece.',
  currencySymbol = '$',
  onOpenBag: _onOpenBag,
  onNavigateToAdmin: _onNavigateToAdmin,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const lbStageRef = useRef<HTMLDivElement | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isEngaged, setIsEngaged] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomedLook, setZoomedLook] = useState<Look | null>(null);
  const [hotPinNum, setHotPinNum] = useState<number | null>(null);
  const [activeFittingProduct, setActiveFittingProduct] = useState<Product | null>(null);

  // Array of product IDs currently worn/fitted onto the active model
  const [wornProductIds, setWornProductIds] = useState<string[]>([]);

  // Card picking & selection state
  // key: `${lookIndex}-${cardNum}`
  const [openPickerCard, setOpenPickerCard] = useState<string | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({});
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleMessage, setBundleMessage] = useState<string>('');

  // Mobile bottom sheet host state
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileSheetProduct, setMobileSheetProduct] = useState<{
    product: Product;
    lookIndex: number;
    cardNum: number;
  } | null>(null);

  // Carousel physics state ref
  const animRef = useRef({
    cur: -1.15,
    target: 0,
    vel: 0,
    still: false,
    dragging: false,
    startX: 0,
    startY: 0,
    startTarget: 0,
    pointerId: -1,
    velocitySamples: [] as Array<{ x: number; time: number }>,
    lastTime: performance.now(),
    rAfId: 0,
    stageWidth: 1000,
    stageHeight: 600,
    isMobile: false,
    panelHover: false,
    cursorX: 0,
    cursorY: 0,
    cursorTargetX: 0,
    cursorTargetY: 0,
    cursorState: 'idle' as 'idle' | 'drag' | 'view' | 'link',
    feetOffsets: {} as Record<string, number>,
  });

  const activeLook = looks[activeIndex] || looks[0];

  // Helper to find Product by id
  const getProduct = useCallback(
    (id: string): Product | undefined => products.find((p) => p.id === id),
    [products]
  );

  // Bundle calculations for the active look
  const lookProducts = (activeLook?.productIds || [])
    .map((id) => getProduct(id))
    .filter((p): p is Product => Boolean(p));

  const totalRawPrice = lookProducts.reduce((sum, p) => sum + p.price, 0);
  const bundleDiscountPrice = totalRawPrice * 0.9;

  // Check if active look is completely added
  const isLookComplete =
    lookProducts.length > 0 &&
    lookProducts.every((_, i) => addedItems[`${activeIndex}-${i + 1}`]);

  // Feet detection scan using small offscreen canvas
  const detectFeet = useCallback((look: Look) => {
    if (animRef.current.feetOffsets[look.src640] !== undefined) return;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = look.src640;
      img.onload = () => {
        try {
          const w = 48;
          const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h).data;
          let lastRow = h - 1;
          for (let y = h - 1; y >= 0; y--) {
            let rowHasPixel = false;
            for (let x = 0; x < w; x++) {
              const alpha = imgData[(y * w + x) * 4 + 3];
              if (alpha > 40) {
                rowHasPixel = true;
                break;
              }
            }
            if (rowHasPixel) {
              lastRow = y;
              break;
            }
          }
          const offset = Math.min(0.4, Math.max(0, (h - 1 - lastRow) / h));
          animRef.current.feetOffsets[look.src640] = offset;
        } catch {
          animRef.current.feetOffsets[look.src640] = 0;
        }
      };
      img.onerror = () => {
        animRef.current.feetOffsets[look.src640] = 0;
      };
    } catch {
      animRef.current.feetOffsets[look.src640] = 0;
    }
  }, []);

  useEffect(() => {
    looks.forEach(detectFeet);
  }, [looks, detectFeet]);

  // Switch look
  const moveTo = useCallback(
    (T: number) => {
      animRef.current.target = T;
      animRef.current.still = false;
      const n = looks.length;
      const newIndex = ((Math.round(T) % n) + n) % n;
      setActiveIndex(newIndex);
      setHotPinNum(null);
      setOpenPickerCard(null);
      setBundleMessage('');
      if (stageRef.current) {
        stageRef.current.classList.remove('is-sweep');
        void stageRef.current.offsetWidth;
        stageRef.current.classList.add('is-sweep');
      }
    },
    [looks.length]
  );

  const go = useCallback(
    (i: number) => {
      const n = looks.length;
      let d = (i - activeIndex) % n;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      moveTo(Math.round(animRef.current.target) + d);
    },
    [activeIndex, looks.length, moveTo]
  );

  const next = useCallback(() => {
    moveTo(Math.round(animRef.current.target) + 1);
  }, [moveTo]);

  const prev = useCallback(() => {
    moveTo(Math.round(animRef.current.target) - 1);
  }, [moveTo]);

  // Autoplay loop timer
  useEffect(() => {
    if (!isPlaying || isZoomed || isEngaged) return;

    const interval = setInterval(() => {
      if (!animRef.current.panelHover && !animRef.current.dragging) {
        next();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isPlaying, isZoomed, isEngaged, next]);

  // Highlight hot pin & corresponding product
  const triggerHot = useCallback(
    (num: number, scrollIntoView = false) => {
      setHotPinNum(num);
      setIsEngaged(true);
      setIsPlaying(false);

      const look = looks[activeIndex];
      const pin = look?.pins.find((p) => p.num === num) || look?.pins[num - 1];
      if (pin) {
        const prod = getProduct(pin.productId);
        if (prod) {
          setActiveFittingProduct(prod);
          // Auto-wear the garment so it is visible immediately on the model
          setWornProductIds((prev) => (prev.includes(prod.id) ? prev : [...prev, prod.id]));
        }
      }

      if (scrollIntoView) {
        const cardElem = document.querySelector(`[data-rw-card="${num}"]`);
        if (cardElem) {
          cardElem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    },
    [activeIndex, getProduct, looks]
  );

  // Directly Fit & Wear a Garment on the Model
  const handleFitProduct = (product: Product, cardNum: number) => {
    setIsEngaged(true);
    setIsPlaying(false);
    setActiveFittingProduct(product);

    // Toggle wearing on model
    setWornProductIds((prev) => {
      if (prev.includes(product.id)) {
        return prev.filter((id) => id !== product.id);
      } else {
        return [...prev, product.id];
      }
    });

    const look = looks[activeIndex];
    const pin = look?.pins.find((p) => p.productId === product.id) || look?.pins[cardNum - 1];
    if (pin) {
      setHotPinNum(pin.num);
    } else {
      setHotPinNum(cardNum);
    }

    // Scroll to card
    const cardElem = document.querySelector(`[data-rw-card="${cardNum}"]`);
    if (cardElem) {
      cardElem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  // Measure stage geometry
  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    animRef.current.stageWidth = rect.width;
    animRef.current.stageHeight = rect.height;
    const isMobile = window.innerWidth <= 749;
    animRef.current.isMobile = isMobile;

    const fs = isMobile ? 1.0 : 1.08;
    const modelH = isMobile
      ? Math.max(200, Math.round(rect.height - 24 - 18))
      : Math.max(200, Math.round((rect.height - 34 - 18) / 1.08));

    const hx = isMobile ? rect.width * 0.3 : rect.width * 0.5;
    const hy = isMobile ? 22 : 34;

    stage.style.setProperty('--rw-model-h', `${modelH}px`);
    stage.style.setProperty('--rw-fs', `${fs}`);
    stage.style.setProperty('--rw-hx', `${hx}px`);
    stage.style.setProperty('--rw-hy', `${hy}px`);
  }, []);

  // Main animation frame loop
  useEffect(() => {
    measure();
    const handleResize = () => measure();
    window.addEventListener('resize', handleResize);

    const K = 95;
    const C = 2 * Math.sqrt(K); // ~19.49

    const loop = (now: number) => {
      const dt = Math.min(0.034, (now - animRef.current.lastTime) / 1000 || 1 / 60);
      animRef.current.lastTime = now;

      // 3 sub-steps for crisp numerical spring integration
      const subSteps = 3;
      const h = dt / subSteps;
      for (let s = 0; s < subSteps; s++) {
        const diff = animRef.current.cur - animRef.current.target;
        const acc = -K * diff - C * animRef.current.vel;
        animRef.current.vel += acc * h;
        animRef.current.cur += animRef.current.vel * h;
      }

      const settled =
        Math.abs(animRef.current.cur - animRef.current.target) <= 0.0005 &&
        Math.abs(animRef.current.vel) <= 0.0005;

      if (settled) {
        animRef.current.cur = animRef.current.target;
        animRef.current.vel = 0;
        animRef.current.still = true;
      } else {
        animRef.current.still = false;
      }

      if (sectionRef.current) {
        if (animRef.current.still) {
          sectionRef.current.classList.add('rw--still');
        } else {
          sectionRef.current.classList.remove('rw--still');
        }
      }

      // Render 3D ring positioning on body elements
      const stage = stageRef.current;
      if (stage) {
        const bodies = stage.querySelectorAll<HTMLElement>('.rw__model[data-rw-model]');
        const W = animRef.current.stageWidth;
        const H = animRef.current.stageHeight;
        const isMobile = animRef.current.isMobile;
        const nBodies = bodies.length;

        if (!isMobile) {
          // 3D Ring layout (Desktop)
          const cx = 0.5 * W;
          const R = 0.62 * W;
          const P = 1.65 * W;
          const floor = H - 34;
          const horizon = 0.36 * H;
          const step = (2 * Math.PI) / nBodies;
          const cur = animRef.current.cur;
          const fs = 1.08;

          bodies.forEach((body, idx) => {
            let phi = ((idx - cur) * step) % (2 * Math.PI);
            if (phi > Math.PI) phi -= 2 * Math.PI;
            if (phi <= -Math.PI) phi += 2 * Math.PI;

            const z = R * (1 - Math.cos(phi));
            const persp = P / (P + z);
            const sl = Math.abs(phi) / step;
            const scale = persp * (1 + (fs - 1) * Math.max(0, Math.min(1, 1 - sl)));
            const x = cx + R * Math.sin(phi) * persp;
            const feet = horizon + (floor - horizon) * persp;
            const bottom = H - feet;
            const blur = sl <= 1 ? 1.8 * sl : Math.min(1.8 + (sl - 1) * 2, 6.5);
            let opacity = Math.max(0, Math.min(1, (Math.cos(phi) + 0.55) / 0.3));

            // At rest, the identical front hero takes front spot
            if (animRef.current.still && sl < 0.02) {
              opacity = 0;
            }

            const w = body.offsetWidth || 300;
            if (x + (w * scale) / 2 < -4 || x - (w * scale) / 2 > W + 4) {
              opacity = 0;
            }

            body.style.transform = `translate3d(${x.toFixed(1)}px, ${(-bottom).toFixed(1)}px, 0) translateX(-50%) scale(${scale.toFixed(3)})`;
            body.style.opacity = opacity.toFixed(3);
            body.style.zIndex = `${Math.round(scale * 1000)}`;
            body.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : 'none';
            body.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
            body.style.pointerEvents = opacity < 0.5 ? 'none' : 'auto';
          });
        } else {
          // Classic Line layout (Mobile)
          const ax = 0.3;
          const ay = 22;
          const sx = 0.32;
          const sy = 22;
          const sr = 0.76;
          const cur = animRef.current.cur;

          bodies.forEach((body, idx) => {
            const k = ((idx - cur) % nBodies + nBodies) % nBodies;
            if (k >= 4) {
              body.style.opacity = '0';
              body.style.visibility = 'hidden';
              return;
            }
            const x = W * (ax + sx * k);
            const bottom = ay + sy * k;
            const scale = Math.pow(sr, k);
            let opacity = Math.max(0, 1 - 0.13 * k);
            const blur = Math.min(0.9 * k, 3.2);

            if (animRef.current.still && k < 0.05) {
              opacity = 0;
            }

            body.style.transform = `translate3d(${x.toFixed(1)}px, ${(-bottom).toFixed(1)}px, 0) translateX(-50%) scale(${scale.toFixed(3)})`;
            body.style.opacity = opacity.toFixed(3);
            body.style.zIndex = `${1000 - Math.round(10 * k)}`;
            body.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : 'none';
            body.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
          });
        }
      }

      // Cursor position interpolation (desktop)
      const cursorElem = stage?.querySelector<HTMLElement>('[data-rw-cursor]');
      if (cursorElem) {
        animRef.current.cursorX +=
          (animRef.current.cursorTargetX - animRef.current.cursorX) * 0.18;
        animRef.current.cursorY +=
          (animRef.current.cursorTargetY - animRef.current.cursorY) * 0.18;
        cursorElem.style.transform = `translate3d(${animRef.current.cursorX.toFixed(1)}px, ${animRef.current.cursorY.toFixed(1)}px, 0)`;
      }

      animRef.current.rAfId = requestAnimationFrame(loop);
    };

    animRef.current.rAfId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current.rAfId);
      window.removeEventListener('resize', handleResize);
    };
  }, [measure]);

  // Pointer drag events on stage
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    animRef.current.dragging = true;
    animRef.current.startX = e.clientX;
    animRef.current.startY = e.clientY;
    animRef.current.startTarget = animRef.current.target;
    animRef.current.pointerId = e.pointerId;
    animRef.current.velocitySamples = [{ x: e.clientX, time: performance.now() }];
    sectionRef.current?.classList.add('is-dragging');
    if (e.pointerType === 'mouse') {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Track cursor target
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect) {
      animRef.current.cursorTargetX = e.clientX - rect.left;
      animRef.current.cursorTargetY = e.clientY - rect.top;
    }

    if (!animRef.current.dragging) return;
    const dx = e.clientX - animRef.current.startX;
    const dy = e.clientY - animRef.current.startY;

    if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
      // Allow vertical page scroll
      animRef.current.dragging = false;
      sectionRef.current?.classList.remove('is-dragging');
      return;
    }

    if (e.pointerType === 'touch' && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    const unit = animRef.current.isMobile
      ? Math.max(90, animRef.current.stageWidth * 0.32 * 1.6)
      : Math.max(120, 0.3 * animRef.current.stageWidth);

    animRef.current.target = animRef.current.startTarget - dx / unit;
    animRef.current.still = false;

    // Track velocity samples
    const now = performance.now();
    animRef.current.velocitySamples.push({ x: e.clientX, time: now });
    if (animRef.current.velocitySamples.length > 6) {
      animRef.current.velocitySamples.shift();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!animRef.current.dragging) return;
    animRef.current.dragging = false;
    sectionRef.current?.classList.remove('is-dragging');
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const samples = animRef.current.velocitySamples;
    let vx = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = last.time - first.time;
      if (dt > 0) {
        vx = (last.x - first.x) / dt;
      }
    }

    const from = Math.round(animRef.current.startTarget);
    const dx = e.clientX - animRef.current.startX;

    if (animRef.current.isMobile) {
      if (Math.abs(dx) > 30 || Math.abs(vx) > 0.3) {
        const step = dx > 0 ? -1 : 1;
        moveTo(from + step);
      } else {
        moveTo(from);
      }
    } else {
      const unit = Math.max(120, 0.3 * animRef.current.stageWidth);
      let targetIndex = Math.round(animRef.current.target - (vx * 160) / unit);
      if (targetIndex === from && Math.abs(vx) > 0.3) {
        targetIndex += vx > 0 ? -1 : 1;
      }
      targetIndex = Math.max(from - 2, Math.min(from + 2, targetIndex));
      moveTo(targetIndex);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    } else if (e.key === 'Escape') {
      if (mobileSheetOpen) {
        setMobileSheetOpen(false);
      } else if (isZoomed) {
        setIsZoomed(false);
      }
    }
  };

  // Open "View look" lightbox
  const openLightbox = (look: Look) => {
    setZoomedLook(look);
    setIsZoomed(true);
    setIsEngaged(true);
    setIsPlaying(false);
  };

  const closeLightbox = () => {
    setIsZoomed(false);
    setHotPinNum(null);
  };

  // Add single piece
  const handleAddPiece = (product: Product, cardNum: number) => {
    const cardKey = `${activeIndex}-${cardNum}`;
    const selectedSize = selectedSizes[cardKey] || product.sizes[0];
    const variant =
      product.variants.find((v) => v.o.includes(selectedSize)) || product.variants[0];

    if (!variant) return;
    // one click = one add (ignore clicks while this card is already adding)
    if (loadingItems[cardKey]) return;

    setLoadingItems((prev) => ({ ...prev, [cardKey]: true }));

    setTimeout(() => {
      addToBag([{ variantId: variant.id, product, size: selectedSize }]);
      setLoadingItems((prev) => ({ ...prev, [cardKey]: false }));
      setAddedItems((prev) => ({ ...prev, [cardKey]: true }));
      setOpenPickerCard(null);
      setMobileSheetOpen(false);
    }, 400);
  };

  // Add full look to bag
  const handleAddFullLook = () => {
    if (isLookComplete || bundleLoading) return;

    setBundleLoading(true);
    setBundleMessage('');

    // Check sizes
    const itemsToAdd: Array<{ variantId: number; product: Product; size: string }> = [];
    const missingSizes: string[] = [];

    lookProducts.forEach((product, idx) => {
      const cardNum = idx + 1;
      const cardKey = `${activeIndex}-${cardNum}`;
      if (addedItems[cardKey]) return;

      const size = selectedSizes[cardKey] || product.sizes[0];
      const variant =
        product.variants.find((v) => v.o.includes(size)) || product.variants[0];

      if (variant) {
        itemsToAdd.push({ variantId: variant.id, product, size });
      } else {
        missingSizes.push(product.name);
      }
    });

    setTimeout(() => {
      if (itemsToAdd.length > 0) {
        addToBag(itemsToAdd);
        itemsToAdd.forEach((_, idx) => {
          setAddedItems((prev) => ({ ...prev, [`${activeIndex}-${idx + 1}`]: true }));
        });
      }
      setBundleLoading(false);
    }, 500);
  };

  // 12 body array for continuous ring
  const n = looks.length;
  const totalBodiesCount = Math.max(12, n * Math.ceil(8 / n));
  const bodiesList = Array.from({ length: totalBodiesCount }).map((_, i) => {
    const look = looks[i % n];
    return { index: i, lookIndex: i % n, look, isClone: i >= n };
  });

  return (
    <section
      id="Runway-template--28035983671601__the_runway_wdM8BG"
      ref={sectionRef}
      className={`rw rw--add-icon rw--popup rw--list has-dividers has-border rw--cursor rw--js ${
        isZoomed ? 'rw--zoom' : ''
      }`}
      data-feel="balanced"
      data-blur="true"
      data-mblur="true"
      data-style="ring"
      data-mstyle="classic"
      data-fit="true"
      data-height-mode="original"
      data-height-vh="100"
      data-mheight-mode="custom"
      data-mheight-vh="109"
      data-reflect="false"
      data-autoplay={isPlaying ? 'true' : 'false'}
      data-speed="5000"
      data-after-add="stay"
      data-bundle-code=""
      data-msg-choose="Pick a size for: [items]"
      data-msg-error="Couldn’t add to bag. Please try again."
      data-msg-soldout="Sold out"
      style={{
        ['--rw-progress' as any]: ((activeIndex + 1) / looks.length).toFixed(3),
      }}
    >
      <div className="rw__sticky">
        <div className="rw__grid">
          {/* Left Column: Stage, Controls, Lightbox */}
          <div className="rw__left">
            {/* Header intro with editable shop name & tagline */}
            <div className="rw__head">
              <div className="rw__intro">
                <h2 className="rw__title">{shopName}</h2>
                <p className="rw__sub">{shopTagline}</p>
              </div>

              {/* Live Virtual Fit Callout Badge when clothes are worn / clicked */}
              {activeFittingProduct && (
                <div
                  className="hidden md:flex items-center gap-3 py-2 px-3.5 bg-black text-white text-xs border border-neutral-800 shadow-md"
                  style={{ animation: 'rw-rise 0.4s var(--rw-ease)' }}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-400">
                    Fitted Piece:
                  </span>
                  <span className="font-bold text-white">{activeFittingProduct.name}</span>
                  <span className="text-neutral-500">|</span>
                  <span className="text-[11px] text-neutral-300">
                    {activeFittingProduct.fitDescription || 'Contemporary streetwear silhouette'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setWornProductIds((prev) =>
                        prev.filter((id) => id !== activeFittingProduct.id)
                      );
                      setActiveFittingProduct(null);
                      setHotPinNum(null);
                    }}
                    className="ml-2 text-neutral-400 hover:text-white font-bold text-xs"
                    title="Remove fit"
                  >
                    ×
                  </button>
                </div>
              )}

              <span
                className="rw__sr"
                aria-live="polite"
                aria-atomic="true"
                data-rw-live
              >
                Look {activeIndex + 1}: {activeLook.name}
              </span>
            </div>

            {/* Stage */}
            <div
              className="rw__stage"
              ref={stageRef}
              data-rw-stage
              tabIndex={0}
              role="region"
              aria-roledescription="carousel"
              aria-label="Try the Look. — use arrow keys or swipe to change look"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onKeyDown={handleKeyDown}
              onPointerEnter={(e) => {
                const rect = stageRef.current?.getBoundingClientRect();
                if (rect) {
                  animRef.current.cursorTargetX = e.clientX - rect.left;
                  animRef.current.cursorTargetY = e.clientY - rect.top;
                  animRef.current.cursorX = animRef.current.cursorTargetX;
                  animRef.current.cursorY = animRef.current.cursorTargetY;
                }
                stageRef.current?.querySelector('.rw__cursor')?.classList.add('is-on');
              }}
              onPointerLeave={() => {
                const cursor = stageRef.current?.querySelector('.rw__cursor');
                cursor?.classList.remove('is-on', 'is-view', 'is-link');
              }}
            >
              {/* 1. Queue bodies */}
              <div className="rw__actors" data-rw-actors>
                {bodiesList.map((item) => {
                  const footOffset = animRef.current.feetOffsets[item.look.src640] || 0;
                  return (
                    <div
                      key={`body-${item.index}`}
                      className="rw__model"
                      data-rw-model
                      data-index={item.lookIndex}
                      aria-hidden="true"
                    >
                      <span className="rw__shadow" />
                      <div
                        className="rw__figure"
                        style={{ ['--rw-ar' as any]: '0.5625' }}
                      >
                        <div
                          className="rw__art"
                          style={{
                            transform: `translateY(calc(${footOffset} * 100%))`,
                          }}
                        >
                          <img
                            src={item.look.src640}
                            srcSet={`${item.look.src640} 640w, ${item.look.srcset1080} 1080w`}
                            sizes="(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px"
                            loading={item.isClone ? 'lazy' : 'eager'}
                            decoding="async"
                            width="1100"
                            height="1956"
                            draggable="false"
                            data-model-image
                            alt={item.look.name}
                            className="is-decoded"
                          />
                          <button
                            type="button"
                            className="rw__hit"
                            data-rw-go={item.index}
                            aria-label={`Look ${item.lookIndex + 1}: ${item.look.name}`}
                            tabIndex={-1}
                            onClick={() => go(item.lookIndex)}
                            onPointerEnter={() => {
                              stageRef.current
                                ?.querySelector('.rw__cursor')
                                ?.classList.add('is-link');
                            }}
                            onPointerLeave={() => {
                              stageRef.current
                                ?.querySelector('.rw__cursor')
                                ?.classList.remove('is-link');
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 2. Heroes */}
              <div className="rw__heroes" data-rw-heroes>
                {looks.map((look, idx) => {
                  const isCurrent = idx === activeIndex;
                  const footOffset = animRef.current.feetOffsets[look.src640] || 0;

                  return (
                    <div
                      key={`hero-${look.id || idx}`}
                      className={`rw__hero ${isCurrent ? 'is-on' : ''}`}
                      data-rw-hero
                      data-index={idx}
                      data-name={look.name}
                      data-label={`Look ${idx + 1}: ${look.name}`}
                      data-probe={look.src640}
                      aria-hidden={!isCurrent}
                    >
                      <div className="rw__figure" style={{ ['--rw-ar' as any]: '0.5625' }}>
                        <span className="rw__shadow" />
                        <div
                          className="rw__art"
                          style={{
                            transform: `translateY(calc(${footOffset} * 100%))`,
                          }}
                        >
                          {/* Model Base Image */}
                          <img
                            src={look.src640}
                            srcSet={`${look.src640} 640w, ${look.srcset1080} 1080w`}
                            sizes="(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px"
                            loading="eager"
                            decoding="async"
                            width="1100"
                            height="1956"
                            draggable="false"
                            data-model-image
                            alt={look.name}
                            className="is-decoded"
                          />

                          {/* ======================================================= */}
                          {/* VIRTUAL TRY-ON: MODEL WEARS THE CLICKED CLOTHES! */}
                          {/* ======================================================= */}
                          {isCurrent &&
                            wornProductIds.map((garmentId) => {
                              const garment = getProduct(garmentId);
                              if (!garment) return null;
                              const pin = look.pins.find((p) => p.productId === garment.id);
                              const posX = pin?.left ?? garment.defaultPinX ?? 50;
                              const posY =
                                pin?.top ??
                                garment.defaultPinY ??
                                (garment.category === 'shoes'
                                  ? 92
                                  : garment.category === 'pants'
                                  ? 70
                                  : 45);

                              const isShoe = garment.category === 'shoes';
                              const isBottom = garment.category === 'pants';
                              const widthStyle = isShoe ? '135px' : isBottom ? '180px' : '190px';

                              return (
                                <div
                                  key={`wear-${garment.id}`}
                                  className="rw__garment-wear"
                                  style={{
                                    left: `${posX}%`,
                                    top: `${posY}%`,
                                    width: widthStyle,
                                    transform: 'translate(-50%, -50%)',
                                  }}
                                  title={`Model wearing ${garment.name}`}
                                >
                                  <img
                                    src={garment.image}
                                    alt={garment.name}
                                    className="w-full h-auto object-contain pointer-events-none drop-shadow-2xl"
                                  />
                                </div>
                              );
                            })}

                          <button
                            type="button"
                            className="rw__zoom"
                            data-rw-zoom
                            aria-label={`View look: ${look.name}`}
                            tabIndex={isCurrent ? 0 : -1}
                            onClick={() => openLightbox(look)}
                            onPointerEnter={() => {
                              stageRef.current
                                ?.querySelector('.rw__cursor')
                                ?.classList.add('is-view');
                            }}
                            onPointerLeave={() => {
                              stageRef.current
                                ?.querySelector('.rw__cursor')
                                ?.classList.remove('is-view');
                            }}
                          />

                          {/* Pins on the Hero (shown on homepage and interactive) */}
                          <div className="rw__pins">
                            {look.pins.map((pin) => {
                              const prod = getProduct(pin.productId);
                              const isHot = hotPinNum === pin.num;
                              return (
                                <button
                                  key={pin.num}
                                  type="button"
                                  className={`rw__pin ${isHot ? 'is-hot' : ''}`}
                                  data-rw-pin={pin.num}
                                  data-tip={prod?.name || 'Product'}
                                  style={{
                                    left: `${pin.left}%`,
                                    top: `${pin.top}%`,
                                    ['--pi' as any]: pin.num,
                                  }}
                                  aria-label={`${pin.num}: ${prod?.name}`}
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHot(pin.num, true);
                                  }}
                                >
                                  <span className="rw__pin-dot">{pin.num}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 3. Light sweep */}
              <span className="rw__sweep" aria-hidden="true" />

              {/* 4. Custom cursor */}
              <span className="rw__cursor" data-rw-cursor aria-hidden="true">
                <span className="rw__cursor-in">
                  <span className="rw__cursor-label rw__cursor-drag">Drag</span>
                  <span className="rw__cursor-label rw__cursor-view">View</span>
                </span>
              </span>

              {/* 5. Mobile progress walk line */}
              <span className="rw__walk">
                <span className="rw__walk-line" />
              </span>
            </div>

            {/* Controls row */}
            <div className="rw__controls">
              <button
                type="button"
                className="rw__icon"
                data-rw-prev
                aria-label="Previous look"
                onClick={prev}
              >
                <svg
                  width="26"
                  height="14"
                  viewBox="0 0 26 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M25 7H1M7 1L1 7l6 6" />
                </svg>
              </button>

              <div className="rw__ticks">
                {looks.map((look, i) => {
                  const isCurrent = i === activeIndex;
                  const isPast = i < activeIndex;
                  return (
                    <button
                      key={look.id || i}
                      type="button"
                      className={`rw__tick ${isCurrent ? 'is-run' : ''} ${
                        isPast ? 'is-past' : ''
                      }`}
                      data-rw-tick={i}
                      aria-current={isCurrent ? 'true' : 'false'}
                      aria-label={`Look ${i + 1}: ${look.name}`}
                      onClick={() => go(i)}
                    >
                      <span className="rw__tick-bar" />
                      <span className="rw__tick-label">
                        0{i + 1}
                        <span className="rw__tick-name">
                          &nbsp;&nbsp;{look.name}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className={`rw__icon rw__auto ${isPlaying ? 'is-playing' : ''}`}
                data-rw-auto
                aria-pressed={isPlaying ? 'true' : 'false'}
                aria-label={isPlaying ? 'Pause autoplay' : 'Play autoplay'}
                onClick={() => {
                  setIsEngaged(false);
                  setIsPlaying(!isPlaying);
                }}
              >
                {isPlaying ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M6.5 4.5h3.5v15H6.5zM14 4.5h3.5v15H14z" />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M7 4.5v15l12.5-7.5z" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="rw__icon"
                data-rw-next
                aria-label="Next look"
                onClick={next}
              >
                <svg
                  width="26"
                  height="14"
                  viewBox="0 0 26 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M1 7h24M19 1l6 6-6 6" />
                </svg>
              </button>
            </div>

            {/* Lightbox / View Look Popup */}
            <div
              className="rw__lb"
              data-rw-lb
              data-word="Look"
              role="region"
              aria-label="View look"
              aria-hidden={!isZoomed}
            >
              <div
                className="rw__lb-stage"
                ref={lbStageRef}
                data-rw-lb-stage
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    closeLightbox();
                  }
                }}
              >
                {zoomedLook && (
                  <div
                    className="rw__lb-model"
                    style={{
                      ['--rw-model-h' as any]: '560px',
                    }}
                  >
                    <div
                      className="rw__figure"
                      style={{ ['--rw-ar' as any]: '0.5625' }}
                    >
                      <span className="rw__shadow" />
                      <div
                        className="rw__art"
                        style={{
                          transform: `translateY(calc(${
                            animRef.current.feetOffsets[zoomedLook.src640] || 0
                          } * 100%))`,
                        }}
                      >
                        <img
                          src={zoomedLook.src640}
                          srcSet={`${zoomedLook.src640} 640w, ${zoomedLook.srcset1080} 1080w`}
                          sizes="360px"
                          loading="eager"
                          decoding="async"
                          width="1100"
                          height="1956"
                          draggable="false"
                          alt={zoomedLook.name}
                          className="is-decoded"
                        />

                        {/* Interactive Pins in popup */}
                        <div className="rw__pins">
                          {zoomedLook.pins.map((pin) => {
                            const prod = getProduct(pin.productId);
                            const isHot = hotPinNum === pin.num;
                            return (
                              <button
                                key={pin.num}
                                type="button"
                                className={`rw__pin ${isHot ? 'is-hot' : ''}`}
                                data-rw-pin={pin.num}
                                data-tip={prod?.name || 'Product'}
                                style={{
                                  left: `${pin.left}%`,
                                  top: `${pin.top}%`,
                                  ['--pi' as any]: pin.num,
                                }}
                                aria-label={`${pin.num}: ${prod?.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerHot(pin.num, true);
                                }}
                              >
                                <span className="rw__pin-dot">{pin.num}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="rw__lb-top">
                <p className="rw__lb-cap">
                  <span className="rw__lb-kicker" data-rw-lb-kicker>
                    Look 0{activeIndex + 1}
                  </span>
                  <span className="rw__lb-name" data-rw-lb-name>
                    {zoomedLook?.name || activeLook.name}
                  </span>
                </p>
                <button
                  type="button"
                  className="rw__lb-close"
                  data-rw-zoom-close
                  aria-label="Close"
                  onClick={closeLightbox}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M5 5l14 14M19 5L5 19" />
                  </svg>
                </button>
              </div>

              <p className="rw__lb-hint">Tap a dot to shop or see fit</p>
            </div>
          </div>

          {/* Right Column: "In this look" Panel */}
          <div
            className={`rw__panel has-rule ${isLookComplete ? 'is-complete' : ''}`}
            onPointerEnter={() => {
              animRef.current.panelHover = true;
            }}
            onPointerLeave={() => {
              animRef.current.panelHover = false;
            }}
          >
            <div className="rw__panel-inner">
              <div className="rw__panel-head">
                <h3 className="rw__panel-title">In this look</h3>
                <span className="rw__label is-swap" data-rw-pieces>
                  {lookProducts.length} pieces
                </span>
              </div>

              {/* Look panels */}
              {looks.map((look, lIdx) => {
                const isCurrent = lIdx === activeIndex;
                const items = (look.productIds || [])
                  .map((id) => getProduct(id))
                  .filter((p): p is Product => Boolean(p));

                return (
                  <div
                    key={`panel-${look.id || lIdx}`}
                    className={`rw__look-panel ${isCurrent ? 'is-in' : ''}`}
                    data-rw-panel={lIdx}
                    hidden={!isCurrent}
                  >
                    {/* Phone-only header */}
                    <div className="rw__mhead">
                      <span className="rw__mhead-title">{look.name}</span>
                      <span className="rw__label">{items.length} pieces</span>
                    </div>

                    {/* Products list */}
                    <ul className="rw__items" role="list">
                      {items.map((prod, pIdx) => {
                        const cardNum = pIdx + 1;
                        const cardKey = `${lIdx}-${cardNum}`;
                        const isPicking = openPickerCard === cardKey;
                        const isAdded = addedItems[cardKey];
                        const isLoading = loadingItems[cardKey];
                        const isHot = hotPinNum === cardNum;
                        const isWorn = wornProductIds.includes(prod.id);
                        const currentSize = selectedSizes[cardKey] || prod.sizes[0];

                        // Has tag "New"? Look 2 item 2 or look 3 item 2
                        const hasNewTag =
                          (lIdx === 1 && cardNum === 2) ||
                          (lIdx === 2 && cardNum === 2);

                        return (
                          <li
                            key={`${prod.id}-${cardNum}`}
                            className={`rw__item ${isPicking ? 'is-picking' : ''} ${
                              isAdded ? 'is-added' : ''
                            } ${isLoading ? 'is-loading' : ''} ${
                              isHot ? 'is-hot' : ''
                            }`}
                            data-rw-card={cardNum}
                            data-title={prod.name}
                            style={{ ['--i' as any]: cardNum }}
                            onPointerEnter={() => {
                              setHotPinNum(cardNum);
                              setActiveFittingProduct(prod);
                            }}
                            onPointerLeave={() => {
                              if (hotPinNum === cardNum && !isWorn) {
                                setHotPinNum(null);
                              }
                            }}
                          >
                            {hasNewTag && (
                              <span className="rw__tag">
                                <span className="rw__tag-text">New</span>
                              </span>
                            )}

                            <a
                              className="rw__media"
                              href={prod.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              tabIndex={-1}
                              aria-hidden="true"
                              onClick={(e) => {
                                // clicking thumbnail also fits piece onto model
                                e.preventDefault();
                                handleFitProduct(prod, cardNum);
                              }}
                            >
                              <img
                                src={prod.image}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                width="400"
                                height={prod.imageHeight || 400}
                              />
                              <span className="rw__num">{cardNum}</span>
                            </a>

                            <div className="rw__info">
                              <span className="rw__type">{prod.vendor}</span>
                              <a
                                className="rw__name"
                                href={prod.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {prod.name}
                              </a>
                              <span className="rw__price">
                                <span>{formatCurrency(prod.price, currencySymbol)}</span>
                              </span>
                            </div>

                            {/* Add button */}
                            <button
                              type="button"
                              className="rw__add"
                              data-rw-add
                              aria-expanded={isPicking ? 'true' : 'false'}
                              aria-controls={`Picker-${look.key}-${cardNum}`}
                              aria-label={
                                isAdded
                                  ? `Added to bag: ${prod.name}`
                                  : `Add to bag: ${prod.name}`
                              }
                              onClick={() => {
                                setIsEngaged(true);
                                setIsPlaying(false);
                                if (isAdded) return;

                                if (window.innerWidth <= 749) {
                                  // Mobile bottom sheet host
                                  setMobileSheetProduct({
                                    product: prod,
                                    lookIndex: lIdx,
                                    cardNum,
                                  });
                                  setMobileSheetOpen(true);
                                } else {
                                  // Inline desktop picker
                                  setOpenPickerCard(isPicking ? null : cardKey);
                                }
                              }}
                            >
                              <svg
                                className="rw__icon-plus"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                fill="none"
                                aria-hidden="true"
                              >
                                <path d="M12 4v16M4 12h16" />
                              </svg>

                              <svg
                                className="rw__icon-check"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                fill="none"
                                aria-hidden="true"
                              >
                                <path d="M4.5 12.5l5 5L19.5 7" />
                              </svg>

                              <svg
                                className="rw__icon-spinner"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                fill="none"
                                aria-hidden="true"
                              >
                                <path d="M12 3a9 9 0 1 1-9 9" />
                              </svg>
                            </button>

                            {/* Inline picker (desktop) */}
                            {isPicking && (
                              <div
                                id={`Picker-${look.key}-${cardNum}`}
                                className="rw__picker"
                                data-rw-picker
                              >
                                <fieldset className="rw__opt">
                                  <legend className="rw__opt-name">
                                    {prod.optionLegend}
                                  </legend>
                                  <div className="rw__pills">
                                    {prod.sizes.map((s) => (
                                      <label key={s} className="rw__pill">
                                        <input
                                          type="radio"
                                          name={`Opt-${look.key}-${cardNum}-1`}
                                          value={s}
                                          checked={currentSize === s}
                                          onChange={() => {
                                            setSelectedSizes((prev) => ({
                                              ...prev,
                                              [cardKey]: s,
                                            }));
                                          }}
                                          data-rw-option="0"
                                        />
                                        <span className="rw__pill-label">{s}</span>
                                      </label>
                                    ))}
                                  </div>
                                </fieldset>

                                <button
                                  type="button"
                                  className="rw__confirm text-white"
                                  data-rw-confirm
                                  onClick={() => handleAddPiece(prod, cardNum)}
                                >
                                  <span data-rw-confirm-label className="text-white">Add to bag</span>
                                  <span className="rw__sr text-white"> — {prod.name}</span>
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {/* Bundle footer */}
                    <div className="rw__bundle has-rule">
                      <p
                        className="rw__msg"
                        data-rw-msg
                        role="status"
                        aria-live="polite"
                      >
                        {bundleMessage}
                      </p>

                      <div className="rw__bundle-row">
                        <div className="rw__bundle-copy">
                          <span className="rw__bundle-title">
                            Complete the look
                          </span>
                          <span className="rw__bundle-note">
                            Bundle all {items.length} and save 10%
                          </span>
                        </div>
                        <div className="rw__bundle-price">
                          <s>{formatCurrency(totalRawPrice, currencySymbol)}</s>
                          <strong>{formatCurrency(bundleDiscountPrice, currencySymbol)}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`rw__cta text-white ${bundleLoading ? 'is-loading' : ''}`}
                        data-rw-all
                        onClick={handleAddFullLook}
                      >
                        <span className="rw__cta-add text-white font-medium">Add full look to bag</span>
                        <span className="rw__cta-m text-white font-medium">
                          Add full look — {formatCurrency(bundleDiscountPrice, currencySymbol)}
                        </span>
                        <span className="rw__cta-done text-white font-medium">Full look in your bag</span>

                        {bundleLoading ? (
                          <svg
                            className="animate-spin"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path d="M12 3a9 9 0 1 1-9 9" />
                          </svg>
                        ) : (
                          <svg
                            width="22"
                            height="12"
                            viewBox="0 0 26 14"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path d="M1 7h24M19 1l6 6-6 6" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <template data-rw-pieces-text>
                      {items.length} pieces
                    </template>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Size Sheet Host */}
      <div className={`rw-sheet-host ${mobileSheetOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="rw__pick-scrim"
          data-rw-pick-close
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setMobileSheetOpen(false)}
        />
        {mobileSheetProduct && (
          <div className="rw__picker">
            <div className="rw__picker-head">
              <img
                src={mobileSheetProduct.product.image}
                alt=""
                className="rw__picker-img"
              />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 500 }}>
                  {mobileSheetProduct.product.name}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {formatCurrency(mobileSheetProduct.product.price, currencySymbol)}
                </div>
              </div>
              <button
                type="button"
                className="rw__picker-close"
                onClick={() => setMobileSheetOpen(false)}
              >
                ×
              </button>
            </div>

            <fieldset className="rw__opt">
              <legend className="rw__opt-name">
                {mobileSheetProduct.product.optionLegend}
              </legend>
              <div className="rw__pills">
                {mobileSheetProduct.product.sizes.map((s) => {
                  const cardKey = `${mobileSheetProduct.lookIndex}-${mobileSheetProduct.cardNum}`;
                  const currentSize =
                    selectedSizes[cardKey] || mobileSheetProduct.product.sizes[0];
                  return (
                    <label key={s} className="rw__pill">
                      <input
                        type="radio"
                        name="mobile-opt"
                        value={s}
                        checked={currentSize === s}
                        onChange={() => {
                          setSelectedSizes((prev) => ({
                            ...prev,
                            [cardKey]: s,
                          }));
                        }}
                      />
                      <span className="rw__pill-label">{s}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <button
              type="button"
              className="rw__confirm text-white"
              onClick={() => {
                handleAddPiece(
                  mobileSheetProduct.product,
                  mobileSheetProduct.cardNum
                );
              }}
            >
              <span className="text-white font-medium">Add to bag</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
