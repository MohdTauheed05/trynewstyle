import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../services/scrollLock';
import { SlipOrder, barcodeBars, renderSlipPng } from '../services/slipImage';
import { ProductThumb } from './ProductThumb';

interface OrderSlipProps {
  order: SlipOrder;
  onClose: () => void;
  onResendWhatsApp: () => void;
  onClearCart: () => void;
}

const STARS = '*'.repeat(34);

/**
 * Receipt-style order slip. Slides out of a printer slot, then the picked
 * products, prices and barcode "print" in one after another.
 */
export const OrderSlip: React.FC<OrderSlipProps> = ({
  order,
  onClose,
  onResendWhatsApp,
  onClearCart,
}) => {
  useScrollLock(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const shown = order.items.slice(0, 4);
  const bars = barcodeBars(order.orderId);

  const getPng = async () => {
    setBusy(true);
    try {
      return await renderSlipPng(order);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const blob = await getPng();
    if (!blob) {
      setNote('Could not create the image. Please take a screenshot instead.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-slip-${order.orderId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setNote('Slip saved — attach it in your WhatsApp chat.');
  };

  const handleShare = async () => {
    const blob = await getPng();
    if (!blob) {
      setNote('Could not create the image. Please take a screenshot instead.');
      return;
    }
    const file = new File([blob], `order-slip-${order.orderId}.png`, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: `Order ${order.orderId}` });
        return;
      } catch {
        /* user cancelled */
        return;
      }
    }
    handleSave();
  };

  const canShareFiles =
    typeof navigator !== 'undefined' && typeof (navigator as any).canShare === 'function';

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
            onClick={onResendWhatsApp}
            className="w-full h-11 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-sm tracking-wide cursor-pointer transition-colors"
          >
            Open WhatsApp again
          </button>
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={handleSave}
              className="flex-1 h-10 bg-white text-[#111] text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-neutral-200 transition-colors disabled:opacity-60"
            >
              {busy ? 'Preparing…' : 'Save slip (PNG)'}
            </button>
            {canShareFiles && (
              <button
                type="button"
                disabled={busy}
                onClick={handleShare}
                className="flex-1 h-10 border border-white/70 text-white text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-white/15 transition-colors disabled:opacity-60"
              >
                Share slip
              </button>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border border-white/40 text-white/90 text-xs uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClearCart();
                onClose();
              }}
              className="flex-1 h-10 border border-white/40 text-white/90 text-xs uppercase tracking-wider cursor-pointer hover:bg-white/10 transition-colors"
            >
              Clear cart
            </button>
          </div>
          {note && <p className="text-center text-[11px] text-white/85">{note}</p>}
        </div>
      </div>
    </div>,
    document.body
  );
};
