import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../services/scrollLock';
import { formatCurrency } from '../services/storeSettings';
import { LadiesRailItem, getStoredLadiesRailItems } from '../services/ladiesRailStorage';
import { addBagItem } from '../services/bagStorage';

interface LadiesRailSectionProps {
  shopName?: string;
  currencySymbol?: string;
  whatsappNumber?: string;
  onOpenBag?: () => void;
}

export const LadiesRailSection: React.FC<LadiesRailSectionProps> = ({
  shopName,
  currencySymbol,
  whatsappNumber,
  onOpenBag,
}) => {
  const [railItems, setRailItems] = useState<LadiesRailItem[]>(() =>
    getStoredLadiesRailItems()
  );

  const [hov, setHov] = useState<number>(-1);
  const [openIdx, setOpenIdx] = useState<number>(-1);
  const [scaleK, setScaleK] = useState<number>(1);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [activeMobileIdx, setActiveMobileIdx] = useState<number>(0);
  const [contactModalOpen, setContactModalOpen] = useState<boolean>(false);
  const [aboutModalOpen, setAboutModalOpen] = useState<boolean>(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const artRef = useRef<HTMLDivElement | null>(null);
  const bigRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const N = railItems.length;

  // Listen to updates from Admin Panel
  useEffect(() => {
    const handleUpdate = () => {
      setRailItems(getStoredLadiesRailItems());
    };
    window.addEventListener('runway:ladies_rail_updated', handleUpdate);
    return () =>
      window.removeEventListener('runway:ladies_rail_updated', handleUpdate);
  }, []);

  // Compute responsive layout
  const handleResize = useCallback(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    if (!mobile) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const k = Math.min(vw / 1500, (vh * 0.95) / 1000);
      setScaleK(Math.max(0.48, Math.min(1.05, k)));
    }
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Page must NOT scroll while the 3D top detail / About / Contact is open
  useScrollLock(openIdx >= 0 || aboutModalOpen || contactModalOpen);

  // Keyboard navigation & escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (openIdx >= 0) {
        if (e.key === 'ArrowRight') setOpenIdx((prev) => (prev + 1) % N);
        if (e.key === 'ArrowLeft') setOpenIdx((prev) => (prev - 1 + N) % N);
        if (e.key === 'Escape') setOpenIdx(-1);
      } else if (isMobile) {
        if (e.key === 'ArrowRight') setActiveMobileIdx((prev) => (prev + 1) % N);
        if (e.key === 'ArrowLeft') setActiveMobileIdx((prev) => (prev - 1 + N) % N);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openIdx, isMobile, N]);

  // Garment position calculation along 1200px chrome rail (X: 150 -> 1350)
  const getGarmentLeft = (k: number) => {
    const step = 1200 / (N + 1);
    const baseX = 150 + step * (k + 1);

    if (hov < 0 || hov === k) return baseX;

    const shiftAmount = 75;
    if (k < hov) {
      const dist = hov - k;
      const factor = Math.max(0, 1 - dist * 0.22);
      return baseX - shiftAmount * factor;
    } else {
      const dist = k - hov;
      const factor = Math.max(0, 1 - dist * 0.22);
      return baseX + shiftAmount * factor;
    }
  };

  // Add exact piece to cart
  const lastAddRef = useRef<{ id: string; t: number }>({ id: '', t: 0 });
  const handleAddToCart = (product: LadiesRailItem) => {
    // Ignore accidental double-taps / double-clicks on the same piece
    const now = Date.now();
    if (lastAddRef.current.id === product.id && now - lastAddRef.current.t < 700) return;
    lastAddRef.current = { id: product.id, t: now };
    addBagItem({
      productId: product.id,
      name: product.name,
      size: 'One Size',
      price: product.price,
      image: product.image,
      quantity: 1,
    });
    if (onOpenBag) {
      onOpenBag();
    }
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
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        setActiveMobileIdx((prev) => (prev + 1) % N);
      } else {
        setActiveMobileIdx((prev) => (prev - 1 + N) % N);
      }
    }
  };

  const activeProduct = openIdx >= 0 ? railItems[openIdx] : null;
  const facedIndex = hov >= 0 ? hov : 0;
  const facedProduct = railItems[facedIndex];
  const facedLeft = getGarmentLeft(facedIndex);
  const mobileFacedProduct = railItems[activeMobileIdx] || railItems[0];

  return (
    <section
      ref={sectionRef}
      id="ladies-rail-section"
      className="relative isolate w-full bg-[#0d0e12] text-[#f1efec] overflow-hidden flex flex-col items-center justify-center select-none"
      style={{
        minHeight: isMobile ? '720px' : `${Math.round(1000 * scaleK)}px`,
        height: isMobile ? 'auto' : `${Math.round(1000 * scaleK)}px`,
      }}
      aria-label="Ladies 3D Tops on Hangers"
    >
      {/* ==================================================================== */}
      {/* MOBILE-RESPONSIVE VIEW (< 768px)                                    */}
      {/* ==================================================================== */}
      {isMobile ? (
        <div
          className="w-full min-h-[720px] py-8 px-4 flex flex-col justify-between items-center relative bg-gradient-to-b from-[#14151a] via-[#101116] to-[#0d0e12]"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Mobile Header */}
          <div className="text-center pt-2 pb-2">
            <span className="text-[10px] tracking-[0.24em] uppercase text-pink-400 font-semibold block mb-1">
              Ladies 3D Collection
            </span>
            <h2 className="text-3xl font-black uppercase text-[#f1efec] tracking-wider font-['Michroma']">
              Tops on Hangers
            </h2>
            <p className="text-[11px] text-[#8d8a86] tracking-wider uppercase mt-1">
              Swipe or tap garments to inspect fit
            </p>
          </div>

          {/* Chrome Rail on Mobile */}
          <div className="relative w-full max-w-sm mx-auto my-4 px-2">
            <div
              className="relative w-full h-[10px] rounded-[5px] z-10"
              style={{
                background:
                  'linear-gradient(180deg, #fafafa 0%, #b9bcc1 28%, #5d6066 55%, #a9adb3 78%, #e6e7e9 100%)',
                boxShadow: '0 8px 16px rgba(0,0,0,0.6)',
              }}
            >
              <div
                className="absolute -left-[10px] -top-[7px] w-[12px] h-[24px] rounded-[4px]"
                style={{
                  background:
                    'linear-gradient(90deg, #8d9096 0%, #f3f3f4 45%, #7a7d83 100%)',
                }}
              />
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
                if (Math.abs(diff) > 2) return null;

                const offsetX = diff * 75;
                const rotY = isSelected ? 0 : diff < 0 ? -60 : 60;
                const scale = isSelected ? 1 : 0.82;
                const opacity = isSelected ? 1 : 0.45;
                const zIndex = isSelected ? 30 : 20 - Math.abs(diff);

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (isSelected) {
                        setOpenIdx(idx);
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
                    <div className="relative w-full h-full flex flex-col items-center">
                      {/* Wooden Clothes Hanger */}
                      <div className="w-16 h-7 mb-[-4px] relative z-10 flex items-center justify-center">
                        <svg viewBox="0 0 32 20" fill="none" className="w-full h-full drop-shadow">
                          <path
                            d="M16 2 C16 2, 22 4, 21 8 C20 12, 16 12, 16 14 L4 18 L28 18 Z"
                            stroke="#e4d5b7"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="16" cy="3" r="1.5" fill="#e4e4e7" />
                        </svg>
                      </div>
                      <div className="w-full flex-1 p-2 flex items-center justify-center overflow-visible">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-contain pointer-events-none drop-shadow-xl"
                          loading="lazy"
                        />
                      </div>
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
                <div className="text-sm font-semibold text-pink-300 mt-1">
                  {formatCurrency(mobileFacedProduct.price, currencySymbol)}
                </div>
              </div>

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
                  onClick={() => setOpenIdx(activeMobileIdx)}
                  className="w-full h-10 rounded-full border border-white/30 text-white text-xs font-medium tracking-wider uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>Inspect Piece ↗</span>
                </button>
              </div>
            </div>
          )}

          {/* Bottom Bar */}
          <div className="w-full max-w-xs mx-auto flex items-center justify-between mt-8 pt-4 border-t border-neutral-800/80 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8d8a86]">
            <button
              type="button"
              onClick={() => setAboutModalOpen(true)}
              className="py-1 px-1 hover:text-white transition-colors cursor-pointer"
            >
              About
            </button>
            <span className="text-[10px] text-neutral-600">Ladies Tops Studio</span>
            <button
              type="button"
              onClick={() => {
                if (whatsappNumber) {
                  const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '');
                  window.open(
                    `https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(
                      shopName || 'Store'
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
          id="ladies-art"
          className="absolute top-1/2 left-1/2"
          style={{
            width: '1500px',
            height: '1000px',
            transform: `translate(-50%, -50%) scale(${scaleK})`,
            transformOrigin: 'center center',
            background:
              'radial-gradient(70% 55% at 50% 40%, #171821 0%, #0d0e12 100%)',
          }}
        >
          {/* Header Title */}
          <div
            className={`absolute left-1/2 top-[32px] -translate-x-1/2 text-center transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
              openIdx >= 0 ? 'opacity-[0.12] blur-[2px]' : 'opacity-100'
            }`}
          >
            <span className="text-[11px] tracking-[0.24em] uppercase text-pink-400 font-bold block mb-2">
              Ladies Haute Couture
            </span>
            <h2
              className="text-[48px] md:text-[54px] leading-none tracking-tight text-[#f1efec] font-black uppercase font-['Michroma']"
            >
              {shopName || 'Atelier'} Tops
            </h2>
            <span className="block text-[11px] tracking-[0.24em] uppercase text-[#8d8a86] mt-2 font-medium">
              3D Hanging Tops & Blouses Collection
            </span>
          </div>

          {/* Chrome Rail (Spans 150px -> 1350px, top 254px, 12px tall) */}
          <div
            className={`absolute left-[150px] right-[150px] top-[254px] h-[12px] rounded-[6px] transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
              openIdx >= 0 ? 'opacity-[0.12] blur-[2px]' : 'opacity-100'
            }`}
            style={{
              background:
                'linear-gradient(180deg, #fafafa 0%, #b9bcc1 28%, #5d6066 55%, #a9adb3 78%, #e6e7e9 100%)',
              boxShadow: '0 10px 18px rgba(0,0,0,0.45)',
            }}
          >
            {/* Left cap */}
            <div
              className="absolute -left-[14px] -top-[9px] w-[16px] h-[30px] rounded-[5px]"
              style={{
                background:
                  'linear-gradient(90deg, #8d9096 0%, #f3f3f4 45%, #7a7d83 100%)',
              }}
            />
            {/* Right cap */}
            <div
              className="absolute -right-[14px] -top-[9px] w-[16px] h-[30px] rounded-[5px]"
              style={{
                background:
                  'linear-gradient(90deg, #8d9096 0%, #f3f3f4 45%, #7a7d83 100%)',
              }}
            />
          </div>

          {/* Garments on the Rail */}
          <div
            id="ladies-garments"
            className="absolute left-0 top-0 w-full h-full pointer-events-none"
          >
            {railItems.map((item, k) => {
              const xPos = getGarmentLeft(k);
              const isHov = hov === k;
              const isFaced = isHov || (hov < 0 && k === 0);

              return (
                <div
                  key={item.id}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${xPos}px`,
                    top: '254px',
                    width: '280px',
                    height: '420px',
                    transform: 'translateX(-50%)',
                    zIndex: isFaced ? 25 : 10 + k,
                    transition:
                      'left 0.75s cubic-bezier(0.2, 0.8, 0.2, 1), z-index 0.3s ease',
                  }}
                >
                  {/* Hanging Structure */}
                  <div
                    onClick={() => setOpenIdx(k)}
                    onPointerEnter={() => setHov(k)}
                    onPointerLeave={() => setHov(-1)}
                    className="w-full h-full flex flex-col items-center justify-start origin-top transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] pointer-events-auto cursor-pointer"
                    style={{
                      transform: isFaced
                        ? 'translateY(18px) scale(1.08) perspective(900px) rotateY(0deg)'
                        : 'translateY(0px) scale(0.96) perspective(900px) rotateY(65deg)',
                      filter: isFaced
                        ? 'brightness(1) drop-shadow(0 22px 28px rgba(0,0,0,0.6))'
                        : 'brightness(0.8) drop-shadow(0 16px 16px rgba(0,0,0,0.5))',
                    }}
                  >
                    {/* Wooden Hanger with Chrome Hook */}
                    <div className="w-20 h-9 relative z-20 flex items-center justify-center mb-[-6px]">
                      <svg viewBox="0 0 36 24" fill="none" className="w-full h-full drop-shadow">
                        <path
                          d="M18 2 C18 2, 25 4, 24 9 C23 13, 18 13, 18 16 L4 21 L32 21 Z"
                          stroke="#e2cfad"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="18" cy="3" r="1.6" fill="#f4f4f5" />
                      </svg>
                    </div>

                    {/* Garment Image */}
                    <div className="w-full flex-1 flex items-center justify-center p-2 overflow-visible">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-contain pointer-events-none drop-shadow-2xl"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Caption below faced garment */}
          <div
            className={`absolute top-[680px] text-center text-[11px] tracking-[0.14em] uppercase text-[#8d8a86] whitespace-nowrap pointer-events-none transition-all duration-350 ${
              hov >= 0 && openIdx < 0 ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              left: `${facedLeft}px`,
              transform: 'translateX(-50%)',
              transition:
                'left 0.75s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s ease',
            }}
          >
            {facedProduct && (
              <>
                <b className="block text-[#f1efec] font-semibold mb-1 text-sm font-['Michroma']">
                  {facedProduct.name}
                </b>
                <span className="text-pink-300 font-bold">{formatCurrency(facedProduct.price, currencySymbol)}</span>
              </>
            )}
          </div>

          {/* Add to Cart / See Availability Pill */}
          <button
            type="button"
            onClick={() => {
              if (facedProduct) {
                handleAddToCart(facedProduct);
              }
            }}
            className={`absolute left-1/2 top-[760px] -translate-x-1/2 h-[42px] px-8 rounded-full border border-pink-300/60 bg-pink-500/10 hover:bg-pink-500 hover:text-white text-[12px] font-bold tracking-[0.14em] uppercase inline-grid place-items-center transition-all duration-500 cursor-pointer ${
              openIdx >= 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            Add {facedProduct?.name ? `"${facedProduct.name}"` : 'to Cart'} ({formatCurrency(facedProduct?.price || 380, currencySymbol)})
          </button>

          {/* Bottom Bar */}
          <div
            className={`absolute left-0 right-0 bottom-[36px] px-[50px] flex items-center justify-between text-[12px] font-medium tracking-[0.14em] uppercase text-[#8d8a86] z-10 transition-all duration-700 ${
              openIdx >= 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <button
              type="button"
              onClick={() => setAboutModalOpen(true)}
              className="hover:text-[#f1efec] transition-colors flex items-center gap-2 group cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
              <span>About Tops Studio</span>
            </button>

            <div className="text-[10px] tracking-[0.2em] text-[#555] uppercase hidden sm:block">
              {shopName} Ladies Edition
            </div>

            <button
              type="button"
              onClick={() => {
                if (whatsappNumber) {
                  const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '');
                  window.open(
                    `https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(
                      shopName || 'Store'
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
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DETAIL INSPECTION MODAL (FIXED & SCROLL PROTECTED)                  */}
      {/* ==================================================================== */}
      {openIdx >= 0 && activeProduct && createPortal(
        <div
          id="ladies-rail-det"
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto overscroll-contain"
        >
          <div className="absolute inset-0" onClick={() => setOpenIdx(-1)} />

          <div className="relative z-10 max-w-sm w-full mx-auto bg-[#14151a] border border-neutral-800 p-6 flex flex-col items-center text-center shadow-2xl rounded-sm my-auto">
            <button
              type="button"
              onClick={() => setOpenIdx(-1)}
              className="absolute right-4 top-4 text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-white p-2 cursor-pointer"
            >
              ✕ Close
            </button>

            <div className="text-[11px] tracking-[0.16em] text-pink-400 font-bold mb-2 uppercase">
              Slot {String(openIdx + 1).padStart(2, '0')} / {String(N).padStart(2, '0')}
            </div>

            {/* Garment Visual */}
            <div className="relative w-full max-w-[260px] h-[280px] sm:max-w-[300px] sm:h-[320px] flex items-center justify-center my-2 overflow-visible">
              <div
                ref={bigRef}
                className="w-full h-full flex flex-col items-center justify-center"
                style={{
                  filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.65))',
                }}
              >
                <div className="w-20 h-9 mb-[-4px] relative z-20">
                  <svg viewBox="0 0 36 24" fill="none" className="w-full h-full drop-shadow">
                    <path
                      d="M18 2 C18 2, 25 4, 24 9 C23 13, 18 13, 18 16 L4 21 L32 21 Z"
                      stroke="#e2cfad"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="18" cy="3" r="1.6" fill="#f4f4f5" />
                  </svg>
                </div>
                <div className="w-full flex-1 p-2 flex items-center justify-center overflow-visible">
                  <img
                    src={activeProduct.image}
                    alt={activeProduct.name}
                    className="w-full h-full object-contain pointer-events-none drop-shadow-2xl"
                  />
                </div>
              </div>
            </div>

            {/* Navigation Arrows */}
            <div className="flex items-center gap-6 my-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIdx((prev) => (prev - 1 + N) % N);
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
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIdx((prev) => (prev + 1) % N);
                }}
                className="w-10 h-10 rounded-full border border-neutral-600 hover:border-white grid place-items-center text-white transition-colors cursor-pointer"
              >
                →
              </button>
            </div>

            {/* Product Title */}
            <h3
              className="text-2xl sm:text-3xl font-normal text-white w-full px-2 break-words leading-tight mt-2 mb-1"
              style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}
            >
              {activeProduct.name}
            </h3>

            {/* Price */}
            <div className="text-sm font-semibold tracking-wider text-pink-300 mb-2">
              {formatCurrency(activeProduct.price, currencySymbol)}
            </div>

            {activeProduct.fitDescription && (
              <p className="text-xs text-neutral-400 mb-4 px-2 leading-relaxed">
                {activeProduct.fitDescription}
              </p>
            )}

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
          <div className="bg-[#14151a] border border-[#2b2b2e] text-[#f1efec] max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setAboutModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white text-lg cursor-pointer"
            >
              ✕
            </button>
            <span className="text-[10px] tracking-widest uppercase font-bold text-pink-400">
              About Ladies Tops
            </span>
            <h3 className="text-xl font-bold mt-1 text-white">{shopName}</h3>
            <p className="text-xs text-neutral-300 mt-3 leading-relaxed">
              Every top in our Ladies 3D Collection is styled with couture proportions, delicate draping, and fine fabrications. Hover to inspect fit on our polished hanging rack or tap to see garment details.
            </p>
          </div>
        </div>
        , document.body)}

      {/* Contact Modal */}
      {contactModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#14151a] border border-[#2b2b2e] text-[#f1efec] max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setContactModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white text-lg cursor-pointer"
            >
              ✕
            </button>
            <span className="text-[10px] tracking-widest uppercase font-bold text-pink-400">
              Customer Concierge
            </span>
            <h3 className="text-xl font-bold mt-1 text-white">Get in Touch</h3>
            <p className="text-xs text-neutral-300 mt-3 leading-relaxed">
              Need assistance with styling, sizes, or custom orders? Reach our stylists anytime.
            </p>
          </div>
        </div>
        , document.body)}
    </section>
  );
};
