import { saveSharedSectionToFirestore } from './firebase';

export interface ReelItem {
  id: string;
  title: string;
  caption: string;
  videoUrl: string;
  posterUrl: string;
  productIds: string[];
}

const STORAGE_KEY = 'runway_reels_v1';

export function getStoredReels(): ReelItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) =>
      item && typeof item.id === 'string' && typeof item.videoUrl === 'string'
    ) : [];
  } catch (error) {
    console.error('Failed to load reels', error);
    return [];
  }
}

export function saveReels(items: ReelItem[], persistCloud = true): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('runway:reels_updated'));
    if (persistCloud) {
      void saveSharedSectionToFirestore('shared_reels', { items }).then((result) => {
        if (!result.success) console.error(result.message);
      });
    }
  } catch (error) {
    console.error('Failed to save reels', error);
  }
}
