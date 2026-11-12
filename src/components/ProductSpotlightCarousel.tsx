import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LadiesPiece, Product } from '../types';
import { addBagItem } from '../services/bagStorage';
import { formatCurrency } from '../services/storeSettings';
import { LADIES_PIECES_SHEET, getStoredLadiesPieces } from '../services/ladiesStorage';
import { LadiesRailItem, getStoredLadiesRailItems } from '../services/ladiesRailStorage';
import { RailItem, getStoredRailItems } from '../services/railStorage';

interface ProductSpotlightCarouselProps {
  products: Product[];
  shopName: string;
  currencySymbol: string;
}

type SpotlightProduct = {
  id: string;
  name: string;
  price: number;
  image: string;
  description?: string;
  sizes: string[];
  url: string;
  crop?: LadiesPiece['box'];
  spriteIndex?: number;
  source: 'catalog' | 'rail' | 'ladies-piece' | 'ladies-rail';
};

const RAIL_SHEET_URL = 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261107_130252_7b1b8485-d5c5-440c-8921-f5ae01054c6a.png&w=2048&q=90';

export const ProductSpotlightCarousel: React.FC<ProductSpotlightCarouselProps> = ({ products, shopName, currencySymbol }) => {
  const [railItems, setRailItems] = useState<RailItem[]>(() => getStoredRailItems());
  const [ladiesPieces, setLadiesPieces] = useState<LadiesPiece[]>(() => getStoredLadiesPieces());
  const [ladiesRailItems, setLadiesRailItems] = useState<LadiesRailItem[]>(() => getStoredLadiesRailItems());
  const [selected, setSelected] = useState<SpotlightProduct | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const dragRef = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

  useEffect(() => {
    const sync = () => {
      setRailItems(getStoredRailItems());
      setLadiesPieces(getStoredLadiesPieces());
      setLadiesRailItems(getStoredLadiesRailItems());
    };
    window.addEventListener('runway:rail_updated', sync);
    window.addEventListener('runway:ladies_updated', sync);
    window.addEventListener('runway:ladies_rail_updated', sync);
    window.addEventListener('runway:catalog_updated', sync);
    return () => {
      window.removeEventListener('runway:rail_updated', sync);
      window.removeEventListener('runway:ladies_updated', sync);
      window.removeEventListener('runway:ladies_rail_updated', sync);
      window.removeEventListener('runway:catalog_updated', sync);
    };
  }, []);

  const allProducts = useMemo<SpotlightProduct[]>(() => {
    const catalog = products.map((product) => ({
      id: product.id, name: product.name, price: product.price, image: product.image,
      description: product.fitDescription, sizes: product.sizes?.length ? product.sizes : ['One Size'],
      url: product.url, source: 'catalog' as const,
    }));
    const rail = railItems.map((item) => ({
      id: item.id, name: item.name, price: item.price,
      image: item.image || RAIL_SHEET_URL, description: 'Streetwear from the shop collection.',
      sizes: ['M'], url: '#', spriteIndex: item.image ? undefined : item.spriteIndex, source: 'rail' as const,
    }));
    const ladies = ladiesPieces.map((piece) => ({
      id: piece.id, name: piece.name, price: piece.price, image: piece.customImage || LADIES_PIECES_SHEET,
      description: piece.category || 'Part of the Ladies collection.', sizes: ['One Size'], url: '#',
      crop: piece.customImage ? undefined : piece.box, source: 'ladies-piece' as const,
    }));
    const ladiesRail = ladiesRailItems.map((item) => ({
      id: item.id, name: item.name, price: item.price, image: item.image,
      description: item.fitDescription, sizes: ['One Size'], url: '#', source: 'ladies-rail' as const,
    }));
    const unique = new Map<string, SpotlightProduct>();
    [...catalog, ...rail, ...ladies, ...ladiesRail].forEach((item) => {
      if (!unique.has(item.id)) unique.set(item.id, item);
    });
    return [...unique.values()];
  }, [products, railItems, ladiesPieces, ladiesRailItems]);

  const addProduct = (product: SpotlightProduct) => {
    addBagItem({
      productId: product.id,
      name: product.name,
      size: product.sizes[0] || 'One Size',
      price: product.price,
      image: product.image,
      url: product.url,
      quantity: 1,
      crop: product.crop ? {
        x: product.crop[0], y: product.crop[2],
        w: product.crop[1] - product.crop[0], h: product.crop[3] - product.crop[2],
        sheetW: 960, sheetH: 720,
      } : undefined,
    });
  };

  const updateCurve = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const center = bounds.left + bounds.width / 2;
    cardRefs.current.forEach((card) => {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const relative = (rect.left + rect.width / 2 - center) / (bounds.width / 2 + rect.width / 2);
      const d = Math.min(1, Math.abs(relative));
      const height = window.innerWidth <= 820 ? 202 + 46 * Math.pow(d, 2.6) : 280 + 92 * Math.pow(d, 2.6);
      const width = window.innerWidth <= 820 ? 126 + 20 * d * d : 170 + 48 * d * d;
      const tilt = relative * (window.innerWidth <= 820 ? 8 : 12);
      const lift = -12 * d * d;
      card.style.height = height.toFixed(1) + 'px';
      card.style.width = width.toFixed(1) + 'px';
      card.style.transform = 'translateY(' + lift.toFixed(1) + 'px) perspective(900px) rotateY(' + tilt.toFixed(1) + 'deg)';
    });
  };

  useEffect(() => {
    updateCurve();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const resize = new ResizeObserver(updateCurve);
    resize.observe(viewport);
    return () => resize.disconnect();
  }, [allProducts.length]);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!horizontal) return;
    event.preventDefault();
    viewport.scrollLeft += horizontal;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || (event.target as HTMLElement).closest('button,a')) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragRef.current = { active: true, startX: event.clientX, startScroll: viewport.scrollLeft, moved: false };
    setIsDragging(true);
    viewport.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    if (!drag.active || !viewport) return;
    const dx = event.clientX - drag.startX;
    if (Math.abs(dx) > 4) drag.moved = true;
    viewport.scrollLeft = drag.startScroll - dx;
  };
  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    dragRef.current.active = false;
    setIsDragging(false);
  };
  const openDetails = (product: SpotlightProduct) => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    setSelected(product);
  };

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selected]);

  const renderProductPhoto = (product: SpotlightProduct, className: string) => {
    if (product.crop) {
      return (
        <svg className={className} viewBox={product.crop[0] + ' ' + product.crop[2] + ' ' + (product.crop[1] - product.crop[0]) + ' ' + (product.crop[3] - product.crop[2])} preserveAspectRatio="xMidYMid meet" aria-label={product.name}>
          <image href={product.image} width="960" height="720" />
        </svg>
      );
    }
    if (product.spriteIndex !== undefined) {
      const col = product.spriteIndex % 5;
      const row = Math.floor(product.spriteIndex / 5);
      const x = col * 409.6 - 50;
      const y = row === 0 ? 80 : 700;
      return (
        <svg className={className} viewBox={x + ' ' + y + ' 509.6 530' } preserveAspectRatio="xMidYMid meet" aria-label={product.name}>
          <image href={RAIL_SHEET_URL} width="2048" height="1360" />
        </svg>
      );
    }
    return product.image ? <img className={className} src={product.image} alt={product.name} loading="lazy" /> : <span className={className + ' reel-image-placeholder'}>Photo unavailable</span>;
  };

  return (
    <section className="reelmark-products" aria-labelledby="reelmark-products-title">
      <style>{`
        .reelmark-products{--rm-ink:#101410;--rm-green:#08482d;--rm-mint:#dae7c7;background:#f5f8ef;color:var(--rm-ink);padding:clamp(52px,7vw,100px) 0 clamp(38px,5vw,72px);overflow:hidden}
        .reelmark-products *{box-sizing:border-box}
        .rm-heading{width:min(1160px,calc(100% - 48px));margin:0 auto 18px;display:grid;grid-template-columns:1fr auto;align-items:end;gap:16px}
        .rm-badge{display:inline-flex;align-items:center;gap:8px;width:max-content;background:var(--rm-mint);color:var(--rm-green);border-radius:99px;padding:9px 15px;font:500 11px/1.2 Inter,Arial,sans-serif;letter-spacing:.04em}
        .rm-badge:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--rm-green)}
        .rm-heading h2{font:700 clamp(32px,5.3vw,70px)/.98 Inter,Arial,sans-serif;letter-spacing:-.045em;margin:15px 0 0;max-width:780px}
        .rm-heading p{grid-column:1;color:#5e5e61;font:14px/1.55 Inter,Arial,sans-serif;margin:12px 0 0;max-width:470px}
        .rm-count{align-self:end;color:var(--rm-green);font:11px Inter,Arial,sans-serif;letter-spacing:.13em;text-transform:uppercase;padding-bottom:5px}
        .rm-track-window{width:100%;height:390px;overflow-x:auto;overflow-y:hidden;padding:28px 3vw 22px;cursor:grab;scrollbar-width:none;overscroll-behavior-x:contain;touch-action:pan-x;perspective:1200px}
        .rm-track-window::-webkit-scrollbar{display:none}.rm-track-window.is-dragging{cursor:grabbing;user-select:none}
        .rm-track{display:flex;align-items:center;gap:18px;width:max-content;min-width:100%;height:100%;padding-right:3vw}
        .reel-product-card{flex:none;height:250px;width:170px;background:#fff;border-radius:14px;padding:9px;display:flex;flex-direction:column;box-shadow:0 0 0 1px rgba(8,72,45,.13);transform-origin:center center;transition:box-shadow .25s,filter .25s;will-change:height,width,transform}
        .reel-product-card:hover{box-shadow:0 12px 32px rgba(8,72,45,.16);filter:saturate(1.03);z-index:3}
        .reel-product-image{height:61%;min-height:0;position:relative;display:grid;place-items:center;overflow:hidden;border-radius:9px;background:#f4f6f0;color:#888}
        .reel-product-image img,.reel-product-image svg{width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply}
        .reel-product-number{position:absolute;left:8px;top:8px;border-radius:99px;background:rgba(255,255,255,.9);padding:5px 8px;color:var(--rm-green);font:10px Inter,Arial,sans-serif;letter-spacing:.08em}
        .reel-product-info{display:flex;justify-content:space-between;align-items:center;gap:7px;padding:9px 1px 6px}
        .reel-product-copy{min-width:0}.reel-product-copy h3{font:600 12px/1.3 Inter,Arial,sans-serif;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .reel-product-copy p{font:11px/1.3 Inter,Arial,sans-serif;color:#5e5e61;margin:4px 0 0}
        .reel-product-info button{width:30px;height:30px;flex:none;border:0;border-radius:50%;background:var(--rm-green);color:#fff;font-size:19px;line-height:1;cursor:pointer}
        .reel-product-details{margin-top:auto;width:100%;border:0;border-top:1px solid #e5e9df;padding:8px 1px 0;background:none;color:var(--rm-green);font:10px Inter,Arial,sans-serif;letter-spacing:.06em;text-decoration:none;text-transform:uppercase;display:flex;justify-content:space-between;cursor:pointer}
        .reel-product-details:hover{text-decoration:underline}.reel-image-placeholder{font:11px Inter,Arial,sans-serif;color:#8a8f84}
        .rm-empty{width:min(1160px,calc(100% - 48px));margin:32px auto;color:#5e5e61;font:14px Inter,Arial,sans-serif}
        .rm-detail-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.56);display:grid;place-items:center;padding:18px;overflow-y:auto}
        .rm-detail-dialog{position:relative;width:min(92vw,760px);max-height:min(88dvh,820px);overflow:auto;background:#fff;border-radius:16px;padding:22px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px}
        .rm-detail-close{position:absolute;right:12px;top:12px;width:40px;height:40px;border:0;border-radius:50%;background:#fff;color:#111;box-shadow:0 2px 12px #0003;font-size:24px;cursor:pointer;z-index:2}
        .rm-detail-photo{width:100%;height:min(64dvh,600px);object-fit:contain;background:#f4f6f0;border-radius:12px}.rm-detail-copy{align-self:center;padding:30px 8px 20px}
        .rm-detail-copy .rm-kicker{font:10px Inter,Arial,sans-serif;color:#68806e;letter-spacing:.15em;text-transform:uppercase}
        .rm-detail-copy h3{font:600 clamp(24px,3vw,38px)/1.05 Inter,Arial,sans-serif;margin:12px 0}
        .rm-detail-price{font:16px Inter,Arial,sans-serif;color:#5e5e61}.rm-detail-description{font:14px/1.6 Inter,Arial,sans-serif;color:#5e5e61;margin:16px 0}
        .rm-size-list{display:flex;flex-wrap:wrap;gap:7px;margin:18px 0}.rm-size-chip{border:1px solid #ddd;border-radius:99px;padding:7px 11px;font:11px Inter,Arial,sans-serif}
        .rm-detail-add{width:100%;min-height:44px;border:0;border-radius:99px;background:var(--rm-green);color:#fff;font:600 11px Inter,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
        .rm-detail-add:disabled{opacity:.55;cursor:default}
        @media(max-width:820px){
          .reelmark-products{padding:42px 0 42px}.rm-heading{width:calc(100% - 32px);grid-template-columns:1fr;gap:12px;margin-bottom:8px}
          .rm-heading h2{font-size:clamp(36px,10vw,54px);max-width:520px}.rm-heading p{font-size:13px;margin-top:8px}.rm-count{padding:0}
          .rm-track-window{height:318px;padding:16px 16px 14px}
          .rm-track{gap:12px;padding-right:16px}
          .reel-product-card{height:202px;width:126px;padding:7px;border-radius:12px}
          .reel-product-image{height:57%}.reel-product-info{padding:7px 1px 5px}.reel-product-copy h3{font-size:10px}.reel-product-copy p{font-size:10px}
          .reel-product-info button{width:27px;height:27px}.reel-product-details{font-size:9px}
          .rm-detail-overlay{padding:12px}.rm-detail-dialog{width:min(94vw,520px);max-height:92dvh;grid-template-columns:1fr;gap:10px;padding:14px;border-radius:14px}
          .rm-detail-close{position:sticky;top:0;left:100%;margin-bottom:-40px}.rm-detail-photo{height:min(43dvh,360px);min-height:200px}
          .rm-detail-copy{padding:4px 4px 8px}.rm-detail-copy h3{font-size:26px}.rm-detail-description{margin:10px 0}
        }
        @media(prefers-reduced-motion:reduce){.reel-product-card{transition:none}}
      `}</style>
      <header className="rm-heading">
        <div>
          <span className="rm-badge">{shopName} · THE FULL COLLECTION</span>
          <h2 id="reelmark-products-title">Every piece, in the spotlight.</h2>
          <p>Explore the full collection, one piece at a time. New products added to the shop appear here automatically.</p>
        </div>
        <span className="rm-count">{allProducts.length} {allProducts.length === 1 ? 'product' : 'products'}</span>
      </header>
      {allProducts.length ? (
        <div
          className={'rm-track-window' + (isDragging ? ' is-dragging' : '')}
          aria-label="All shop products"
          ref={viewportRef}
          onScroll={updateCurve}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <div className="rm-track">
            {allProducts.map((product, index) => (
              <article className="reel-product-card" key={product.source + '-' + product.id} ref={(element) => { cardRefs.current[index] = element; }}>
                <button type="button" className="reel-product-image" onClick={() => openDetails(product)} aria-label={'View ' + product.name}>
                  {renderProductPhoto(product, 'reel-card-photo')}
                  <span className="reel-product-number">{String(index + 1).padStart(2, '0')}</span>
                </button>
                <div className="reel-product-info">
                  <div className="reel-product-copy">
                    <h3>{product.name}</h3>
                    <p>{formatCurrency(product.price, currencySymbol)}</p>
                  </div>
                  <button type="button" onClick={() => addProduct(product)} aria-label={'Add ' + product.name + ' to bag'}>+</button>
                </div>
                <button type="button" className="reel-product-details" onClick={() => openDetails(product)}>View product <span aria-hidden="true">↗</span></button>
              </article>
            ))}
          </div>
        </div>
      ) : <p className="rm-empty">Products added in Admin will appear here.</p>}
      {selected && (
        <div className="rm-detail-overlay" role="presentation" onClick={() => setSelected(null)}>
          <div className="rm-detail-dialog" role="dialog" aria-modal="true" aria-label={selected.name} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="rm-detail-close" aria-label="Close product details" onClick={() => setSelected(null)}>×</button>
            {renderProductPhoto(selected, 'rm-detail-photo')}
            <div className="rm-detail-copy">
              <span className="rm-kicker">PRODUCT DETAILS</span>
              <h3>{selected.name}</h3>
              <p className="rm-detail-price">{formatCurrency(selected.price, currencySymbol)}</p>
              {selected.description && <p className="rm-detail-description">{selected.description}</p>}
              {selected.sizes.length > 1 && <div className="rm-size-list" aria-label="Available sizes">{selected.sizes.map((size) => <span className="rm-size-chip" key={size}>{size}</span>)}</div>}
              <button type="button" className="rm-detail-add" onClick={() => addProduct(selected)}>Add to bag · {selected.sizes[0]}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
