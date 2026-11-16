import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LadiesPiece, Look, Product } from '../types';
import { addBagItem, addToBag } from '../services/bagStorage';
import { formatCurrency } from '../services/storeSettings';
import {
  LADIES_LOOK_BOUNDS,
  LADIES_MODEL_Y0,
  LADIES_MODEL_Y1,
  LADIES_MODELS_SHEET,
  LADIES_PIECES_SHEET,
  getStoredLadiesPieces,
  getStoredLadiesSettings,
} from '../services/ladiesStorage';

const WESTERN_PRESETS = [
  { name: 'Denim Maxi', file: 'hf_20261112_034542_a6430ecf-9862-412c-8ef6-5745115bd78c.png' },
  { name: 'Cloud Set', file: 'hf_20261112_034738_73282737-acc8-41e9-a822-96c663e27b6c.png' },
  { name: 'Library Knit', file: 'hf_20261112_034742_9a8a92fd-79ae-4163-9ffa-14ae2a68717f.png' },
  { name: 'Lilac Run', file: 'hf_20261112_034735_4e352e03-ad2b-44d1-9fcf-4b5b9454dc55.png' },
  { name: 'Satin Night', file: 'hf_20261112_034738_aeb8ea57-6399-4f3c-b54a-4a57d0bd971e.png' },
  { name: 'Night Suit', file: 'hf_20261112_034736_aace5c5f-8c14-4b00-83ba-744dbad2e337.png' },
  { name: 'Sage Slip', file: 'hf_20261112_034735_3d9fb69e-b4e0-49f7-a2d4-e592bd616c27.png' },
  { name: 'Bomber Cargo', file: 'hf_20261112_034740_3e3c5ad7-689b-46a2-8e09-c7d36a569b9c.png' },
];
const STUDIO_CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/';

interface CircleLookbookProps {
  looks: Look[];
  products: Product[];
  shopName: string;
  currencySymbol: string;
}

type ArchivePin = {
  num: number;
  id: string;
  name: string;
  left: number;
  top: number;
};

type ArchiveItem =
  | {
      kind: 'product';
      id: string;
      name: string;
      vendor: string;
      price: number;
      image: string;
      url: string;
      sizes: string[];
      optionLegend: string;
      product: Product;
    }
  | {
      kind: 'ladiesPiece';
      id: string;
      name: string;
      vendor: string;
      price: number;
      image: string;
      piece: LadiesPiece;
    };

type Entry = {
  id: string;
  key: string;
  name: string;
  groupLabel: string;
  image: string;
  src640: string;
  group: 'men' | 'women';
  products: Product[];
  ladiesPieces?: LadiesPiece[];
  pins: ArchivePin[];
  crop?: [number, number, number, number];
};

export const CircleLookbook: React.FC<CircleLookbookProps> = ({
  looks,
  products,
  shopName,
  currencySymbol,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const lbStageRef = useRef<HTMLDivElement | null>(null);

  const [ladiesPieces, setLadiesPieces] = useState(() => getStoredLadiesPieces());
  const [firstLadiesLook, setFirstLadiesLook] = useState(
    () => getStoredLadiesSettings().firstLookNumber || 15
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isEngaged, setIsEngaged] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomedEntry, setZoomedEntry] = useState<Entry | null>(null);
  const [hotPinNum, setHotPinNum] = useState<number | null>(null);
  const [activeFittingItem, setActiveFittingItem] = useState<{
    id: string;
    name: string;
    image: string;
    description: string;
  } | null>(null);
  const [wornProductIds, setWornProductIds] = useState<string[]>([]);

  const [openPickerCard, setOpenPickerCard] = useState<string | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({});
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
  const [bundleLoading, setBundleLoading] = useState(false);

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileSheetProduct, setMobileSheetProduct] = useState<{
    product: Product;
    lookIndex: number;
    cardNum: number;
  } | null>(null);

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
    feetOffsets: {} as Record<string, number>,
  });

  useEffect(() => {
    const sync = () => {
      setLadiesPieces(getStoredLadiesPieces());
      setFirstLadiesLook(getStoredLadiesSettings().firstLookNumber || 15);
    };
    window.addEventListener('runway:ladies_updated', sync);
    window.addEventListener('runway:catalog_updated', sync);
    return () => {
      window.removeEventListener('runway:ladies_updated', sync);
      window.removeEventListener('runway:catalog_updated', sync);
    };
  }, []);

  const entries = useMemo<Entry[]>(() => {
    const modelEntries: Entry[] = looks
      .filter(
        (look) =>
          !look.modelGroup ||
          look.modelGroup === 'men' ||
          look.modelGroup === 'ladies' ||
          look.modelGroup === 'western'
      )
      .map((look) => {
        const assignedProducts = look.productIds
          .map((id) => products.find((product) => product.id === id))
          .filter((product): product is Product => Boolean(product));
        const pins: ArchivePin[] = assignedProducts.map((prod, idx) => {
          const explicitPin =
            look.pins?.find((p) => p.productId === prod.id) || look.pins?.[idx];
          return {
            num: idx + 1,
            id: prod.id,
            name: prod.name,
            left: explicitPin?.left ?? prod.defaultPinX ?? 50,
            top:
              explicitPin?.top ??
              prod.defaultPinY ??
              (idx === 0 ? 32 : idx === 1 ? 56 : 84),
          };
        });
        const isMen = look.modelGroup === 'men' || !look.modelGroup;
        return {
          id: look.id,
          key: look.key || look.id,
          name: look.name,
          groupLabel: isMen
            ? "Men's Studio"
            : look.modelGroup === 'western'
            ? 'Western Wear'
            : 'Ladies Studio',
          image: look.srcset1080 || look.src640,
          src640: look.src640 || look.srcset1080,
          group: isMen ? 'men' : 'women',
          products: assignedProducts,
          pins,
        };
      });

    const depthEntries: Entry[] = LADIES_LOOK_BOUNDS.map(([x0, x1], index) => {
      const lookNumber = firstLadiesLook + index;
      const assignedPieces = ladiesPieces.filter(
        (piece) => piece.lookNumber === lookNumber
      );
      const pins: ArchivePin[] = assignedPieces.map((piece, pIdx) => ({
        num: pIdx + 1,
        id: piece.id,
        name: piece.name,
        left: 50,
        top: pIdx === 0 ? 34 : pIdx === 1 ? 60 : 82,
      }));
      return {
        id: 'ladies-depth-' + lookNumber,
        key: 'ladies-depth-' + lookNumber,
        name: 'Ladies Look ' + String(lookNumber).padStart(2, '0'),
        groupLabel: 'Ladies Collection',
        image: LADIES_MODELS_SHEET,
        src640: LADIES_MODELS_SHEET,
        group: 'women',
        products: [],
        ladiesPieces: assignedPieces,
        pins,
        crop: [x0, x1, LADIES_MODEL_Y0, LADIES_MODEL_Y1],
      };
    });

    const westernEntries: Entry[] = WESTERN_PRESETS.map((preset) => {
      const assignedProducts = products.filter(
        (product) => product.virtualStudioLook === preset.name
      );
      const pins: ArchivePin[] = assignedProducts.map((prod, idx) => ({
        num: idx + 1,
        id: prod.id,
        name: prod.name,
        left: prod.defaultPinX ?? 50,
        top: prod.defaultPinY ?? (idx === 0 ? 34 : idx === 1 ? 58 : 82),
      }));
      const img =
        'https://images.higgs.ai/?default=1&output=webp&url=' +
        encodeURIComponent(STUDIO_CDN + preset.file) +
        '&w=1000&q=85';
      return {
        id: 'western-preset-' + preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        key: 'western-' + preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: preset.name,
        groupLabel: 'Western Model',
        image: img,
        src640: img,
        group: 'women',
        products: assignedProducts,
        pins,
      };
    });

    const menList = modelEntries.filter((entry) => entry.group === 'men');
    const westernList = [
      ...modelEntries.filter((entry) => entry.groupLabel === 'Western Wear'),
      ...westernEntries,
    ];
    const ladiesList = [
      ...modelEntries.filter((entry) => entry.groupLabel === 'Ladies Studio'),
      ...depthEntries,
    ];

    const baseRounds = Math.min(menList.length, westernList.length, ladiesList.length);
    const extraPool: Array<{ type: 'men' | 'western' | 'ladies'; entry: Entry }> = [
      ...menList.slice(baseRounds).map((entry) => ({ type: 'men' as const, entry })),
      ...westernList.slice(baseRounds).map((entry) => ({ type: 'western' as const, entry })),
      ...ladiesList.slice(baseRounds).map((entry) => ({ type: 'ladies' as const, entry })),
    ];

    const mixed: Entry[] = [];
    for (let i = 0; i < baseRounds; i += 1) {
      mixed.push(menList[i], westernList[i], ladiesList[i]);
      if (
        extraPool.length > 0 &&
        (i === Math.floor(baseRounds / 2) - 1 || i === baseRounds - 1)
      ) {
        const diffIdx = extraPool.findIndex((ex) => ex.type !== 'ladies' && ex.type !== 'men');
        const [picked] = extraPool.splice(diffIdx >= 0 ? diffIdx : 0, 1);
        mixed.push(picked.entry);
      }
    }

    // Interleave any remaining items if pools are uneven
    while (extraPool.length > 0) {
      const lastLabel = mixed[mixed.length - 1]?.groupLabel;
      const diffIdx = extraPool.findIndex((ex) => ex.entry.groupLabel !== lastLabel);
      const [picked] = extraPool.splice(diffIdx >= 0 ? diffIdx : 0, 1);
      mixed.push(picked.entry);
    }

    return mixed;
  }, [looks, products, ladiesPieces, firstLadiesLook]);

  const entryCount = entries.length;
  const safeIndex = entryCount ? ((activeIndex % entryCount) + entryCount) % entryCount : 0;
  const activeEntry = entries[safeIndex];

  const getEntryItems = useCallback((entry?: Entry): ArchiveItem[] => {
    if (!entry) return [];
    return [
      ...entry.products.map((product) => ({
        kind: 'product' as const,
        id: product.id,
        name: product.name,
        vendor: product.vendor || 'Studio Collection',
        price: product.price,
        image: product.image,
        url: product.url,
        sizes: product.sizes?.length ? product.sizes : ['One Size'],
        optionLegend: product.optionLegend || 'Size',
        product,
      })),
      ...(entry.ladiesPieces || []).map((piece) => ({
        kind: 'ladiesPiece' as const,
        id: piece.id,
        name: piece.name,
        vendor: 'Ladies Atelier',
        price: piece.price,
        image: piece.customImage || '',
        piece,
      })),
    ];
  }, []);

  const activeItems = useMemo(() => getEntryItems(activeEntry), [activeEntry, getEntryItems]);
  const totalRawPrice = activeItems.reduce((sum, item) => sum + item.price, 0);
  const bundleDiscountPrice = totalRawPrice * 0.9;
  const isLookComplete =
    activeItems.length > 0 &&
    activeItems.every((_, i) => addedItems[`${safeIndex}-${i + 1}`]);

  // Detect feet offset for standard image entries
  const detectFeet = useCallback((entry: Entry) => {
    if (entry.crop || animRef.current.feetOffsets[entry.src640] !== undefined) return;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = entry.src640;
      img.onload = () => {
        try {
          const w = 48;
          const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
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
              if (imgData[(y * w + x) * 4 + 3] > 40) {
                rowHasPixel = true;
                break;
              }
            }
            if (rowHasPixel) {
              lastRow = y;
              break;
            }
          }
          animRef.current.feetOffsets[entry.src640] = Math.min(
            0.4,
            Math.max(0, (h - 1 - lastRow) / h)
          );
        } catch {
          animRef.current.feetOffsets[entry.src640] = 0;
        }
      };
      img.onerror = () => {
        animRef.current.feetOffsets[entry.src640] = 0;
      };
    } catch {
      animRef.current.feetOffsets[entry.src640] = 0;
    }
  }, []);

  useEffect(() => {
    entries.forEach(detectFeet);
  }, [entries, detectFeet]);

  const moveTo = useCallback(
    (T: number) => {
      if (!entryCount) return;
      animRef.current.target = T;
      animRef.current.still = false;
      const newIndex = ((Math.round(T) % entryCount) + entryCount) % entryCount;
      setActiveIndex(newIndex);
      setHotPinNum(null);
      setOpenPickerCard(null);
      if (stageRef.current) {
        stageRef.current.classList.remove('is-sweep');
        void stageRef.current.offsetWidth;
        stageRef.current.classList.add('is-sweep');
      }
    },
    [entryCount]
  );

  const go = useCallback(
    (i: number) => {
      if (!entryCount) return;
      let d = (i - safeIndex) % entryCount;
      if (d > entryCount / 2) d -= entryCount;
      if (d < -entryCount / 2) d += entryCount;
      moveTo(Math.round(animRef.current.target) + d);
    },
    [safeIndex, entryCount, moveTo]
  );

  const next = useCallback(() => {
    moveTo(Math.round(animRef.current.target) + 1);
  }, [moveTo]);

  const prev = useCallback(() => {
    moveTo(Math.round(animRef.current.target) - 1);
  }, [moveTo]);

  useEffect(() => {
    if (!isPlaying || isZoomed || isEngaged || entryCount < 2) return;
    const interval = setInterval(() => {
      if (!animRef.current.panelHover && !animRef.current.dragging) {
        next();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, isZoomed, isEngaged, entryCount, next]);

  const triggerHot = useCallback(
    (num: number, scrollIntoView = false) => {
      setHotPinNum(num);
      setIsEngaged(true);
      setIsPlaying(false);

      const item = activeItems[num - 1];
      if (item?.kind === 'product') {
        const prod = item.product;
        setActiveFittingItem({
          id: prod.id,
          name: prod.name,
          image: prod.image,
          description: prod.fitDescription || 'Contemporary studio silhouette',
        });
        setWornProductIds((current) =>
          current.includes(prod.id) ? current : [...current, prod.id]
        );
      }

      if (scrollIntoView && sectionRef.current) {
        const cardElem = sectionRef.current.querySelector(`[data-rw-card="${num}"]`);
        if (cardElem) {
          cardElem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    },
    [activeItems]
  );

  const handleFitItem = (item: ArchiveItem, cardNum: number) => {
    setIsEngaged(true);
    setIsPlaying(false);
    setHotPinNum(cardNum);

    if (item.kind === 'product') {
      const prod = item.product;
      setActiveFittingItem({
        id: prod.id,
        name: prod.name,
        image: prod.image,
        description: prod.fitDescription || 'Contemporary studio silhouette',
      });
      setWornProductIds((current) =>
        current.includes(prod.id) ? current.filter((id) => id !== prod.id) : [...current, prod.id]
      );
    }

    if (sectionRef.current) {
      const cardElem = sectionRef.current.querySelector(`[data-rw-card="${cardNum}"]`);
      if (cardElem) {
        cardElem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  };

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

  useEffect(() => {
    measure();
    const handleResize = () => measure();
    window.addEventListener('resize', handleResize);

    const K = 95;
    const C = 2 * Math.sqrt(K);

    const loop = (now: number) => {
      const dt = Math.min(0.034, (now - animRef.current.lastTime) / 1000 || 1 / 60);
      animRef.current.lastTime = now;

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

      const stage = stageRef.current;
      if (stage) {
        const bodies = stage.querySelectorAll<HTMLElement>('.rw__model[data-rw-model]');
        const W = animRef.current.stageWidth;
        const H = animRef.current.stageHeight;
        const isMobile = animRef.current.isMobile;
        const nBodies = bodies.length || 1;

        if (!isMobile) {
          const cx = 0.5 * W;
          const R = 0.62 * W;
          const P = 1.65 * W;
          const floor = H - 34;
          const horizon = 0.36 * H;
          // Maintain a spacious 30deg visual interval (matching homepage 12-slot spacing)
          // regardless of how many total models are in the archive.
          const slotStep = Math.PI / 6;
          const cur = animRef.current.cur;
          const fs = 1.08;

          bodies.forEach((body, idx) => {
            let delta = ((idx - cur) % nBodies + nBodies) % nBodies;
            if (delta > nBodies / 2) delta -= nBodies;

            const absDelta = Math.abs(delta);
            if (absDelta > 4.2) {
              body.style.opacity = '0';
              body.style.visibility = 'hidden';
              body.style.pointerEvents = 'none';
              return;
            }

            const phi = delta * slotStep;
            const z = R * (1 - Math.cos(phi));
            const persp = P / (P + z);
            const sl = absDelta;
            const scale = persp * (1 + (fs - 1) * Math.max(0, Math.min(1, 1 - sl)));
            const x = cx + R * Math.sin(phi) * persp;
            const feet = horizon + (floor - horizon) * persp;
            const bottom = H - feet;
            const blur = sl <= 1 ? 1.8 * sl : Math.min(1.8 + (sl - 1) * 2, 6.5);
            let opacity = Math.max(0, Math.min(1, (Math.cos(phi) + 0.55) / 0.3));

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
  }, [measure, entryCount]);

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
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect) {
      animRef.current.cursorTargetX = e.clientX - rect.left;
      animRef.current.cursorTargetY = e.clientY - rect.top;
    }

    if (!animRef.current.dragging) return;
    const dx = e.clientX - animRef.current.startX;
    const dy = e.clientY - animRef.current.startY;

    if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
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
      // ignore
    }

    const samples = animRef.current.velocitySamples;
    let vx = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = last.time - first.time;
      if (dt > 0) vx = (last.x - first.x) / dt;
    }

    const from = Math.round(animRef.current.startTarget);
    const dx = e.clientX - animRef.current.startX;

    if (animRef.current.isMobile) {
      if (Math.abs(dx) > 30 || Math.abs(vx) > 0.3) {
        moveTo(from + (dx > 0 ? -1 : 1));
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    } else if (e.key === 'Escape') {
      if (mobileSheetOpen) setMobileSheetOpen(false);
      else if (isZoomed) setIsZoomed(false);
    }
  };

  const openLightbox = (entry: Entry) => {
    setZoomedEntry(entry);
    setIsZoomed(true);
    setIsEngaged(true);
    setIsPlaying(false);
  };

  const closeLightbox = () => {
    setIsZoomed(false);
    setHotPinNum(null);
  };

  const handleAddProductPiece = (product: Product, cardNum: number) => {
    const cardKey = `${safeIndex}-${cardNum}`;
    const selectedSize = selectedSizes[cardKey] || product.sizes?.[0] || 'One Size';
    const variant =
      product.variants?.find((v) => v.o.includes(selectedSize)) || product.variants?.[0];

    if (loadingItems[cardKey]) return;
    setLoadingItems((prevMap) => ({ ...prevMap, [cardKey]: true }));

    setTimeout(() => {
      if (variant) {
        addToBag([{ variantId: variant.id, product, size: selectedSize }]);
      } else {
        addBagItem({
          productId: product.id,
          name: product.name,
          size: selectedSize,
          price: product.price,
          image: product.image,
          url: product.url,
          quantity: 1,
        });
      }
      setLoadingItems((prevMap) => ({ ...prevMap, [cardKey]: false }));
      setAddedItems((prevMap) => ({ ...prevMap, [cardKey]: true }));
      setOpenPickerCard(null);
      setMobileSheetOpen(false);
    }, 320);
  };

  const handleAddLadiesPiece = (piece: LadiesPiece, cardNum: number) => {
    const cardKey = `${safeIndex}-${cardNum}`;
    if (loadingItems[cardKey]) return;
    setLoadingItems((prevMap) => ({ ...prevMap, [cardKey]: true }));
    setTimeout(() => {
      addBagItem({
        productId: piece.id,
        name: piece.name,
        size: 'One Size',
        price: piece.price,
        image: piece.customImage || LADIES_PIECES_SHEET,
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
      setLoadingItems((prevMap) => ({ ...prevMap, [cardKey]: false }));
      setAddedItems((prevMap) => ({ ...prevMap, [cardKey]: true }));
    }, 280);
  };

  const handleAddFullLook = () => {
    if (!activeItems.length || isLookComplete || bundleLoading) return;
    setBundleLoading(true);

    setTimeout(() => {
      activeItems.forEach((item, idx) => {
        const cardNum = idx + 1;
        const cardKey = `${safeIndex}-${cardNum}`;
        if (addedItems[cardKey]) return;
        if (item.kind === 'product') {
          const size = selectedSizes[cardKey] || item.sizes[0] || 'One Size';
          const variant =
            item.product.variants?.find((v) => v.o.includes(size)) ||
            item.product.variants?.[0];
          if (variant) {
            addToBag([{ variantId: variant.id, product: item.product, size }]);
          } else {
            addBagItem({
              productId: item.product.id,
              name: item.product.name,
              size,
              price: item.product.price,
              image: item.product.image,
              url: item.product.url,
              quantity: 1,
            });
          }
        } else {
          const piece = item.piece;
          addBagItem({
            productId: piece.id,
            name: piece.name,
            size: 'One Size',
            price: piece.price,
            image: piece.customImage || LADIES_PIECES_SHEET,
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
        }
        setAddedItems((prevMap) => ({ ...prevMap, [cardKey]: true }));
      });
      setBundleLoading(false);
    }, 450);
  };

  const getFigureAspect = (entry: Entry) =>
    entry.crop
      ? ((entry.crop[1] - entry.crop[0]) / (entry.crop[3] - entry.crop[2])).toFixed(4)
      : '0.5625';

  const renderModelArtwork = (entry: Entry, eager = false) => {
    if (entry.crop) {
      const [x0, x1, y0, y1] = entry.crop;
      const w = x1 - x0;
      const h = y1 - y0;
      const clipId = `rw-crop-${x0}-${x1}-${y0}-${y1}`;
      return (
        <svg
          viewBox={`${x0} ${y0} ${w} ${h}`}
          preserveAspectRatio="xMidYMax meet"
          className="is-decoded"
          style={{ overflow: 'hidden' }}
          aria-label={entry.name}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={x0} y={y0} width={w} height={h} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <image
              href={entry.image}
              width="960"
              height="540"
              preserveAspectRatio="none"
            />
          </g>
        </svg>
      );
    }

    return (
      <img
        src={entry.src640}
        srcSet={`${entry.src640} 640w, ${entry.image} 1080w`}
        sizes="(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        width="1100"
        height="1956"
        draggable="false"
        data-model-image
        alt={entry.name}
        className="is-decoded"
      />
    );
  };

  if (!entryCount) {
    return (
      <section id="circle-lookbook" className="rw rw--archive">
        <div className="p-12 text-center text-sm text-neutral-500">
          Add male, ladies, or western models in Admin to feature them here.
        </div>
      </section>
    );
  }

  // If fewer than 8 models exist, pad bodies array like RunwaySection so the 3D ring stays balanced.
  const totalBodiesCount =
    entryCount < 8 ? Math.max(12, entryCount * Math.ceil(8 / entryCount)) : entryCount;
  const bodiesList = Array.from({ length: totalBodiesCount }).map((_, i) => {
    const entry = entries[i % entryCount];
    return { index: i, entryIndex: i % entryCount, entry, isClone: i >= entryCount };
  });

  return (
    <section
      id="circle-lookbook"
      ref={sectionRef}
      className={`rw rw--add-icon rw--popup rw--list has-dividers has-border rw--cursor rw--js rw--archive ${
        isZoomed ? 'rw--zoom' : ''
      }`}
      data-feel="balanced"
      data-blur="true"
      data-mblur="true"
      data-style="ring"
      data-mstyle="classic"
      data-fit="true"
      data-autoplay={isPlaying ? 'true' : 'false'}
      data-speed="5000"
      aria-label={`${shopName} all-models runway`}
      style={{
        ['--rw-progress' as any]: ((safeIndex + 1) / entryCount).toFixed(3),
      }}
    >
      <div className="rw__sticky">
        <div className="rw__grid">
          {/* Left Column: Stage, Controls, Lightbox */}
          <div className="rw__left">
            <div className="rw__head">
              <div className="rw__intro">
                <h2 className="rw__title">All Looks Runway</h2>
                <p className="rw__sub">
                  Men’s, ladies &amp; western looks — {entryCount} models styled head to toe.
                </p>
              </div>

              {activeFittingItem && (
                <div
                  className="hidden md:flex items-center gap-3 py-2 px-3.5 bg-black text-white text-xs border border-neutral-800 shadow-md"
                  style={{ animation: 'rw-rise 0.4s var(--rw-ease)' }}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-400">
                    Fitted Piece:
                  </span>
                  <span className="font-bold text-white">{activeFittingItem.name}</span>
                  <span className="text-neutral-500">|</span>
                  <span className="text-[11px] text-neutral-300">
                    {activeFittingItem.description}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setWornProductIds((current) =>
                        current.filter((id) => id !== activeFittingItem.id)
                      );
                      setActiveFittingItem(null);
                      setHotPinNum(null);
                    }}
                    className="ml-2 text-neutral-400 hover:text-white font-bold text-xs"
                    title="Remove fit"
                  >
                    ×
                  </button>
                </div>
              )}

              <span className="rw__sr" aria-live="polite" aria-atomic="true">
                Look {safeIndex + 1} of {entryCount}: {activeEntry?.name}
              </span>
            </div>

            {/* 3D Runway Stage */}
            <div
              className="rw__stage"
              ref={stageRef}
              data-rw-stage
              tabIndex={0}
              role="region"
              aria-roledescription="carousel"
              aria-label="All models runway — use arrow keys or drag to change look"
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
                stageRef.current
                  ?.querySelector('.rw__cursor')
                  ?.classList.remove('is-on', 'is-view', 'is-link');
              }}
            >
              {/* 1. 3D Ring Queue Bodies */}
              <div className="rw__actors" data-rw-actors>
                {bodiesList.map((item) => {
                  const footOffset = animRef.current.feetOffsets[item.entry.src640] || 0;
                  return (
                    <div
                      key={`archive-body-${item.index}`}
                      className="rw__model"
                      data-rw-model
                      data-index={item.entryIndex}
                      aria-hidden="true"
                    >
                      <span className="rw__shadow" />
                      <div className="rw__figure" style={{ ['--rw-ar' as any]: getFigureAspect(item.entry) }}>
                        <div
                          className="rw__art"
                          style={{
                            transform: `translateY(calc(${footOffset} * 100%))`,
                          }}
                        >
                          {renderModelArtwork(item.entry, !item.isClone && item.entryIndex < 4)}
                          <button
                            type="button"
                            className="rw__hit"
                            aria-label={`Look ${item.entryIndex + 1}: ${item.entry.name}`}
                            tabIndex={-1}
                            onClick={() => go(item.entryIndex)}
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

              {/* 2. Front Heroes */}
              <div className="rw__heroes" data-rw-heroes>
                {entries.map((entry, idx) => {
                  const isCurrent = idx === safeIndex;
                  const footOffset = animRef.current.feetOffsets[entry.src640] || 0;

                  return (
                    <div
                      key={`archive-hero-${entry.id}-${idx}`}
                      className={`rw__hero ${isCurrent ? 'is-on' : ''}`}
                      data-rw-hero
                      data-index={idx}
                      data-name={entry.name}
                      aria-hidden={!isCurrent}
                    >
                      <div className="rw__figure" style={{ ['--rw-ar' as any]: getFigureAspect(entry) }}>
                        <span className="rw__shadow" />
                        <div
                          className="rw__art"
                          style={{
                            transform: `translateY(calc(${footOffset} * 100%))`,
                          }}
                        >
                          {renderModelArtwork(entry, isCurrent)}

                          {isCurrent &&
                            wornProductIds.map((garmentId) => {
                              const garment = entry.products.find((p) => p.id === garmentId);
                              if (!garment) return null;
                              const pin = entry.pins.find((p) => p.id === garment.id);
                              const posX = pin?.left ?? garment.defaultPinX ?? 50;
                              const posY =
                                pin?.top ??
                                garment.defaultPinY ??
                                (garment.category === 'shoes'
                                  ? 92
                                  : garment.category === 'pants'
                                  ? 70
                                  : 45);
                              const widthStyle =
                                garment.category === 'shoes'
                                  ? '135px'
                                  : garment.category === 'pants'
                                  ? '180px'
                                  : '190px';
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
                            aria-label={`View look: ${entry.name}`}
                            tabIndex={isCurrent ? 0 : -1}
                            onClick={() => openLightbox(entry)}
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

                          {entry.pins.length > 0 && (
                            <div className="rw__pins">
                              {entry.pins.map((pin) => {
                                const isHot = hotPinNum === pin.num;
                                return (
                                  <button
                                    key={pin.num}
                                    type="button"
                                    className={`rw__pin ${isHot ? 'is-hot' : ''}`}
                                    data-rw-pin={pin.num}
                                    data-tip={pin.name}
                                    style={{
                                      left: `${pin.left}%`,
                                      top: `${pin.top}%`,
                                      ['--pi' as any]: pin.num,
                                    }}
                                    aria-label={`${pin.num}: ${pin.name}`}
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
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <span className="rw__sweep" aria-hidden="true" />
              <span className="rw__cursor" data-rw-cursor aria-hidden="true">
                <span className="rw__cursor-in">
                  <span className="rw__cursor-label rw__cursor-drag">Drag</span>
                  <span className="rw__cursor-label rw__cursor-view">View</span>
                </span>
              </span>
              <span className="rw__walk">
                <span className="rw__walk-line" />
              </span>
            </div>

            {/* Controls Row */}
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
                {entries.map((entry, i) => {
                  const isCurrent = i === safeIndex;
                  const isPast = i < safeIndex;
                  return (
                    <button
                      key={`${entry.id}-${i}`}
                      type="button"
                      className={`rw__tick ${isCurrent ? 'is-run' : ''} ${
                        isPast ? 'is-past' : ''
                      }`}
                      data-rw-tick={i}
                      aria-current={isCurrent ? 'true' : 'false'}
                      aria-label={`Look ${i + 1}: ${entry.name}`}
                      onClick={() => go(i)}
                    >
                      <span className="rw__tick-bar" />
                      <span className="rw__tick-label">
                        {String(i + 1).padStart(2, '0')}
                        <span className="rw__tick-name">&nbsp;&nbsp;{entry.name}</span>
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M6.5 4.5h3.5v15H6.5zM14 4.5h3.5v15H14z" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
                  if (e.target === e.currentTarget) closeLightbox();
                }}
              >
                {zoomedEntry && (
                  <div className="rw__lb-model" style={{ ['--rw-model-h' as any]: '560px' }}>
                    <div className="rw__figure" style={{ ['--rw-ar' as any]: getFigureAspect(zoomedEntry) }}>
                      <span className="rw__shadow" />
                      <div
                        className="rw__art"
                        style={{
                          transform: `translateY(calc(${
                            animRef.current.feetOffsets[zoomedEntry.src640] || 0
                          } * 100%))`,
                        }}
                      >
                        {renderModelArtwork(zoomedEntry, true)}
                        {zoomedEntry.pins.length > 0 && (
                          <div className="rw__pins">
                            {zoomedEntry.pins.map((pin) => (
                              <button
                                key={pin.num}
                                type="button"
                                className={`rw__pin ${hotPinNum === pin.num ? 'is-hot' : ''}`}
                                data-rw-pin={pin.num}
                                data-tip={pin.name}
                                style={{
                                  left: `${pin.left}%`,
                                  top: `${pin.top}%`,
                                  ['--pi' as any]: pin.num,
                                }}
                                aria-label={`${pin.num}: ${pin.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerHot(pin.num, true);
                                }}
                              >
                                <span className="rw__pin-dot">{pin.num}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="rw__lb-top">
                <p className="rw__lb-cap">
                  <span className="rw__lb-kicker">
                    Look {String(safeIndex + 1).padStart(2, '0')} · {zoomedEntry?.groupLabel}
                  </span>
                  <span className="rw__lb-name">{zoomedEntry?.name || activeEntry?.name}</span>
                </p>
                <button
                  type="button"
                  className="rw__lb-close"
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

              <p className="rw__lb-hint">Tap a dot to shop or inspect</p>
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
                <div>
                  <h3 className="rw__panel-title">In this look</h3>
                  <div className="mt-1.5 text-[11px] tracking-[0.08em] uppercase text-[#66625c]">
                    {String(safeIndex + 1).padStart(2, '0')} / {String(entryCount).padStart(2, '0')} ·{' '}
                    <span className="text-[#151413] font-medium">{activeEntry?.name}</span>
                  </div>
                </div>
                <span className="rw__label is-swap">
                  {activeItems.length} {activeItems.length === 1 ? 'piece' : 'pieces'}
                </span>
              </div>

              <div className="rw__look-panel is-in">
                <div className="rw__mhead">
                  <span className="rw__mhead-title">{activeEntry?.name}</span>
                  <span className="rw__label">
                    {activeItems.length} {activeItems.length === 1 ? 'piece' : 'pieces'}
                  </span>
                </div>

                {activeItems.length > 0 ? (
                  <ul className="rw__items" role="list">
                    {activeItems.map((item, pIdx) => {
                      const cardNum = pIdx + 1;
                      const cardKey = `${safeIndex}-${cardNum}`;
                      const isPicking = openPickerCard === cardKey;
                      const isAdded = addedItems[cardKey];
                      const isLoading = loadingItems[cardKey];
                      const isHot = hotPinNum === cardNum;
                      const isWorn = wornProductIds.includes(item.id);

                      return (
                        <li
                          key={`${item.id}-${cardNum}`}
                          className={`rw__item ${isPicking ? 'is-picking' : ''} ${
                            isAdded ? 'is-added' : ''
                          } ${isLoading ? 'is-loading' : ''} ${isHot ? 'is-hot' : ''}`}
                          data-rw-card={cardNum}
                          style={{ ['--i' as any]: cardNum }}
                          onPointerEnter={() => {
                            setHotPinNum(cardNum);
                          }}
                          onPointerLeave={() => {
                            if (hotPinNum === cardNum && !isWorn) {
                              setHotPinNum(null);
                            }
                          }}
                        >
                          <a
                            className="rw__media"
                            href={item.kind === 'product' ? item.url : '#circle-lookbook'}
                            tabIndex={-1}
                            aria-hidden="true"
                            onClick={(e) => {
                              e.preventDefault();
                              handleFitItem(item, cardNum);
                            }}
                          >
                            {item.image ? (
                              <img src={item.image} alt="" loading="lazy" decoding="async" />
                            ) : item.kind === 'ladiesPiece' && item.piece.box ? (
                              <svg
                                viewBox={`${item.piece.box[0]} ${item.piece.box[2]} ${
                                  item.piece.box[1] - item.piece.box[0]
                                } ${item.piece.box[3] - item.piece.box[2]}`}
                                className="w-full h-full object-contain"
                              >
                                <image href={LADIES_PIECES_SHEET} width="960" height="720" />
                              </svg>
                            ) : null}
                            <span className="rw__num">{cardNum}</span>
                          </a>

                          <div className="rw__info">
                            <span className="rw__type">{item.vendor}</span>
                            <span className="rw__name">{item.name}</span>
                            <span className="rw__price">
                              <span>{formatCurrency(item.price, currencySymbol)}</span>
                            </span>
                          </div>

                          <button
                            type="button"
                            className="rw__add"
                            data-rw-add
                            aria-expanded={isPicking ? 'true' : 'false'}
                            aria-label={
                              isAdded ? `Added to bag: ${item.name}` : `Add to bag: ${item.name}`
                            }
                            onClick={() => {
                              setIsEngaged(true);
                              setIsPlaying(false);
                              if (isAdded) return;

                              if (item.kind === 'ladiesPiece') {
                                handleAddLadiesPiece(item.piece, cardNum);
                                return;
                              }

                              if (window.innerWidth <= 749) {
                                setMobileSheetProduct({
                                  product: item.product,
                                  lookIndex: safeIndex,
                                  cardNum,
                                });
                                setMobileSheetOpen(true);
                              } else {
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

                          {isPicking && item.kind === 'product' && (
                            <div className="rw__picker" data-rw-picker>
                              <fieldset className="rw__opt">
                                <legend className="rw__opt-name">{item.optionLegend}</legend>
                                <div className="rw__pills">
                                  {item.sizes.map((s) => {
                                    const currentSize =
                                      selectedSizes[cardKey] || item.sizes[0];
                                    return (
                                      <label key={s} className="rw__pill">
                                        <input
                                          type="radio"
                                          name={`ArchiveOpt-${activeEntry?.key}-${cardNum}`}
                                          value={s}
                                          checked={currentSize === s}
                                          onChange={() => {
                                            setSelectedSizes((prevSizes) => ({
                                              ...prevSizes,
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
                                data-rw-confirm
                                onClick={() => handleAddProductPiece(item.product, cardNum)}
                              >
                                <span className="text-white">Add to bag</span>
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-8 py-6 text-xs leading-relaxed text-[#66625c] border-t border-[#c8c8c8]">
                    <p className="m-0 font-medium text-[#151413] uppercase tracking-wider text-[11px] mb-1.5">
                      {activeEntry?.groupLabel}
                    </p>
                    <p className="m-0">
                      No pieces assigned to this model yet. Tap the model to view full size, or use
                      the controls below to explore other looks.
                    </p>
                  </div>
                )}

                {activeItems.length > 0 && (
                  <div className="rw__bundle has-rule">
                    <div className="rw__bundle-row">
                      <div className="rw__bundle-copy">
                        <span className="rw__bundle-title">Complete the look</span>
                        <span className="rw__bundle-note">
                          Bundle all {activeItems.length} and save 10%
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
                      <span className="rw__cta-add text-white font-medium">
                        Add full look to bag
                      </span>
                      <span className="rw__cta-m text-white font-medium">
                        Add full look — {formatCurrency(bundleDiscountPrice, currencySymbol)}
                      </span>
                      <span className="rw__cta-done text-white font-medium">
                        Full look in your bag
                      </span>
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
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Size Sheet Host */}
      <div className={`rw-sheet-host ${mobileSheetOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="rw__pick-scrim"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setMobileSheetOpen(false)}
        />
        {mobileSheetProduct && (
          <div className="rw__picker">
            <div className="rw__picker-head">
              <img src={mobileSheetProduct.product.image} alt="" className="rw__picker-img" />
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
                {mobileSheetProduct.product.optionLegend || 'Size'}
              </legend>
              <div className="rw__pills">
                {(mobileSheetProduct.product.sizes?.length
                  ? mobileSheetProduct.product.sizes
                  : ['One Size']
                ).map((s) => {
                  const cardKey = `${mobileSheetProduct.lookIndex}-${mobileSheetProduct.cardNum}`;
                  const currentSize =
                    selectedSizes[cardKey] ||
                    mobileSheetProduct.product.sizes?.[0] ||
                    'One Size';
                  return (
                    <label key={s} className="rw__pill">
                      <input
                        type="radio"
                        name="archive-mobile-opt"
                        value={s}
                        checked={currentSize === s}
                        onChange={() => {
                          setSelectedSizes((prevSizes) => ({
                            ...prevSizes,
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
                handleAddProductPiece(
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
