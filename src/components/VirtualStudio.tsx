import React, { useEffect, useRef, useState } from 'react';
import { Look, Product } from '../types';
import { addBagItem } from '../services/bagStorage';
import { formatCurrency } from '../services/storeSettings';

interface VirtualStudioProps {
  shopName: string;
  currencySymbol: string;
  products: Product[];
  looks: Look[];
}

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/';
const studioImage = (file: string, width: number) =>
  'https://images.higgs.ai/?default=1&output=webp&url=' +
  encodeURIComponent(CDN + file) + '&w=' + width + '&q=85';

const WESTERN_PRESETS = [
  { name: 'Denim Maxi', category: 'Everyday', file: 'hf_20261112_034542_a6430ecf-9862-412c-8ef6-5745115bd78c.png' },
  { name: 'Cloud Set', category: 'Everyday', file: 'hf_20261112_034738_73282737-acc8-41e9-a822-96c663e27b6c.png' },
  { name: 'Library Knit', category: 'Everyday', file: 'hf_20261112_034742_9a8a92fd-79ae-4163-9ffa-14ae2a68717f.png' },
  { name: 'Lilac Run', category: 'Athletic', file: 'hf_20261112_034735_4e352e03-ad2b-44d1-9fcf-4b5b9454dc55.png' },
  { name: 'Satin Night', category: 'Sleep', file: 'hf_20261112_034738_aeb8ea57-6399-4f3c-b54a-4a57d0bd971e.png' },
  { name: 'Night Suit', category: 'Formal', file: 'hf_20261112_034736_aace5c5f-8c14-4b00-83ba-744dbad2e337.png' },
  { name: 'Sage Slip', category: 'Party', file: 'hf_20261112_034735_3d9fb69e-b4e0-49f7-a2d4-e592bd616c27.png' },
  { name: 'Bomber Cargo', category: 'Street', file: 'hf_20261112_034740_3e3c5ad7-689b-46a2-8e09-c7d36a569b9c.png' },
];

interface StudioLook {
  id: string;
  name: string;
  category: string;
  image: string;
  productIds: string[];
  isPreset: boolean;
}

const WESTERN_PRESET_URLS = WESTERN_PRESETS.map((look) => studioImage(look.file, 1000));
const BG_URL = studioImage('hf_20261112_034551_6394b127-5366-40a8-9c82-3c416f1161f1.png', 2400);

export const VirtualStudio: React.FC<VirtualStudioProps> = ({ shopName, currencySymbol, products, looks }) => {
  const [selectedLookIndex, setSelectedLookIndex] = useState(0);
  const latestChange = useRef(0);

  const studioLooks: StudioLook[] = [
    ...WESTERN_PRESETS.map((look, index) => ({
      id: 'western-preset-' + index,
      name: look.name,
      category: look.category,
      image: WESTERN_PRESET_URLS[index],
      productIds: [],
      isPreset: true,
    })),
    ...looks.filter((look) => look.modelGroup === 'western').map((look) => ({
      id: look.id,
      name: look.name,
      category: 'Western',
      image: look.srcset1080 || look.src640,
      productIds: look.productIds,
      isPreset: false,
    })),
  ];
  const currentLook = studioLooks[selectedLookIndex] || studioLooks[0];

  useEffect(() => {
    const images = [...WESTERN_PRESET_URLS, ...looks.filter((look) => look.modelGroup === 'western').map((look) => look.src640)].map((src) => {
      const image = new Image();
      image.src = src;
      return image;
    });
    const background = new Image();
    background.src = BG_URL;
    return () => {
      images.forEach((image) => { image.src = ''; });
      background.src = '';
    };
  }, [looks]);

  const chooseLook = (index: number) => {
    if (index === selectedLookIndex) return;
    const token = ++latestChange.current;
    const image = new Image();
    image.src = studioLooks[index].image;
    const apply = () => {
      if (token === latestChange.current) setSelectedLookIndex(index);
    };
    if (image.complete) apply();
    else image.onload = apply;
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

  const visibleLooks = studioLooks.map((look, index) => ({ ...look, index }));
  const wornProducts = (currentLook.isPreset
    ? products.filter((product) => product.virtualStudioLook === currentLook.name)
    : currentLook.productIds.map((id) => products.find((product) => product.id === id)))
    .filter((product): product is Product => Boolean(product?.image));

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
        </header>

        <div className="vs-stage">
          <div className="vs-profile">
            <div className="vs-avatar">
              <img src={currentLook.image} alt={currentLook.name + ' female model'} />
            </div>
            <div className="vs-profile-copy">
              <span className="vs-eyebrow">WESTERN MODEL</span>
              <strong>{currentLook.name}</strong>
              <span>Western Wear 3D female look</span>
            </div>
          </div>

          <div className="vs-model-frame">
            <img
              key={currentLook.id}
              className="vs-model-image"
              src={currentLook.image}
              alt={currentLook.name + ' female model wearing the Western outfit'}
              onAnimationEnd={(event) => event.currentTarget.classList.remove('changing')}
              onLoad={(event) => event.currentTarget.classList.add('changing')}
            />
            <div className="vs-scan-line" aria-hidden="true" />
          </div>

        <section className="vs-worn-section" aria-labelledby="vs-worn-title">
          <div className="vs-worn-heading">
            <div>
              <span className="vs-eyebrow">SHOP THE MODEL</span>
              <h2 id="vs-worn-title">Worn in {currentLook.name}</h2>
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
              {currentLook.isPreset
                ? <>No products are matched to this preset yet. In Admin → Clothes Inventory, edit each item and choose “{currentLook.name}” under Western Wear 3D Look Match.</>
                : <>No products are assigned to this model yet. In Admin → Men’s Runway Models, choose Western when editing the model and assign the clothes it wears.</>}
            </p>
          )}
        </section>

          <aside className="vs-panel">
            <div className="vs-panel-title">
              <div><span className="vs-eyebrow">CHOOSE A MODEL</span><h2>Models</h2></div>
              <span>{visibleLooks.length} looks</span>
            </div>
            <div className="vs-look-grid">
              {visibleLooks.map((look) => (
                <article key={look.index} className={'vs-look-card ' + (selectedLookIndex === look.index ? 'selected' : '')}>
                  <button type="button" className="vs-look-select" onClick={() => chooseLook(look.index)} aria-label={'Preview ' + look.name}>
                    <img src={look.image} alt="" loading="lazy" />
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
