import { BagItemCrop } from '../types';
import { saveSharedSectionToFirestore } from './firebase';

export type MvSheetView = 'side' | 'front' | 'back';
export type MvCropEntry = readonly [number, number, number]; // [y, h, hookX]

const RAW_SOURCES: Record<MvSheetView, string> = {
  side: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261113_115504_3ab92758-5854-4a1c-85db-ff8efd929e86.png',
  front: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261113_115743_54dc8c72-0be0-4858-bd0c-10ecb399c16c.png',
  back: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261113_115613_7d45aea6-1bea-41ff-b878-72d7c8bcb9da.png',
};

export const MV_SHEETS: Record<MvSheetView, string> = {
  side: `https://images.higgs.ai/?default=1&output=webp&url=${encodeURIComponent(RAW_SOURCES.side)}&w=1360&q=85`,
  front: `https://images.higgs.ai/?default=1&output=webp&url=${encodeURIComponent(RAW_SOURCES.front)}&w=1360&q=85`,
  back: `https://images.higgs.ai/?default=1&output=webp&url=${encodeURIComponent(RAW_SOURCES.back)}&w=1360&q=85`,
};

export const MV_SHEET_W = 1360;
export const MV_SHEET_H = 2048;
export const MV_CELL_W = 340;

export const MV_CATALOG = [
  {
    k: 0,
    name: 'Noir Tailored Blazer',
    fitDescription: 'Single-breasted black wool crepe blazer with structured shoulder and horn fastening.',
  },
  {
    k: 1,
    name: 'Ivory Belted Trench',
    fitDescription: 'Full-length ivory gabardine trench coat with storm flap and tonal waist belt.',
  },
  {
    k: 2,
    name: 'Oxblood Silk Slip',
    fitDescription: 'Ankle-length bias-cut mulberry silk slip dress in deep oxblood with fine straps.',
  },
  {
    k: 3,
    name: 'Taupe Wool Blazer',
    fitDescription: 'Warm taupe tailored wool blazer with clean notch lapel and horn button closure.',
  },
  {
    k: 4,
    name: 'Champagne Bias Slip',
    fitDescription: 'Lustrous champagne silk charmeuse slip dress cut on the bias for ankle-length drape.',
  },
  {
    k: 5,
    name: 'Pearl Silk Slip',
    fitDescription: 'Luminous ivory pearl silk slip dress finished with delicate rouleau straps.',
  },
  {
    k: 6,
    name: 'Taupe Belted Trench',
    fitDescription: 'Fluid longline taupe belted trench coat engineered for effortless movement.',
  },
  {
    k: 7,
    name: 'Oxblood Satin Gown',
    fitDescription: 'Floor-length liquid oxblood satin evening gown with sweeping fuller skirt.',
  },
] as const;

// Measured per sheet in 1360x2048 pixels: [y, h, hookX] -> x = hookX - 170
export const MV_CROPS: Record<MvSheetView, readonly MvCropEntry[]> = {
  side: [
    [44, 619, 185],
    [45, 860, 514],
    [45, 876, 834],
    [45, 606, 1169],
    [1024, 937, 177],
    [1024, 936, 511],
    [1024, 907, 825],
    [1024, 962, 1166],
  ],
  front: [
    [79, 552, 175],
    [76, 900, 511],
    [76, 913, 848],
    [80, 550, 1179],
    [1024, 936, 177],
    [1024, 940, 513],
    [1024, 894, 851],
    [1024, 938, 1185],
  ],
  back: [
    [76, 515, 176],
    [60, 890, 508],
    [60, 901, 845],
    [76, 520, 1180],
    [1026, 931, 175],
    [1026, 929, 508],
    [1024, 901, 845],
    [1024, 934, 1184],
  ],
};

export const MV_RAIL_ORDER: readonly number[] = [
  0, 1, 2, 3, 4, 0, 5, 6, 7, 0, 4, 1, 2, 3, 5, 6, 7, 1, 4, 3,
];

export function getMvCropBox(view: MvSheetView, k: number): BagItemCrop {
  const safeK = ((k % 8) + 8) % 8;
  const [y, h, hookX] = MV_CROPS[view][safeK];
  return {
    x: hookX - MV_CELL_W / 2,
    y,
    w: MV_CELL_W,
    h: h + 6,
    sheetW: MV_SHEET_W,
    sheetH: MV_SHEET_H,
  };
}

let sheetPreloadPromise: Promise<void> | null = null;
export function preloadMaisonVerrelSheets(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (sheetPreloadPromise) return sheetPreloadPromise;

  const views: MvSheetView[] = ['side', 'front', 'back'];
  const loaders = views.map(
    (v) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.src = MV_SHEETS[v];
        const done = () => resolve();
        img.onload = () => {
          if (typeof img.decode === 'function') {
            img.decode().then(done, done);
          } else {
            done();
          }
        };
        img.onerror = done;
      })
  );

  sheetPreloadPromise = Promise.all(loaders).then(() => undefined);
  return sheetPreloadPromise;
}

export interface LadiesRailItem {
  id: string;
  name: string;
  price: number;
  image: string;
  fitDescription?: string;
  sheetIndex?: number;
  backImage?: string;
  sizes?: string[];
  crop?: BagItemCrop;
}

export const DEFAULT_LADIES_RAIL_ITEMS: LadiesRailItem[] = MV_RAIL_ORDER.map((k, idx) => {
  const meta = MV_CATALOG[k];
  return {
    id: `mv-rail-${idx + 1}`,
    name: meta.name,
    price: 690,
    image: MV_SHEETS.front,
    fitDescription: meta.fitDescription,
    sheetIndex: k,
    sizes: ['S', 'M', 'L', 'XL'],
    crop: getMvCropBox('front', k),
  };
});

const STORAGE_KEY_LADIES_RAIL = 'runway_ladies_rail_items_v2';

export function getStoredLadiesRailItems(): LadiesRailItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LADIES_RAIL);
    if (!raw) return DEFAULT_LADIES_RAIL_ITEMS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load ladies rail items from storage', e);
  }
  return DEFAULT_LADIES_RAIL_ITEMS;
}

export function saveLadiesRailItems(items: LadiesRailItem[], persistCloud = true): void {
  try {
    localStorage.setItem(STORAGE_KEY_LADIES_RAIL, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('runway:ladies_rail_updated'));
    if (persistCloud) {
      void saveSharedSectionToFirestore('shared_ladies_rail', { items }).then((result) => {
        if (!result.success) console.error(result.message);
      });
    }
  } catch (e) {
    console.error('Failed to save ladies rail items to storage', e);
  }
}

export function resetLadiesRailItems(): LadiesRailItem[] {
  try {
    localStorage.removeItem(STORAGE_KEY_LADIES_RAIL);
    window.dispatchEvent(new CustomEvent('runway:ladies_rail_updated'));
    void saveSharedSectionToFirestore('shared_ladies_rail', {
      items: DEFAULT_LADIES_RAIL_ITEMS,
    }).then((result) => {
      if (!result.success) console.error(result.message);
    });
  } catch (e) {
    console.error('Failed to reset ladies rail items', e);
  }
  return DEFAULT_LADIES_RAIL_ITEMS;
}
