/**
 * Almacén de imágenes por petición (misma idea que chatbot_Agente01/utils.py image_store).
 * Al leer Notion se descarga la imagen una vez y el markdown usa ![alt](IMG:0001); el JSON del chat
 * devuelve ia360Images: { "IMG:0001": "data:..." } sin repetir descargas tras la respuesta del modelo.
 */
import { AsyncLocalStorage } from 'async_hooks';

const MAX_BYTES_DEFAULT = 900_000;

interface StoreState {
  counter: number;
  map: Map<string, string>;
}

const als = new AsyncLocalStorage<StoreState>();

async function downloadImageAsDataUri(urlStr: string, maxBytes: number): Promise<string | null> {
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
      signal: AbortSignal.timeout(20_000),
    });
    if (r.ok) break;
    if (r.status !== 403 && r.status !== 401) break;
  }

  if (!r?.ok) {
    console.warn('[ia360-image-store] upstream', r?.status ?? 0, urlStr.slice(0, 100));
    return null;
  }

  const ab = await r.arrayBuffer();
  if (ab.byteLength > maxBytes) {
    console.warn('[ia360-image-store] omitida por tamaño', ab.byteLength, urlStr.slice(0, 80));
    return null;
  }

  const ctRaw = r.headers.get('content-type') || 'application/octet-stream';
  const ct = ctRaw.split(';')[0].trim().toLowerCase();
  if (!ct.startsWith('image/')) {
    console.warn('[ia360-image-store] content-type no imagen', ct, urlStr.slice(0, 80));
    return null;
  }

  const buf = Buffer.from(ab);
  return `data:${ct};base64,${buf.toString('base64')}`;
}

export function runWithIa360ImageStore<T>(fn: () => Promise<T>): Promise<T> {
  return als.run({ counter: 0, map: new Map() }, fn);
}

function getState(): StoreState | undefined {
  return als.getStore();
}

/**
 * Descarga la imagen, guarda data URI en el mapa del request y devuelve la clave IMG:0001.
 * Si falla, guarda la URL https para que el cliente pueda usar proxy (como Agente01).
 */
export async function storeIa360ImageFromUrl(url: string): Promise<string> {
  const st = getState();
  if (!st) {
    throw new Error('ia360ImageStore: no hay contexto AsyncLocalStorage (runWithIa360ImageStore)');
  }
  st.counter += 1;
  const key = `IMG:${String(st.counter).padStart(4, '0')}`;
  const dataUri = await downloadImageAsDataUri(url.trim(), MAX_BYTES_DEFAULT);
  st.map.set(key, dataUri ?? url);
  return key;
}

/** Serializa el mapa para el JSON del cliente (solo dentro del mismo async que runWithIa360ImageStore). */
export function getIa360ImagesPayload(): Record<string, string> {
  const st = getState();
  if (!st) return {};
  return Object.fromEntries(st.map);
}

/** Indica si hay contexto de almacén activo (p. ej. get_page_content usa placeholders). */
export function isIa360ImageStoreActive(): boolean {
  return getState() !== undefined;
}
