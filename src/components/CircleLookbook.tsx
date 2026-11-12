import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Look, Product, LadiesPiece } from '../types';
import { addBagItem } from '../services/bagStorage';
import { formatCurrency } from '../services/storeSettings';
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

import { LADIES_LOOK_BOUNDS, LADIES_MODEL_Y0, LADIES_MODEL_Y1, LADIES_MODELS_SHEET, LADIES_PIECES_SHEET, getStoredLadiesPieces, getStoredLadiesSettings } from '../services/ladiesStorage';

interface CircleLookbookProps { looks: Look[]; products: Product[]; shopName: string; currencySymbol: string; }
type Entry = { id: string; name: string; image: string; group: 'men' | 'women'; products: Product[]; ladiesPieces?: LadiesPiece[]; crop?: [number, number, number, number]; };

export const CircleLookbook: React.FC<CircleLookbookProps> = ({ looks, products, shopName, currencySymbol }) => {
  const [ladiesPieces, setLadiesPieces] = useState(() => getStoredLadiesPieces());
  const [firstLadiesLook, setFirstLadiesLook] = useState(() => getStoredLadiesSettings().firstLookNumber || 15);
  const wheelLock = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const sync = () => { setLadiesPieces(getStoredLadiesPieces()); setFirstLadiesLook(getStoredLadiesSettings().firstLookNumber || 15); };
    window.addEventListener('runway:ladies_updated', sync);
    window.addEventListener('runway:catalog_updated', sync);
    return () => { window.removeEventListener('runway:ladies_updated', sync); window.removeEventListener('runway:catalog_updated', sync); };
  }, []);

  const entries = useMemo<Entry[]>(() => {
    const modelEntries = looks
      .filter((look) => !look.modelGroup || look.modelGroup === 'men' || look.modelGroup === 'ladies' || look.modelGroup === 'western')
      .map((look) => ({
        id: look.id, name: look.name, image: look.srcset1080 || look.src640,
        group: look.modelGroup === 'men' || !look.modelGroup ? 'men' as const : 'women' as const,
        products: look.productIds.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product)),
      }));
    const depthEntries = LADIES_LOOK_BOUNDS.map(([x0, x1], index) => {
      const lookNumber = firstLadiesLook + index;
      return {
        id: 'ladies-depth-' + lookNumber, name: 'Ladies Look ' + String(lookNumber).padStart(2, '0'),
        image: LADIES_MODELS_SHEET, group: 'women' as const, products: [],
        ladiesPieces: ladiesPieces.filter((piece) => piece.lookNumber === lookNumber),
        crop: [x0, x1, LADIES_MODEL_Y0, LADIES_MODEL_Y1] as [number, number, number, number],
      };
    });
    const westernEntries: Entry[] = WESTERN_PRESETS.map((preset) => ({
      id: 'western-preset-' + preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: preset.name,
      image: 'https://images.higgs.ai/?default=1&output=webp&url=' + encodeURIComponent(STUDIO_CDN + preset.file) + '&w=1000&q=85',
      group: 'women',
      products: products.filter((product) => product.virtualStudioLook === preset.name),
    }));
    const men = modelEntries.filter((entry) => entry.group === 'men');
    const women = [...modelEntries.filter((entry) => entry.group === 'women'), ...westernEntries, ...depthEntries];
    const alternating: Entry[] = [];
    for (let index = 0; index < Math.max(men.length, women.length); index += 1) {
      if (men[index]) alternating.push(men[index]);
      if (women[index]) alternating.push(women[index]);
    }
    return alternating;
  }, [looks, products, ladiesPieces, firstLadiesLook]);

  const ringEntries = entries;
  const selectedIndex = ringEntries.length ? ((activeIndex % ringEntries.length) + ringEntries.length) % ringEntries.length : 0;
  const active = ringEntries[selectedIndex];
  const handleWheel = (event: React.WheelEvent<HTMLElement>) => {
    const now = Date.now();
    if (now - wheelLock.current < 280 || !ringEntries.length) return;
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(delta) < 14) return;
    wheelLock.current = now;
    setActiveIndex((current) => (current + (delta > 0 ? 1 : -1) + ringEntries.length) % ringEntries.length);
  };

  const addProduct = (product: Product) => addBagItem({
    productId: product.id, name: product.name, size: product.sizes?.[0] || 'One Size',
    price: product.price, image: product.image, url: product.url, quantity: 1,
  });
  const addPiece = (piece: LadiesPiece) => addBagItem({
    productId: piece.id, name: piece.name, size: 'One Size', price: piece.price,
    image: piece.customImage || LADIES_PIECES_SHEET, quantity: 1,
    crop: !piece.customImage && piece.box ? {
      x: piece.box[0], y: piece.box[2], w: piece.box[1] - piece.box[0], h: piece.box[3] - piece.box[2], sheetW: 960, sheetH: 720,
    } : undefined,
  });

  const shopItems = active ? [
    ...active.products.map((product) => ({ id: product.id, name: product.name, image: product.image, price: product.price, piece: undefined, add: () => addProduct(product) })),
    ...(active.ladiesPieces || []).map((piece) => ({ id: piece.id, name: piece.name, image: piece.customImage || '', price: piece.price, piece, add: () => addPiece(piece) })),
  ] : [];

  const getOrbitStyle = (index: number): React.CSSProperties => {
    const count = ringEntries.length || 1;
    let delta = index - selectedIndex;
    if (delta > count / 2) delta -= count;
    if (delta < -count / 2) delta += count;
    const angle = delta * (Math.PI * 2 / count);
    const depth = (1 + Math.cos(angle)) / 2;
    const mobile = typeof window !== 'undefined' && window.innerWidth < 700;
    const rx = mobile ? 37 : 38;
    const ry = mobile ? 33 : 34;
    const x = 50 + Math.sin(angle) * rx;
    const y = 50 + Math.cos(angle) * ry;
    const scale = 0.48 + depth * 0.56;
    return {
      left: x + '%', top: y + '%', zIndex: Math.round(depth * 100) + 1,
      opacity: Math.max(0.35, 0.62 + depth * 0.38),
      transform: 'translate(-50%, -100%) scale(' + scale + ')',
    };
  };

  const renderModel = (entry: Entry, label: boolean) => entry.crop ? (
    <svg viewBox={entry.crop[0] + ' ' + entry.crop[2] + ' ' + (entry.crop[1] - entry.crop[0]) + ' ' + (entry.crop[3] - entry.crop[2])} preserveAspectRatio="none" aria-label={label ? entry.name : undefined}>
      <image href={entry.image} width="960" height="720" preserveAspectRatio="none" />
    </svg>
  ) : <img src={entry.image} alt={label ? entry.name : ''} draggable={false} loading="lazy" />;

  return (
    <section className="circle-lookbook" aria-label="Circle runway lookbook" onWheel={handleWheel}>
      <style>{`
        .circle-lookbook{--ink:#151515;--muted:#757575;position:relative;isolation:isolate;height:100svh;min-height:620px;max-height:1000px;overflow:hidden;background:#fff;color:var(--ink);padding:0 24px}
        .circle-lookbook *{box-sizing:border-box}.cl-top{height:58px;position:relative;z-index:5;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e6e6e6;font:10px/1 Arial,sans-serif;letter-spacing:.13em}
        .cl-brand{position:absolute;left:50%;transform:translateX(-50%);font-size:16px;letter-spacing:-.04em}.cl-brand sup{font-size:8px}.cl-signal,.cl-top-right{display:flex;align-items:center;gap:12px}.cl-signal{color:#777}
        .cl-stage{position:absolute;inset:58px 0 150px;overflow:hidden}.cl-ring{position:absolute;left:50%;top:51%;width:min(68vw,780px);height:min(50vh,400px);transform:translate(-50%,-50%);border:1px dashed #e3e3e3;border-radius:50%;pointer-events:none}
        .cl-center-title{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);font:400 clamp(30px,4.2vw,58px)/.88 Georgia,serif;letter-spacing:-.04em;text-align:center;white-space:nowrap;z-index:0}
        .cl-subtitle{font:10px Arial,sans-serif;letter-spacing:.08em;color:#888;margin-top:12px;line-height:1.4}
        .cl-orbit-model{position:absolute;width:clamp(66px,11vw,150px);height:clamp(145px,27vh,290px);transform-origin:center center;transition:left .75s cubic-bezier(.16,1,.3,1),top .75s cubic-bezier(.16,1,.3,1),transform .75s cubic-bezier(.16,1,.3,1),opacity .5s;cursor:pointer;background:none;border:0;padding:0;display:flex;align-items:flex-end;justify-content:center}
        .cl-orbit-model img,.cl-orbit-model svg{width:100%;height:100%;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 5px 5px #0002);pointer-events:none}
        .cl-orbit-model span{position:absolute;bottom:-17px;left:50%;transform:translateX(-50%);font:8px Arial,sans-serif;letter-spacing:.1em;white-space:nowrap;text-transform:uppercase;color:#555;opacity:0;transition:opacity .2s}
        .cl-orbit-model[aria-current=true] span,.cl-orbit-model:hover span{opacity:1}
        .cl-shadow{position:absolute;bottom:8%;left:50%;width:22%;height:2%;border-radius:50%;background:#0002;filter:blur(5px);transform:translateX(-50%);z-index:0}
        .cl-dock{position:absolute;z-index:5;left:18px;right:18px;bottom:0;min-height:122px;display:grid;grid-template-columns:minmax(165px, .8fr) minmax(0, 2.2fr) auto;align-items:center;gap:20px;border-top:1px solid #e6e6e6;background:#fff;padding:12px 0 17px}
        .cl-look-name{font:400 clamp(18px,2vw,28px)/1 Georgia,serif;text-transform:uppercase;margin-top:5px}.cl-counter,.cl-kicker{font:9px Arial,sans-serif;color:#666;letter-spacing:.14em;text-transform:uppercase}
        .cl-items{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}.cl-items::-webkit-scrollbar{display:none}
        .cl-item{flex:0 0 auto;min-width:170px;max-width:230px;height:72px;border:1px dashed #ccc;border-radius:99px;padding:5px 13px 5px 6px;display:flex;align-items:center;gap:10px;background:#fff}
        .cl-item img,.cl-item-thumb{width:58px;height:58px;border-radius:50%;object-fit:cover;background:#f1f1f1;flex:none}.cl-item-title{display:grid;gap:4px;min-width:0}.cl-item-title strong{font:11px Arial,sans-serif;text-transform:uppercase;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cl-item-title small{font:10px Arial,sans-serif;color:#777}
        .cl-item button{border:0;border-radius:50%;width:30px;height:30px;background:#111;color:#fff;cursor:pointer;flex:none;font-size:14px;line-height:1}
        .cl-empty{font:11px Arial,sans-serif;color:#888}.cl-shop-link{font:9px Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}
        @media(max-width:700px){.circle-lookbook{height:100svh;min-height:570px;padding:0 12px}.cl-top{height:54px}.cl-signal{display:none}.cl-brand{position:static;transform:none}.cl-stage{inset:54px 0 148px}
          .cl-stage{inset:54px 0 160px}.cl-ring{width:78vw;height:40vh;top:50%}.cl-center-title{top:45%;font-size:clamp(29px,8vw,42px)}.cl-orbit-model{width:clamp(54px,15vw,102px);height:clamp(120px,23vh,220px)}
          .cl-dock{left:10px;right:10px;min-height:140px;grid-template-columns:1fr auto;gap:8px;padding:10px 0 13px}.cl-dock-info{grid-column:1}.cl-items{grid-column:1/-1;grid-row:2}.cl-shop-link{grid-column:2;grid-row:1}.cl-item{min-width:150px;height:64px}.cl-item img,.cl-item-thumb{width:48px;height:48px}}
        @media(max-width:390px){.cl-orbit-model{width:19vw;height:23vh}.cl-ring{width:82vw;height:36vh}.cl-stage{inset:54px 0 160px}.cl-item{min-width:138px}.cl-item-title strong{max-width:80px}}
        @media(prefers-reduced-motion:reduce){.cl-orbit-model{transition:none}}
      `}</style>
      <div className="cl-top">
        <span className="cl-signal"><span aria-hidden="true">▮▮</span> LOW SIGNAL</span>
        <span className="cl-brand">TRY THE LOOK<sup>®</sup></span>
        <div className="cl-top-right"><span className="cl-kicker">{ringEntries.length} looks · scroll to explore</span></div>
      </div>
      {active ? <>
        <div className="cl-stage">
          <div className="cl-ring" />
          <div className="cl-center-title">Stay out<br/>of the loop<div className="cl-subtitle">Vol. 01 — {ringEntries.length} looks</div></div>
          {ringEntries.map((entry, index) => (
            <button key={entry.id} type="button" className="cl-orbit-model" style={getOrbitStyle(index)} aria-current={index === selectedIndex} aria-label={'View ' + entry.name} onClick={() => setActiveIndex(index)}>
              {renderModel(entry, false)}
              <span>{entry.name}</span>
            </button>
          ))}
          <div className="cl-shadow" />
        </div>
        <footer className="cl-dock">
          <div className="cl-dock-info">
            <span className="cl-counter">{String(selectedIndex + 1).padStart(2, '0')} / {String(ringEntries.length).padStart(2, '0')}</span>
            <div className="cl-look-name">{active.name}</div>
          </div>
          <div className="cl-items" aria-label={'Products worn by ' + active.name}>
            {shopItems.length ? shopItems.map((item) => (
              <div className="cl-item" key={item.id}>
                {item.image ? <img src={item.image} alt="" loading="lazy" /> : item.piece?.box ? <svg className="cl-item-thumb" viewBox={item.piece.box[0] + ' ' + item.piece.box[2] + ' ' + (item.piece.box[1] - item.piece.box[0]) + ' ' + (item.piece.box[3] - item.piece.box[2])}><image href={LADIES_PIECES_SHEET} width="960" height="720" /></svg> : <span className="cl-item-thumb" />}
                <span className="cl-item-title"><strong>{item.name}</strong><small>{formatCurrency(item.price, currencySymbol)}</small></span>
                <button type="button" onClick={item.add} aria-label={'Add ' + item.name + ' to bag'}>+</button>
              </div>
            )) : <span className="cl-empty">No products assigned to this model yet.</span>}
          </div>
          <span className="cl-shop-link">Shop this look&nbsp; +</span>
        </footer>
      </> : <p className="cl-empty">Add male or female models in Admin to feature them here.</p>}
    </section>
  );
};
