import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../services/scrollLock';
import { formatCurrency } from '../services/storeSettings';
import { RailItem, getStoredRailItems } from '../services/railStorage';
import { addBagItem } from '../services/bagStorage';

interface OffcutRailSectionProps {
  shopName?: string;
  shopTagline?: string;
  currencySymbol?: string;
  whatsappNumber?: string;
  onOpenBag?: () => void;
}

const POLYGONS = [
  // 0: Winged Skull Tee
  'polygon(52.98% 2.08%,51.41% 3.96%,51.81% 3.96%,52.98% 2.45%,55.34% 2.45%,56.12% 3.21%,56.12% 5.47%,54.55% 7.17%,54.36% 9.25%,51.61% 10.38%,47.88% 15.09%,45.92% 16.60%,44.74% 16.60%,31.20% 23.40%,29.24% 25.28%,25.51% 30.94%,14.13% 53.58%,25.51% 60.19%,28.85% 61.70%,28.26% 82.45%,28.65% 96.79%,45.33% 96.79%,49.25% 96.42%,52.00% 95.66%,56.51% 95.66%,62.60% 96.79%,79.47% 96.79%,80.06% 90.38%,79.87% 61.89%,94.39% 53.77%,83.99% 32.08%,79.47% 24.72%,75.94% 22.26%,64.76% 16.79%,63.58% 16.79%,60.24% 13.96%,59.26% 12.08%,57.50% 10.19%,54.95% 9.25%,54.95% 7.17%,56.71% 5.09%,56.71% 3.58%,55.14% 1.89%)',
  // 1: Heavy Blank Tee — Black
  'polygon(53.85% 1.89%,52.47% 2.83%,51.88% 3.96%,52.28% 3.96%,53.45% 2.45%,55.61% 2.45%,56.59% 3.58%,56.59% 5.28%,54.83% 7.17%,54.83% 9.25%,52.47% 10.00%,50.90% 11.51%,49.14% 14.34%,46.39% 16.60%,45.41% 16.60%,35.60% 21.51%,30.89% 24.53%,26.77% 31.13%,26.37% 32.64%,21.86% 41.32%,15.97% 54.34%,24.80% 59.81%,29.51% 62.08%,28.53% 86.23%,28.53% 94.91%,28.92% 96.79%,44.62% 96.79%,48.55% 96.42%,52.28% 95.47%,57.77% 95.47%,60.32% 96.23%,64.05% 96.60%,80.73% 96.79%,80.93% 71.51%,80.53% 62.08%,93.88% 54.53%,93.88% 53.96%,92.90% 52.64%,92.90% 51.13%,83.87% 32.08%,79.55% 24.72%,75.63% 21.89%,71.11% 20.00%,64.84% 16.60%,63.85% 16.60%,61.89% 15.28%,58.16% 10.38%,55.22% 9.25%,55.22% 7.55%,56.79% 5.66%,57.18% 3.77%,55.81% 2.08%)',
  // 2: Heavy Blank Tee — White (Corrected sleeve coordinates so left sleeve is never clipped)
  'polygon(49.61% 1.89%,48.43% 2.45%,47.45% 3.96%,47.84% 3.96%,49.02% 2.45%,51.18% 2.45%,52.16% 3.40%,52.16% 5.28%,50.59% 6.98%,50.39% 9.25%,47.65% 10.38%,46.27% 11.70%,44.31% 14.72%,42.15% 16.42%,40.78% 16.60%,30.57% 21.70%,26.45% 24.53%,22.33% 31.32%,12.52% 52.08%,11.80% 58.00%,13.80% 61.20%,25.67% 61.51%,24.69% 86.79%,24.69% 95.28%,25.08% 96.79%,32.34% 96.42%,42.35% 96.60%,47.25% 95.85%,51.57% 95.85%,56.08% 96.60%,67.66% 96.42%,75.71% 96.79%,76.10% 96.42%,76.30% 83.21%,75.31% 61.51%,89.44% 53.77%,89.64% 53.21%,87.68% 49.81%,79.24% 31.70%,75.12% 24.91%,71.39% 22.08%,58.24% 15.85%,56.48% 14.15%,53.73% 10.38%,50.98% 9.25%,50.98% 7.17%,52.55% 5.47%,52.75% 3.58%,51.77% 2.26%)',
  // 3: Offcut Longsleeve
  'polygon(46.35% 1.89%,45.17% 2.45%,44.19% 3.96%,46.15% 2.26%,47.72% 2.26%,49.10% 3.58%,49.10% 5.09%,47.33% 7.17%,47.14% 9.25%,44.00% 10.75%,41.64% 14.34%,38.70% 16.79%,37.72% 16.79%,25.16% 23.21%,23.00% 25.28%,20.25% 30.75%,15.15% 48.87%,10.24% 71.70%,8.48% 83.58%,8.28% 89.25%,8.87% 91.13%,8.48% 96.23%,16.13% 97.92%,17.11% 97.74%,18.49% 92.83%,19.47% 91.70%,20.45% 89.25%,22.21% 89.06%,22.41% 96.04%,23.00% 96.98%,39.87% 96.60%,44.98% 95.47%,47.14% 95.47%,51.84% 96.42%,61.07% 96.23%,71.86% 96.98%,72.25% 96.79%,72.45% 90.38%,72.84% 90.00%,74.61% 90.19%,76.18% 93.21%,77.55% 97.92%,85.60% 96.79%,85.60% 91.51%,86.19% 90.57%,86.19% 84.53%,84.81% 73.21%,82.06% 58.68%,79.12% 46.04%,75.39% 32.45%,72.65% 26.23%,71.08% 24.15%,57.34% 16.79%,55.97% 16.60%,53.22% 14.15%,51.65% 11.51%,50.47% 10.38%,47.72% 9.25%,47.72% 7.17%,49.49% 5.09%,49.49% 3.58%,48.12% 2.08%)',
  // 4: Rose & Chain Tee
  'polygon(45.25% 1.89%,43.29% 3.96%,43.88% 3.96%,45.05% 2.45%,47.21% 2.45%,48.19% 3.40%,48.19% 5.09%,46.43% 7.36%,46.43% 9.25%,43.88% 10.19%,42.31% 11.70%,40.93% 13.96%,38.19% 16.42%,36.81% 16.60%,24.25% 22.83%,21.70% 24.91%,16.21% 34.15%,6.59% 54.15%,21.31% 62.26%,20.72% 80.94%,20.92% 96.79%,39.76% 96.79%,44.66% 96.42%,72.14% 96.79%,72.53% 96.42%,72.53% 76.23%,71.94% 62.26%,79.40% 58.49%,86.07% 54.15%,75.67% 32.08%,71.35% 24.91%,67.03% 21.89%,61.54% 19.43%,59.18% 17.92%,56.63% 16.79%,55.65% 16.79%,53.69% 15.47%,49.96% 10.57%,47.02% 9.25%,47.02% 7.17%,48.39% 5.66%,48.78% 3.77%,47.41% 2.08%)',
  // 5: Varsity Jacket
  'polygon(52.39% 1.70%,50.43% 3.77%,52.20% 2.26%,54.55% 2.26%,55.53% 3.40%,55.53% 4.91%,53.57% 7.17%,53.57% 9.43%,50.63% 10.57%,47.68% 14.34%,46.31% 14.53%,42.78% 17.74%,41.60% 17.92%,29.24% 24.53%,27.08% 26.60%,24.92% 29.81%,22.17% 37.55%,19.23% 47.92%,15.70% 65.85%,14.72% 76.23%,14.52% 84.72%,15.11% 90.38%,16.68% 92.26%,17.07% 93.40%,17.07% 97.74%,17.66% 98.30%,20.02% 98.68%,25.12% 98.68%,25.71% 98.11%,26.10% 93.40%,27.86% 90.94%,28.45% 88.30%,30.02% 88.30%,30.42% 88.68%,30.61% 92.83%,31.40% 93.58%,60.44% 93.96%,63.19% 93.58%,75.16% 93.77%,75.94% 93.02%,76.33% 88.49%,78.30% 88.30%,78.89% 90.94%,80.85% 93.58%,81.44% 98.30%,82.03% 98.87%,89.29% 98.49%,90.07% 97.92%,90.07% 93.21%,91.84% 90.75%,92.03% 78.49%,90.66% 63.58%,87.91% 49.06%,83.40% 32.83%,81.44% 28.49%,78.10% 24.72%,65.74% 17.92%,64.36% 17.55%,61.03% 14.53%,59.65% 14.34%,56.51% 10.19%,53.96% 9.25%,53.96% 7.36%,55.73% 5.28%,55.93% 3.40%,54.55% 1.89%)',
  // 6: No Restocks Longsleeve
  'polygon(53.85% 1.13%,52.47% 2.08%,51.88% 3.21%,52.28% 3.21%,53.45% 1.70%,55.61% 1.70%,56.59% 2.64%,56.59% 4.34%,54.83% 6.42%,54.83% 8.30%,51.88% 9.43%,48.74% 13.58%,46.39% 15.47%,45.41% 15.47%,34.22% 20.94%,30.49% 23.21%,28.73% 25.28%,26.18% 31.13%,24.02% 37.74%,22.45% 44.53%,19.31% 63.77%,18.33% 75.66%,18.13% 86.42%,18.72% 91.51%,19.70% 93.21%,19.51% 97.55%,20.88% 98.30%,27.35% 98.87%,28.34% 94.34%,30.10% 94.15%,30.69% 95.85%,30.69% 97.92%,31.28% 98.30%,48.16% 97.92%,51.10% 97.17%,55.22% 97.17%,57.57% 97.92%,65.82% 97.74%,77.79% 98.30%,78.18% 94.72%,79.95% 94.53%,81.12% 98.87%,85.83% 98.68%,88.58% 98.11%,88.78% 93.21%,89.56% 91.89%,90.15% 87.17%,90.15% 79.81%,89.36% 68.11%,86.42% 45.85%,82.69% 30.19%,80.53% 25.28%,78.77% 23.21%,65.03% 15.85%,63.27% 15.47%,61.11% 13.58%,58.16% 9.43%,55.22% 8.30%,55.22% 6.60%,56.99% 4.34%,56.99% 2.64%,55.81% 1.32%)',
  // 7: Arch Logo Hoodie
  'polygon(48.82% 2.08%,47.06% 3.96%,48.82% 2.45%,50.78% 2.45%,51.96% 3.40%,51.96% 5.47%,50.20% 7.36%,50.20% 9.43%,47.84% 10.38%,41.37% 10.75%,34.50% 12.26%,33.52% 13.21%,33.12% 15.47%,30.57% 20.94%,30.57% 22.26%,25.27% 25.66%,23.70% 27.92%,21.55% 32.83%,16.44% 48.49%,12.32% 68.49%,11.15% 78.11%,10.75% 85.28%,11.34% 90.94%,12.52% 92.45%,12.13% 97.55%,20.37% 99.25%,20.96% 98.68%,22.14% 94.15%,23.70% 92.83%,24.29% 91.70%,25.86% 91.70%,27.04% 93.96%,27.83% 98.11%,34.30% 97.17%,46.08% 96.23%,57.85% 96.42%,72.37% 98.11%,74.14% 92.08%,74.53% 91.70%,76.10% 91.70%,76.69% 93.02%,78.45% 94.91%,79.83% 99.25%,87.68% 98.11%,88.27% 97.74%,87.87% 92.45%,89.05% 91.13%,89.44% 88.11%,89.44% 81.70%,88.66% 73.21%,87.28% 63.96%,83.95% 48.68%,79.24% 33.21%,76.69% 27.92%,74.92% 25.47%,69.62% 22.08%,69.62% 20.75%,67.27% 15.66%,66.68% 13.21%,65.31% 12.08%,62.56% 11.32%,52.94% 10.38%,50.78% 9.62%,50.59% 7.36%,52.16% 5.85%,52.55% 3.77%,52.35% 3.21%,50.59% 1.89%)',
  // 8: Barbed Heart Tee
  'polygon(45.96% 1.32%,44.00% 3.02%,44.19% 3.40%,45.96% 1.70%,47.53% 1.70%,48.90% 2.83%,48.90% 4.53%,47.14% 6.42%,46.94% 8.68%,44.00% 9.81%,41.64% 13.21%,38.70% 15.85%,37.32% 16.04%,23.98% 22.64%,21.62% 24.72%,17.90% 30.75%,7.30% 51.70%,21.62% 59.62%,20.84% 75.09%,21.04% 98.87%,33.59% 98.68%,38.50% 99.25%,44.39% 98.30%,50.08% 98.30%,53.61% 99.06%,62.64% 98.68%,72.84% 99.06%,73.23% 98.87%,73.63% 88.68%,73.04% 60.00%,86.77% 52.26%,86.77% 51.70%,76.77% 31.51%,73.04% 25.28%,69.90% 22.45%,57.14% 16.04%,55.97% 16.04%,53.22% 13.77%,50.47% 9.81%,47.53% 8.68%,47.53% 6.42%,49.10% 4.91%,49.49% 3.40%,48.12% 1.51%,46.94% 1.13%)',
  // 9: Black Zip Hoodie
  'polygon(45.25% 1.51%,43.29% 3.21%,43.49% 3.58%,45.25% 1.89%,47.02% 1.89%,48.19% 3.02%,48.19% 4.91%,46.43% 6.79%,46.43% 9.06%,43.29% 10.38%,34.46% 11.13%,29.75% 12.26%,28.57% 13.77%,28.18% 15.85%,25.63% 20.94%,25.63% 22.26%,20.13% 25.85%,16.60% 32.64%,13.27% 43.40%,10.32% 55.47%,7.18% 73.77%,6.59% 79.81%,6.59% 87.36%,7.18% 91.13%,8.56% 92.64%,8.36% 97.55%,8.75% 98.11%,16.60% 98.87%,17.97% 93.40%,19.15% 92.45%,19.94% 90.75%,21.70% 90.94%,22.88% 96.98%,23.47% 97.36%,35.44% 96.23%,45.45% 96.42%,46.04% 98.11%,46.62% 97.92%,46.62% 96.60%,47.41% 96.23%,56.44% 96.23%,69.00% 97.36%,69.58% 96.60%,70.57% 91.13%,72.33% 90.94%,73.31% 92.83%,74.29% 93.58%,75.86% 99.06%,83.32% 98.30%,83.71% 97.92%,83.71% 92.83%,84.89% 91.51%,85.48% 88.87%,85.68% 81.13%,85.09% 72.83%,82.34% 55.66%,79.20% 42.45%,76.06% 32.26%,72.72% 25.85%,67.43% 22.26%,67.43% 20.94%,66.05% 18.87%,64.29% 13.02%,61.73% 11.70%,56.83% 10.94%,50.35% 10.57%,48.98% 9.62%,47.02% 9.25%,46.82% 6.98%,48.59% 5.09%,48.78% 3.21%,47.21% 1.51%)',
];

const SHEET_URL =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261107_130252_7b1b8485-d5c5-440c-8921-f5ae01054c6a.png&w=2048&q=90';

// Sheet geometry constants
const ROWY = [80, 700];
const OPEN = 86;
const CX = 750;

function getSpriteGarmentPaintStyle(k: number, ew: number, eh: number) {
  const col = k % 5;
  const row = Math.floor(k / 5);
  const x_box = col * 409.6 - 50;
  const y_box = ROWY[row];
  const sx = ew / 509.6;
  const sy = eh / 530;

  const bgW = (2048 / 509.6) * ew;
  const bgH = (1360 / 530) * eh;
  const posX = -x_box * sx;
  const posY = -y_box * sy;

  return {
    backgroundImage: `url("${SHEET_URL}")`,
    backgroundSize: `${bgW.toFixed(2)}px ${bgH.toFixed(2)}px`,
    backgroundPosition: `${posX.toFixed(2)}px ${posY.toFixed(2)}px`,
    clipPath: POLYGONS[k] || 'none',
    backgroundRepeat: 'no-repeat',
  };
}

export const OffcutRailSection: React.FC<OffcutRailSectionProps> = ({
  shopName = 'Atelier',
  shopTagline = 'Curated Streetwear & Fitting Studio',
  currencySymbol = '$',
  whatsappNumber = '',
  onOpenBag,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const artRef = useRef<HTMLDivElement | null>(null);
  const bigRef = useRef<HTMLDivElement | null>(null);
  const big2Ref = useRef<HTMLDivElement | null>(null);

  const [railItems, setRailItems] = useState<RailItem[]>(() => getStoredRailItems());
  const [scaleK, setScaleK] = useState(1);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [activeMobileIdx, setActiveMobileIdx] = useState(0);

  // Desktop hover and detail states
  const [hov, setHov] = useState(-1);
  const [openIdx, setOpenIdx] = useState(-1);
  const [_isOpeningAnim, setIsOpeningAnim] = useState(false);

  // Bottom modal states: About & Contact
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  // Touch swipe tracking on mobile
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync with storage events from Admin updates
  useEffect(() => {
    const handleUpdate = () => {
      setRailItems(getStoredRailItems());
    };
    window.addEventListener('runway:rail_updated', handleUpdate);
    return () => window.removeEventListener('runway:rail_updated', handleUpdate);
  }, []);

  const N = railItems.length || 1;
  const SLOT = Math.max(70, Math.min(108, Math.floor(1000 / Math.max(N - 1, 1))));

  // Resize fit function
  const updateFit = useCallback(() => {
    if (!sectionRef.current) return;
    const cw = sectionRef.current.clientWidth || window.innerWidth;
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);

    if (!mobile) {
      const k = Math.min(cw / 1500, (window.innerHeight * 0.95) / 1000, 1.05);
      setScaleK(Math.max(k, 0.45));
    }
  }, []);

  useEffect(() => {
    updateFit();
    window.addEventListener('resize', updateFit);
    return () => window.removeEventListener('resize', updateFit);
  }, [updateFit]);

  // Direct Add-to-Cart Handler for ANY Rail Piece
  const lastAddRef = useRef<{ id: string; t: number }>({ id: '', t: 0 });
  const handleAddToCart = (item: RailItem) => {
    // Ignore accidental double-taps / double-clicks on the same piece
    const now = Date.now();
    if (lastAddRef.current.id === item.id && now - lastAddRef.current.t < 700) return;
    lastAddRef.current = { id: item.id, t: now };
    // If it's a built-in item without a custom image URL, supply a clean product image
    const imgSrc =
      item.image ||
      'https://reel-ref-try-the-look.vercel.app/assets/source-tshirt.webp';

    addBagItem({
      productId: item.id,
      name: item.name,
      price: item.price,
      image: imgSrc,
      size: 'M',
      url: '#',
    });

    if (onOpenBag) {
      onOpenBag();
    }
  };

  // Compute garment horizontal positions for Desktop Artboard
  const getGarmentLeft = (k: number) => {
    const base = CX + (k - (N - 1) / 2) * SLOT;
    if (hov >= 0 && k !== hov) {
      return base + Math.sign(k - hov) * OPEN;
    }
    return base;
  };

  const openG = (k: number) => {
    if (openIdx >= 0 || k < 0 || k >= N) return;
    const gx = getGarmentLeft(k);
    setHov(k);
    setOpenIdx(k);
    setIsOpeningAnim(true);

    if (bigRef.current) {
      bigRef.current.animate(
        [
          {
            transform: `translate(${gx - 750}px, -8px) scale(0.61)`,
            opacity: 1,
          },
          {
            transform: 'none',
            opacity: 1,
          },
        ],
        {
          duration: 750,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          fill: 'forwards',
        }
      );
    }
  };

  const closeG = () => {
    if (openIdx < 0) return;
    const k = openIdx;
    const gx = getGarmentLeft(k);

    if (bigRef.current) {
      const anim = bigRef.current.animate(
        [
          { transform: 'none', opacity: 1 },
          {
            transform: `translate(${gx - 750}px, -8px) scale(0.61)`,
            opacity: 1,
          },
        ],
        {
          duration: 650,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          fill: 'forwards',
        }
      );

      anim.onfinish = () => {
        setIsOpeningAnim(false);
        setOpenIdx(-1);
        setHov(-1);
      };
    } else {
      setIsOpeningAnim(false);
      setOpenIdx(-1);
      setHov(-1);
    }
  };

  const step = (d: number) => {
    if (openIdx < 0) return;
    const to = (openIdx + d + N) % N;

    if (big2Ref.current) {
      big2Ref.current.animate(
        [
          { transform: 'none', opacity: 1, filter: 'blur(0)' },
          {
            transform: `translateX(${-d * 120}px) scale(0.94)`,
            opacity: 0,
            filter: 'blur(6px)',
          },
        ],
        {
          duration: 600,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          fill: 'none',
        }
      );
    }

    setOpenIdx(to);
    setHov(to);

    if (bigRef.current) {
      bigRef.current.animate(
        [
          {
            transform: `translateX(${d * 120}px) scale(0.94)`,
            opacity: 0,
            filter: 'blur(6px)',
          },
          { transform: 'none', opacity: 1, filter: 'blur(0)' },
        ],
        {
          duration: 600,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          fill: 'forwards',
        }
      );
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (openIdx >= 0) {
        if (e.key === 'ArrowRight') step(1);
        if (e.key === 'ArrowLeft') step(-1);
        if (e.key === 'Escape') closeG();
      } else {
        if (e.key === 'ArrowRight') {
          if (isMobile) {
            setActiveMobileIdx((prev) => (prev + 1) % N);
          } else {
            setHov((prev) => (prev < 0 ? 0 : Math.min(N - 1, prev + 1)));
          }
        } else if (e.key === 'ArrowLeft') {
          if (isMobile) {
            setActiveMobileIdx((prev) => (prev - 1 + N) % N);
          } else {
            setHov((prev) => (prev < 0 ? N - 1 : Math.max(0, prev - 1)));
          }
        } else if (e.key === 'Enter') {
          if (isMobile) {
            openG(activeMobileIdx);
          } else if (hov >= 0) {
            openG(hov);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openIdx, hov, N, isMobile, activeMobileIdx]);

  // Page must NOT scroll while the 3D hanger detail / About / Contact is open.
  // (portal + ref-counted lock, restores the exact scroll position on close)
  useScrollLock(openIdx >= 0 || aboutModalOpen || contactModalOpen);

  // Expose automation / inspection hook
  useEffect(() => {
    (window as any).__closet = {
      open: (k: number) => openG(k),
      close: () => closeG(),
      step: (d: number) => step(d),
      setHov: (k: number) => setHov(k),
      get state() {
        return { hov, openIdx, isMobile, activeMobileIdx };
      },
    };
    return () => {
      delete (window as any).__closet;
    };
  }, [hov, openIdx, isMobile, activeMobileIdx]);

  const activeProduct = openIdx >= 0 && openIdx < N ? railItems[openIdx] : null;
  const facedGarmentLeft = hov >= 0 && hov < N ? getGarmentLeft(hov) : CX;
  const facedProduct = hov >= 0 && hov < N ? railItems[hov] : null;
  const mobileFacedProduct = railItems[activeMobileIdx] || railItems[0];

  // Render garment visual
  const renderGarmentVisual = (
    item: RailItem,
    _k: number,
    width: number,
    height: number,
    _isDetail: boolean
  ) => {
    if (
      item.spriteIndex !== undefined &&
      item.spriteIndex >= 0 &&
      item.spriteIndex < 10 &&
      !item.image
    ) {
      const paint = getSpriteGarmentPaintStyle(item.spriteIndex, width, height);
      return <i className="absolute inset-0 block" style={paint} />;
    }

    const imgSrc =
      item.image ||
      'https://reel-ref-try-the-look.vercel.app/assets/source-tshirt.webp';
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-start pointer-events-none select-none">
        {/* Metallic hanger hook */}
        <div className="relative w-8 h-7 flex-shrink-0 -mb-2 z-10 opacity-90">
          <svg viewBox="0 0 32 28" fill="none" className="w-full h-full drop-shadow-sm">
            <path
              d="M16 2 C 16 2, 22 4, 21 11 C 20 15, 16 15, 16 19 L 4 27 L 28 27 Z"
              stroke="#d4d4d8"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="16" cy="3" r="1.5" fill="#f4f4f5" />
          </svg>
        </div>

        {/* Brand Garment Image */}
        <div
          className="w-full flex-1 flex items-center justify-center p-1 overflow-visible"
          style={{
            filter: 'drop-shadow(0 14px 20px rgba(0,0,0,0.5))',
          }}
        >
          <img
            src={imgSrc}
            alt={item.name}
            className="w-full h-full object-contain pointer-events-none"
            loading="lazy"
          />
        </div>
      </div>
    );
  };

  // Mobile Touch Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    // Horizontal swipe threshold
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        // Swipe left -> next garment
        setActiveMobileIdx((prev) => (prev + 1) % N);
      } else {
        // Swipe right -> prev garment
        setActiveMobileIdx((prev) => (prev - 1 + N) % N);
      }
    }
  };

  return (
    <section
      ref={sectionRef}
      id="offcut-rail-section"
      className="relative isolate w-full bg-[#0b0b0c] text-[#f1efec] overflow-hidden flex flex-col items-center justify-center select-none"
      style={{
        minHeight: isMobile ? '720px' : `${Math.round(1000 * scaleK)}px`,
        height: isMobile ? 'auto' : `${Math.round(1000 * scaleK)}px`,
      }}
      aria-label="Interactive 3D Clothing Rail"
    >
      {/* ==================================================================== */}
      {/* MOBILE-RESPONSIVE VIEW (< 768px)                                    */}
      {/* ==================================================================== */}
      {isMobile ? (
        <div
          className="w-full min-h-[720px] py-8 px-4 flex flex-col justify-between items-center relative bg-gradient-to-b from-[#18181a] via-[#111113] to-[#0b0b0c]"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Mobile Header: Brand Name from Admin */}
          <div className="text-center pt-2 pb-2">
            <span className="text-[10px] tracking-[0.24em] uppercase text-[#8d8a86] font-semibold block mb-1">
              3D Hanging Rail
            </span>
            <h2 className="text-3xl font-black uppercase text-[#f1efec] tracking-wider">
              {shopName || 'Atelier'}
            </h2>
            <p className="text-[11px] text-[#8d8a86] tracking-wider uppercase mt-1">
              Swipe or tap clothes to inspect fit
            </p>
          </div>

          {/* Chrome Rail on Mobile */}
          <div className="relative w-full max-w-sm mx-auto my-4 px-2">
            {/* The polished chrome bar */}
            <div
              className="relative w-full h-[10px] rounded-[5px] z-10"
              style={{
                background:
                  'linear-gradient(180deg, #fafafa 0%, #b9bcc1 28%, #5d6066 55%, #a9adb3 78%, #e6e7e9 100%)',
                boxShadow: '0 8px 16px rgba(0,0,0,0.6)',
              }}
            >
              {/* Left metallic cap */}
              <div
                className="absolute -left-[10px] -top-[7px] w-[12px] h-[24px] rounded-[4px]"
                style={{
                  background:
                    'linear-gradient(90deg, #8d9096 0%, #f3f3f4 45%, #7a7d83 100%)',
                }}
              />
              {/* Right metallic cap */}
              <div
                className="absolute -right-[10px] -top-[7px] w-[12px] h-[24px] rounded-[4px]"
                style={{
                  background:
                    'linear-gradient(90deg, #8d9096 0%, #f3f3f4 45%, #7a7d83 100%)',
                }}
              />
            </div>

            {/* Mobile Garment Stage */}
            <div className="relative h-[270px] w-full flex items-center justify-center mt-[-6px] overflow-visible">
              {railItems.map((item, idx) => {
                const diff = idx - activeMobileIdx;
                const isSelected = diff === 0;

                // Only render items close to active for performance & clean visual
                if (Math.abs(diff) > 2) return null;

                const offsetX = diff * 75; // px horizontal spread
                const rotY = isSelected ? 0 : diff < 0 ? -60 : 60;
                const scale = isSelected ? 1 : 0.82;
                const opacity = isSelected ? 1 : 0.45;
                const zIndex = isSelected ? 30 : 20 - Math.abs(diff);

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (isSelected) {
                        openG(idx);
                      } else {
                        setActiveMobileIdx(idx);
                      }
                    }}
                    className="absolute top-0 w-[210px] h-[260px] cursor-pointer transition-all duration-500 ease-out"
                    style={{
                      transform: `translateX(${offsetX}px) scale(${scale}) perspective(800px) rotateY(${rotY}deg)`,
                      zIndex,
                      opacity,
                    }}
                  >
                    <div className="relative w-full h-full">
                      {renderGarmentVisual(item, idx, 210, 260, false)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Step Arrows */}
            <div className="flex items-center justify-between px-4 mt-1">
              <button
                type="button"
                onClick={() => setActiveMobileIdx((prev) => (prev - 1 + N) % N)}
                aria-label="Previous piece"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 grid place-items-center transition-colors active:scale-95 cursor-pointer"
              >
                ←
              </button>

              <div className="text-[11px] font-semibold tracking-[0.2em] text-[#8d8a86]">
                {String(activeMobileIdx + 1).padStart(2, '0')} / {String(N).padStart(2, '0')}
              </div>

              <button
                type="button"
                onClick={() => setActiveMobileIdx((prev) => (prev + 1) % N)}
                aria-label="Next piece"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 grid place-items-center transition-colors active:scale-95 cursor-pointer"
              >
                →
              </button>
            </div>
          </div>

          {/* Active Garment Details & Responsive Stacked Buttons */}
          {mobileFacedProduct && (
            <div className="w-full max-w-xs mx-auto text-center px-2 flex flex-col items-center gap-3 mt-1">
              <div>
                <h3
                  className="text-2xl font-normal text-white px-2 break-words leading-tight"
                  style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}
                >
                  {mobileFacedProduct.name}
                </h3>
                <div className="text-sm font-semibold text-neutral-300 mt-1">
                  {formatCurrency(mobileFacedProduct.price, currencySymbol)}
                </div>
              </div>

              {/* Clean stacked buttons that never wrap or break */}
              <div className="w-full flex flex-col items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleAddToCart(mobileFacedProduct)}
                  className="w-full h-11 rounded-full bg-white text-black text-xs font-bold tracking-wider uppercase hover:bg-neutral-200 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>Add to Cart ({formatCurrency(mobileFacedProduct.price, currencySymbol)})</span>
                </button>

                <button
                  type="button"
                  onClick={() => openG(activeMobileIdx)}
                  className="w-full h-10 rounded-full border border-white/30 text-white text-xs font-medium tracking-wider uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>Inspect Piece ↗</span>
                </button>
              </div>
            </div>
          )}

          {/* Mobile Bottom Bar: About on Left & Contact on Right */}
          <div className="w-full max-w-xs mx-auto flex items-center justify-between mt-8 pt-4 border-t border-neutral-800/80 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8d8a86]">
            <button
              type="button"
              onClick={() => setAboutModalOpen(true)}
              className="py-1 px-1 hover:text-white transition-colors cursor-pointer"
            >
              About
            </button>
            <span className="text-[10px] text-neutral-600">
              {shopName} Studio
            </span>
            <button
              type="button"
              onClick={() => {
                if (whatsappNumber) {
                  const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '');
                  window.open(
                    `https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(
                      shopName
                    )}!`,
                    '_blank'
                  );
                } else {
                  setContactModalOpen(true);
                }
              }}
              className="py-1 px-1 hover:text-white transition-colors cursor-pointer"
            >
              Contact
            </button>
          </div>
        </div>
      ) : (
        /* ================================================================== */
        /* DESKTOP ARTBOARD VIEW (>= 768px)                                  */
        /* ================================================================== */
        <div
          ref={artRef}
          id="art"
          className="absolute top-1/2 left-1/2"
          style={{
            width: '1500px',
            height: '1000px',
            transform: `translate(-50%, -50%) scale(${scaleK})`,
            transformOrigin: 'center center',
            background:
              'radial-gradient(70% 55% at 50% 40%, #18181a 0%, #0b0b0c 100%)',
          }}
        >
          {/* Center Site Logo from Admin */}
          <div
            id="logo"
            className={`absolute left-1/2 top-[32px] -translate-x-1/2 text-center transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
              openIdx >= 0 ? 'opacity-[0.12] blur-[2px]' : 'opacity-100'
            }`}
          >
            <h2
              className="text-[52px] md:text-[60px] leading-none tracking-tight text-[#f1efec] font-black uppercase"
              style={{
                fontFamily: "'Inter', sans-serif",
                letterSpacing: '0.04em',
              }}
            >
              {shopName || 'Atelier'}
            </h2>
            <span className="block text-[11px] tracking-[0.24em] uppercase text-[#8d8a86] mt-2 font-medium">
              3D Collection & Fitting Rail
            </span>
          </div>

          {/* Polished Chrome Rail (1200px wide, spans x 150 -> 1350, top 254px, 12px tall) */}
          <div
            id="rail"
            className={`absolute left-[150px] right-[150px] top-[254px] h-[12px] rounded-[6px] transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
              openIdx >= 0 ? 'opacity-[0.12] blur-[2px]' : 'opacity-100'
            }`}
            style={{
              background:
                'linear-gradient(180deg, #fafafa 0%, #b9bcc1 28%, #5d6066 55%, #a9adb3 78%, #e6e7e9 100%)',
              boxShadow: '0 10px 18px rgba(0,0,0,0.45)',
            }}
          >
            {/* Left end cap */}
            <div
              className="absolute -left-[14px] -top-[9px] w-[16px] h-[30px] rounded-[5px]"
              style={{
                background:
                  'linear-gradient(90deg, #8d9096 0%, #f3f3f4 45%, #7a7d83 100%)',
              }}
            />
            {/* Right end cap */}
            <div
              className="absolute -right-[14px] -top-[9px] w-[16px] h-[30px] rounded-[5px]"
              style={{
                background:
                  'linear-gradient(90deg, #8d9096 0%, #f3f3f4 45%, #7a7d83 100%)',
              }}
            />
          </div>

          {/* Rack Container with Clothes Hanging Edge-on in Real CSS 3D */}
          <div
            id="rack"
            onPointerLeave={() => {
              if (openIdx < 0) setHov(-1);
            }}
            className={`absolute inset-0 w-[1500px] h-[1000px] transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
              openIdx >= 0 ? 'opacity-[0.12] blur-[2px]' : 'opacity-100'
            }`}
          >
            {railItems.map((item, k) => {
              const x = getGarmentLeft(k);
              const isFaced = hov === k;
              const isHiddenByDetail = openIdx === k;

              return (
                <div
                  key={item.id}
                  className="absolute top-[236px] w-[289px] h-[300px] pointer-events-none"
                  style={{
                    left: `${x}px`,
                    marginLeft: '-144.5px',
                    perspective: '900px',
                    visibility: isHiddenByDetail ? 'hidden' : 'visible',
                    transition: 'left 0.75s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    zIndex: isFaced ? 20 : 10 + k,
                  }}
                >
                  {/* Only the visible (rotated) garment is clickable, so neighbouring
                      hangers no longer steal each other's clicks */}
                  <div
                    className="absolute inset-0 pointer-events-auto cursor-pointer"
                    onPointerEnter={() => {
                      if (openIdx < 0) setHov(k);
                    }}
                    onClick={() => openG(k)}
                    style={{
                      transformOrigin: '50% 4%',
                      transform: isFaced ? 'rotateY(0deg)' : 'rotateY(-74deg)',
                      filter: isFaced
                        ? 'brightness(1) drop-shadow(0 22px 26px rgba(0,0,0,0.55))'
                        : 'brightness(0.82) drop-shadow(0 18px 18px rgba(0,0,0,0.5))',
                      transition:
                        'transform 0.75s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.75s ease',
                    }}
                  >
                    {renderGarmentVisual(item, k, 289, 300, false)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Caption below faced garment */}
          <div
            id="cap"
            className={`absolute top-[552px] text-center text-[11px] tracking-[0.12em] uppercase text-[#8d8a86] whitespace-nowrap pointer-events-none transition-all duration-350 ${
              hov >= 0 && openIdx < 0 ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              left: `${facedGarmentLeft}px`,
              transform: 'translateX(-50%)',
              transition:
                'left 0.75s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s ease',
            }}
          >
            {facedProduct && (
              <>
                <b className="block text-[#f1efec] font-medium mb-[4px]">
                  {facedProduct.name}
                </b>
                <span>{formatCurrency(facedProduct.price, currencySymbol)}</span>
              </>
            )}
          </div>

          {/* "See availability" bottom pill on Desktop (directly adds faced item to cart & opens bag) */}
          <button
            type="button"
            id="avail"
            onClick={() => {
              if (facedProduct) {
                handleAddToCart(facedProduct);
              } else if (railItems[0]) {
                handleAddToCart(railItems[0]);
              } else if (onOpenBag) {
                onOpenBag();
              }
            }}
            className={`absolute left-1/2 top-[740px] -translate-x-1/2 h-[38px] px-[24px] rounded-[40px] border border-[rgba(241,239,236,0.6)] text-[12px] font-medium tracking-[0.12em] uppercase inline-grid place-items-center transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:bg-[#f1efec] hover:text-[#0b0b0c] cursor-pointer ${
              openIdx >= 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            See availability
          </button>

          {/* BOTTOM SECTION: About on Left & Contact on Right */}
          <div
            id="bottom-bar"
            className={`absolute left-0 right-0 bottom-[36px] px-[50px] flex items-center justify-between text-[12px] font-medium tracking-[0.14em] uppercase text-[#8d8a86] z-10 transition-all duration-700 ${
              openIdx >= 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <button
              type="button"
              onClick={() => setAboutModalOpen(true)}
              className="hover:text-[#f1efec] transition-colors flex items-center gap-2 group cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#8d8a86] group-hover:bg-[#f1efec] transition-colors" />
              <span>About</span>
            </button>

            <div className="text-[10px] tracking-[0.2em] text-[#555] uppercase hidden sm:block">
              {shopName} Studio Edition
            </div>

            <button
              type="button"
              onClick={() => {
                if (whatsappNumber) {
                  const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '');
                  window.open(
                    `https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(
                      shopName
                    )}!`,
                    '_blank'
                  );
                } else {
                  setContactModalOpen(true);
                }
              }}
              className="hover:text-[#f1efec] transition-colors flex items-center gap-2 group cursor-pointer"
            >
              <span>Contact</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#8d8a86] group-hover:bg-[#f1efec] transition-colors" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DETAIL MODAL (#det) FOR BOTH MOBILE & DESKTOP                        */}
      {/* ==================================================================== */}
      {openIdx >= 0 && activeProduct && createPortal(
        <div
          id="det"
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto overscroll-contain"
        >
          {/* Backdrop dismiss */}
          <div className="absolute inset-0" onClick={closeG} />

          <div className="relative z-10 max-w-sm w-full mx-auto bg-[#121214] border border-neutral-800 p-6 flex flex-col items-center text-center shadow-2xl rounded-sm my-auto">
            {/* Close Button top-right */}
            <button
              type="button"
              id="close"
              onClick={closeG}
              className="absolute right-4 top-4 text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-white p-2 cursor-pointer"
            >
              ✕ Close
            </button>

            {/* Counter: e.g. 01 / 10 */}
            <div
              id="num"
              className="text-[11px] tracking-[0.16em] text-[#8d8a86] mb-2"
            >
              {String(openIdx + 1).padStart(2, '0')} / {String(N).padStart(2, '0')}
            </div>

            {/* Big Detail Garment Image */}
            <div className="relative w-full max-w-[260px] h-[280px] sm:max-w-[300px] sm:h-[320px] flex items-center justify-center my-2 overflow-visible">
              <div
                ref={bigRef}
                id="big"
                className="w-full h-full flex items-center justify-center"
                style={{
                  transformOrigin: '50% 4%',
                  filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.65))',
                }}
              >
                {renderGarmentVisual(activeProduct, openIdx, 300, 320, true)}
              </div>
            </div>

            {/* Navigation Arrows */}
            <div className="flex items-center gap-6 my-2">
              <button
                type="button"
                id="prev"
                aria-label="Previous"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                className="w-10 h-10 rounded-full border border-neutral-600 hover:border-white grid place-items-center text-white transition-colors cursor-pointer"
              >
                ←
              </button>
              <span className="text-xs text-neutral-400 font-mono">
                {openIdx + 1} of {N}
              </span>
              <button
                type="button"
                id="next"
                aria-label="Next"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                className="w-10 h-10 rounded-full border border-neutral-600 hover:border-white grid place-items-center text-white transition-colors cursor-pointer"
              >
                →
              </button>
            </div>

            {/* Product Title */}
            <h3
              id="name"
              className="text-2xl sm:text-3xl font-normal text-white w-full px-2 break-words leading-tight mt-2 mb-1"
              style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}
            >
              {activeProduct.name}
            </h3>

            {/* Price */}
            <div
              id="price"
              className="text-sm font-semibold tracking-wider text-[#8d8a86] mb-4"
            >
              {formatCurrency(activeProduct.price, currencySymbol)}
            </div>

            {/* Add to Cart Button */}
            <button
              type="button"
              onClick={() => handleAddToCart(activeProduct)}
              className="w-full h-11 rounded-full bg-white text-black text-xs font-bold tracking-wider uppercase hover:bg-neutral-200 transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>Add to Cart ({formatCurrency(activeProduct.price, currencySymbol)})</span>
            </button>
          </div>
        </div>
        , document.body)}

      {/* About Modal */}
      {aboutModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#2b2b2e] text-[#f1efec] max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setAboutModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white text-lg cursor-pointer"
            >
              ✕
            </button>
            <span className="text-[10px] tracking-widest uppercase font-bold text-neutral-400">
              About The Brand
            </span>
            <h3 className="text-xl font-bold mt-1 text-white">{shopName}</h3>
            <p className="text-xs text-neutral-300 mt-3 leading-relaxed">
              {shopTagline}
            </p>
            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
              Each garment in our collection is crafted with meticulous proportions, premium weight fabrics, and architectural drape. Explore the interactive 3D rack or browse head-to-toe looks on our runway.
            </p>
            <div className="mt-6 pt-4 border-t border-[#2b2b2e] flex justify-end">
              <button
                type="button"
                onClick={() => setAboutModalOpen(false)}
                className="px-4 py-1.5 bg-white text-black text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
        , document.body)}

      {/* Contact Modal */}
      {contactModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-[#2b2b2e] text-[#f1efec] max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setContactModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white text-lg cursor-pointer"
            >
              ✕
            </button>
            <span className="text-[10px] tracking-widest uppercase font-bold text-neutral-400">
              Customer Concierge
            </span>
            <h3 className="text-xl font-bold mt-1 text-white">{shopName} Concierge</h3>
            <p className="text-xs text-neutral-300 mt-3 leading-relaxed">
              Have questions regarding sizing, custom cuts, or direct international ordering? Our styling team is available for real-time consultation.
            </p>
            {whatsappNumber && (
              <div className="mt-4 p-3 bg-[#1d1d20] border border-[#2e2e33] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-neutral-400 font-semibold block">WhatsApp Concierge</span>
                  <span className="text-xs font-bold text-white">+{whatsappNumber}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '');
                    window.open(
                      `https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(
                        shopName
                      )}!`,
                      '_blank'
                    );
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold uppercase tracking-wider cursor-pointer"
                >
                  Chat Now
                </button>
              </div>
            )}
            <div className="mt-6 pt-4 border-t border-[#2b2b2e] flex justify-end">
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="px-4 py-1.5 bg-white text-black text-xs font-semibold uppercase tracking-wider hover:bg-neutral-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        , document.body)}
    </section>
  );
};
