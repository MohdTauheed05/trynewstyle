import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Look, Product } from '../types';

interface PageRibbonSectionProps {
  shopName: string;
  looks: Look[];
  products: Product[];
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

export const PageRibbonSection: React.FC<PageRibbonSectionProps> = ({ shopName, looks, products }) => {
  const trackRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const menLook = looks.find((look) => !look.modelGroup || look.modelGroup === 'men');
  const ladiesLook = looks.find((look) => look.modelGroup === 'ladies');
  const westernLook = looks.find((look) => look.modelGroup === 'western');
  const fallbackLook = looks[0];
  const tops = products.filter((product) => product.category === 'top' || product.category === 'hoodie' || product.category === 'sweatshirt');
  const dresses = products.filter((product) => product.virtualStudioLook || product.category === 'accessory');
  const pageItems = useMemo(() => [
    { id: 'men-studio', title: "Men's Studio", kicker: '01 / RUNWAY', image: menLook?.srcset1080 || menLook?.src640 || products[0]?.image, tone: 'sand' },
    { id: 'offcut-rail-section', title: '3D Hanger T-Shirts', kicker: '02 / CHROME RAIL', image: tops[0]?.image || products[1]?.image || menLook?.src640, tone: 'blue' },
    { id: 'ladies-section', title: 'Ladies Collection', kicker: '03 / LOOKBOOK', image: ladiesLook?.srcset1080 || ladiesLook?.src640 || fallbackLook?.src640, tone: 'rose' },
    { id: 'ladies-rail-section', title: '3D Hanger Dresses', kicker: '04 / LADIES RAIL', image: dresses[0]?.image || products[2]?.image || ladiesLook?.src640, tone: 'plum' },
    { id: 'virtual-studio', title: 'Western Model', kicker: '05 / WESTERN WEAR', image: westernLook?.srcset1080 || westernLook?.src640 || ladiesLook?.src640, tone: 'olive' },
    { id: 'circle-lookbook', title: 'Circle Model Page', kicker: '06 / CIRCLE LOOKBOOK', image: looks[1]?.srcset1080 || looks[1]?.src640 || fallbackLook?.src640, tone: 'violet' },
    { id: 'product-collection', title: 'All Products', kicker: '07 / FULL COLLECTION', image: products[0]?.image || fallbackLook?.src640, tone: 'amber' },
  ], [menLook, ladiesLook, westernLook, fallbackLook, looks, products, tops, dresses]);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const track = trackRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const range = Math.max(1, rect.height - window.innerHeight);
        setProgress(clamp(-rect.top / range));
      });
    };
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const columns = typeof window !== 'undefined' && window.innerWidth < 680 ? 2 : 3;
  const stageWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const stageHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const layoutProgress = clamp((progress - 0.22) / 0.66);
  const openPage = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="page-ribbon-track" id="page-ribbon" ref={trackRef} aria-label={shopName + ' page ribbon'}>
      <div className="page-ribbon-stage">
        <div className="pr-topline"><span><i /> {shopName.toUpperCase()} · STYLE INDEX</span><span>SCROLL TO EXPLORE</span></div>
        <div className="pr-headline" aria-hidden="true">
          <span style={{ transform: 'translateX(' + (-progress * 18) + 'vw)' }}>STYLE IN</span>
          <span style={{ transform: 'translateX(' + (progress * 18) + 'vw)' }}>MOTION</span>
        </div>
        <p className="pr-intro">Explore every corner of the collection.</p>
        <div className="pr-orbit" aria-hidden="true" />
        <div className="pr-cards">
          {pageItems.map((item, index) => {
            const spread = index - (pageItems.length - 1) / 2;
            const mobile = stageWidth < 680;
            const startX = stageWidth / 2 + spread * stageWidth * (mobile ? 0.19 : 0.145);
            const startY = stageHeight * (0.59 + Math.cos((index / (pageItems.length - 1)) * Math.PI * 2) * 0.055);
            const startZ = -Math.abs(spread) * (mobile ? 38 : 55);
            const startRotate = -spread * 9;
            const col = index % columns;
            const row = Math.floor(index / columns);
            const rows = Math.ceil(pageItems.length / columns);
            const gridX = stageWidth * ((col + 0.5) / columns);
            const gridY = stageHeight * (0.34 + (row + 0.5) * (0.56 / rows));
            const x = mix(startX, gridX, layoutProgress);
            const y = mix(startY, gridY, layoutProgress);
            const z = mix(startZ, 0, layoutProgress);
            const rotate = mix(startRotate, 0, layoutProgress);
            const scale = mix(mobile ? 0.92 : 0.84, 1, layoutProgress);
            const active = Math.abs(spread) < 0.5;
            return (
              <a
                key={item.id}
                className={'pr-card pr-tone-' + item.tone}
                href={'#' + item.id}
                onClick={(event) => openPage(event, item.id)}
                aria-label={'Open ' + item.title}
                style={{
                  transform: 'translate3d(' + x + 'px,' + y + 'px,' + z + 'px) translate(-50%,-50%) rotateY(' + rotate + 'deg) scale(' + scale + ')',
                  zIndex: 20 - Math.round(Math.abs(spread) * (1 - layoutProgress) * 2) + (active ? 2 : 0),
                }}
              >
                <div className="pr-card-image">
                  {item.image && <img src={item.image} alt="" loading="lazy" />}
                  <span className="pr-card-glow" />
                  <span className="pr-card-open" aria-hidden="true">↗</span>
                </div>
                <div className="pr-card-copy"><span>{item.kicker}</span><strong>{item.title}</strong></div>
              </a>
            );
          })}
        </div>
        <div className="pr-caption"><span>COLLECTION / LOOKBOOK / STUDIO</span><span>{String(Math.min(7, Math.floor(progress * 7) + 1)).padStart(2, '0')} — 07</span></div>
        <div className="pr-progress"><span style={{ transform: 'scaleX(' + progress + ')' }} /></div>
      </div>
    </section>
  );
};
