import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Product } from '../types';
import { addBagItem } from '../services/bagStorage';
import { formatCurrency } from '../services/storeSettings';
import { ReelItem } from '../services/reelStorage';

type ReelPlayback =
  | { kind: 'file'; src: string }
  | { kind: 'embed'; src: string }
  | { kind: 'link'; src: string }
  | { kind: 'resolve'; src: string };

function resolveReelPlayback(rawUrl: string): ReelPlayback {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const path = url.pathname;

    if (host === 'youtu.be' || host.endsWith('youtube.com')) {
      const id = host === 'youtu.be' ? path.split('/').filter(Boolean)[0] : (url.searchParams.get('v') || path.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1]);
      if (id) return { kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&mute=1&playsinline=1&rel=0' };
    }
    if (host === 'instagram.com') {
      const match = path.match(/\/(?:reel|reels|p|tv)\/([^/?]+)/);
      if (match) return { kind: 'embed', src: 'https://www.instagram.com/reel/' + encodeURIComponent(match[1]) + '/embed/' };
    }
    if (host.endsWith('tiktok.com')) {
      const id = path.match(/\/video\/(\d+)/)?.[1];
      if (id) return { kind: 'embed', src: 'https://www.tiktok.com/player/v1/' + id + '?music_info=1&description=1' };
      return { kind: 'resolve', src: url.href };
    }
    if (host.endsWith('facebook.com') || host === 'fb.watch') {
      return { kind: 'embed', src: 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(url.href) + '&show_text=0&autoplay=1' };
    }

    if (/\.(mp4|m4v|webm|ogv)(?:$|[?#])/i.test(url.href) || /cloudinary\.com\/[^/]+\/video\/upload\//i.test(url.href)) {
      return { kind: 'file', src: url.href };
    }
    return { kind: 'link', src: url.href };
  } catch {
    return { kind: 'link', src: rawUrl };
  }
}

interface ReelCoverflowProps {
  reels: ReelItem[];
  products: Product[];
  shopName: string;
  currencySymbol: string;
}

export const ReelCoverflow: React.FC<ReelCoverflowProps> = ({ reels, products, shopName, currencySymbol }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [resolvedTikTok, setResolvedTikTok] = useState<{ reelId: string; src: string } | null>(null);
  const [tiktokResolveError, setTiktokResolveError] = useState('');
  const [dragStart, setDragStart] = useState<number | null>(null);
  const wheelAt = useRef(0);
  const active = reels.length ? reels[((activeIndex % reels.length) + reels.length) % reels.length] : null;
  const rawPlayback = active ? resolveReelPlayback(active.videoUrl) : null;
  const playback = rawPlayback?.kind === 'resolve' && resolvedTikTok?.reelId === active?.id
    ? { kind: 'embed' as const, src: resolvedTikTok.src }
    : rawPlayback;
  const activeProducts = useMemo(() => active ? active.productIds.map((id) => products.find((item) => item.id === id)).filter((item): item is Product => Boolean(item)) : [], [active, products]);

  useEffect(() => { setActiveIndex(0); }, [reels.length]);
  useEffect(() => {
    setVideoFailed(false);
    setTiktokResolveError('');
    if (!active || rawPlayback?.kind !== 'resolve') return;
    let cancelled = false;
    fetch('/api/resolve-tiktok?url=' + encodeURIComponent(active.videoUrl))
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not prepare this TikTok reel.');
        return data as { embedUrl?: string };
      })
      .then((data) => {
        if (!cancelled && data.embedUrl) setResolvedTikTok({ reelId: active.id, src: data.embedUrl });
      })
      .catch((error: unknown) => {
        if (!cancelled) setTiktokResolveError(error instanceof Error ? error.message : 'Could not prepare this TikTok reel.');
      });
    return () => { cancelled = true; };
  }, [active?.id, active?.videoUrl, rawPlayback?.kind]);
  const shift = (amount: number) => {
    if (reels.length < 2) return;
    setActiveIndex((current) => (current + amount + reels.length) % reels.length);
  };
  const add = (product: Product) => addBagItem({
    productId: product.id, name: product.name, size: product.sizes?.[0] || 'One Size',
    price: product.price, image: product.image, url: product.url, quantity: 1,
  });
  const onWheel = (event: React.WheelEvent<HTMLElement>) => {
    if (!reels.length) return;
    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(delta) < 8) return;
    if (event.cancelable) event.preventDefault();
    const now = Date.now();
    if (now - wheelAt.current < 520) return;
    wheelAt.current = now;
    shift(delta > 0 ? 1 : -1);
  };
  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('.rf-controls,button,video')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    setDragStart(event.clientX);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  };
  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (dragStart === null) return;
    const delta = event.clientX - dragStart;
    if (Math.abs(delta) > 35) shift(delta < 0 ? 1 : -1);
    setDragStart(null);
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
  };
  const offsetIndex = (index: number) => {
    let delta = index - activeIndex;
    if (delta > reels.length / 2) delta -= reels.length;
    if (delta < -reels.length / 2) delta += reels.length;
    return delta;
  };

  return (
    <section className="reel-coverflow" aria-label={shopName + ' reels'} onWheel={onWheel}>
      <style>{`
        .reel-coverflow{--rf-ink:#f5f6fa;position:relative;isolation:isolate;overflow:hidden;background:radial-gradient(ellipse at 50% 36%,#17275a 0,#080d24 48%,#050817 100%);color:var(--rf-ink);padding:74px 24px 38px;min-height:760px}
        .reel-coverflow *{box-sizing:border-box}.rf-head{text-align:center;max-width:720px;margin:0 auto 28px}.rf-eyebrow{font:600 10px Arial,sans-serif;letter-spacing:.24em;color:#9daeff;text-transform:uppercase}.rf-head h2{font:500 clamp(36px,6vw,68px)/.98 Georgia,serif;letter-spacing:-.04em;margin:14px 0 10px}.rf-head p{font:14px/1.6 Arial,sans-serif;color:#aeb5c9;margin:0}
        .rf-stage{height:490px;max-width:1180px;margin:0 auto;position:relative;display:flex;align-items:center;justify-content:center;perspective:1300px;touch-action:pan-y;cursor:grab;user-select:none}.rf-stage.is-dragging{cursor:grabbing}
        .rf-card{position:absolute;left:50%;top:50%;width:clamp(180px,20vw,252px);height:438px;transform-origin:center center;border:1px solid #5369b5;border-radius:19px;overflow:hidden;background:#10172f;box-shadow:0 18px 55px #0008;transition:transform .6s cubic-bezier(.2,.75,.2,1),opacity .5s,filter .5s;cursor:pointer}
        .rf-card video,.rf-card img,.rf-card iframe{width:100%;height:100%;object-fit:cover;display:block;background:linear-gradient(145deg,#cbb8a3,#766b60);border:0}.rf-open-link{position:absolute;z-index:2;left:50%;top:50%;transform:translate(-50%,-50%);padding:12px 18px;border-radius:99px;background:#eefaff;color:#10172c;font:600 11px Arial,sans-serif;text-decoration:none;white-space:nowrap}.rf-no-poster{width:100%;height:100%;background:linear-gradient(145deg,#27366b,#11182d)}
.rf-reel-status{position:absolute;z-index:3;left:12px;right:12px;top:50%;transform:translateY(-50%);padding:12px;border-radius:10px;background:#091128dd;color:#fff;text-align:center;font:11px/1.5 Arial,sans-serif}.rf-card.is-active{border-color:#58ddff;box-shadow:0 0 0 1px #58ddff55,0 0 40px #3178ff55,0 20px 60px #0009;cursor:default}
        .rf-card-shade{position:absolute;inset:45% 0 0;background:linear-gradient(transparent,#060916e8);pointer-events:none}.rf-card-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:54px;height:54px;border:1px solid #ffffffa8;border-radius:50%;display:grid;place-items:center;color:#fff;background:#05081777;font-size:21px}
        .rf-card-title{position:absolute;left:20px;right:16px;bottom:19px;font:600 12px Arial,sans-serif;letter-spacing:.13em;text-transform:uppercase}.rf-card-index{position:absolute;left:18px;top:17px;border-radius:99px;padding:7px 10px;background:#070b1bcc;color:#dce6ff;font:9px Arial,sans-serif;letter-spacing:.1em}
        .rf-controls{position:absolute;left:50%;bottom:0;transform:translateX(-50%);display:flex;align-items:center;gap:16px;z-index:5}.rf-arrow{width:38px;height:38px;border:1px solid #56617e;border-radius:50%;background:#0b1228;color:#fff;font-size:18px;cursor:pointer}.rf-arrow:hover{border-color:#6be5ff;color:#6be5ff}.rf-dots{display:flex;gap:6px}.rf-dot{width:5px;height:5px;border-radius:50%;background:#64708e;border:0;padding:0;cursor:pointer}.rf-dot.active{width:20px;border-radius:9px;background:#61ddff}
        .rf-meta{min-height:105px;text-align:center;padding:30px 16px 12px}.rf-meta h3{font:500 20px Georgia,serif;margin:0 0 7px}.rf-meta p{font:12px/1.5 Arial,sans-serif;color:#aab3cc;margin:0 auto;max-width:520px}
        .rf-shop{max-width:900px;margin:0 auto;border-top:1px solid #293252;padding-top:18px}.rf-shop-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px}.rf-shop-head strong{font:10px Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase}.rf-shop-head span{font:10px Arial,sans-serif;color:#9aa4c0}.rf-products{display:flex;gap:10px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:thin;scrollbar-color:#516394 transparent}.rf-product{flex:0 0 245px;display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #293252;border-radius:14px;background:#0c132b}.rf-product img{width:56px;height:60px;object-fit:contain;border-radius:8px;background:#fff}.rf-prod-name{font:600 10px Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px}.rf-prod-price{font:10px Arial,sans-serif;color:#aab3cc;margin-top:5px}.rf-add{margin-left:auto;flex:none;border:0;border-radius:50%;width:30px;height:30px;background:#eafaff;color:#10172c;font-size:18px;cursor:pointer}
        .rf-footer{max-width:900px;margin:32px auto 0;border-top:1px solid #293252;padding-top:18px;display:flex;justify-content:space-between;gap:16px;align-items:center;color:#98a3c0;font:9px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}.rf-footer a{color:#dce8ff;text-decoration:none;margin-left:14px}
        @media(max-width:700px){.reel-coverflow{min-height:720px;padding:52px 14px 26px}.rf-head{margin-bottom:8px}.rf-head p{font-size:12px}.rf-stage{height:410px;margin:0 -14px}.rf-card{width:210px;height:350px;border-radius:16px}.rf-card-title{left:14px;bottom:15px;font-size:10px}.rf-controls{bottom:0}.rf-meta{padding-top:24px;min-height:92px}.rf-meta h3{font-size:18px}.rf-product{flex-basis:220px}.rf-footer{margin-top:24px;flex-direction:column;align-items:flex-start}.rf-footer a{margin:0 12px 0 0}}
        @media(prefers-reduced-motion:reduce){.rf-card{transition:none}}
      `}</style>
      <header className="rf-head"><span className="rf-eyebrow">{shopName} · The style reel</span><h2>Looks in motion</h2><p>Explore the collection through the people and pieces that bring it to life.</p></header>
      {active ? <>
        <div className={'rf-stage' + (dragStart !== null ? ' is-dragging' : '')} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => setDragStart(null)}>
          {reels.map((reel, index) => {
            const offset = offsetIndex(index);
            const abs = Math.abs(offset);
            if (abs > 3) return null;
            const mobile = typeof window !== 'undefined' && window.innerWidth < 700;
            const x = offset * (mobile ? 136 : 188);
            const y = abs * 8;
            const rotate = offset * (mobile ? -7 : -9);
            const scale = Math.max(.68, 1 - abs * (mobile ? .14 : .13));
            const opacity = Math.max(.28, 1 - abs * .22);
            return <div key={reel.id} role={offset === 0 ? undefined : 'button'} tabIndex={offset === 0 ? -1 : 0} className={'rf-card' + (offset === 0 ? ' is-active' : '')} aria-label={offset === 0 ? undefined : 'Show ' + reel.title} style={{transform:'translate(-50%,-50%) translateX(' + x + 'px) translateY(' + y + 'px) rotateY(' + rotate + 'deg) scale(' + scale + ')',zIndex:10-abs,opacity}} onClick={() => {
              if (offset) {
                shift(offset);
                const reelPlayback = resolveReelPlayback(reel.videoUrl);
                if (reelPlayback.kind === 'embed' || reelPlayback.kind === 'resolve' || reelPlayback.kind === 'file') setStartedReelId(reel.id);
              } else if (playback?.kind === 'embed') setStartedReelId(reel.id);
            }} onKeyDown={(event) => { if (offset && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); shift(offset); } }}>
              {offset === 0 && playback?.kind === 'file' && !videoFailed
                ? <video src={playback.src} poster={reel.posterUrl || undefined} autoPlay muted loop playsInline controls onError={() => setVideoFailed(true)} />
                : reel.posterUrl ? <img src={reel.posterUrl} alt="" loading="lazy" /> : <div className="rf-no-poster" />}
              {offset === 0 && playback?.kind === 'embed' && <iframe title={reel.title} src={(() => { const playerUrl = new URL(playback.src); playerUrl.searchParams.set('autoplay', '1'); playerUrl.searchParams.set('muted', '1'); playerUrl.searchParams.set('loop', '1'); return playerUrl.toString(); })()} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="eager" />}
              {offset === 0 && playback?.kind === 'resolve' && !resolvedTikTok && <div className="rf-reel-status">{tiktokResolveError || 'Preparing TikTok reel…'}</div>}
              {offset === 0 && (playback?.kind === 'link' || videoFailed) && <a className="rf-open-link" href={reel.videoUrl} target="_blank" rel="noreferrer">Open reel ↗</a>}
              <span className="rf-card-shade"/><span className="rf-card-index">REEL {String(index + 1).padStart(2,'0')}</span>
              {offset !== 0 && <span className="rf-card-play" aria-hidden="true">▶</span>}<span className="rf-card-title">{reel.title}</span>
            </div>;
          })}
          <div className="rf-controls"><button type="button" className="rf-arrow" onClick={() => shift(-1)} aria-label="Previous reel">‹</button><div className="rf-dots">{reels.map((reel,index)=><button key={reel.id} type="button" className={'rf-dot'+(index===activeIndex?' active':'')} aria-label={'Show reel '+(index+1)} onClick={() => setActiveIndex(index)} />)}</div><button type="button" className="rf-arrow" onClick={() => shift(1)} aria-label="Next reel">›</button></div>
        </div>
        <div className="rf-meta"><h3>{active.title}</h3>{active.caption && <p>{active.caption}</p>}</div>
        {activeProducts.length > 0 && <div className="rf-shop"><div className="rf-shop-head"><strong>Shop this reel</strong><span>{activeProducts.length} {activeProducts.length===1?'piece':'pieces'}</span></div><div className="rf-products">{activeProducts.map((product)=><article className="rf-product" key={product.id}><img src={product.image} alt={product.name} loading="lazy"/><div><div className="rf-prod-name">{product.name}</div><div className="rf-prod-price">{formatCurrency(product.price,currencySymbol)}</div></div><button type="button" className="rf-add" onClick={()=>add(product)} aria-label={'Add '+product.name+' to bag'}>+</button></article>)}</div></div>}
      </> : <div className="rf-empty">Reels are coming soon.</div>}
      <footer className="rf-footer"><span>© {new Date().getFullYear()} {shopName}</span><span>Follow the look <a href="#">Instagram</a><a href="#">TikTok</a><a href="#">WhatsApp</a></span></footer>
    </section>
  );
};
