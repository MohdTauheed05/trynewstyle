import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Look, Product } from '../types';
import { addBagItem } from '../services/bagStorage';
import { formatCurrency } from '../services/storeSettings';

interface VirtualStudioProps {
  shopName: string;
  currencySymbol: string;
  products: Product[];
  looks: Look[];
}

type StudioFrame = 'full' | 'mid' | 'portrait';
interface StudioState {
  look: number;
  filter: number;
  realism: number;
  frame: StudioFrame;
}

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/';
const studioImage = (file: string, width: number) =>
  'https://images.higgs.ai/?default=1&output=webp&url=' +
  encodeURIComponent(CDN + file) + '&w=' + width + '&q=85';

const FILTERS = [
  { name: 'Daylight', css: 'none' },
  { name: 'Soft Film', css: 'contrast(.92) saturate(.85) brightness(1.06)' },
  { name: 'Cool Studio', css: 'saturate(.9) brightness(1.06) contrast(1.04)' },
  { name: 'Blue Hour', css: 'brightness(.82) contrast(1.1) saturate(1.1)' },
  { name: 'Mono', css: 'grayscale(1) contrast(1.12) brightness(1.03)' },
  { name: 'Golden Hour', css: 'saturate(1.1) brightness(1.02)' },
];

const DEFAULT_STATE: StudioState = { look: 0, filter: 0, realism: 75, frame: 'full' };
const BG_URL = studioImage('hf_20261112_034551_6394b127-5366-40a8-9c82-3c416f1161f1.png', 2400);

export const VirtualStudio: React.FC<VirtualStudioProps> = ({ shopName, currencySymbol, products, looks }) => {
  const [scene, setScene] = useState<StudioState>(DEFAULT_STATE);
  const [history, setHistory] = useState<StudioState[]>([DEFAULT_STATE]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [category, setCategory] = useState('All');
  const [activePanel, setActivePanel] = useState<'looks' | 'collection'>('looks');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const latestChange = useRef(0);

  useEffect(() => {
    const images = looks.map((look) => {
      const image = new Image();
      image.src = look.srcset1080 || look.src640;
      return image;
    });
    const background = new Image();
    background.src = BG_URL;
    return () => {
      images.forEach((image) => { image.src = ''; });
      background.src = '';
    };
  }, [looks]);

  const commitScene = useCallback((next: StudioState) => {
    const kept = history.slice(0, historyIndex + 1);
    const last = kept[kept.length - 1];
    setScene(next);
    if (!last || last.look !== next.look || last.filter !== next.filter || last.realism !== next.realism || last.frame !== next.frame) {
      const updated = [...kept, next].slice(-30);
      setHistory(updated);
      setHistoryIndex(updated.length - 1);
    }
    latestChange.current += 1;
  }, [history, historyIndex]);

  const chooseLook = (index: number) => {
    if (index === scene.look) return;
    const token = ++latestChange.current;
    const image = new Image();
    image.src = LOOK_URLS[index];
    const apply = () => {
      if (token !== latestChange.current) return;
      commitScene({ ...scene, look: index });
    };
    if (image.complete) apply();
    else image.onload = apply;
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setScene(history[nextIndex]);
    latestChange.current += 1;
  };
  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setScene(history[nextIndex]);
    latestChange.current += 1;
  };

  const addProduct = (product: Product) => {
    const size = product.sizes?.[0] || 'One Size';
    addBagItem({
      productId: product.id,
      name: product.name,
      size,
      price: product.price,
      image: product.image,
      url: product.url,
      quantity: 1,
    });
  };

  const currentLook = looks[scene.look] || looks[0];
  const categories = ['All', 'With products'];
  const visibleLooks = looks.map((look, index) => ({
    ...look,
    index,
    studioCategory: look.productIds.length ? 'Products linked' : 'No products yet',
  })).filter((look) => category === 'All' || look.productIds.length > 0);
  const visibleProducts = products.filter((product) => product.image);
  const wornProducts = currentLook
    ? currentLook.productIds.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product?.image))
    : [];

  return (
    <section id="virtual-studio" className="virtual-studio">
      <div className="vs-background" style={{ backgroundImage: 'url("' + BG_URL + '")' }} />
      <div className="vs-shade" />
      <div className="vs-content">
        <header className="vs-header">
          <div className="vs-brand">
            <strong>{shopName}</strong>
            <span>VIRTUAL STYLING STUDIO</span>
          </div>
          <div className="vs-tabs" aria-label="Studio views">
            <button type="button" className={activePanel === 'looks' ? 'active' : ''} onClick={() => setActivePanel('looks')}>Looks</button>
            <button type="button" className={activePanel === 'collection' ? 'active' : ''} onClick={() => setActivePanel('collection')}>My collection</button>
          </div>
        </header>

        <div className="vs-stage">
          <div className="vs-profile">
            <div className="vs-avatar">
              {currentLook?.src640 && <img src={currentLook.src640} alt={currentLook.name + ' model'} />}
            </div>
            <div className="vs-profile-copy">
              <span className="vs-eyebrow">ADMIN MODEL</span>
              <strong>{currentLook?.name || 'No model selected'}</strong>
              <span>{currentLook ? 'Photo and assigned pieces from Admin' : 'Add a model in Admin → Runway Models'}</span>
            </div>
          </div>

          <div className={'vs-model-frame ' + scene.frame} style={{ filter: FILTERS[scene.filter].css + ' saturate(' + (0.65 + scene.realism / 200) + ')' }}>
            <img
              key={currentLook?.id || 'no-model'}
              className="vs-model-image"
              src={currentLook?.srcset1080 || currentLook?.src640 || ''}
              alt={(currentLook?.name || 'Studio') + ' model wearing the assigned outfit'}
              onAnimationEnd={(event) => event.currentTarget.classList.remove('changing')}
              onLoad={(event) => event.currentTarget.classList.add('changing')}
            />
            <div className="vs-scan-line" aria-hidden="true" />
          </div>

          <aside className="vs-panel">
            {activePanel === 'looks' ? (
              <>
                <div className="vs-panel-title">
                  <div><span className="vs-eyebrow">THE EDIT</span><h2>Outfits</h2></div>
                  <span>{visibleLooks.length} looks</span>
                </div>
                <div className="vs-categories">
                  {categories.map((item) => (
                    <button key={item} type="button" className={(item === 'All' ? category === 'All' : category === 'With products') ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>
                  ))}
                </div>
                <div className="vs-look-grid">
                  {visibleLooks.map((look) => (
                    <article key={look.index} className={'vs-look-card ' + (scene.look === look.index ? 'selected' : '')}>
                      <button type="button" className="vs-look-select" onClick={() => chooseLook(look.index)} aria-label={'Preview ' + look.name}>
                        <img src={look.src640} alt="" loading="lazy" />
                        <span>{look.name}</span>
                        <i>{look.studioCategory}</i>
                      </button>
                      <button
                        type="button"
                        className={favorites.includes(look.index) ? 'favorite on' : 'favorite'}
                        aria-label={favorites.includes(look.index) ? 'Remove favorite' : 'Add favorite'}
                        aria-pressed={favorites.includes(look.index)}
                        onClick={() => setFavorites((current) => current.includes(look.index) ? current.filter((id) => id !== look.index) : [...current, look.index])}
                      >{favorites.includes(look.index) ? '♥' : '♡'}</button>
                    </article>
                  ))}
                </div>
                <div className="vs-selected-description">
                  <strong>{currentLook?.name || 'No model selected'}</strong>
                  <span>Choose a model. Its assigned products appear below and in My collection.</span>
                </div>
              </>
            ) : (
              <>
                <div className="vs-panel-title">
                  <div><span className="vs-eyebrow">YOUR SHOP</span><h2>My collection</h2></div>
                  <span>{visibleProducts.length} pieces</span>
                </div>
                <p className="vs-collection-note">Items added in Admin → Clothes Inventory appear here, including accessories.</p>
                <div className="vs-product-grid">
                  {visibleProducts.length ? visibleProducts.map((product) => (
                    <article className="vs-product-card" key={product.id}>
                      <button type="button" className="vs-product-preview" onClick={() => setSelectedProduct(product)} aria-label={'Preview ' + product.name}>
                        <img src={product.image} alt="" loading="lazy" />
                      </button>
                      <strong>{product.name}</strong>
                      {looks.filter((look) => look.productIds.includes(product.id)).map((look) => <small className="vs-product-look-label" key={look.id}>Worn in {look.name}</small>)}
                      <span>{formatCurrency(product.price, currencySymbol)}</span>
                      <div className="vs-product-actions">
                        <button type="button" onClick={() => setSelectedProduct(product)}>Details</button>
                        <button type="button" onClick={() => addProduct(product)}>Add to bag</button>
                      </div>
                    </article>
                  )) : (
                    <div className="vs-empty-products">
                      <strong>Your collection is waiting</strong>
                      <span>Add clothes or accessories from the Admin panel. They’ll show here automatically.</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {selectedProduct && activePanel === 'collection' && (
              <div className="vs-product-detail">
                <button type="button" className="vs-detail-close" onClick={() => setSelectedProduct(null)} aria-label="Close product details">×</button>
                <img src={selectedProduct.image} alt={selectedProduct.name} />
                <div>
                  <span className="vs-eyebrow">{selectedProduct.category || 'PIECE'}</span>
                  <strong>{selectedProduct.name}</strong>
                  <span>{formatCurrency(selectedProduct.price, currencySymbol)}</span>
                  <button type="button" onClick={() => addProduct(selectedProduct)}>Add to bag</button>
                </div>
              </div>
            )}
          </aside>

          <div className="vs-bottom-controls">
            <button type="button" onClick={undo} disabled={historyIndex <= 0}>↶ <span>Undo</span></button>
            <button type="button" onClick={redo} disabled={historyIndex >= history.length - 1}>↷ <span>Redo</span></button>
            <button type="button" onClick={() => {
              const frames: StudioFrame[] = ['full', 'mid', 'portrait'];
              const next = frames[(frames.indexOf(scene.frame) + 1) % frames.length];
              commitScene({ ...scene, frame: next });
            }}>◉ <span>{scene.frame === 'full' ? 'Full' : scene.frame === 'mid' ? 'Mid' : 'Portrait'}</span></button>
            <button type="button" onClick={() => commitScene(DEFAULT_STATE)}>↺ <span>Reset</span></button>
            <label className="vs-realism">
              <span>Realism</span><input type="range" min="0" max="100" value={scene.realism} onChange={(event) => commitScene({ ...scene, realism: Number(event.target.value) })} /><b>{scene.realism}%</b>
            </label>
            <label className="vs-filter">
              <span>Filter</span><select value={scene.filter} onChange={(event) => commitScene({ ...scene, filter: Number(event.target.value) })}>{FILTERS.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select>
            </label>
            <button type="button" className={saved.includes(scene.look) ? 'vs-save saved' : 'vs-save'} onClick={() => {
              setSaved((current) => current.includes(scene.look) ? current : [...current, scene.look]);
            }}>{saved.includes(scene.look) ? '✓ Saved' : '☆ Save look'}</button>
          </div>
        </div>
        <section className="vs-worn-section" aria-labelledby="vs-worn-title">
          <div className="vs-worn-heading">
            <div>
              <span className="vs-eyebrow">SHOP THE MODEL</span>
              <h2 id="vs-worn-title">Worn in {currentLook?.name || 'this look'}</h2>
            </div>
            <span>{wornProducts.length} {wornProducts.length === 1 ? 'piece' : 'pieces'}</span>
          </div>
          {wornProducts.length ? (
            <div className="vs-worn-products">
              {wornProducts.map((product) => (
                <article className="vs-worn-card" key={product.id}>
                  <div className="vs-worn-image"><img src={product.image} alt={product.name + ' product photo'} loading="lazy" /></div>
                  <div className="vs-worn-copy">
                    <strong>{product.name}</strong>
                    <span>{formatCurrency(product.price, currencySymbol)}</span>
                    {product.fitDescription && <small>{product.fitDescription}</small>}
                  </div>
                  <button type="button" onClick={() => addProduct(product)}>Add to bag</button>
                </article>
              ))}
            </div>
          ) : (
            <p className="vs-worn-empty">
              No products are assigned to this model yet. In Admin → Runway Models, edit this model and select its clothes under “Assign Clothes to this Look.”
            </p>
          )}
        </section>
        <p className="vs-photo-note">Upload your model photo and assign its products in Admin → Runway Models. Customers can add those pieces to their bag below.</p>
      </div>

    </section>
  );
};
