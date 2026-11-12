import { saveSharedSectionToFirestore } from './firebase';
export interface LadiesRailItem {
  id: string;
  name: string;
  price: number;
  image: string;
  fitDescription?: string;
}

export const DEFAULT_LADIES_RAIL_ITEMS: LadiesRailItem[] = [
  {
    id: 'lrail-1',
    name: 'Sculpted Ruffle Silk Top',
    price: 380,
    image: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=600&q=85',
    fitDescription: 'Asymmetric sculpted ruffle bodice crafted from mulberry silk with invisible back zip.',
  },
  {
    id: 'lrail-2',
    name: 'Satin Silk Billow Blouse',
    price: 420,
    image: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=600&q=85',
    fitDescription: 'Fluid billow-sleeve blouse with champagne luster and elongated French cuffs.',
  },
  {
    id: 'lrail-3',
    name: 'Pleated Georgette Halter Top',
    price: 290,
    image: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=600&q=85',
    fitDescription: 'Sunray pleated georgette halter top with open back and delicate neck tie.',
  },
  {
    id: 'lrail-4',
    name: 'Champagne Trench Bodice',
    price: 460,
    image: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=600&q=85',
    fitDescription: 'Satin-finish sleeveless trench top with structured storm flap and tortoise buttons.',
  },
  {
    id: 'lrail-5',
    name: 'Blush Feather Trim Evening Top',
    price: 510,
    image: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=600&q=85',
    fitDescription: 'Opulent cropped evening top trimmed with ostrich plume feathers and lined in pure silk.',
  },
  {
    id: 'lrail-6',
    name: 'Powder Blue Fine Knit Top',
    price: 390,
    image: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=600&q=85',
    fitDescription: 'Lightweight cashmere-blend top in delicate powder blue with ribbed boat neckline.',
  },
  {
    id: 'lrail-7',
    name: 'Pearl Embroidered Organza Blouse',
    price: 440,
    image: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=600&q=85',
    fitDescription: 'Sheer translucent organza blouse adorned with hand-stitched pearl beadwork.',
  },
  {
    id: 'lrail-8',
    name: 'Noir Velvet Corset Bodice',
    price: 480,
    image: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=600&q=85',
    fitDescription: 'Boned velvet bodice in deep obsidian with sweetheart neckline and lace-up back.',
  },
  {
    id: 'lrail-9',
    name: 'Tailored Linen Peplum Vest',
    price: 320,
    image: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=600&q=85',
    fitDescription: 'Crisp oatmeal Belgian linen tailored vest with sculpted waistline and horn buttons.',
  },
  {
    id: 'lrail-10',
    name: 'Draped Halter Evening Bodice',
    price: 350,
    image: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=600&q=85',
    fitDescription: 'Grecian draped bodice in molten satin finish with metallic neck ring.',
  },
];

const STORAGE_KEY_LADIES_RAIL = 'runway_ladies_rail_items_v1';

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
    void saveSharedSectionToFirestore('shared_ladies_rail', { items: DEFAULT_LADIES_RAIL_ITEMS }).then((result) => {
      if (!result.success) console.error(result.message);
    });
  } catch (e) {
    console.error('Failed to reset ladies rail items', e);
  }
  return DEFAULT_LADIES_RAIL_ITEMS;
}
