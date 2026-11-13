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
 
export async function saveReels(
  items: ReelItem[],
  persistCloud = true
): Promise<{ success: boolean; message: string }> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('runway:reels_updated'));
  } catch (error: any) {
    console.error('Failed to save reels locally', error);
    return { success: false, message: error?.message || 'Could not save reels on this device.' };
  }
 
  if (!persistCloud) return { success: true, message: 'Reels loaded from shared storage.' };
  const result = await saveSharedSectionToFirestore('shared_reels', { items });
  if (!result.success) console.error('Failed to sync reels to Firestore:', result.message);
  return result;
}
