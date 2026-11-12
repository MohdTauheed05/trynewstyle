import { saveSharedSectionToFirestore } from './firebase';
import { LadiesPiece, LadiesSectionSettings } from '../types';

export const LADIES_MODELS_SHEET =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042056_1a704ff7-b0e5-4a9f-bbda-62392b819fb6.png&w=3840&q=85';

export const LADIES_PIECES_SHEET =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=2400&q=85';

export const LADIES_LOOK_BOUNDS: [number, number][] = [
  [12, 176],  // 0: blush feather jacket and satin trousers
  [178, 330], // 1: sage pleated gown
  [331, 470], // 2: champagne satin trench
  [476, 633], // 3: blush billow blouse and trousers
  [634, 767], // 4: powder-blue coat
  [767, 956], // 5: ivory ruffle gown
];

export const LADIES_MODEL_Y0 = 48;
export const LADIES_MODEL_Y1 = 496;

export const DEFAULT_LADIES_PIECES: LadiesPiece[] = [
  {
    id: 'lp-1',
    name: 'Feather Jacket',
    price: 2900,
    lookNumber: 15,
    pieceNumber: 1,
    box: [26, 224, 28, 214],
  },
  {
    id: 'lp-2',
    name: 'Satin Wide Leg Trousers',
    price: 1450,
    lookNumber: 15,
    pieceNumber: 2,
    box: [304, 412, 22, 236],
  },
  {
    id: 'lp-3',
    name: 'Pleated Dress',
    price: 2200,
    lookNumber: 16,
    pieceNumber: 1,
    box: [530, 666, 12, 242],
  },
  {
    id: 'lp-4',
    name: 'Gold Waist Belt',
    price: 420,
    lookNumber: 16,
    pieceNumber: 2,
    box: [752, 922, 100, 146],
  },
  {
    id: 'lp-5',
    name: 'Satin Trench Dress',
    price: 2350,
    lookNumber: 17,
    pieceNumber: 1,
    box: [70, 176, 246, 466],
  },
  {
    id: 'lp-6',
    name: 'Top Handle Bag',
    price: 980,
    lookNumber: 17,
    pieceNumber: 2,
    box: [294, 422, 294, 432],
  },
  {
    id: 'lp-7',
    name: 'Billow Sleeve Blouse',
    price: 860,
    lookNumber: 18,
    pieceNumber: 1,
    box: [508, 688, 240, 452],
  },
  {
    id: 'lp-8',
    name: 'Tie Waist Trousers',
    price: 740,
    lookNumber: 18,
    pieceNumber: 2,
    box: [780, 890, 252, 466],
  },
  {
    id: 'lp-9',
    name: 'Powder Long Coat',
    price: 1980,
    lookNumber: 19,
    pieceNumber: 1,
    box: [64, 178, 484, 698],
  },
  {
    id: 'lp-10',
    name: 'Ivory Straight Trousers',
    price: 690,
    lookNumber: 19,
    pieceNumber: 2,
    box: [316, 396, 482, 698],
  },
  {
    id: 'lp-11',
    name: 'Sculpted Ruffle Top',
    price: 1120,
    lookNumber: 20,
    pieceNumber: 1,
    box: [530, 672, 508, 682],
  },
  {
    id: 'lp-12',
    name: 'Pleated Maxi Skirt',
    price: 1340,
    lookNumber: 20,
    pieceNumber: 2,
    box: [754, 916, 484, 700],
  },
];

export const DEFAULT_LADIES_SETTINGS: LadiesSectionSettings = {
  seasonTitle: 'Spring Summer 2027',
  subtitle:
    'A study in softness and strength. The new season collection blends delicate textures and modern silhouettes, crafted for a more beautiful tomorrow.',
  firstLookNumber: 15,
};

const STORAGE_KEY_LADIES_PIECES = 'runway_ladies_pieces_v1';
const STORAGE_KEY_LADIES_SETTINGS = 'runway_ladies_settings_v1';

export function getStoredLadiesPieces(): LadiesPiece[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LADIES_PIECES);
    if (!raw) return DEFAULT_LADIES_PIECES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load ladies pieces', e);
  }
  return DEFAULT_LADIES_PIECES;
}

export function saveLadiesPieces(pieces: LadiesPiece[], persistCloud = true): void {
  try {
    localStorage.setItem(STORAGE_KEY_LADIES_PIECES, JSON.stringify(pieces));
    window.dispatchEvent(new CustomEvent('runway:ladies_updated'));
    if (persistCloud) {
      void saveSharedSectionToFirestore('shared_ladies', {
        pieces,
        settings: getStoredLadiesSettings(),
      }).then((result) => {
        if (!result.success) console.error(result.message);
      });
    }
  } catch (e) {
    console.error('Failed to save ladies pieces', e);
  }
}

export function getStoredLadiesSettings(): LadiesSectionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LADIES_SETTINGS);
    if (!raw) return DEFAULT_LADIES_SETTINGS;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.seasonTitle === 'string') {
      return { ...DEFAULT_LADIES_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load ladies settings', e);
  }
  return DEFAULT_LADIES_SETTINGS;
}

export function saveLadiesSettings(settings: LadiesSectionSettings, persistCloud = true): void {
  try {
    localStorage.setItem(STORAGE_KEY_LADIES_SETTINGS, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('runway:ladies_updated'));
    if (persistCloud) {
      void saveSharedSectionToFirestore('shared_ladies', {
        pieces: getStoredLadiesPieces(),
        settings,
      }).then((result) => {
        if (!result.success) console.error(result.message);
      });
    }
  } catch (e) {
    console.error('Failed to save ladies settings', e);
  }
}

export function resetLadiesData(): { pieces: LadiesPiece[]; settings: LadiesSectionSettings } {
  try {
    localStorage.removeItem(STORAGE_KEY_LADIES_PIECES);
    localStorage.removeItem(STORAGE_KEY_LADIES_SETTINGS);
    window.dispatchEvent(new CustomEvent('runway:ladies_updated'));
    void saveSharedSectionToFirestore('shared_ladies', {
      pieces: DEFAULT_LADIES_PIECES,
      settings: DEFAULT_LADIES_SETTINGS,
    }).then((result) => {
      if (!result.success) console.error(result.message);
    });
  } catch (e) {
    console.error('Failed to reset ladies data', e);
  }
  return {
    pieces: DEFAULT_LADIES_PIECES,
    settings: DEFAULT_LADIES_SETTINGS,
  };
}
