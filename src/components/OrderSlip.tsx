import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../services/scrollLock';
import { SlipOrder, barcodeBars, renderSlipPng } from '../services/slipImage';
import { ProductThumb } from './ProductThumb';

interface OrderSlipProps {
  order: SlipOrder;
  whatsappNumber: string;
  onClose: () => void;
  onClearCart: () => void;
}

const STARS = '*'.repeat(34);

/**
 * Receipt-style order slip. Slides out of a printer slot, then the picked
 * products, prices and barcode "print" in one after another.
 */
export const OrderSlip: React.FC<OrderSlipProps> = ({
  order,
  whatsappNumber,
  onClose,
  onClearCart,
}) => {
  useScrollLock(true);
  const [note, setNote] = useState('');
  const [png, setPng] = useState<Blob | null>(null);
  const [pngFailed, setPngFailed] = useState(false);
  const orderRef = useRef(order);

  const shown = order.items.slice(0, 4);
  const bars = barcodeBars(order.orderId);

  // Render the slip image once, in the background, so the WhatsApp button
  // can react instantly (browsers only allow share/clipboard on a direct tap).
  useEffect(() => {
    let alive = true;
    renderSlipPng(orderRef.current)
      .then((b) => {
        if (!alive) return;
        if (b) setPng(b);
        else setPngFailed(true);
      })
      .catch(() => alive && setPngFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const fileName = `order-slip-${order.orderId}.png`;
  const toShareableProductUrl = (url?: string) => {
    if (!url || url === '#') return '';
    if (url.startsWith('#')) return `${window.location.origin}${window.location.pathname}${url}`;
    return url;
  };
  const caption = [
    `🧾 *Order ${order.orderId}* - ${order.shopName}`,
    order.customerName ? `👤 ${order.customerName}` : '',
    ...order.items.map((it) => {
      const details = `• ${it.quantity}x ${it.name} (${it.size}) - ${order.currencyText(it.price * it.quantity)}`;
      return it.url ? `${details}\n  ${it.url}` : details;
    }),
    `💰 *Total: ${order.currencyText(order.total)}*`,
    order.notes ? `📍 ${order.notes}` : '',
    order.shareUrl ? `🔗 View order and product photos: ${order.shareUrl}` : '',
    '',
    '(Open the order link above to view item photos.)',
  ]
    .filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n');

  const downloadPng = () => {
    if (!png) return false;
    const url = URL.createObjectURL(png);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  };

  const handleSave = () => {
    if (downloadPng()) setNote('Slip image saved to your device.');
    else setNote('Slip image is not ready. Please take a screenshot instead.');
  };

  /**
   * Opens the SHOP OWNER's WhatsApp chat directly (number from Admin settings).
   * A website cannot attach a picture to a chosen chat by itself, so the slip
   * image is copied to the clipboard (or saved) for the customer to paste/attach.
   */
  const handleOrderWhatsApp = async () => {
    const cleanPhone = (whatsappNumber || '').replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      setNote('The shop WhatsApp number is not set. Please save it in Admin settings.');
      return;
    }

    // wa.me opens the chat for this exact owner number and pre-fills the order,
    // product links, and shareable order page on both desktop and mobile.
    const chatUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(caption)}`;
    let clipboardJob: Promise<boolean> = Promise.resolve(false);
    try {
      const CI = (window as any).ClipboardItem;
      if (png && CI && navigator.clipboard?.write) {
        clipboardJob = navigator.clipboard
          .write([new CI({ 'image/png': png })])
          .then(() => true)
          .catch(() => false);
      }
    } catch {
      clipboardJob = Promise.resolve(false);
    }

    // Open synchronously from the tap so mobile browsers do not block the chat.
    const win = window.open(chatUrl, '_blank');
    if (!win) window.location.href = chatUrl;

    const copied = await clipboardJob;
    if (copied) {
      setNote('Owner chat opened with the order and product links. Paste the copied slip photo in the chat, then tap Send.');
    } else if (downloadPng()) {
      setNote('Owner chat opened with the order and product links. Attach the saved slip photo in the chat, then tap Send.');
    } else {
      setNote('Owner chat opened with the order and product links. Save or screenshot the slip photo and attach it in the chat.');
    }
  };

  const handleShareSlipPhoto = async () => {
    if (!png) {
      setNote('Slip image is not ready yet.');
      return;
    }
    const slipFile = new File([png], fileName, { type: 'image/png' });
    if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [slipFile] })) {
      try {
        await navigator.share({ files: [slipFile], title: `Order ${order.orderId} - ${order.shopName}` });
        setNote('Choose a contact or app to share the slip photo.');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    handleSave();
  };

  return createPortal(
    <div
      className="slip-overlay fixed inset-0 z-[10000] overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label={`Order slip ${order.orderId}`}
    >
      <div className="min-h-full flex flex-col items-center px-4 pt-6 pb-10">
        {/* Printer */}
        <div className="slip-printer relative z-20 w-[min(400px,92vw)] h-[46px] rounded-[14px] bg-gradient-to-b from-white to-[#e9ebe4] shadow-[0_10px_24px_rgba(0,0,0,0.35)] flex items-center justify-between px-5">
          <div className="flex-1 h-[7px] rounded-full bg-[#1b1b1b] mx-0 shadow-inner" />
          <span className="slip-led ml-4 w-2.5 h-2.5 rounded-full bg-[#7ddf5a]" />
        </div>

        {/* Paper feed window */}
        <div className="slip-feed relative z-10 -mt-3 w-[min(340px,86vw)] overflow-hidden pb-4">
          <article className="slip-paper relative bg-[#fffef8] text-[#111] px-6 pt-8 pb-10 font-['Space_Mono',monospace] shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
            <h2 className="slip-line text-center font-bold uppercase text-[13px] tracking-[0.08em] leading-snug" style={{ ['--d' as any]: '1.6s' }}>
              {order.shopName} · Order Slip
            </h2>
            <p className="slip-line text-center text-[11px] mt-2 overflow-hidden whitespace-nowrap" style={{ ['--d' as any]: '1.75s' }}>
              {STARS}
            </p>

            <div className="slip-line mt-3 text-[10.5px] leading-[1.6]" style={{ ['--d' as any]: '1.9s' }}>
              <div>ORDER&nbsp; {order.orderId}</div>
              <div>DATE&nbsp;&nbsp; {order.date}</div>
              {order.customerName && <div>NAME&nbsp;&nbsp; {order.customerName}</div>}
            </div>

            {/* Collage of the actual selected products */}
            <div className="relative mt-4">
              <span
                className="slip-note absolute -top-1 left-0 text-[#2f45b8] -rotate-6 text-[17px] leading-none z-10"
                style={{ fontFamily: "'Caveat', cursive", ['--d' as any]: '3.4s' }}
              >
                your picks!
              </span>
              <span className="slip-spark absolute top-0 right-6 text-[#2f45b8] text-[22px] leading-none z-10" style={{ ['--d' as any]: '3.6s' }}>
                ✳
              </span>
              <div className={`grid gap-3 pt-5 ${shown.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {shown.map((it, i) => (
                  <div
                    key={`${it.id}-${i}`}
                    className="slip-pop flex flex-col items-center"
                    style={{ ['--d' as any]: `${2.1 + i * 0.35}s` }}
                  >
                    <div className="w-full h-[120px] flex items-center justify-center">
                      <ProductThumb item={it} className="w-full h-full" />
                    </div>
                    <span className="mt-1 text-[10px] font-bold bg-[#111] text-white px-1.5 py-[1px]">
                      {order.currencyText(it.price)}
                    </span>
                  </div>
                ))}
              </div>
              {order.items.length > shown.length && (
                <p className="text-center text-[10px] mt-2 text-[#555]">
                  + {order.items.length - shown.length} more item(s) below
                </p>
              )}
            </div>

            <p className="slip-line text-center text-[11px] mt-4 overflow-hidden whitespace-nowrap" style={{ ['--d' as any]: '3.6s' }}>
              {STARS}
            </p>

            {/* Line items */}
            <ul className="mt-3 space-y-2.5">
              {order.items.map((it, i) => (
                <li
                  key={`${it.id}-line-${i}`}
                  className="slip-line text-[11.5px] leading-snug"
                  style={{ ['--d' as any]: `${3.8 + i * 0.25}s` }}
                >
                  <div className="flex justify-between gap-3 font-bold">
                    <span className="break-words min-w-0">
                      {it.quantity}x {it.name}
                    </span>
                    <span className="shrink-0">{order.currencyText(it.price * it.quantity)}</span>
                  </div>
                  <div className="text-[10.5px] text-[#555]">&nbsp;&nbsp;&nbsp;size {it.size}</div>
                </li>
              ))}
            </ul>

            {order.notes && (
              <p className="slip-line mt-3 text-[10.5px] text-[#555] break-words" style={{ ['--d' as any]: `${4 + order.items.length * 0.25}s` }}>
                NOTE: {order.notes}
              </p>
            )}

            <p className="slip-line text-center text-[11px] mt-3 overflow-hidden whitespace-nowrap" style={{ ['--d' as any]: `${4.1 + order.items.length * 0.25}s` }}>
              {STARS}
            </p>

            <div
              className="slip-line mt-3 flex justify-between font-bold text-[14px]"
              style={{ ['--d' as any]: `${4.3 + order.items.length * 0.25}s` }}
            >
              <span>TOTAL</span>
              <span>{order.currencyText(order.total)}</span>
            </div>

            <div
              className="slip-line mt-6 flex items-end justify-between gap-3"
              style={{ ['--d' as any]: `${4.6 + order.items.length * 0.25}s` }}
            >
              <div className="text-[9px] uppercase leading-[1.4] tracking-wide">
                Ordered
                <br />
                via WhatsApp
                <br />
                Thank you
              </div>
              <div className="flex items-end h-[44px]" aria-hidden="true">
                {bars.map((w, i) => (
                  <span
                    key={i}
                    className="slip-bar block bg-[#111]"
                    style={{
                      width: `${w * 0.9}px`,
                      marginRight: '1.2px',
                      height: i % 2 === 0 ? '100%' : '0',
                      animationDelay: `${4.6 + order.items.length * 0.25 + i * 0.02}s`,
                    }}
                  />
                ))}
              </div>
            </div>

            <p
              className="slip-line text-center font-bold text-[14px] mt-6 tracking-wide"
              style={{ ['--d' as any]: `${5.2 + order.items.length * 0.25}s` }}
            >
              THANK YOU!
            </p>

            <span className="slip-torn" aria-hidden="true" />
          </article>
        </div>

        {/* Actions */}
        <div className="slip-actions relative z-20 mt-6 w-[min(340px,86vw)] flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleOrderWhatsApp}
            disabled={!png && !pngFailed}
            className="w-full h-12 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.072.376-.043.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.392-12.416c-5.523 0-10 4.477-10 10 0 1.765.459 3.424 1.261 4.869l-1.261 4.606 4.71-1.236c1.396.762 2.996 1.192 4.69 1.192 5.524 0 10-4.477 10-10s-4.476-10-10-10z" />
            </svg>
            <span>{!png && !pngFailed ? 'Preparing slip…' : 'Open owner’s WhatsApp'}</span>
          </button>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 h-10 bg-white text-[#111] text-[10px] font-semibold uppercase tracking-wide cursor-pointer hover:bg-neutral-200 transition-colors"
            >
              Save PNG
            </button>
            <button
              type="button"
              onClick={handleShareSlipPhoto}
              disabled={!png}
              className="flex-1 h-10 bg-white text-[#111] text-[10px] font-semibold uppercase tracking-wide cursor-pointer hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              Share photo
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border border-white/60 text-white text-[10px] font-semibold uppercase tracking-wide cursor-pointer hover:bg-white/15 transition-colors"
            >
              Close
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              onClearCart();
              onClose();
            }}
            className="w-full h-9 border border-white/30 text-white/85 text-[11px] uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors"
          >
            Clear cart
          </button>
          {note && <p className="text-center text-[11px] leading-snug text-white/90">{note}</p>}
        </div>
      </div>
    </div>,
    document.body
  );
};
