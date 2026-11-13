import React, { useEffect, useMemo, useRef } from 'react';
import { Look, Product } from '../types';
import { DEFAULT_LOOKS } from '../data/defaultCatalog';
import { LADIES_LOOK_BOUNDS, LADIES_MODEL_Y0, LADIES_MODEL_Y1, LADIES_MODELS_SHEET } from '../services/ladiesStorage';

interface PageRibbonSectionProps {
  shopName: string;
  looks: Look[];
  products: Product[];
}

type RibbonModel = { id: string; name: string; image: string; crop?: [number, number, number, number] };

type PageItem = {
  id: string;
  title: string;
  kicker: string;
  mode: 'runway' | 'rail' | 'ladies' | 'western' | 'circle' | 'products';
  models?: RibbonModel[];
  products?: Product[];
};

const PAGES = [
  { id: 'men-studio', title: "Men's Studio", kicker: '01 / RUNWAY', mode: 'runway' },
  { id: 'offcut-rail-section', title: '3D Hanger T-Shirts', kicker: '02 / CHROME RAIL', mode: 'rail' },
  { id: 'ladies-section', title: 'Ladies Collection', kicker: '03 / LOOKBOOK', mode: 'ladies' },
  { id: 'ladies-rail-section', title: '3D Hanger Dresses', kicker: '04 / LADIES RAIL', mode: 'rail' },
  { id: 'virtual-studio', title: 'Western Model', kicker: '05 / WESTERN WEAR', mode: 'western' },
  { id: 'circle-lookbook', title: 'Circle Model Page', kicker: '06 / CIRCLE LOOKBOOK', mode: 'circle' },
  { id: 'product-collection', title: 'All Products', kicker: '07 / FULL COLLECTION', mode: 'products' },
] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const PageRibbonSection: React.FC<PageRibbonSectionProps> = ({ shopName, looks, products }) => {
  const stageRef = useRef<HTMLElement | null>(null);
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const phaseRef = useRef(0);
  const wheelRef = useRef(0);
  const dragRef = useRef<{ x: number; phase: number } | null>(null);
  const draggedRef = useRef(false);

  const pages = useMemo<PageItem[]>(() => {
    const availableLooks = looks.length ? looks : DEFAULT_LOOKS;
    const men: RibbonModel[] = availableLooks
      .filter((look) => !look.modelGroup || look.modelGroup.toLowerCase() === 'men')
      .map((look) => ({ id: look.id, name: look.name, image: look.srcset1080 || look.src640 }));
    const ladies: RibbonModel[] = LADIES_LOOK_BOUNDS.map(([x0, x1], index) => ({
      id: 'ladies-model-' + (index + 1),
      name: 'Ladies Look ' + String(index + 1).padStart(2, '0'),
      image: LADIES_MODELS_SHEET,
      crop: [x0, LADIES_MODEL_Y0, x1 - x0, LADIES_MODEL_Y1 - LADIES_MODEL_Y0],
    }));
    const westernFiles = [
      ['Denim Maxi', 'hf_20261112_034542_a6430ecf-9862-412c-8ef6-5745115bd78c.png'],
      ['Cloud Set', 'hf_20261112_034738_73282737-acc8-41e9-a822-96c663e27b6c.png'],
      ['Library Knit', 'hf_20261112_034742_9a8a92fd-79ae-4163-9ffa-14ae2a68717f.png'],
      ['Lilac Run', 'hf_20261112_034735_4e352e03-ad2b-44d1-9fcf-4b5b9454dc55.png'],
      ['Satin Night', 'hf_20261112_034738_aeb8ea57-6399-4f3c-b54a-4a57d0bd971e.png'],
      ['Night Suit', 'hf_20261112_034736_aace5c5f-8c14-4b00-83ba-744dbad2e337.png'],
      ['Sage Slip', 'hf_20261112_034735_3d9fb69e-b4e0-49f7-a2d4-e592bd616c27.png'],
      ['Bomber Cargo', 'hf_20261112_034740_3e3c5ad7-689b-46a2-8e09-c7d36a569b9c.png'],
    ] as const;
    const studioCdn = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/';
    const westernPresets: RibbonModel[] = westernFiles.map(([name, file]) => ({
      id: 'western-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      image: 'https://images.higgs.ai/?default=1&output=webp&url=' + encodeURIComponent(studioCdn + file) + '&w=1000&q=85',
    }));
    const western: RibbonModel[] = [...westernPresets, ...availableLooks.filter((look) => look.modelGroup?.toLowerCase() === 'western')
      .map((look) => ({ id: look.id, name: look.name, image: look.srcset1080 || look.src640 }))];
    const allModels = [...men.slice(0, 4), ...ladies.slice(0, 4), ...western.slice(0, 4)];
    const tops = products.filter((product) => ['top', 'hoodie', 'sweatshirt'].includes(product.category || ''));
    const dresses = products.filter((product) => Boolean(product.virtualStudioLook));
    const matchingProducts = (look?: Look) => look
      ? products.filter((product) => look.productIds.includes(product.id))
      : [];
    const make = (index: number, modelSet: RibbonModel[], productSet: Product[] = []): PageItem => ({
      ...PAGES[index],
      mode: PAGES[index].mode,
      models: modelSet,
      products: productSet.length ? productSet : products.slice(0, 5),
    });

    return [
      make(0, men, matchingProducts(availableLooks.find((look) => !look.modelGroup || look.modelGroup.toLowerCase() === 'men'))),
      make(1, men, tops.length ? tops : products.slice(0, 5)),
      make(2, ladies),
      make(3, ladies, dresses.length ? dresses : tops),
      make(4, western),
      make(5, allModels.slice(0, 12), products.slice(0, 3)),
      make(6, [], products),
    ];
  }, [looks, products]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let frame = 0;
    let previousTime = 0;
    let visible = false;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    const updateMotionPreference = () => { reducedMotion = motionQuery.matches; };
    motionQuery.addEventListener?.('change', updateMotionPreference);

    const animate = (time: number) => {
      frame = 0;
      if (!visible || document.hidden) {
        previousTime = 0;
        return;
      }

      const delta = previousTime ? Math.min(48, time - previousTime) : 16;
      previousTime = time;
      const width = stage.clientWidth || window.innerWidth;
      const height = stage.clientHeight || window.innerHeight;
      const mobile = width < 680;
      const step = Math.min(width * (mobile ? 0.34 : 0.21), mobile ? 150 : 380);
      if (!reducedMotion && !dragRef.current) phaseRef.current += delta * 0.00028;
      phaseRef.current += wheelRef.current;
      wheelRef.current *= 0.86;
      if (Math.abs(wheelRef.current) < 0.0001) wheelRef.current = 0;

      const count = pages.length;
      phaseRef.current = ((phaseRef.current % count) + count) % count;
      const activeIndex = ((Math.round(phaseRef.current) % count) + count) % count;
      const counter = stage.querySelector<HTMLElement>('.pr-counter');
      if (counter) counter.textContent = String(activeIndex + 1).padStart(2, '0') + ' / ' + String(count).padStart(2, '0');

      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const relative = ((((index - phaseRef.current + count / 2) % count) + count) % count) - count / 2;
        const distance = Math.abs(relative);
        const x = width / 2 + relative * step;
        const float = reducedMotion ? 0 : Math.sin(time * 0.0015 + index * 1.37) * (mobile ? 4 : 9);
        const y = height * (mobile ? 0.59 : 0.57) + Math.sin(relative * 0.72) * Math.min(mobile ? 24 : 62, height * (mobile ? 0.045 : 0.08)) + float;
        const z = -Math.min(distance, 4) * (mobile ? 35 : 82);
        const rotateY = relative * (mobile ? -9 : -14);
        const rotateZ = relative * -1.7 + (reducedMotion ? 0 : Math.sin(time * 0.001 + index) * 0.4);
        const scale = 1 - Math.min(distance, 4) * (mobile ? 0.07 : 0.085);
        const opacity = Math.max(0.3, 1 - Math.max(0, distance - 2.2) * 0.26);
        card.style.transform = 'translate3d(' + x + 'px,' + y + 'px,' + z + 'px) translate(-50%,-50%) rotateY(' + rotateY + 'deg) rotateZ(' + rotateZ + 'deg) scale(' + scale + ')';
        card.style.zIndex = String(100 - Math.round(distance * 10));
        card.style.opacity = String(opacity);
      });

      frame = requestAnimationFrame(animate);
    };

    const start = () => {
      if (!frame && visible && !document.hidden) {
        previousTime = 0;
        frame = requestAnimationFrame(animate);
      }
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    }, { threshold: 0.03 });
    const onVisibilityChange = () => document.hidden ? stop() : start();
    const releaseOutsideStage = (event: PointerEvent) => {
      if (event.target instanceof Node && stage.contains(event.target)) return;
      dragRef.current = null;
      stage.classList.remove('is-dragging');
      window.setTimeout(() => { draggedRef.current = false; }, 100);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pointerup', releaseOutsideStage);
    window.addEventListener('pointercancel', releaseOutsideStage);
    if (observer) observer.observe(stage);
    else {
      visible = true;
      start();
    }

    return () => {
      stop();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pointerup', releaseOutsideStage);
      window.removeEventListener('pointercancel', releaseOutsideStage);
      motionQuery.removeEventListener?.('change', updateMotionPreference);
    };
  }, [pages.length]);

  const handleWheel = (event: React.WheelEvent<HTMLElement>) => {
    wheelRef.current += clamp((event.deltaY || event.deltaX) / 380 * 0.34, -0.8, 0.8);
  };
  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragRef.current = { x: event.clientX, phase: phaseRef.current };
    draggedRef.current = false;
    event.currentTarget.classList.add('is-dragging');
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    const distance = event.clientX - dragRef.current.x;
    if (Math.abs(distance) > 12) draggedRef.current = true;
    const width = stageRef.current?.clientWidth || window.innerWidth;
    const step = Math.min(width * (width < 680 ? 0.34 : 0.21), width < 680 ? 150 : 380);
    phaseRef.current = dragRef.current.phase - distance / step;
  };
  const handlePointerUp = () => {
    dragRef.current = null;
    stageRef.current?.classList.remove('is-dragging');
    window.setTimeout(() => { draggedRef.current = false; }, 100);
  };

  const renderShot = (page: PageItem) => {
    const modelImage = (look: RibbonModel, className: string, style?: React.CSSProperties) => look.crop
              ? <svg key={look.id} className={className + ' pr-shot-model-svg'} viewBox={look.crop.join(' ')} preserveAspectRatio="xMidYMax meet" style={style} aria-label={look.name}><image href={look.image} width="960" height="540" /></svg>
              : <img key={look.id} className={className} src={look.image} alt={look.name} loading="eager" decoding="async" style={style} />;
    const modelList = page.models || [];
    const productList = page.products || [];
    const modelImages = modelList.slice(0, page.mode === 'circle' ? 12 : 5);
    const productImages = productList.slice(0, page.mode === 'products' ? 9 : 3);

    return (
      <div className={'pr-page-shot pr-shot-' + page.mode}>
        <div className="pr-shot-sitebar">
          <strong>{shopName}</strong>
          <span>COLLECTION　 STUDIO　 SHOP</span>
          <b aria-hidden="true">BAG (0)</b>
        </div>
        <div className="pr-shot-eyebrow">{page.kicker.replace(/^\d+\s\/\s/, '')}</div>
        {page.mode === 'products' ? (
          <div className="pr-shot-product-grid">
            {productImages.map((product) => <div className="pr-shot-product" key={product.id}><img src={product.image} alt="" loading="lazy" /><span>{product.name}</span></div>)}
          </div>
        ) : page.mode === 'rail' ? (
          <div className="pr-shot-rail">
            {productImages.map((product) => <div className="pr-shot-hanger" key={product.id}><i aria-hidden="true" /><img src={product.image} alt="" loading="lazy" /><span>{product.name}</span></div>)}
          </div>
        ) : page.mode === 'circle' ? (
          <div className="pr-shot-circle">
            <i className="pr-shot-orbit" aria-hidden="true" />
            {modelImages.map((look, index) => { const angle = (index / Math.max(1, modelImages.length)) * Math.PI * 2 - Math.PI / 2; return modelImage(look, '', { left: (50 + Math.cos(angle) * 38) + '%', top: (50 + Math.sin(angle) * 37) + '%' }); })}
            <span>STAY OUT OF THE LOOP</span>
          </div>
        ) : (
          <div className="pr-shot-runway">
            <div className="pr-shot-models">
              {modelImages.map((look, index) => modelImage(look, index === 0 ? 'is-lead' : ''))}
              {!modelImages.length && <div className="pr-shot-empty">Add models in Admin</div>}
            </div>
            {page.mode !== 'western' && productImages.length > 0 && (
              <aside className="pr-shot-shop">{productImages.slice(0, 2).map((product) => <div key={product.id}><img src={product.image} alt="" loading="lazy" /><span>{product.name}</span></div>)}</aside>
            )}
            {page.mode === 'western' && <div className="pr-shot-western-tag">WESTERN MODEL · SHOP THE LOOK</div>}
          </div>
        )}
        <div className="pr-shot-footer"><i /> TRY THE LOOK <span>SCROLL TO EXPLORE</span></div>
      </div>
    );
  };

  return (
    <section className="page-ribbon" id="page-ribbon" aria-label={shopName + ' page previews'}>
      <div className="pr-stage" ref={stageRef} onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
        <div className="pr-noise" aria-hidden="true" />
        <header className="pr-topline">
          <span><i /> {shopName.toUpperCase()} · PAGE INDEX</span>
          <span>DRAG OR SCROLL TO EXPLORE</span>
        </header>
        <div className="pr-headline" aria-hidden="true"><span>THE STYLE</span><span>UNIVERSE</span></div>
        <p className="pr-intro">Every page. Every look. One collection.</p>
        <div className="pr-orbit pr-orbit-one" aria-hidden="true" />
        <div className="pr-orbit pr-orbit-two" aria-hidden="true" />
        <div className="pr-cards">
          {pages.map((page) => (
            <a
              key={page.id}
              ref={(node) => { cardRefs.current[PAGES.findIndex((entry) => entry.id === page.id)] = node; }}
              className="pr-card"
              href={'#' + page.id}
              onClick={(event) => {
                if (draggedRef.current) {
                  event.preventDefault();
                  return;
                }
                event.preventDefault();
                const target = document.getElementById(page.id);
                if (!target) return;
                const hash = '#' + page.id;
                if (window.location.hash !== hash) window.history.pushState(null, '', hash);
                const headerHeight = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;
                const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
                window.scrollTo({ top, behavior: 'smooth' });
              }}
              aria-label={'Open ' + page.title}
              draggable={false}
            >
              <div className="pr-browser-bar">
                <span className="pr-window-dots"><i /><i /><i /></span>
                <span className="pr-address">{page.title}</span>
                <span className="pr-browser-icons" aria-hidden="true">⌕　◻</span>
              </div>
              <div className="pr-frame">{renderShot(page)}</div>
              <div className="pr-card-copy"><span>{page.kicker}</span><strong>{page.title}</strong><b aria-hidden="true">↗</b></div>
            </a>
          ))}
        </div>
        <div className="pr-caption">
          <span>CONTINUOUS PAGE TOUR</span>
          <span className="pr-counter">01 / 07</span>
        </div>
        <div className="pr-progress"><span /></div>
      </div>
    </section>
  );
};
