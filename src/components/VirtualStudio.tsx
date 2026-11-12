import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Product } from '../types';
import { addBagItem } from '../services/bagStorage';
import { formatCurrency } from '../services/storeSettings';

interface VirtualStudioProps {
  shopName: string;
  currencySymbol: string;
  products: Product[];
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

const LOOKS = [
  { name: 'Denim Maxi', category: 'Everyday', file: 'hf_20261112_034542_a6430ecf-9862-412c-8ef6-5745115bd78c.png' },
  { name: 'Cloud Set', category: 'Everyday', file: 'hf_20261112_034738_73282737-acc8-41e9-a822-96c663e27b6c.png' },
  { name: 'Library Knit', category: 'Everyday', file: 'hf_20261112_034742_9a8a92fd-79ae-4163-9ffa-14ae2a68717f.png' },
  { name: 'Lilac Run', category: 'Athletic', file: 'hf_20261112_034735_4e352e03-ad2b-44d1-9fcf-4b5b9454dc55.png' },
  { name: 'Satin Night', category: 'Sleep', file: 'hf_20261112_034738_aeb8ea57-6399-4f3c-b54a-4a57d0bd971e.png' },
  { name: 'Night Suit', category: 'Formal', file: 'hf_20261112_034736_aace5c5f-8c14-4b00-83ba-744dbad2e337.png' },
  { name: 'Sage Slip', category: 'Party', file: 'hf_20261112_034735_3d9fb69e-b4e0-49f7-a2d4-e592bd616c27.png' },
  { name: 'Bomber Cargo', category: 'Street', file: 'hf_20261112_034740_3e3c5ad7-689b-46a2-8e09-c7d36a569b9c.png' },
];

const FILTERS = [
  { name: 'Daylight', css: 'none' },
  { name: 'Soft Film', css: 'contrast(.92) saturate(.85) brightness(1.06)' },
  { name: 'Cool Studio', css: 'saturate(.9) brightness(1.06) contrast(1.04)' },
  { name: 'Blue Hour', css: 'brightness(.82) contrast(1.1) saturate(1.1)' },
  { name: 'Mono', css: 'grayscale(1) contrast(1.12) brightness(1.03)' },
  { name: 'Golden Hour', css: 'saturate(1.1) brightness(1.02)' },
];

const DEFAULT_STATE: StudioState = { look: 0, filter: 0, realism: 75, frame: 'full' };
const LOOK_URLS = LOOKS.map((look) => studioImage(look.file, 1000));
const BG_URL = studioImage('hf_20261112_034551_6394b127-5366-40a8-9c82-3c416f1161f1.png', 2400);

export const VirtualStudio: React.FC<VirtualStudioProps> = ({ shopName, currencySymbol, products }) => {
  const [scene, setScene] = useState<StudioState>(DEFAULT_STATE);
  const [history, setHistory] = useState<StudioState[]>([DEFAULT_STATE]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [category, setCategory] = useState('All');
  const [activePanel, setActivePanel] = useState<'looks' | 'collection'>('looks');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [selfie, setSelfie] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [photoMessage, setPhotoMessage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestChange = useRef(0);

  useEffect(() => {
    const images = LOOK_URLS.map((src) => {
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
  }, []);

  useEffect(() => {
    if (!cameraOpen) return;
    let active = true;
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera capture is unavailable in this browser. You can choose a selfie photo instead.');
      return () => { active = false; };
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      })
      .catch(() => {
        if (active) setCameraError('Camera permission was not granted. Choose a selfie image from your device.');
      });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

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

  const openCamera = () => {
    setPhotoMessage('');
    setCameraOpen(true);
  };

  const closeCamera = () => {
    setCameraOpen(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const captureSelfie = () => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setSelfie(canvas.toDataURL('image/jpeg', 0.86));
    setPhotoMessage('Selfie saved on this device. Photo-based outfit generation needs an AI service.');
    closeCamera();
  };

  const loadSelfieFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoMessage('Choose an image file for your selfie.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelfie(reader.result);
        setPhotoMessage('Selfie saved on this device. Photo-based outfit generation needs an AI service.');
        closeCamera();
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
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

  const categories = ['All', 'Everyday', 'Athletic', 'Sleep', 'Formal', 'Party', 'Street'];
  const visibleLooks = LOOKS.map((look, index) => ({ ...look, index }))
    .filter((look) => category === 'All' || look.category === category);
  const visibleProducts = products.filter((product) =>
    product.image && !product.image.startsWith('data:')
  );

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
          <div className="vs-header-actions">
            <button type="button" className="vs-camera-button" onClick={openCamera} aria-label="Take a selfie">
              <span aria-hidden="true">◎</span><span>{selfie ? 'Retake selfie' : 'Camera selfie'}</span>
            </button>
            <input ref={fileInputRef} className="vs-file-input" type="file" accept="image/*" capture="user" onChange={loadSelfieFile} />
            <button type="button" className="vs-upload-button" onClick={() => fileInputRef.current?.click()}>Upload photo</button>
          </div>
        </header>

        <div className="vs-stage">
          <div className="vs-profile">
            <div className="vs-avatar">
              <img src={selfie || LOOK_URLS[scene.look]} alt={selfie ? 'Your saved selfie' : LOOKS[scene.look].name + ' model'} />
            </div>
            <div className="vs-profile-copy">
              <span className="vs-eyebrow">{selfie ? 'SELFIE CAPTURED' : 'STYLE PREVIEW'}</span>
              <strong>{selfie ? 'Your photo is ready' : LOOKS[scene.look].name}</strong>
              <span>{selfie ? 'Stored on this device only' : 'Select a look to preview'}</span>
            </div>
            {selfie && <button type="button" className="vs-clear-selfie" onClick={() => { setSelfie(''); setPhotoMessage(''); }} aria-label="Remove selfie">×</button>}
          </div>

          <div className={'vs-model-frame ' + scene.frame} style={{ filter: FILTERS[scene.filter].css + ' saturate(' + (0.65 + scene.realism / 200) + ')' }}>
            <img
              key={LOOKS[scene.look].file}
              className="vs-model-image"
              src={LOOK_URLS[scene.look]}
              alt={LOOKS[scene.look].name + ' outfit on the studio model'}
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
                    <button key={item} type="button" className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>
                  ))}
                </div>
                <div className="vs-look-grid">
                  {visibleLooks.map((look) => (
                    <article key={look.index} className={'vs-look-card ' + (scene.look === look.index ? 'selected' : '')}>
                      <button type="button" className="vs-look-select" onClick={() => chooseLook(look.index)} aria-label={'Preview ' + look.name}>
                        <img src={studioImage(LOOKS[look.index].file, 360)} alt="" loading="lazy" />
                        <span>{look.name}</span>
                        <i>{look.category}</i>
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
                  <strong>{LOOKS[scene.look].name}</strong>
                  <span>Choose a look above. Your shop’s products and accessories are available in My collection.</span>
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

          {selfie && (
            <div className="vs-tryon-notice" role="status">
              <strong>Your selfie is ready</strong>
              <span>AI outfit generation isn’t connected yet. The studio preview still shows the selected look on its model.</span>
              <button type="button" onClick={() => setPhotoMessage('Your selfie stays on this device until you remove it.')}>Privacy details</button>
            </div>
          )}

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
        <p className="vs-photo-note">{photoMessage || 'Camera selfies stay in this browser. To generate your face wearing selected clothes, connect an AI try-on service.'}</p>
      </div>

      {cameraOpen && (
        <div className="vs-camera-modal" role="dialog" aria-modal="true" aria-label="Take a selfie">
          <div className="vs-camera-card">
            <div className="vs-camera-heading"><div><span className="vs-eyebrow">CAMERA</span><h2>Take a selfie</h2></div><button type="button" onClick={closeCamera} aria-label="Close camera">×</button></div>
            {cameraError ? <p className="vs-camera-error">{cameraError}</p> : <video ref={videoRef} autoPlay playsInline muted />}
            <canvas ref={captureCanvasRef} className="vs-hidden-canvas" />
            <div className="vs-camera-actions">
              <button type="button" onClick={() => fileInputRef.current?.click()}>Choose photo</button>
              <button type="button" className="primary" onClick={captureSelfie} disabled={Boolean(cameraError)}>Capture selfie</button>
            </div>
            <p>Your selfie is kept in this browser and is not uploaded.</p>
          </div>
        </div>
      )}
    </section>
  );
};
