export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawUrl = typeof req.query?.url === 'string' ? req.query.url : '';
  let source: URL;
  try {
    source = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid TikTok URL' });
  }

  const host = source.hostname.replace(/^www\./i, '').toLowerCase();
  if (!(host === 'tiktok.com' || host.endsWith('.tiktok.com'))) {
    return res.status(400).json({ error: 'Only TikTok links can be resolved' });
  }

  const getVideoId = (candidate: string) => {
    try {
      const parsed = new URL(candidate);
      return parsed.pathname.match(/\/video\/(\d+)/)?.[1] || '';
    } catch {
      return '';
    }
  };

  try {
    const response = await fetch(source.href, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TryTheLookReel/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    let videoId = getVideoId(response.url);

    if (!videoId) {
      const html = await response.text();
      const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1];
      videoId = getVideoId(canonical || '');
      if (!videoId) videoId = html.match(/"videoId"\s*:\s*"?(\d{15,})"?/)?.[1] || '';
      if (!videoId) videoId = html.match(/"id"\s*:\s*"?(\d{15,})"?/)?.[1] || '';
    }

    if (!videoId) return res.status(422).json({ error: 'Could not find the TikTok video ID. Use the full TikTok video URL or a direct MP4 URL.' });
    return res.status(200).json({
      videoId,
      embedUrl: 'https://www.tiktok.com/player/v1/' + videoId + '?music_info=1&description=1',
    });
  } catch {
    return res.status(422).json({ error: 'TikTok could not resolve this share link. Use a full TikTok video URL or a direct MP4 URL.' });
  }
}
