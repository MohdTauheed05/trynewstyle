import { BagItem } from '../types';

export interface SlipOrder {
  orderId: string;
  date: string;
  shopName: string;
  customerName?: string;
  notes?: string;
  items: BagItem[];
  total: number;
  currencyText: (n: number) => string;
}

/** Deterministic barcode pattern from the order id (shared by on-screen + PNG slip). */
export function barcodeBars(seed: string, count = 46): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    bars.push(1 + (Math.abs(h) % 4)); // 1..4 px units
  }
  return bars;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = setTimeout(() => resolve(null), 5000);
    img.onload = () => {
      clearTimeout(t);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(t);
      resolve(null);
    };
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws the slip to a PNG blob (same look as the on-screen slip). */
export async function renderSlipPng(order: SlipOrder): Promise<Blob | null> {
  const S = 2; // retina scale
  const W = 360;
  const PAD = 24;
  const MONO = `'Space Mono', 'Courier New', monospace`;

  const imgs = await Promise.all(order.items.slice(0, 4).map((i) => loadImage(i.image)));

  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `700 12px ${MONO}`;
  const itemLines = order.items.map((it) =>
    wrapText(measure, `${it.quantity}x ${it.name}`, W - PAD * 2 - 90)
  );
  const linesCount = itemLines.reduce((a, l) => a + l.length + 1, 0);

  const collageH = 230;
  const H = 70 + 20 + 62 + collageH + 30 + linesCount * 17 + 110 + 120;

  const draw = async (withImages: boolean): Promise<Blob | null> => {
    const canvas = document.createElement('canvas');
    canvas.width = W * S;
    canvas.height = H * S;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(S, S);

    // paper with torn bottom
    ctx.fillStyle = '#fffef8';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, H - 8);
    for (let x = W; x > 0; x -= 8) {
      ctx.lineTo(x - 4, H);
      ctx.lineTo(x - 8, H - 8);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#111';
    ctx.textBaseline = 'alphabetic';
    let y = 44;

    ctx.font = `700 15px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${order.shopName.toUpperCase()} · ORDER SLIP`.slice(0, 34), W / 2, y);
    y += 20;
    ctx.font = `400 11px ${MONO}`;
    ctx.fillText('*'.repeat(36), W / 2, y);
    y += 20;

    ctx.textAlign = 'left';
    ctx.font = `400 10.5px ${MONO}`;
    ctx.fillText(`ORDER  ${order.orderId}`, PAD, y);
    y += 15;
    ctx.fillText(`DATE   ${order.date}`, PAD, y);
    y += 15;
    if (order.customerName) {
      ctx.fillText(`NAME   ${order.customerName}`.slice(0, 40), PAD, y);
      y += 15;
    }
    y += 8;

    // collage
    const shown = order.items.slice(0, 4);
    const cols = shown.length > 1 ? 2 : 1;
    const cellW = (W - PAD * 2) / cols;
    const rows = Math.ceil(shown.length / cols);
    const cellH = collageH / Math.max(rows, 1);
    shown.forEach((it, i) => {
      const cx = PAD + (i % cols) * cellW;
      const cy = y + Math.floor(i / cols) * cellH;
      const img = withImages ? imgs[i] : null;
      const bw = cellW - 14;
      const bh = cellH - 30;
      if (img) {
        if (it.crop) {
          const c = it.crop;
          const sx = (img.naturalWidth / c.sheetW) * c.x;
          const sy = (img.naturalHeight / c.sheetH) * c.y;
          const sw = (img.naturalWidth / c.sheetW) * c.w;
          const sh = (img.naturalHeight / c.sheetH) * c.h;
          const r = Math.min(bw / sw, bh / sh);
          ctx.drawImage(img, sx, sy, sw, sh, cx + (cellW - sw * r) / 2, cy + (bh - sh * r) / 2, sw * r, sh * r);
        } else {
          const r = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
          const dw = img.naturalWidth * r;
          const dh = img.naturalHeight * r;
          ctx.drawImage(img, cx + (cellW - dw) / 2, cy + (bh - dh) / 2, dw, dh);
        }
      } else {
        ctx.strokeStyle = '#ccc';
        ctx.strokeRect(cx + 7, cy, bw, bh);
      }
      ctx.textAlign = 'center';
      ctx.font = `700 10px ${MONO}`;
      ctx.fillStyle = '#111';
      ctx.fillText(order.currencyText(it.price), cx + cellW / 2, cy + bh + 16);
      ctx.textAlign = 'left';
    });
    y += collageH + 18;

    ctx.font = `400 11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('*'.repeat(36), W / 2, y);
    y += 22;

    // line items
    ctx.textAlign = 'left';
    order.items.forEach((it, idx) => {
      ctx.font = `700 12px ${MONO}`;
      itemLines[idx].forEach((ln, li) => {
        ctx.textAlign = 'left';
        ctx.fillText(ln, PAD, y);
        if (li === 0) {
          ctx.textAlign = 'right';
          ctx.fillText(order.currencyText(it.price * it.quantity), W - PAD, y);
        }
        y += 17;
      });
      ctx.textAlign = 'left';
      ctx.font = `400 10.5px ${MONO}`;
      ctx.fillStyle = '#555';
      ctx.fillText(`   size ${it.size}`, PAD, y);
      ctx.fillStyle = '#111';
      y += 17;
    });

    y += 4;
    ctx.font = `400 11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('*'.repeat(36), W / 2, y);
    y += 24;
    ctx.font = `700 14px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL', PAD, y);
    ctx.textAlign = 'right';
    ctx.fillText(order.currencyText(order.total), W - PAD, y);
    y += 30;

    // tags + barcode
    ctx.textAlign = 'left';
    ctx.font = `400 9px ${MONO}`;
    ['ORDERED', 'VIA WHATSAPP', 'THANK YOU'].forEach((t, i) => ctx.fillText(t, PAD, y + 8 + i * 12));
    const bars = barcodeBars(order.orderId);
    let bx = W - PAD;
    ctx.fillStyle = '#111';
    for (let i = bars.length - 1; i >= 0; i--) {
      const w = bars[i] * 0.9;
      bx -= w + 1.2;
      if (i % 2 === 0) ctx.fillRect(bx, y - 4, w, 44);
    }
    y += 78;
    ctx.textAlign = 'center';
    ctx.font = `700 14px ${MONO}`;
    ctx.fillText('THANK YOU!', W / 2, y);

    return new Promise((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), 'image/png');
      } catch {
        resolve(null);
      }
    });
  };

  try {
    const withImgs = await draw(true);
    if (withImgs) return withImgs;
  } catch {
    /* tainted canvas -> retry without remote images */
  }
  return draw(false);
}
