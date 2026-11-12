import React, { useEffect, useMemo, useState } from 'react';
import { Look, Product, LadiesPiece } from '../types';
import { addBagItem } from '../services/bagStorage';
import { formatCurrency } from '../services/storeSettings';
import {
  LADIES_LOOK_BOUNDS,
  LADIES_MODEL_Y0,
  LADIES_MODEL_Y1,
  LADIES_MODELS_SHEET,
  getStoredLadiesPieces,
  getStoredLadiesSettings,
} from '../services/ladiesStorage';

interface CircleLookbookProps {
  looks: Look[];
  products: Product[];
  shopName: string;
  currencySymbol: string;
}

type Entry = {
  id: string;
  name: string;
  image: string;
  group: 'men' | 'women';
  products: Product[];
  ladiesPieces?: LadiesPiece[];
  crop?: [number, number, number, number];
};

export const CircleLookbook: React.FC<CircleLookbookProps> = ({ looks, products, shopName, currencySymbol }) => {
  const [ladiesPieces, setLadiesPieces] = useState(() => getStoredLadiesPieces());
  const [firstLadiesLook, setFirstLadiesLook] = useState(() => getStoredLadiesSettings().firstLookNumber || 15);
  const [group, setGroup] = useState<'men' | 'women'>('men');
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const sync = () => {
      setLadiesPieces(getStoredLadiesPieces());
      setFirstLadiesLook(getStoredLadiesSettings().firstLookNumber || 15);
    };
    window.addEventListener('runway:ladies_updated', sync);
    window.addEventListener('runway:catalog_updated', sync);
    return () => {
      window.removeEventListener('runway:ladies_updated', sync);
      window.removeEventListener('runway:catalog_updated', sync);
    };
  }, []);

  const entries = useMemo<Entry[]>(() => {
    const modelEntries: Entry[] = looks
      .filter((look) => !look.modelGroup || look.modelGroup === 'men' || look.modelGroup === 'ladies' || look.modelGroup === 'western')
      .map((look) => ({
        id: look.id,
        name: look.name,
        image: look.srcset1080 || look.src640,
        group: look.modelGroup === 'men' ? 'men' : 'women',
        products: look.productIds.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product)),
      }));

    const depthEntries: Entry[] = LADIES_LOOK_BOUNDS.map(([x0, x1], index) => {
      const lookNumber = firstLadiesLook + index;
      const pieces = ladiesPieces.filter((piece) => piece.lookNumber === lookNumber);
      const box: [number, number, number, number] = [x0, x1, LADIES_MODEL_Y0, LADIES_MODEL_Y1];
      return {
        id: 'ladies-depth-' + lookNumber,
        name: 'Ladies Look ' + String(lookNumber).padStart(2, '0'),
        image: LADIES_MODELS_SHEET,
        group: 'women',
        products: [],
        ladiesPieces: pieces,
        crop: box,
      };
    });
    return [...modelEntries, ...depthEntries];
  }, [looks, products, ladiesPieces, firstLadiesLook]);

  const groupEntries = entries.filter((entry) => entry.group === group);
  useEffect(() => {
    if (!groupEntries.some((entry) => entry.id === activeId)) setActiveId(groupEntries[0]?.id || '');
  }, [group, groupEntries, activeId]);
  const active = groupEntries.find((entry) => entry.id === activeId) || groupEntries[0];

  const addProduct = (product: Product) => addBagItem({
    productId: product.id,
    name: product.name,
    size: product.sizes?.[0] || 'One Size',
    price: product.price,
    image: product.image,
    url: product.url,
    quantity: 1,
  });
  const addPiece = (piece: LadiesPiece) => addBagItem({
    productId: piece.id,
    name: piece.name,
    size: 'One Size',
    price: piece.price,
    image: piece.customImage || LADIES_MODELS_SHEET,
    quantity: 1,
    crop: !piece.customImage && piece.box ? {
      x: piece.box[0], y: piece.box[2], w: piece.box[1] - piece.box[0], h: piece.box[3] - piece.box[2], sheetW: 960, sheetH: 720,
    } : undefined,
  });

  const productsForActive = active ? [
    ...active.products.map((product) => ({ id: product.id, name: product.name, image: product.image, price: product.price, onAdd: () => addProduct(product) })),
    ...(active.ladiesPieces || []).map((piece) => ({
      id: piece.id,
      name: piece.name,
      image: piece.customImage || '',
      price: piece.price,
      piece,
      onAdd: () => addPiece(piece),
    })),
  ] : [];

  return (
    <section className="circle-lookbook" aria-label="Shop the model lookbook">
      <style>{`
        .circle-lookbook{--cl-ink:#171717;--cl-muted:#737373;background:#ececec;color:var(--cl-ink);padding:clamp(44px,7vw,96px) clamp(18px,5vw,72px) 72px;overflow:hidden}
        .cl-shell{max-width:1360px;margin:auto}.cl-head{display:flex;align-items:end;justify-content:space-between;gap:24px;border-bottom:1px solid #c9c9c9;padding-bottom:22px}
        .cl-kicker{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--cl-muted)}.cl-head h2{font:400 clamp(32px,5vw,68px)/.98 Georgia,serif;letter-spacing:-.04em;margin:10px 0 0}.cl-tabs{display:flex;gap:8px}
        .cl-tabs button,.cl-models button,.cl-product button{font:inherit;cursor:pointer}.cl-tabs button{border:1px dashed #171717;border-radius:99px;padding:10px 17px;text-transform:uppercase;font-size:11px;letter-spacing:.1em;background:transparent}
        .cl-tabs button[aria-pressed=true]{background:#171717;color:white;border-style:solid}.cl-stage{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(300px,.95fr);gap:clamp(20px,5vw,76px);align-items:center;padding:36px 0 30px}
        .cl-orbit{min-height:430px;position:relative;display:grid;place-items:center;isolation:isolate}.cl-orbit:before{content:"";position:absolute;width:min(82%,530px);aspect-ratio:1;border:1px dashed #aaa;border-radius:50%;z-index:-1}
        .cl-orbit:after{content:"";position:absolute;width:64%;height:12%;bottom:6%;border-radius:50%;background:radial-gradient(ellipse,#0002,transparent 70%);filter:blur(9px);z-index:-1}
        .cl-center{height:410px;width:min(100%,380px);display:grid;place-items:end center}.cl-center img{width:100%;height:100%;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 16px 12px #0002);animation:cl-enter .55s cubic-bezier(.16,1,.3,1) both}
        .cl-title{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font:400 clamp(26px,4vw,48px)/.95 Georgia,serif;text-align:center;pointer-events:none;z-index:-1;color:#333}
        @keyframes cl-enter{from{opacity:.4;transform:translateY(18px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        .cl-caption{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);font-size:10px;letter-spacing:.18em;text-transform:uppercase;white-space:nowrap}
        .cl-models{display:flex;gap:10px;overflow:auto;padding:6px 2px 12px;scrollbar-width:thin}.cl-models button{flex:0 0 82px;border:1px solid transparent;background:transparent;text-align:center;padding:5px;border-radius:12px;color:inherit}
        .cl-models button[aria-current=true]{border-color:#222;background:#fff}.cl-models img{width:100%;height:88px;object-fit:contain}.cl-models span{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:5px}
        .cl-products{border-top:1px solid #c9c9c9;padding-top:22px}.cl-products-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:14px;gap:12px}.cl-products h3{font:400 clamp(22px,3vw,34px)/1 Georgia,serif;margin:4px 0 0}.cl-count{font-size:11px;color:var(--cl-muted)}
        .cl-product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}.cl-product{background:#fff;padding:10px;border-radius:12px;min-width:0}
        .cl-product-image{height:155px;background:#f4f4f4;border-radius:8px;display:grid;place-items:center;overflow:hidden}.cl-product-image img{width:100%;height:100%;object-fit:contain}.cl-product-copy{padding:10px 1px 8px;display:grid;gap:6px}.cl-product-copy strong{font-size:12px;font-weight:500}.cl-product-copy span{font-size:12px;color:var(--cl-muted)}
        .cl-product button{width:100%;min-height:36px;background:#171717;color:#fff;border-radius:6px;font-size:10px;text-transform:uppercase;letter-spacing:.1em}
        .cl-empty{color:var(--cl-muted);font-size:13px;padding:22px 0}.cl-product-placeholder{font:400 28px Georgia,serif;color:#bbb}
        @media(max-width:760px){.circle-lookbook{padding:40px 16px 48px}.cl-head{align-items:start;flex-direction:column}.cl-head h2{font-size:42px}.cl-tabs{width:100%}.cl-tabs button{flex:1}
          .cl-stage{grid-template-columns:1fr;gap:16px;padding:18px 0}.cl-orbit{min-height:340px}.cl-center{height:330px;width:min(82vw,330px)}.cl-title{font-size:34px}
          .cl-models{margin:0 -16px;padding-left:16px;padding-right:16px}.cl-models img{height:78px}.cl-product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.cl-product-image{height:clamp(110px,34vw,165px)}}
        @media(prefers-reduced-motion:reduce){.cl-center img{animation:none}}
      `}</style>
      <div className="cl-shell">
        <header className="cl-head">
          <div><span className="cl-kicker">{shopName} · STYLE JOURNAL</span><h2>Stay out of the loop</h2></div>
          <div className="cl-tabs" role="group" aria-label="Choose model category">
            <button type="button" aria-pressed={group === 'men'} onClick={() => setGroup('men')}>Men</button>
            <button type="button" aria-pressed={group === 'women'} onClick={() => setGroup('women')}>Women</button>
          </div>
        </header>
        {active ? (
          <>
            <div className="cl-stage">
              <div className="cl-orbit">
                <div className="cl-title">A look<br/>in motion</div>
                <div className="cl-center" key={active.id}>
                  {active.crop ? (
                    <svg viewBox={`${active.crop[0]} ${active.crop[2]} ${active.crop[1] - active.crop[0]} ${active.crop[3] - active.crop[2]}`} role="img" aria-label={active.name} style={{ width: '100%', height: '100%' }}>
                      <image href={active.image} width="960" height="720" preserveAspectRatio="none" />
                    </svg>
                  ) : <img src={active.image} alt={active.name} />}
                </div>
                <span className="cl-caption">{active.name}</span>
              </div>
              <div>
                <span className="cl-kicker">SELECT A LOOK · {groupEntries.length} MODELS</span>
                <div className="cl-models">
                  {groupEntries.map((entry) => (
                    <button key={entry.id} type="button" aria-current={entry.id === active.id} onClick={() => setActiveId(entry.id)}>
                      {entry.crop ? <svg viewBox={`${entry.crop[0]} ${entry.crop[2]} ${entry.crop[1] - entry.crop[0]} ${entry.crop[3] - entry.crop[2]}`} width="100%" height="78"><image href={entry.image} width="960" height="720" preserveAspectRatio="none" /></svg> : <img src={entry.image} alt="" loading="lazy" />}
                      <span>{entry.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <section className="cl-products" aria-label={active.name + ' products'}>
              <div className="cl-products-head"><div><span className="cl-kicker">SHOP THIS LOOK</span><h3>{active.name}</h3></div><span className="cl-count">{productsForActive.length} pieces</span></div>
              {productsForActive.length ? <div className="cl-product-grid">{productsForActive.map((item) => (
                <article className="cl-product" key={item.id}>
                  <div className="cl-product-image">{item.image ? <img src={item.image} alt={item.name} loading="lazy" /> : item.piece?.box ? <svg viewBox={\`\${item.piece.box[0]} \${item.piece.box[2]} \${item.piece.box[1] - item.piece.box[0]} \${item.piece.box[3] - item.piece.box[2]}\`} width="100%" height="100%"><image href="https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=2400&q=85" width="960" height="720" /></svg> : <span className="cl-product-placeholder">✳</span>}</div>
                  <div className="cl-product-copy"><strong>{item.name}</strong><span>{formatCurrency(item.price, currencySymbol)}</span></div>
                  <button type="button" onClick={item.onAdd}>Add to bag</button>
                </article>
              ))}</div> : <p className="cl-empty">No products are assigned to this look yet. Assign products to the model in Admin and they’ll appear here.</p>}
            </section>
          </>
        ) : <p className="cl-empty">Add male or female models in Admin to feature them here.</p>}
      </div>
    </section>
  );
};
