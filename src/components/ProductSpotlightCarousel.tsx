import React from 'react';
import { Product } from '../types';
import { addBagItem } from '../services/bagStorage';
import { formatCurrency } from '../services/storeSettings';

interface ProductSpotlightCarouselProps {
  products: Product[];
  shopName: string;
  currencySymbol: string;
}

export const ProductSpotlightCarousel: React.FC<ProductSpotlightCarouselProps> = ({ products, shopName, currencySymbol }) => {
  const addProduct = (product: Product) => addBagItem({
    productId: product.id,
    name: product.name,
    size: product.sizes?.[0] || 'One Size',
    price: product.price,
    image: product.image,
    url: product.url,
    quantity: 1,
  });

  const renderProducts = (copy: 'primary' | 'duplicate') => products.map((product, index) => (
    <article className="reel-product-card" key={copy + '-' + product.id + '-' + index}>
      <a className="reel-product-image" href={product.url} tabIndex={copy === 'duplicate' ? -1 : 0} aria-label={'View ' + product.name}>
        {product.image ? <img src={product.image} alt={product.name} loading="lazy" /> : <span aria-hidden="true">Product photo</span>}
        <span className="reel-product-number">{String(index + 1).padStart(2, '0')}</span>
      </a>
      <div className="reel-product-info">
        <div className="reel-product-copy">
          <h3>{product.name}</h3>
          <p>{formatCurrency(product.price, currencySymbol)}</p>
        </div>
        {copy === 'primary' && (
          <button type="button" onClick={() => addProduct(product)} aria-label={'Add ' + product.name + ' to bag'}>+</button>
        )}
      </div>
      <a className="reel-product-details" href={product.url} tabIndex={copy === 'duplicate' ? -1 : 0}>View product <span aria-hidden="true">↗</span></a>
    </article>
  ));

  return (
    <section className="reelmark-products" aria-labelledby="reelmark-products-title">
      <style>{`
        .reelmark-products{--rm-ink:#101410;--rm-green:#08482d;--rm-mint:#dae7c7;background:#f5f8ef;color:var(--rm-ink);padding:clamp(52px,7vw,100px) 0 clamp(38px,5vw,72px);overflow:hidden}
        .reelmark-products *{box-sizing:border-box}
        .rm-heading{width:min(1160px,calc(100% - 48px));margin:0 auto 32px;display:grid;grid-template-columns:1fr auto;align-items:end;gap:16px}
        .rm-badge{display:inline-flex;align-items:center;gap:8px;width:max-content;background:var(--rm-mint);color:var(--rm-green);border-radius:99px;padding:9px 15px;font:500 11px/1.2 Inter,Arial,sans-serif;letter-spacing:.04em}
        .rm-badge:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--rm-green)}
        .rm-heading h2{font:700 clamp(32px,5.3vw,70px)/.98 Inter,Arial,sans-serif;letter-spacing:-.045em;margin:15px 0 0;max-width:780px}
        .rm-heading p{grid-column:1;color:#5e5e61;font:14px/1.55 Inter,Arial,sans-serif;margin:12px 0 0;max-width:470px}
        .rm-count{align-self:end;color:var(--rm-green);font:11px Inter,Arial,sans-serif;letter-spacing:.13em;text-transform:uppercase;padding-bottom:5px}
        .rm-track-window{width:100%;overflow:hidden;padding:20px 0 26px}
        .rm-track{display:flex;width:max-content;animation:rm-flow 54s linear infinite;will-change:transform}
        .rm-track-window:hover .rm-track,.rm-track-window:focus-within .rm-track{animation-play-state:paused}
        .rm-product-group{display:flex;align-items:center;gap:18px;padding-right:18px}
        @keyframes rm-flow{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .reel-product-card{width:clamp(190px,17vw,250px);height:clamp(310px,30vw,390px);flex:none;background:#fff;border-radius:18px;padding:10px;display:flex;flex-direction:column;box-shadow:0 0 0 1px rgba(8,72,45,.12);transition:transform .35s ease,box-shadow .35s ease}
        .reel-product-card:nth-child(6n+1){transform:translateY(14px) rotate(-2deg)}
        .reel-product-card:nth-child(6n+2){transform:translateY(-6px) rotate(-1deg)}
        .reel-product-card:nth-child(6n+3){transform:translateY(5px)}
        .reel-product-card:nth-child(6n+4){transform:translateY(-12px) rotate(1deg)}
        .reel-product-card:nth-child(6n+5){transform:translateY(6px) rotate(2deg)}
        .reel-product-card:nth-child(6n){transform:translateY(-4px)}
        .reel-product-card:hover{transform:translateY(-10px) rotate(0);box-shadow:0 14px 34px rgba(8,72,45,.12)}
        .reel-product-image{height:62%;min-height:0;position:relative;display:grid;place-items:center;overflow:hidden;border-radius:11px;background:#f4f6f0;color:#888;text-decoration:none}
        .reel-product-image img{width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply}
        .reel-product-number{position:absolute;left:10px;top:10px;border-radius:99px;background:rgba(255,255,255,.88);padding:6px 9px;color:var(--rm-green);font:10px Inter,Arial,sans-serif;letter-spacing:.08em}
        .reel-product-info{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:11px 2px 7px}
        .reel-product-copy{min-width:0}.reel-product-copy h3{font:600 13px/1.3 Inter,Arial,sans-serif;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .reel-product-copy p{font:12px/1.3 Inter,Arial,sans-serif;color:#5e5e61;margin:5px 0 0}
        .reel-product-info button{width:34px;height:34px;flex:none;border:0;border-radius:50%;background:var(--rm-green);color:#fff;font-size:21px;line-height:1;cursor:pointer}
        .reel-product-details{margin-top:auto;border-top:1px solid #e5e9df;padding:9px 2px 1px;color:var(--rm-green);font:10px Inter,Arial,sans-serif;letter-spacing:.06em;text-decoration:none;text-transform:uppercase;display:flex;justify-content:space-between}
        .reel-product-details:hover{text-decoration:underline}
        .rm-empty{width:min(1160px,calc(100% - 48px));margin:32px auto;color:#5e5e61;font:14px Inter,Arial,sans-serif}
        @media(max-width:820px){
          .reelmark-products{padding:42px 0 42px}.rm-heading{width:calc(100% - 32px);grid-template-columns:1fr;gap:12px;margin-bottom:15px}
          .rm-heading h2{font-size:clamp(36px,10vw,54px);max-width:520px}.rm-heading p{font-size:13px;margin-top:8px}.rm-count{padding:0}
          .rm-track-window{overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;padding:20px 16px 20px}.rm-track-window::-webkit-scrollbar{display:none}
          .rm-track{animation:none}.rm-product-group{gap:12px;padding-right:12px}.rm-product-group.clone{display:none}
          .reel-product-card{width:min(68vw,250px);height:340px;transform:none!important;border-radius:16px}
          .reel-product-image{height:62%}.reel-product-copy h3{font-size:12px}
        }
        @media(prefers-reduced-motion:reduce){.rm-track{animation:none}.reel-product-card{transition:none}}
      `}</style>
      <header className="rm-heading">
        <div>
          <span className="rm-badge">{shopName} · THE FULL COLLECTION</span>
          <h2 id="reelmark-products-title">Every piece, in the spotlight.</h2>
          <p>Explore the full collection, one piece at a time. New products added to the shop appear here automatically.</p>
        </div>
        <span className="rm-count">{products.length} {products.length === 1 ? 'product' : 'products'}</span>
      </header>
      {products.length ? (
        <div className="rm-track-window" aria-label="All shop products">
          <div className="rm-track">
            <div className="rm-product-group">{renderProducts('primary')}</div>
            <div className="rm-product-group clone" aria-hidden="true">{renderProducts('duplicate')}</div>
          </div>
        </div>
      ) : <p className="rm-empty">Products added in Admin will appear here.</p>}
    </section>
  );
};
