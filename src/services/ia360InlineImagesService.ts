/**
 * Descarga imágenes Notion/S3 para la respuesta JSON del chat (data URIs).
 * En BD no se persisten URLs ni base64: usar stripMarkdownImages sobre el markdown del modelo.
 */
function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function readEnvInt(name: string, defaultVal: number, lo: number, hi: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return defaultVal;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return defaultVal;
  return clampInt(n, lo, hi);
}

function serverLogIa360Images(): boolean {
  const v = process.env.IA360_LOG_IMAGES?.trim().toLowerCase();
  return v === 'true' || v === '1';
}

export function isIa360InlineImagesHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h.endsWith('.amazonaws.com') ||
    h.endsWith('notion.so') ||
    h.endsWith('notion.site') ||
    h === 'notionusercontent.com' ||
    h.endsWith('notionusercontent.com') ||
    h.endsWith('.notion-static.com') ||
    h === 'notion-static.com' ||
    h.endsWith('.cloudfront.net')
  );
}

interface ImgMatch {
  start: number;
  end: number;
  alt: string;
  url: string;
}

function findMarkdownHttpsImages(markdown: string): ImgMatch[] {
  const raw: ImgMatch[] = [];
  const reA = /!\[([^\]]*)\]\(<(https:\/\/[^>\s]+)>\)/g;
  let m: RegExpExecArray | null;
  while ((m = reA.exec(markdown)) !== null) {
    raw.push({
      start: m.index,
      end: m.index + m[0].length,
      alt: m[1],
      url: m[2],
    });
  }
  const reP = /!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)/g;
  while ((m = reP.exec(markdown)) !== null) {
    if (m[2].startsWith('data:')) continue;
    const start = m.index;
    const end = m.index + m[0].length;
    if (raw.some((x) => !(end <= x.start || start >= x.end))) continue;
    raw.push({ start, end, alt: m[1], url: m[2] });
  }
  raw.sort((a, b) => a.start - b.start);
  const out: ImgMatch[] = [];
  for (const x of raw) {
    if (out.some((y) => !(x.end <= y.start || x.start >= y.end))) continue;
    out.push(x);
  }
  return out;
}

async function fetchImageAsDataUri(urlStr: string, maxBytes: number): Promise<string | null> {
  const attempts: Array<Record<string, string>> = [
    {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://www.notion.so/',
    },
    {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'image/*,*/*;q=0.8',
      Referer: 'https://notion.so/',
    },
    {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'image/*,*/*;q=0.8',
    },
  ];

  let r: Response | null = null;
  for (const headers of attempts) {
    r = await fetch(urlStr, {
      redirect: 'follow',
      headers,
      signal: AbortSignal.timeout(45_000),
    });
    if (r.ok) break;
    if (r.status !== 403 && r.status !== 401) break;
  }

  if (!r?.ok) {
    console.warn('[ia360-inline-images] upstream', r?.status ?? 0, urlStr.slice(0, 100));
    return null;
  }

  const ab = await r.arrayBuffer();
  if (ab.byteLength > maxBytes) {
    console.warn('[ia360-inline-images] omitida por tamaño', ab.byteLength, urlStr.slice(0, 80));
    return null;
  }

  const ctRaw = r.headers.get('content-type') || 'application/octet-stream';
  const ct = ctRaw.split(';')[0].trim().toLowerCase();
  if (!ct.startsWith('image/')) {
    console.warn('[ia360-inline-images] content-type no imagen', ct, urlStr.slice(0, 80));
    return null;
  }

  const buf = Buffer.from(ab);
  return `data:${ct};base64,${buf.toString('base64')}`;
}

/**
 * Sustituye `![alt](url https)` de hosts Notion/S3 por `![alt](data:image/...;base64,...)` cuando la descarga tiene éxito.
 * Desactivar: IA360_INLINE_IMAGES=false
 */
export async function inlineNotionImagesInMarkdown(markdown: string): Promise<string> {
  const off = process.env.IA360_INLINE_IMAGES?.trim().toLowerCase();
  if (off === '0' || off === 'false' || off === 'no') return markdown;

  const maxPerImg = readEnvInt('IA360_INLINE_IMAGE_MAX_BYTES', 900_000, 20_000, 8_000_000);
  const maxTotal = readEnvInt('IA360_INLINE_IMAGE_MAX_TOTAL_BYTES', 8_000_000, 200_000, 40_000_000);
  const maxCount = readEnvInt('IA360_INLINE_IMAGE_MAX_COUNT', 24, 1, 80);

  const matches = findMarkdownHttpsImages(markdown);
  if (!matches.length) return markdown;

  if (serverLogIa360Images()) {
    console.info(
      '[IA360 imagen][servidor] inlining: el modelo incluyó %d imagen(es) con URL https',
      matches.length,
    );
    matches.forEach((hit, i) => {
      console.info('[IA360 imagen][servidor]   link [%d/%d]: %s', i + 1, matches.length, hit.url);
    });
  }

  let totalRawBytes = 0;
  let fetchCount = 0;
  const cache = new Map<string, string | null>();

  async function resolve(url: string): Promise<string | null> {
    if (cache.has(url)) return cache.get(url)!;
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') {
        cache.set(url, null);
        return null;
      }
      if (!isIa360InlineImagesHost(u.hostname)) {
        cache.set(url, null);
        return null;
      }
    } catch {
      cache.set(url, null);
      return null;
    }

    if (fetchCount >= maxCount) {
      cache.set(url, null);
      return null;
    }

    if (serverLogIa360Images()) {
      console.info('[IA360 imagen][servidor] descargando imagen — link:', url);
    }

    const dataUri = await fetchImageAsDataUri(url, maxPerImg);
    if (!dataUri) {
      if (serverLogIa360Images()) {
        console.warn('[IA360 imagen][servidor] descarga falló — link:', url);
      }
      cache.set(url, null);
      return null;
    }

    const approxRaw = Math.floor((dataUri.length * 3) / 4);
    if (totalRawBytes + approxRaw > maxTotal) {
      console.warn('[ia360-inline-images] límite total alcanzado, se mantiene URL', url.slice(0, 80));
      cache.set(url, null);
      return null;
    }

    totalRawBytes += approxRaw;
    fetchCount++;
    cache.set(url, dataUri);
    if (serverLogIa360Images()) {
      console.info(
        '[IA360 imagen][servidor] inline OK — link: %s → ~%d bytes (data URI)',
        url,
        approxRaw,
      );
    }
    return dataUri;
  }

  let out = '';
  let last = 0;
  for (const hit of matches) {
    out += markdown.slice(last, hit.start);
    let replacement = markdown.slice(hit.start, hit.end);
    try {
      const dataUri = await resolve(hit.url);
      if (dataUri) {
        replacement = `![${hit.alt}](${dataUri})`;
      }
    } catch (e) {
      console.warn('[ia360-inline-images] error en sustitución', e);
    }
    out += replacement;
    last = hit.end;
  }
  out += markdown.slice(last);
  return out;
}

/**
 * Quita del markdown todas las imágenes (https y data:) para no persistir rutas ni base64 en BD.
 */
export function stripMarkdownImages(markdown: string): string {
  let t = markdown;
  t = t.replace(/!\[[^\]]*\]\(<https?:\/\/[^>\s]+>\)/gi, '');
  t = t.replace(/!\[[^\]]*\]\(https?:\/\/[^)\s\n]+\)/gi, '');
  t = t.replace(/!\[[^\]]*\]\(<data:image\/[^>]+>\)/gi, '');
  t = t.replace(/!\[[^\]]*\]\(data:image\/[^)\s]+\)/gi, '');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}
