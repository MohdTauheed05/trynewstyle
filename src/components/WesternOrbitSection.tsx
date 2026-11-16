import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Look, Product } from '../types';
import { addBagItem } from '../services/bagStorage';
import { formatCurrency } from '../services/storeSettings';
import { WESTERN_PRESETS } from './VirtualStudio';

interface WesternOrbitSectionProps {
  shopName: string;
  currencySymbol: string;
  products: Product[];
  looks: Look[];
  whatsappNumber?: string;
  onOpenBag?: () => void;
}

interface StudioLook {
  id: string;
  name: string;
  category: string;
  image: string;
  productIds: string[];
  pins: Array<{ num: number; productId: string; left: number; top: number }>;
  isPreset: boolean;
}

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/';
const studioImage = (file: string, width: number) =>
  `https://images.higgs.ai/?default=1&output=webp&url=${encodeURIComponent(CDN + file)}&w=${width}&q=85`;

const BG_URL = studioImage('hf_20261112_034551_6394b127-5366-40a8-9c82-3c416f1161f1.png', 2400);

export const WesternOrbitSection: React.FC<WesternOrbitSectionProps> = ({
  shopName,
  currencySymbol,
  products,
  looks,
  onOpenBag,
}) => {
  const studioLooks = useMemo<StudioLook[]>(() => {
    const presetLooks: StudioLook[] = WESTERN_PRESETS.map((look, index) => ({
      id: `western-preset-${index}`,
      name: look.name,
      category: look.category,
      image: studioImage(look.file, 1000),
      productIds: [],
      pins: [],
      isPreset: true,
    }));

    const customLooks: StudioLook[] = looks
      .filter((look) => look.modelGroup === 'western')
      .map((look) => ({
        id: look.id,
        name: look.name,
        category: 'Western',
        image: look.srcset1080 || look.src640,
        productIds: look.productIds || [],
        pins: look.pins || [],
        isPreset: false,
      }));

    return [...presetLooks, ...customLooks];
  }, [looks]);

  const [selectedLookIndex, setSelectedLookIndex] = useState(0);
  const [prevLookImage, setPrevLookImage] = useState<string | null>(null);
  const [isChanging, setIsChanging] = useState(false);
  const [focusedProductId, setFocusedProductId] = useState<string | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [rotateDeg, setRotateDeg] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const latestChange = useRef(0);
  const dragRef = useRef({ active: false, startX: 0, startDeg: 0 });
  const animTimerRef = useRef<number | null>(null);

  const safeIndex =
    studioLooks.length > 0
      ? ((selectedLookIndex % studioLooks.length) + studioLooks.length) % studioLooks.length
      : 0;
  const currentLook = studioLooks[safeIndex] || studioLooks[0];

  // Preload all preset + custom western images & penthouse studio background
  useEffect(() => {
    const urls = [...studioLooks.map((l) => l.image), BG_URL];
    const imgs = urls.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
    return () => {
      imgs.forEach((img) => {
        img.src = '';
      });
    };
  }, [studioLooks]);

  useEffect(() => {
    return () => {
      if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
    };
  }, []);

  const chooseLook = (index: number) => {
    if (index === safeIndex || !studioLooks[index]) return;
    const token = ++latestChange.current;
    const previousSrc = currentLook?.image || null;
    const nextImg = new Image();
    nextImg.src = studioLooks[index].image;

    const apply = () => {
      if (token !== latestChange.current) return;
      setPrevLookImage(previousSrc);
      setSelectedLookIndex(index);
      setFocusedProductId(null);
      setIsChanging(false);
      // Trigger CSS beam scan & top-to-bottom outfit wipe cleanly on next animation frame
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setIsChanging(true);
        });
      });
      if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
      animTimerRef.current = window.setTimeout(() => {
        setIsChanging(false);
        setPrevLookImage(null);
      }, 1100);
    };

    if (nextImg.complete) apply();
    else nextImg.onload = apply;
  };

  const wornProducts = useMemo(() => {
    if (!currentLook) return [];
    const list = currentLook.isPreset
      ? products.filter((product) => product.virtualStudioLook === currentLook.name)
      : currentLook.productIds.map((id) => products.find((product) => product.id === id));
    return list.filter((product): product is Product => Boolean(product?.image));
  }, [currentLook, products]);

  const totalLookPrice = wornProducts.reduce((sum, p) => sum + (p.price || 0), 0);

  const getSelectedSize = (product: Product) =>
    selectedSizes[product.id] || product.sizes?.[0] || 'One Size';

  const addProduct = (product: Product) => {
    addBagItem({
      productId: product.id,
      name: product.name,
      size: getSelectedSize(product),
      price: product.price,
      image: product.image,
      url: product.url || '#western-orbit-studio',
      quantity: 1,
    });
    setAddedIds((prev) => ({ ...prev, [product.id]: true }));
    window.setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [product.id]: false }));
    }, 1400);
  };

  const handleAddFullLook = () => {
    if (!wornProducts.length) return;
    wornProducts.forEach((product) => {
      addBagItem({
        productId: product.id,
        name: product.name,
        size: getSelectedSize(product),
        price: product.price,
        image: product.image,
        url: product.url || '#western-orbit-studio',
        quantity: 1,
      });
    });
    onOpenBag?.();
  };

  const handleFramePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current = { active: true, startX: e.clientX, startDeg: rotateDeg };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleFramePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    setRotateDeg(Math.max(-26, Math.min(26, dragRef.current.startDeg + dx * 0.16)));
  };

  const handleFramePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setIsDragging(false);
    setRotateDeg(0);
  };

  return (
    <section
      id="western-orbit-studio"
      className="virtual-studio"
      aria-label="Virtual Styling Studio — Western Models"
    >
      <div className="vs-content">

        <div className="vs-stage">
          {/* Top-Left Active Model Frosted Profile Pill */}
          {currentLook && (
            <div className="vs-profile">
              <div className="vs-avatar">
                <img
                  src={currentLook.image}
                  alt={`${currentLook.name} female model`}
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="vs-profile-copy">
                <span className="vs-eyebrow">
                  {currentLook.isPreset ? 'WESTERN MODEL' : 'CUSTOM MODEL'}
                </span>
                <strong>{currentLook.name}</strong>
                <span>Western Wear 3D female look</span>
              </div>
            </div>
          )}

          {/* Center Full-Body Model + Stool + Laser Outfit Wipe Scan Effect */}
          {currentLook && (
            <div
              className={`vs-model-frame ${isDragging ? 'is-grabbing' : ''}`}
              onPointerDown={handleFramePointerDown}
              onPointerMove={handleFramePointerMove}
              onPointerUp={handleFramePointerEnd}
              onPointerCancel={handleFramePointerEnd}
              style={{
                transform: `perspective(1200px) rotateY(${rotateDeg.toFixed(2)}deg)`,
                transition: isDragging ? 'none' : 'transform 0.55s cubic-bezier(0.2, 0.7, 0.2, 1)',
              }}
            >
              {/* Previous outfit layer remains visible beneath while laser beam sweeps down */}
              {prevLookImage && isChanging && (
                <img
                  className="vs-model-image vs-model-prev"
                  src={prevLookImage}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  referrerPolicy="no-referrer"
                />
              )}

              <img
                key={currentLook.id}
                className={`vs-model-image ${isChanging ? 'changing' : ''}`}
                src={currentLook.image}
                alt={`${currentLook.name} female model wearing the Western outfit`}
                draggable={false}
                referrerPolicy="no-referrer"
                onAnimationEnd={() => {
                  setIsChanging(false);
                  setPrevLookImage(null);
                }}
              />
              <div className="vs-scan-line" aria-hidden="true" />

              {/* Optional product pins if assigned in Admin */}
              {wornProducts.map((prod, idx) => {
                const pin = currentLook.pins.find((p) => p.productId === prod.id) || currentLook.pins[idx];
                const left = pin?.left ?? prod.defaultPinX ?? 50;
                const top = pin?.top ?? prod.defaultPinY ?? (idx === 0 ? 32 : idx === 1 ? 56 : 80);
                return (
                  <button
                    key={prod.id}
                    type="button"
                    className={`vs-model-pin ${focusedProductId === prod.id ? 'is-hot' : ''}`}
                    style={{ left: `${left}%`, top: `${top}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFocusedProductId(prod.id);
                    }}
                    aria-label={`Inspect ${prod.name}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          )}

          {/* Bottom-Left Frosted Glass "SHOP THE MODEL / Worn in ..." Section */}
          <section className="vs-worn-section" aria-labelledby="vs-worn-title">
            <div className="vs-worn-heading">
              <div>
                <span className="vs-eyebrow">SHOP THE MODEL</span>
                <h2 id="vs-worn-title">Worn in {currentLook?.name || 'Denim Maxi'}</h2>
              </div>
              <div className="vs-worn-head-right">
                <span className="tabular-nums">
                  {wornProducts.length} {wornProducts.length === 1 ? 'piece' : 'pieces'}
                </span>
                {wornProducts.length > 0 && (
                  <button
                    type="button"
                    className="vs-worn-full-btn"
                    onClick={handleAddFullLook}
                  >
                    Bag &amp; WhatsApp · {formatCurrency(totalLookPrice, currencySymbol)}
                  </button>
                )}
              </div>
            </div>

            {wornProducts.length ? (
              <div className="vs-worn-products">
                {wornProducts.map((product) => {
                  const isAdded = Boolean(addedIds[product.id]);
                  const isFocused = focusedProductId === product.id;
                  const activeSize = getSelectedSize(product);

                  return (
                    <article
                      className={`vs-worn-card ${isFocused ? 'is-focused' : ''}`}
                      key={product.id}
                    >
                      <div className="vs-worn-image">
                        <img
                          src={product.image}
                          alt={`${product.name} product photo`}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="vs-worn-copy">
                        <strong>{product.name}</strong>
                        <span className="tabular-nums">
                          {formatCurrency(product.price, currencySymbol)}
                        </span>
                        {product.sizes?.length > 0 && (
                          <div className="vs-worn-sizes">
                            {product.sizes.slice(0, 4).map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                className={activeSize === sz ? 'active' : ''}
                                onClick={() =>
                                  setSelectedSizes((prev) => ({ ...prev, [product.id]: sz }))
                                }
                              >
                                {sz}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => addProduct(product)}>
                        {isAdded ? 'Added to bag' : 'Add to bag'}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="vs-worn-empty">
                {currentLook?.isPreset ? (
                  <>
                    No products are matched to this preset yet. In Admin → Clothes Inventory, edit
                    each item and choose &ldquo;{currentLook.name}&rdquo; under Western Wear 3D Look
                    Match.
                  </>
                ) : (
                  <>
                    No products are assigned to this model yet. In Admin → Men’s Runway Models,
                    choose Western when editing the model and assign the clothes it wears.
                  </>
                )}
              </p>
            )}
          </section>

          {/* Right Frosted Glass "CHOOSE A MODEL / Models" Panel */}
          <aside className="vs-panel" aria-label="Choose a Western model">
            <div className="vs-panel-title">
              <div>
                <span className="vs-eyebrow">CHOOSE A MODEL</span>
                <h2>Models</h2>
              </div>
              <span className="tabular-nums">{studioLooks.length} looks</span>
            </div>

            <div className="vs-look-grid">
              {studioLooks.map((look, index) => (
                <article
                  key={look.id}
                  className={`vs-look-card ${safeIndex === index ? 'selected' : ''}`}
                >
                  <button
                    type="button"
                    className="vs-look-select"
                    onClick={() => chooseLook(index)}
                    aria-label={`Preview ${look.name}`}
                  >
                    <img
                      src={look.image}
                      alt={look.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <span>{look.name}</span>
                    <i>{look.category}</i>
                  </button>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};
