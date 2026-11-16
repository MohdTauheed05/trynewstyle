import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Look, MaisonEditCategory, MaisonEditProduct, MaisonEditStoreId, Product } from '../types';
import { addBagItem } from '../services/bagStorage';
import { formatCurrency } from '../services/storeSettings';
import { MAISON_EDIT_MASKS, MaisonEditMaskKey } from '../data/maisonEditMasks';
import {
  ME_AR_ROOM_URL,
  ME_MODEL_URLS,
  ME_PRODUCT_SHEET_URL,
  ME_STORES,
  ME_STYLES,
  getMaisonEditCrop,
  getMaisonEditPtStyle,
  getStoredMaisonEditItems,
} from '../services/maisonEditStorage';

interface VirtualStudioProps {
  shopName: string;
  currencySymbol: string;
  products: Product[];
  looks: Look[];
  whatsappNumber?: string;
  onOpenBag?: () => void;
}

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/';
const westernImage = (file: string, width = 1000) =>
  `https://images.higgs.ai/?default=1&output=webp&url=${encodeURIComponent(CDN + file)}&w=${width}&q=85`;

export const WESTERN_PRESETS = [
  { name: 'Denim Maxi', category: 'Everyday', file: 'hf_20261112_034542_a6430ecf-9862-412c-8ef6-5745115bd78c.png' },
  { name: 'Cloud Set', category: 'Everyday', file: 'hf_20261112_034738_73282737-acc8-41e9-a822-96c663e27b6c.png' },
  { name: 'Library Knit', category: 'Everyday', file: 'hf_20261112_034742_9a8a92fd-79ae-4163-9ffa-14ae2a68717f.png' },
  { name: 'Lilac Run', category: 'Athletic', file: 'hf_20261112_034735_4e352e03-ad2b-44d1-9fcf-4b5b9454dc55.png' },
  { name: 'Satin Night', category: 'Sleep', file: 'hf_20261112_034738_aeb8ea57-6399-4f3c-b54a-4a57d0bd971e.png' },
  { name: 'Night Suit', category: 'Formal', file: 'hf_20261112_034736_aace5c5f-8c14-4b00-83ba-744dbad2e337.png' },
  { name: 'Sage Slip', category: 'Party', file: 'hf_20261112_034735_3d9fb69e-b4e0-49f7-a2d4-e592bd616c27.png' },
  { name: 'Bomber Cargo', category: 'Street', file: 'hf_20261112_034740_3e3c5ad7-689b-46a2-8e09-c7d36a569b9c.png' },
] as const;

type LookSlotState = Record<MaisonEditCategory, string>; // stores item IDs
type CatTab = 'all' | 'tops' | 'skirts' | 'shoes' | 'bags';

const CATEGORY_TABS: Array<{ id: CatTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'tops', label: 'Tops' },
  { id: 'skirts', label: 'Bottoms' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'bags', label: 'Bags' },
];

const REGION_BOUNDS: Record<MaisonEditCategory, readonly [number, number]> = {
  tops: [0.07, 0.53],
  skirts: [0.32, 0.57],
  shoes: [0.53, 1.0],
  bags: [0.45, 0.75],
};

const COMP_W = 1000;
const COMP_H = 1506;
const DEFAULT_SLOTS: LookSlotState = { tops: 't1', skirts: 'k1', shoes: 's1', bags: 'g1' };

const FALLBACK_SLOT_FOR_KEY: Record<MaisonEditCategory, string> = {
  tops: 't1',
  skirts: 'k1',
  shoes: 's1',
  bags: 'g1',
};

export const VirtualStudio: React.FC<VirtualStudioProps> = ({
  currencySymbol,
  products,
  looks,
  onOpenBag,
}) => {
  const [meItems, setMeItems] = useState<MaisonEditProduct[]>(() => getStoredMaisonEditItems());
  const [activeModelId, setActiveModelId] = useState<string>('maison-edit');
  const [lookIds, setLookIds] = useState<LookSlotState>(DEFAULT_SLOTS);
  const [history, setHistory] = useState<LookSlotState[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>(() =>
    getStoredMaisonEditItems()
      .filter((i) => i.savedDefault)
      .map((i) => i.id)
  );

  // Shop filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [catTab, setCatTab] = useState<CatTab>('all');
  const [storeFilter, setStoreFilter] = useState<MaisonEditStoreId | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [showModelDrawer, setShowModelDrawer] = useState(false);

  // Stage interaction & animation state
  const [arMode, setArMode] = useState(false);
  const [arScanKey, setArScanKey] = useState(0);
  const [hoveredCat, setHoveredCat] = useState<MaisonEditCategory | null>(null);
  const [poppedCat, setPoppedCat] = useState<MaisonEditCategory | null>(null);
  const [glintY, setGlintY] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastOpen, setToastOpen] = useState(false);
  const [stylistIndex, setStylistIndex] = useState(0);
  const [ctaAdded, setCtaAdded] = useState(false);
  const [ctaSweeping, setCtaSweeping] = useState(false);
  const [ctaBadgeCount, setCtaBadgeCount] = useState(0);

  // Animated values (total + fit scores)
  const [displayTotal, setDisplayTotal] = useState(397.89);
  const [displayScores, setDisplayScores] = useState([100, 83, 96]);
  const [checkedRows, setCheckedRows] = useState([true, true, true]);

  // Refs for canvases, assets, turntable, drag rotation
  const cOldRef = useRef<HTMLCanvasElement | null>(null);
  const cNewRef = useRef<HTMLCanvasElement | null>(null);
  const offCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const assetsRef = useRef<{
    ready: boolean;
    models: Record<string, HTMLImageElement>;
    masks: Record<string, HTMLImageElement>;
  }>({ ready: false, models: {}, masks: {} });
  const prevStateRef = useRef<LookSlotState>(DEFAULT_SLOTS);
  const sweepFrameRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);
  const stylistTimersRef = useRef<number[]>([]);

  // Underline sliding ref
  const catsContainerRef = useRef<HTMLDivElement | null>(null);
  const catBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [barStyle, setBarStyle] = useState<{ left: number; width: number }>({ left: 0, width: 20 });

  // 360 turntable drag rotation refs
  const spinRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<SVGEllipseElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const ryRef = useRef(0);
  const dragRef = useRef({ active: false, startX: 0, startRy: 0, lastX: 0, vel: 0 });
  const [isGrabbing, setIsGrabbing] = useState(false);

  // Sync admin updates live
  useEffect(() => {
    const sync = () => {
      const updated = getStoredMaisonEditItems();
      setMeItems(updated);
      setLookIds((prev) => {
        const next = { ...prev };
        (['tops', 'skirts', 'shoes', 'bags'] as const).forEach((cat) => {
          if (!updated.some((i) => i.id === next[cat])) {
            const fallback = updated.find((i) => i.category === cat);
            if (fallback) next[cat] = fallback.id;
          }
        });
        return next;
      });
    };
    window.addEventListener('runway:maison_edit_updated', sync);
    return () => window.removeEventListener('runway:maison_edit_updated', sync);
  }, []);

  useEffect(() => {
    setCtaAdded(false);
    setCtaBadgeCount(0);
  }, [lookIds, activeModelId]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastOpen(false), 1800);
  }, []);

  // All Western Models list (presets + Admin-added modelGroup === 'western')
  const westernModels = useMemo(() => {
    const presets = WESTERN_PRESETS.map((preset, idx) => ({
      id: `western-preset-${idx}`,
      name: preset.name,
      category: preset.category,
      image: westernImage(preset.file, 1000),
      productIds: [] as string[],
      isPreset: true,
    }));
    const customWestern = looks
      .filter((l) => l.modelGroup === 'western')
      .map((l) => ({
        id: l.id,
        name: l.name,
        category: 'Western',
        image: l.srcset1080 || l.src640,
        productIds: l.productIds || [],
        isPreset: false,
      }));
    return [...presets, ...customWestern];
  }, [looks]);

  const activeWesternModel = useMemo(
    () => (activeModelId === 'maison-edit' ? null : westernModels.find((m) => m.id === activeModelId) || null),
    [activeModelId, westernModels]
  );

  // Resolve active Maison Edit worn pieces
  const resolveSlotItem = useCallback(
    (cat: MaisonEditCategory, id: string): MaisonEditProduct | undefined =>
      meItems.find((i) => i.id === id) || meItems.find((i) => i.category === cat),
    [meItems]
  );

  const wornSlots = useMemo(
    () => ({
      tops: resolveSlotItem('tops', lookIds.tops),
      skirts: resolveSlotItem('skirts', lookIds.skirts),
      shoes: resolveSlotItem('shoes', lookIds.shoes),
      bags: resolveSlotItem('bags', lookIds.bags),
    }),
    [lookIds, resolveSlotItem]
  );

  // Products worn when a Western preset/custom model is active
  const activeWesternProducts = useMemo(() => {
    if (!activeWesternModel) return [];
    const list = activeWesternModel.isPreset
      ? products.filter((p) => p.virtualStudioLook === activeWesternModel.name)
      : activeWesternModel.productIds
          .map((id) => products.find((p) => p.id === id))
          .filter((p): p is Product => Boolean(p));
    return list;
  }, [activeWesternModel, products]);

  // Helper: Resolve compositor layer key ('t1'..'g3') from a LookSlotState
  const resolveCompositeKeys = useCallback(
    (state: LookSlotState): Record<MaisonEditCategory, string> => {
      const getSlotKey = (cat: MaisonEditCategory, id: string) => {
        const item = meItems.find((x) => x.id === id);
        if (item?.slotKey) return item.slotKey;
        if (id in ME_MODEL_URLS || id === 't1' || id === 'k1' || id === 's1' || id === 'g1') return id;
        return FALLBACK_SLOT_FOR_KEY[cat];
      };
      return {
        tops: getSlotKey('tops', state.tops),
        skirts: getSlotKey('skirts', state.skirts),
        shoes: getSlotKey('shoes', state.shoes),
        bags: getSlotKey('bags', state.bags),
      };
    },
    [meItems]
  );

  // Compositor Draw Function
  const drawLookToCanvas = useCallback(
    (canvas: HTMLCanvasElement | null, state: LookSlotState) => {
      const assets = assetsRef.current;
      if (!canvas || !assets.ready || !assets.models.base) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (!offCanvasRef.current) {
        const off = document.createElement('canvas');
        off.width = COMP_W;
        off.height = COMP_H;
        offCanvasRef.current = off;
      }
      const offCtx = offCanvasRef.current.getContext('2d');
      if (!offCtx) return;

      ctx.clearRect(0, 0, COMP_W, COMP_H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(assets.models.base, 0, 0, COMP_W, COMP_H);

      const keys = resolveCompositeKeys(state);
      const order: Array<[MaisonEditCategory, string]> = [
        ['shoes', keys.shoes],
        ['skirts', keys.skirts],
        ['tops', keys.tops],
        ['bags', keys.bags],
      ];

      for (const [, key] of order) {
        if (key === 't1' || key === 'k1' || key === 's1' || key === 'g1') continue;
        const variantImg = assets.models[key];
        const maskImg = assets.masks[key];
        if (!variantImg || !maskImg) continue;

        offCtx.globalCompositeOperation = 'source-over';
        offCtx.clearRect(0, 0, COMP_W, COMP_H);
        offCtx.drawImage(maskImg, 0, 0, COMP_W, COMP_H);
        offCtx.globalCompositeOperation = 'source-in';
        offCtx.drawImage(variantImg, 0, 0, COMP_W, COMP_H);

        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(maskImg, 0, 0, COMP_W, COMP_H);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(offCanvasRef.current, 0, 0, COMP_W, COMP_H);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    [resolveCompositeKeys]
  );

  // Preload 9 model sheets + 8 masks cleanly on mount
  useEffect(() => {
    let cancelled = false;
    const loadImg = (src: string, useCors: boolean) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        if (useCors) img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const modelEntries = Object.entries(ME_MODEL_URLS);
    const maskEntries = Object.entries(MAISON_EDIT_MASKS) as Array<[MaisonEditMaskKey, string]>;

    Promise.all([
      Promise.all(modelEntries.map(async ([k, url]) => [k, await loadImg(url, true)] as const)),
      Promise.all(maskEntries.map(async ([k, url]) => [k, await loadImg(url, false)] as const)),
    ])
      .then(([loadedModels, loadedMasks]) => {
        if (cancelled) return;
        const modelsMap: Record<string, HTMLImageElement> = {};
        loadedModels.forEach(([k, img]) => {
          modelsMap[k] = img;
        });
        const masksMap: Record<string, HTMLImageElement> = {};
        loadedMasks.forEach(([k, img]) => {
          masksMap[k] = img;
        });
        assetsRef.current = { ready: true, models: modelsMap, masks: masksMap };
        drawLookToCanvas(cOldRef.current, lookIds);
        drawLookToCanvas(cNewRef.current, lookIds);
      })
      .catch((err) => {
        console.warn('Maison Edit asset preload warning:', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Re-draw when switching back to Maison Edit canvas view
  useEffect(() => {
    if (activeModelId === 'maison-edit' && assetsRef.current.ready) {
      drawLookToCanvas(cOldRef.current, lookIds);
      drawLookToCanvas(cNewRef.current, lookIds);
    }
  }, [activeModelId, drawLookToCanvas, lookIds]);

  // Swap sweep animation
  const runSweepAnimation = useCallback(
    (nextState: LookSlotState, changedCat: MaisonEditCategory) => {
      const cOld = cOldRef.current;
      const cNew = cNewRef.current;
      if (!cOld || !cNew) return;

      cancelAnimationFrame(sweepFrameRef.current);
      // Finish any prior partial state on cOld before starting new sweep
      drawLookToCanvas(cOld, prevStateRef.current);
      drawLookToCanvas(cNew, nextState);
      prevStateRef.current = nextState;

      const [startFrac, endFrac] = REGION_BOUNDS[changedCat];
      const duration = 720;
      const startTime = performance.now();

      const step = (now: number) => {
        const rawT = Math.min(1, (now - startTime) / duration);
        // Quadratic ease-in-out
        const eased = rawT < 0.5 ? 2 * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 2) / 2;
        const frac = startFrac + (endFrac - startFrac) * eased;
        const yPct = frac * 100;

        cNew.style.clipPath = `inset(0 0 ${(100 - yPct).toFixed(2)}% 0)`;
        cOld.style.clipPath = `inset(${yPct.toFixed(2)}% 0 0 0)`;
        setGlintY(yPct);

        if (rawT < 1) {
          sweepFrameRef.current = requestAnimationFrame(step);
        } else {
          drawLookToCanvas(cOld, nextState);
          cOld.style.clipPath = '';
          cNew.style.clipPath = '';
          setGlintY(null);
        }
      };

      sweepFrameRef.current = requestAnimationFrame(step);
    },
    [drawLookToCanvas]
  );

  // Sliding underline bar calculation
  useEffect(() => {
    const btn = catBtnRefs.current[catTab];
    const container = catsContainerRef.current;
    if (btn && container) {
      setBarStyle({
        left: btn.offsetLeft,
        width: btn.offsetWidth,
      });
    }
  }, [catTab]);

  // Turntable spring & idle rotation loop
  useEffect(() => {
    let frame = 0;
    let dashOffset = 0;
    const tick = () => {
      if (!dragRef.current.active && Math.abs(ryRef.current) > 0.04) {
        ryRef.current *= 0.92;
        if (Math.abs(ryRef.current) < 0.05) ryRef.current = 0;
      }
      if (spinRef.current) {
        spinRef.current.style.setProperty('--ry', `${ryRef.current.toFixed(2)}deg`);
      }
      if (shadowRef.current) {
        const shiftX = (ryRef.current * 0.45).toFixed(1);
        shadowRef.current.style.transform = `translateX(calc(-50% + ${shiftX}px))`;
      }
      const baseSpeed = 0.18 + Math.min(1.6, Math.abs(dragRef.current.vel) * 0.14);
      dashOffset = (dashOffset - baseSpeed) % 300;
      dragRef.current.vel *= 0.9;
      if (ringRef.current) {
        ringRef.current.style.strokeDashoffset = dashOffset.toFixed(2);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startRy: ryRef.current,
      lastX: e.clientX,
      vel: 0,
    };
    setIsGrabbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    dragRef.current.vel = e.clientX - dragRef.current.lastX;
    dragRef.current.lastX = e.clientX;
    ryRef.current = Math.max(-34, Math.min(34, dragRef.current.startRy + dx * 0.22));
  };
  const handleStagePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current.active = false;
    setIsGrabbing(false);
  };

  // Wear an item
  const wearItem = useCallback(
    (item: MaisonEditProduct, recordHistory = true) => {
      if (activeModelId !== 'maison-edit') {
        setActiveModelId('maison-edit');
      }
      const nextState: LookSlotState = { ...lookIds, [item.category]: item.id };
      if (recordHistory) {
        setHistory((h) => [...h.slice(-19), lookIds]);
      }
      setLookIds(nextState);
      setPoppedCat(item.category);
      setTimeout(() => setPoppedCat((cur) => (cur === item.category ? null : cur)), 560);
      runSweepAnimation(nextState, item.category);
      showToast(`Trying on · ${item.name}`);
    },
    [activeModelId, lookIds, runSweepAnimation, showToast]
  );

  // Cycle category next item
  const cycleCategory = useCallback(
    (cat: MaisonEditCategory, syncFilter = true) => {
      if (syncFilter) setCatTab(cat);
      const list = meItems.filter((i) => i.category === cat);
      if (!list.length) return;
      const curIdx = list.findIndex((i) => i.id === lookIds[cat]);
      const nextItem = list[(curIdx + 1) % list.length];
      wearItem(nextItem, true);
    },
    [lookIds, meItems, wearItem]
  );

  const handleUndo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    const changedCat =
      (['tops', 'skirts', 'shoes', 'bags'] as const).find((cat) => prev[cat] !== lookIds[cat]) || 'tops';
    setActiveModelId('maison-edit');
    setLookIds(prev);
    runSweepAnimation(prev, changedCat);
    const restoredItem = resolveSlotItem(changedCat, prev[changedCat]);
    if (restoredItem) showToast(`Undid · ${restoredItem.name}`);
  };

  // AI Stylist
  const runStylist = useCallback(() => {
    stylistTimersRef.current.forEach((t) => clearTimeout(t));
    stylistTimersRef.current = [];
    const preset = ME_STYLES[stylistIndex % ME_STYLES.length];
    setStylistIndex((idx) => (idx + 1) % ME_STYLES.length);
    setActiveModelId('maison-edit');
    showToast(`AI stylist · ${preset.name}`);

    let working: LookSlotState = { ...lookIds };
    setHistory((h) => [...h.slice(-19), lookIds]);

    (['tops', 'skirts', 'shoes', 'bags'] as const).forEach((cat, idx) => {
      const tId = window.setTimeout(() => {
        const targetKey = preset.look[cat];
        const targetItem =
          meItems.find((i) => i.id === targetKey || i.slotKey === targetKey) ||
          meItems.find((i) => i.category === cat);
        if (!targetItem) return;
        working = { ...working, [cat]: targetItem.id };
        setLookIds({ ...working });
        setPoppedCat(cat);
        runSweepAnimation({ ...working }, cat);
      }, idx * 520);
      stylistTimersRef.current.push(tId);
    });
  }, [lookIds, meItems, runSweepAnimation, showToast, stylistIndex]);

  useEffect(() => {
    return () => stylistTimersRef.current.forEach((t) => clearTimeout(t));
  }, []);

  // Look price + style & fit metrics
  const lookTotal = useMemo(() => {
    if (activeWesternModel) {
      return activeWesternProducts.reduce((sum, p) => sum + (p.price || 0), 0);
    }
    return (['tops', 'skirts', 'shoes', 'bags'] as const).reduce(
      (sum, cat) => sum + (wornSlots[cat]?.price || 0),
      0
    );
  }, [activeWesternModel, activeWesternProducts, wornSlots]);

  const targetFitScores = useMemo(() => {
    if (activeWesternModel) {
      return [100, activeWesternProducts.length ? 92 : 84, 94];
    }
    const worn = [wornSlots.tops, wornSlots.skirts, wornSlots.shoes, wornSlots.bags].filter(
      (x): x is MaisonEditProduct => Boolean(x)
    );
    const tagCounts: Record<string, number> = {};
    worn.forEach((item) => {
      (item.tags || []).forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const maxTagCount = Math.max(1, ...Object.values(tagCounts));
    const styleScore = Math.min(99, 56 + 9 * maxTagCount);

    const skirtKey = wornSlots.skirts?.slotKey || wornSlots.skirts?.id;
    const shoeKey = wornSlots.shoes?.slotKey || wornSlots.shoes?.id;
    const skirtBonus = skirtKey === 'k1' ? 14 : skirtKey === 'k3' ? 10 : 6;
    const heelBonus = shoeKey !== 's2' ? 4 : 0;
    const bodyScore = Math.min(99, 78 + skirtBonus + heelBonus);
    return [100, styleScore, bodyScore];
  }, [activeWesternModel, activeWesternProducts.length, wornSlots]);

  // Animate total counter over 600ms ease-out cubic
  const prevTotalRef = useRef(lookTotal);
  useEffect(() => {
    const startVal = prevTotalRef.current;
    const endVal = lookTotal;
    prevTotalRef.current = endVal;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayTotal(startVal + (endVal - startVal) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [lookTotal]);

  // Animate fit score percentages & staggered check circles
  useEffect(() => {
    setCheckedRows([false, false, false]);
    const timers = [0, 1, 2].map((idx) =>
      window.setTimeout(() => {
        setCheckedRows((prev) => {
          const next = [...prev];
          next[idx] = targetFitScores[idx] >= 80;
          return next;
        });
      }, idx * 140 + 180)
    );
    const start = performance.now();
    const startVals = [...displayScores];
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 520);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScores(
        targetFitScores.map((target, i) => Math.round(startVals[i] + (target - startVals[i]) * eased))
      );
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      timers.forEach((id) => clearTimeout(id));
      cancelAnimationFrame(frame);
    };
  }, [targetFitScores[0], targetFitScores[1], targetFitScores[2]]);

  // Filtered Shop Grid Items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return meItems.filter((item) => {
      if (savedOnly && !savedIds.includes(item.id)) return false;
      if (storeFilter && item.store !== storeFilter) return false;
      if (catTab !== 'all' && item.category !== catTab) return false;
      if (q) {
        const hay = `${item.name} ${item.store} ${item.category} ${(item.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [catTab, meItems, savedIds, savedOnly, searchQuery, storeFilter]);

  const gridHeading = useMemo(() => {
    if (savedOnly) return 'Saved pieces';
    if (storeFilter) return `${ME_STORES[storeFilter].label} picks`;
    return 'Popular in your style';
  }, [savedOnly, storeFilter]);

  // Recommendations (3 not-worn items matching top's first tag)
  const recommendations = useMemo(() => {
    const wornSet = new Set([lookIds.tops, lookIds.skirts, lookIds.shoes, lookIds.bags]);
    const mood = wornSlots.tops?.tags?.[0] || 'minimal';
    const candidates = meItems.filter((i) => !wornSet.has(i.id));
    candidates.sort((a, b) => {
      const aMatch = (a.tags || []).includes(mood) ? 1 : 0;
      const bMatch = (b.tags || []).includes(mood) ? 1 : 0;
      return bMatch - aMatch;
    });
    return candidates.slice(0, 3);
  }, [lookIds, meItems, wornSlots.tops]);

  const toggleSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Add a single Maison Edit item to Bag
  const addMeItemToBag = (item: MaisonEditProduct, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const crop = !item.customImage
      ? getMaisonEditCrop(item.sheetCol ?? 0, item.sheetRow ?? 0)
      : undefined;
    addBagItem({
      productId: `me-${item.id}`,
      name: item.name,
      size: item.sizes?.[0] || (item.category === 'shoes' ? '38' : 'M'),
      price: item.price,
      image: item.customImage || ME_PRODUCT_SHEET_URL,
      url: '#virtual-studio',
      quantity: 1,
      crop,
    });
    showToast(`Added · ${item.name}`);
  };

  // Shop the Look -> Add all worn pieces to cart (with stagger to bypass 700ms add guard)
  const handleShopTheLook = (openBagAfter = false) => {
    if (ctaAdded && !openBagAfter && onOpenBag) {
      onOpenBag();
      return;
    }

    setCtaSweeping(false);
    requestAnimationFrame(() => setCtaSweeping(true));

    if (activeWesternModel) {
      if (!activeWesternProducts.length) {
        showToast('Assign clothes in Admin to add this look');
        return;
      }
      activeWesternProducts.forEach((prod) => {
        addBagItem({
          productId: prod.id,
          name: prod.name,
          size: prod.sizes?.[0] || 'M',
          price: prod.price,
          image: prod.image,
          url: prod.url || '#virtual-studio',
          quantity: 1,
        });
      });
      setCtaBadgeCount(activeWesternProducts.length);
      setCtaAdded(true);
      showToast(`${activeWesternProducts.length} pieces added · ${formatCurrency(lookTotal, currencySymbol)}`);
      if (openBagAfter) onOpenBag?.();
      return;
    }

    const itemsToAdd = (['tops', 'skirts', 'shoes', 'bags'] as const)
      .map((cat) => wornSlots[cat])
      .filter((x): x is MaisonEditProduct => Boolean(x));

    itemsToAdd.forEach((item) => {
      const crop = !item.customImage
        ? getMaisonEditCrop(item.sheetCol ?? 0, item.sheetRow ?? 0)
        : undefined;
      addBagItem({
        productId: `me-${item.id}`,
        name: item.name,
        size: item.sizes?.[0] || (item.category === 'shoes' ? '38' : 'M'),
        price: item.price,
        image: item.customImage || ME_PRODUCT_SHEET_URL,
        url: '#virtual-studio',
        quantity: 1,
        crop,
      });
    });

    setCtaBadgeCount(itemsToAdd.length);
    setCtaAdded(true);
    showToast(`${itemsToAdd.length} pieces added · ${formatCurrency(lookTotal, currencySymbol)}`);
    window.setTimeout(() => setCtaSweeping(false), 700);
    if (openBagAfter) {
      window.setTimeout(() => onOpenBag?.(), 150);
    }
  };

  // Thumbnail renderer helper (.pt sheet crop OR customImage)
  const renderMeThumb = (item: MaisonEditProduct, ch: number, className?: string) => {
    if (item.customImage) {
      return <img src={item.customImage} alt={item.name} className={className} loading="lazy" />;
    }
    return (
      <div
        className={`pt ${className || ''}`}
        style={getMaisonEditPtStyle(item.sheetCol ?? 0, item.sheetRow ?? 0, ch)}
        aria-label={item.name}
      />
    );
  };

  return (
    <section id="virtual-studio" className="maison-edit" aria-label="Maison Edit Virtual Try-On & Western Wear Studio">
      {/* Top Floating Toast */}
      <div className={`me-toast ${toastOpen ? 'on' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>

      <div className="me-app">
        {/* ================================================================
            LEFT COLUMN: SHOP PANEL
            ================================================================ */}
        <div className="me-left">
          <div className="me-top-row">
            <h2 className="me-logo">MAISON EDIT</h2>
            <button
              type="button"
              className="me-menu-btn"
              aria-label="Toggle Western wear model selector"
              onClick={() => setShowModelDrawer((v) => !v)}
              title="Switch between Interactive Model & Western Models"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <line x1="3" y1="6.5" x2="21" y2="6.5" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17.5" x2="21" y2="17.5" />
              </svg>
            </button>
          </div>

          <div className="me-shop-panel">
            {/* Search Pill */}
            <div className="me-search-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="search"
                className="me-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for products, brands or styles..."
                aria-label="Search Western Wear pieces"
              />
            </div>

            {/* Category Tabs with sliding ink bar */}
            <div className="me-cats" ref={catsContainerRef}>
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  ref={(el) => { catBtnRefs.current[tab.id] = el; }}
                  className={`me-cat-btn ${catTab === tab.id ? 'active' : ''}`}
                  onClick={() => {
                    setCatTab(tab.id);
                    setSavedOnly(false);
                  }}
                >
                  {tab.label}
                </button>
              ))}
              <div
                className="me-cat-bar"
                style={{ left: barStyle.left, width: barStyle.width }}
                aria-hidden="true"
              />
            </div>

            {/* Scroll Area */}
            <div className="me-shop-scroll">
              <div className="me-sec-head">
                <h3>Shop by Store</h3>
                <button
                  type="button"
                  onClick={() => {
                    setStoreFilter(null);
                    setSavedOnly(false);
                  }}
                >
                  See all
                </button>
              </div>

              <div className="me-stores">
                {(['norra', 'lune', 'meridian', 'ode'] as const).map((storeId) => {
                  const st = ME_STORES[storeId];
                  return (
                    <button
                      key={st.id}
                      type="button"
                      className={`me-store-tile ${storeFilter === st.id ? 'active' : ''}`}
                      onClick={() => {
                        setStoreFilter((cur) => (cur === st.id ? null : st.id));
                        setSavedOnly(false);
                      }}
                    >
                      <span className={st.styleClass}>
                        {st.id === 'ode' ? (
                          <>ODE<br />STUDIO</>
                        ) : (
                          st.label
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Dual-Model Strip: Interactive Try-On + Existing Western Models */}
              <div className="me-sec-head">
                <h3>Models · Interactive &amp; Western</h3>
                <span>{westernModels.length + 1} models</span>
              </div>

              <div className="me-models-strip" aria-label="Switch active model">
                <button
                  type="button"
                  className={`me-model-chip ${activeModelId === 'maison-edit' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveModelId('maison-edit');
                    showToast('Interactive 81-Look Studio');
                  }}
                >
                  <div className="me-model-chip-thumb">
                    <img src={ME_MODEL_URLS.base} alt="Maison Edit interactive model" />
                  </div>
                  <div className="me-model-chip-copy">
                    <strong>Interactive Try-On</strong>
                    <span>81 Mix &amp; Match</span>
                  </div>
                </button>

                {westernModels.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    className={`me-model-chip ${activeModelId === model.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveModelId(model.id);
                      showToast(`Model · ${model.name}`);
                    }}
                  >
                    <div className="me-model-chip-thumb">
                      <img src={model.image} alt={model.name} loading="lazy" />
                    </div>
                    <div className="me-model-chip-copy">
                      <strong>{model.name}</strong>
                      <span>{model.category}</span>
                    </div>
                  </button>
                ))}
              </div>

              {showModelDrawer && (
                <div className="mb-3 rounded-lg border border-[#e4e1dc] bg-white p-2.5 text-[11px] text-[#5e5c58]">
                  Tap <strong>Interactive Try-On</strong> to mix 81 pieces live on the turntable, or choose any <strong>Western Model</strong> pill above to preview preset &amp; custom looks on the same 360° &amp; AR stage.
                </div>
              )}

              <div className="me-sec-head">
                <h3>{gridHeading}</h3>
                <span>{filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}</span>
              </div>

              <div className="me-grid">
                {filteredItems.map((item, idx) => {
                  const isWearing =
                    activeModelId === 'maison-edit' &&
                    (lookIds[item.category] === item.id ||
                      (item.slotKey && lookIds[item.category] === item.slotKey));
                  const isSaved = savedIds.includes(item.id);
                  return (
                    <article
                      key={item.id}
                      className={`me-card ${isWearing ? 'wearing' : ''}`}
                      style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                      onClick={() => wearItem(item, true)}
                    >
                      <div className="me-card-thumb">
                        {renderMeThumb(item, 400)}
                        <button
                          type="button"
                          className={`me-heart ${isSaved ? 'saved' : ''}`}
                          aria-label={isSaved ? `Remove ${item.name} from saved` : `Save ${item.name}`}
                          onClick={(e) => toggleSave(item.id, e)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9">
                            <path d="M12 20.5s-7.5-4.8-9.3-9.2C1.4 8 3.6 4.5 7.2 4.5c2 0 3.7 1.1 4.8 2.7 1.1-1.6 2.8-2.7 4.8-2.7 3.6 0 5.8 3.5 4.5 6.8-1.8 4.4-9.3 9.2-9.3 9.2z" />
                          </svg>
                        </button>
                        {isWearing && <span className="me-wearing-tag">WEARING</span>}
                        {!isWearing && <span className="me-tryon-chip">Try on</span>}
                      </div>
                      <div className="me-card-meta">
                        <div className="me-card-copy">
                          <span className="me-card-store">{ME_STORES[item.store]?.label || item.store}</span>
                          <span className="me-card-name" title={item.name}>{item.name}</span>
                          <span className="me-card-price">{formatCurrency(item.price, currencySymbol)}</span>
                        </div>
                        <button
                          type="button"
                          className="me-card-bag-btn"
                          onClick={(e) => addMeItemToBag(item, e)}
                          title={`Add ${item.name} to bag`}
                        >
                          + Bag
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* Bottom Tab Bar */}
            <nav className="me-tabbar" aria-label="Studio navigation">
              <button
                type="button"
                className="me-tab-btn"
                onClick={() => {
                  setSearchQuery('');
                  setCatTab('all');
                  setStoreFilter(null);
                  setSavedOnly(false);
                  showToast('Filters cleared');
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z" /></svg>
                <span>Home</span>
              </button>
              <button
                type="button"
                className={`me-tab-btn ${!savedOnly ? 'active' : ''}`}
                onClick={() => setSavedOnly(false)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <span>Explore</span>
              </button>
              <button
                type="button"
                className="me-tab-btn"
                onClick={runStylist}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l2.2 5.4L20 10.5l-5.8 2.1L12 18l-2.2-5.4L4 10.5l5.8-2.1z" /></svg>
                <span>Outfits</span>
              </button>
              <button
                type="button"
                className={`me-tab-btn ${savedOnly ? 'active' : ''}`}
                onClick={() => setSavedOnly((v) => !v)}
              >
                <svg viewBox="0 0 24 24" fill={savedOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7"><path d="M12 20.5s-7.5-4.8-9.3-9.2C1.4 8 3.6 4.5 7.2 4.5c2 0 3.7 1.1 4.8 2.7 1.1-1.6 2.8-2.7 4.8-2.7 3.6 0 5.8 3.5 4.5 6.8-1.8 4.4-9.3 9.2-9.3 9.2z" /></svg>
                <span>Saved</span>
              </button>
              <button
                type="button"
                className="me-tab-btn"
                onClick={() => {
                  showToast('Size M · 165 cm · fit profile saved');
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4" /><path d="M4.5 20c1.5-3.8 4.2-5.5 7.5-5.5s6 1.7 7.5 5.5" /></svg>
                <span>Profile</span>
              </button>
            </nav>
          </div>
        </div>

        {/* ================================================================
            CENTRE STAGE: TURNTABLE & MODEL / COMPOSITOR
            ================================================================ */}
        <div className="me-stage">
          {/* AR Room Overlay */}
          <div className={`me-ar-room ${arMode ? 'on' : ''}`} aria-hidden={!arMode}>
            <img src={ME_AR_ROOM_URL} alt="Bright fitting studio AR room background" />
            <span className="me-ar-bracket tl" />
            <span className="me-ar-bracket tr" />
            <span className="me-ar-bracket bl" />
            <span className="me-ar-bracket br" />
            {arMode && <div key={arScanKey} className="me-ar-scan" />}
            <div className="me-ar-label">
              <span className="me-ar-dot" />
              <span>AR preview · your room</span>
            </div>
          </div>

          {/* Left Floating Icon Rail (7 buttons) */}
          <div className="me-rail">
            <div className="me-rail-item">
              <button
                type="button"
                className="me-rail-btn"
                disabled={!history.length}
                onClick={handleUndo}
                aria-label="Undo last outfit change"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 1 1 0 12h-3" /></svg>
              </button>
              <span className="me-rail-tip">Undo</span>
            </div>

            <div className="me-rail-item">
              <button
                type="button"
                className="me-rail-btn"
                onClick={() => showToast('Size M · 165 cm · fit profile saved')}
                aria-label="Body and size fit profile"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="6" r="2.5" /><path d="M12 10v10M8 12l4-1 4 1M9.5 21l2.5-6 2.5 6" /></svg>
              </button>
              <span className="me-rail-tip">Size M · 165 cm</span>
            </div>

            <div className="me-rail-item">
              <button
                type="button"
                className={`me-rail-btn ${catTab === 'tops' ? 'active' : ''}`}
                onClick={() => cycleCategory('tops', true)}
                aria-label="Cycle tops"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 4l4 2 4-2 4 4-2.5 3-1.5-1V20H8V10l-1.5 1L4 8z" /></svg>
              </button>
              <span className="me-rail-tip">Tops · {wornSlots.tops?.name || 'Top'}</span>
            </div>

            <div className="me-rail-item">
              <button
                type="button"
                className={`me-rail-btn ${catTab === 'skirts' ? 'active' : ''}`}
                onClick={() => cycleCategory('skirts', true)}
                aria-label="Cycle skirts"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 5h8l3 14H5z" /></svg>
              </button>
              <span className="me-rail-tip">Bottoms · {wornSlots.skirts?.name || 'Skirt'}</span>
            </div>

            <div className="me-rail-item">
              <button
                type="button"
                className={`me-rail-btn ${catTab === 'shoes' ? 'active' : ''}`}
                onClick={() => cycleCategory('shoes', true)}
                aria-label="Cycle shoes"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 17h16v-3c-3 0-5-2.5-7-6l-4 1-1 4-4 1z" /></svg>
              </button>
              <span className="me-rail-tip">Shoes · {wornSlots.shoes?.name || 'Shoes'}</span>
            </div>

            <div className="me-rail-item">
              <button
                type="button"
                className={`me-rail-btn ${catTab === 'bags' ? 'active' : ''}`}
                onClick={() => cycleCategory('bags', true)}
                aria-label="Cycle bags"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="5" y="9" width="14" height="11" rx="2" /><path d="M9 9V7a3 3 0 0 1 6 0v2" /></svg>
              </button>
              <span className="me-rail-tip">Bags · {wornSlots.bags?.name || 'Bag'}</span>
            </div>

            <div className="me-rail-item">
              <button
                type="button"
                className="me-rail-btn"
                onClick={runStylist}
                aria-label="AI stylist surprise me"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l2.2 5.4L20 10.5l-5.8 2.1L12 18l-2.2-5.4L4 10.5l5.8-2.1z" /></svg>
              </button>
              <span className="me-rail-tip">AI stylist · surprise me</span>
            </div>
          </div>

          {/* 3D / AR Toggle */}
          <div className="me-mode-pill" role="group" aria-label="View mode">
            <div className={`me-mode-indicator ${arMode ? 'ar' : ''}`} aria-hidden="true" />
            <button
              type="button"
              className={!arMode ? 'active' : ''}
              onClick={() => setArMode(false)}
            >
              3D
            </button>
            <button
              type="button"
              className={arMode ? 'active' : ''}
              onClick={() => {
                setArMode(true);
                setArScanKey((k) => k + 1);
              }}
            >
              AR
            </button>
          </div>

          {/* Worn Strip */}
          {activeModelId === 'maison-edit' && (
            <div className="me-worn-strip" aria-label="Currently worn pieces">
              {(['tops', 'skirts', 'shoes', 'bags'] as const).map((cat) => {
                const item = wornSlots[cat];
                if (!item) return null;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`me-strip-item ${hoveredCat === cat ? 'highlighted' : ''} ${poppedCat === cat ? 'me-swap-pop' : ''}`}
                    onMouseEnter={() => setHoveredCat(cat)}
                    onMouseLeave={() => setHoveredCat(null)}
                    onClick={() => cycleCategory(cat, true)}
                    title={`${item.name} — tap to swap`}
                  >
                    {renderMeThumb(item, 537)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Central Figure + 360 Turntable */}
          <div className="me-figure">
            {/* Turntable sits at feet level */}
            <div
              className="me-tt"
              style={{
                bottom: '1.4%',
                transform: 'translateX(-50%) translateY(40%)',
              }}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerEnd}
              onPointerCancel={handleStagePointerEnd}
            >
              <div className="me-tt-side" />
              <div className="me-tt-top" />
              <svg className="me-tt-ring" viewBox="0 0 300 90" fill="none">
                <ellipse
                  ref={ringRef}
                  cx="150"
                  cy="45"
                  rx="142"
                  ry="38"
                  stroke="rgba(0,0,0,.13)"
                  strokeWidth="1.4"
                  strokeDasharray="3 5"
                  pathLength={300}
                />
              </svg>
              <div className="me-tt-label">
                <span className="me-tt-arrow l">⟲</span>
                <span>360°</span>
                <span className="me-tt-arrow r">⟳</span>
              </div>
            </div>

            <div className="me-shadow" ref={shadowRef} />

            <div
              className={`me-body ${isGrabbing ? 'grabbing' : ''}`}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerEnd}
              onPointerCancel={handleStagePointerEnd}
            >
              <div className="me-spin" ref={spinRef}>
                {activeModelId === 'maison-edit' ? (
                  <>
                    <canvas
                      ref={cOldRef}
                      width={COMP_W}
                      height={COMP_H}
                      className="me-canvas"
                    />
                    <canvas
                      ref={cNewRef}
                      width={COMP_W}
                      height={COMP_H}
                      className="me-canvas"
                    />
                    {glintY !== null && (
                      <div
                        className="me-glint"
                        style={{ top: `${glintY.toFixed(2)}%` }}
                        aria-hidden="true"
                      />
                    )}
                  </>
                ) : activeWesternModel ? (
                  <img
                    key={activeWesternModel.id}
                    src={activeWesternModel.image}
                    alt={`${activeWesternModel.name} Western Wear look`}
                    className="me-canvas"
                    style={{ objectFit: 'contain', objectPosition: 'center bottom' }}
                    draggable={false}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================
            RIGHT COLUMN: YOUR LOOK + RECOMMENDED FOR YOU
            ================================================================ */}
        <div className="me-right">
          <div className="me-look-panel">
            <div className="me-look-head">
              <span>{activeWesternModel ? activeWesternModel.name.toUpperCase() : 'YOUR LOOK'}</span>
              <strong>{formatCurrency(displayTotal, currencySymbol)}</strong>
            </div>

            <div className="me-look-rows">
              {activeWesternModel ? (
                activeWesternProducts.length > 0 ? (
                  activeWesternProducts.map((prod) => (
                    <div
                      key={prod.id}
                      className="me-look-row"
                      onClick={() => {
                        addBagItem({
                          productId: prod.id,
                          name: prod.name,
                          size: prod.sizes?.[0] || 'M',
                          price: prod.price,
                          image: prod.image,
                          url: prod.url || '#virtual-studio',
                          quantity: 1,
                        });
                        showToast(`Added · ${prod.name}`);
                      }}
                    >
                      <div className="me-look-thumb">
                        <img src={prod.image} alt={prod.name} loading="lazy" />
                      </div>
                      <div className="me-look-info">
                        <span className="me-look-store">{prod.vendor || 'Western Wear'}</span>
                        <span className="me-look-name">{prod.name}</span>
                        <span className="me-look-price">{formatCurrency(prod.price, currencySymbol)}</span>
                      </div>
                      <button
                        type="button"
                        className="me-look-add"
                        onClick={(e) => {
                          e.stopPropagation();
                          addBagItem({
                            productId: prod.id,
                            name: prod.name,
                            size: prod.sizes?.[0] || 'M',
                            price: prod.price,
                            image: prod.image,
                            url: prod.url || '#virtual-studio',
                            quantity: 1,
                          });
                          showToast(`Added · ${prod.name}`);
                        }}
                      >
                        + Bag
                      </button>
                      <span className="me-look-chev">›</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-[#d7d3cc] bg-white/70 p-3 text-[11px] leading-relaxed text-[#5e5c58]">
                    No catalog products matched to <strong>{activeWesternModel.name}</strong> yet.
                    Assign items in Admin → Clothes Inventory or click any piece in the shop grid to switch to interactive try-on.
                  </div>
                )
              ) : (
                (['tops', 'skirts', 'shoes', 'bags'] as const).map((cat) => {
                  const item = wornSlots[cat];
                  if (!item) return null;
                  return (
                    <div
                      key={cat}
                      className="me-look-row"
                      onMouseEnter={() => setHoveredCat(cat)}
                      onMouseLeave={() => setHoveredCat(null)}
                      onClick={() => cycleCategory(cat, true)}
                    >
                      <div className={`me-look-thumb ${poppedCat === cat ? 'me-swap-pop' : ''}`}>
                        {renderMeThumb(item, 450)}
                      </div>
                      <div className="me-look-info">
                        <span className="me-look-store">{ME_STORES[item.store]?.label || item.store}</span>
                        <span className="me-look-name">{item.name}</span>
                        <span className="me-look-price">{formatCurrency(item.price, currencySymbol)}</span>
                      </div>
                      <button
                        type="button"
                        className="me-look-add"
                        onClick={(e) => addMeItemToBag(item, e)}
                        title={`Add ${item.name} to cart`}
                      >
                        + Bag
                      </button>
                      <span className="me-look-chev">›</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* STYLE & FIT */}
            <div className="me-fit-box">
              <div className="me-fit-title">STYLE &amp; FIT</div>
              {[
                {
                  label: 'Fits your size',
                  score: displayScores[0],
                  checked: checkedRows[0],
                  note: 'Size M fits your saved measurements',
                },
                {
                  label: 'Matches your style',
                  score: displayScores[1],
                  checked: checkedRows[1],
                  note: 'Based on 4 pieces and your saved styles',
                },
                {
                  label: 'Complements your body shape',
                  score: displayScores[2],
                  checked: checkedRows[2],
                  note: 'Mini length + knee height balance your frame',
                },
              ].map((row) => (
                <div className="me-fit-row" key={row.label}>
                  <span className={`me-fit-check ${row.checked ? 'filled' : ''}`}>
                    {row.checked && (
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2.2 6.2l2.5 2.5L9.8 3.5" />
                      </svg>
                    )}
                  </span>
                  <span className="me-fit-label">
                    <span>{row.label}</span>
                    <span className="me-fit-info-dot" aria-hidden="true">ⓘ</span>
                  </span>
                  <span className="me-fit-pct">{row.score}%</span>
                  <span className="me-fit-bubble">{row.note}</span>
                </div>
              ))}
            </div>

            {/* CTAs: Shop the Look + Order on WhatsApp */}
            <div className="me-cta-stack">
              <button
                type="button"
                className={`me-shop-cta ${ctaSweeping ? 'sweeping' : ''}`}
                onClick={() => handleShopTheLook(false)}
              >
                <span>{ctaAdded ? 'Added · view bag' : 'Shop the Look'}</span>
                {ctaBadgeCount > 0 ? (
                  <span className="me-cta-badge">{ctaBadgeCount}</span>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <path d="M15 3h6v6" />
                    <path d="M10 14L21 3" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="me-wa-cta"
                onClick={() => handleShopTheLook(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                <span>Order Look via WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Recommended for you */}
          <div className="me-rec-card">
            <div className="me-rec-head">
              <span aria-hidden="true">✦</span>
              <span>Recommended for you</span>
            </div>
            <div className="me-rec-grid">
              {recommendations.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  className="me-rec-item"
                  onClick={() => wearItem(rec, true)}
                >
                  <div className="me-rec-thumb">
                    {renderMeThumb(rec, 450)}
                  </div>
                  <small>{ME_STORES[rec.store]?.label || rec.store}</small>
                  <span title={rec.name}>{rec.name}</span>
                  <b>{formatCurrency(rec.price, currencySymbol)}</b>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
