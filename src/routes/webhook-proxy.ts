/**
 * Proxy para webhooks externos (agente Isa / HGInet).
 * Evita CORS: el widget llama a este backend y el backend reenvía al webhook externo.
 * Variables de entorno opcionales: ISA_REGISTRO_WEBHOOK_URL, ISA_AGENT_WEBHOOK_URL
 * Si el webhook usa HTTPS con certificado autofirmado: WEBHOOK_PROXY_ALLOW_SELF_SIGNED=true (solo ese destino vía https nativo).
 */
import https from 'node:https';
import { URL } from 'node:url';
import { Router, Request, Response } from 'express';

const router = Router();

const REGISTRO_WEBHOOK_URL =
  process.env.ISA_REGISTRO_WEBHOOK_URL ||
  'https://agentehgi.hginet.com.co/webhook/1986379d-e2f5-4eb3-b925-146875342724';
const AGENT_WEBHOOK_URL =
  process.env.ISA_AGENT_WEBHOOK_URL ||
  'https://agentehgi.hginet.com.co/webhook/72919732-5851-4c49-966f-36f638298c88';

const allowSelfSignedWebhook =
  process.env.WEBHOOK_PROXY_ALLOW_SELF_SIGNED === 'true' ||
  process.env.WEBHOOK_PROXY_ALLOW_SELF_SIGNED === '1';

/** POST HTTPS sin verificar cadena TLS (solo si WEBHOOK_PROXY_ALLOW_SELF_SIGNED). */
function postHttpsInsecure(
  targetUrl: string,
  body: string,
  contentType: string,
  accept: string
): Promise<{ status: number; contentType: string; text: string }> {
  const u = new URL(targetUrl);
  return new Promise((resolve, reject) => {
    const opts: https.RequestOptions = {
      hostname: u.hostname,
      port: u.port || 443,
      path: `${u.pathname}${u.search}`,
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': contentType,
        Accept: accept,
        'Content-Length': Buffer.byteLength(body, 'utf8'),
      },
    };
    const req = https.request(opts, (incoming) => {
      const chunks: Buffer[] = [];
      incoming.on('data', (c) => chunks.push(c));
      incoming.on('end', () => {
        const rawCt = incoming.headers['content-type'];
        const ct =
          typeof rawCt === 'string'
            ? rawCt
            : Array.isArray(rawCt)
              ? rawCt[0]
              : 'application/json';
        resolve({
          status: incoming.statusCode ?? 502,
          contentType: ct.split(';')[0].trim() || 'application/json',
          text: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.write(body, 'utf8');
    req.end();
  });
}

async function proxyPost(targetUrl: string, req: Request, res: Response): Promise<void> {
  const bodyStr = JSON.stringify(req.body);
  const contentType = (req.headers['content-type'] as string) || 'application/json';
  const accept = (req.headers['accept'] as string) || 'application/json';

  try {
    if (allowSelfSignedWebhook && targetUrl.startsWith('https://')) {
      const r = await postHttpsInsecure(targetUrl, bodyStr, contentType, accept);
      const outCt = r.contentType.includes('charset') ? r.contentType : `${r.contentType}; charset=utf-8`;
      res.setHeader('Content-Type', outCt);
      res.status(r.status).send(r.text);
      return;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        Accept: accept,
      },
      body: bodyStr,
    });

    const ct = response.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', ct.includes('charset') ? ct : `${ct}; charset=utf-8`);

    const text = await response.text();
    res.status(response.status).send(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[webhook-proxy] Error forwarding request:', detail, err);
    res.status(502).json({
      error: 'Error de proxy',
      message: 'No se pudo conectar con el servicio externo. Reintente más tarde.',
    });
  }
}

/** POST /api/webhook-proxy/registro — reenvía el body al webhook de registro (licencia/NIT/director) */
router.post('/registro', (req, res) => {
  proxyPost(REGISTRO_WEBHOOK_URL, req, res);
});

/** POST /api/webhook-proxy/agent — reenvía el body al webhook del agente (sendMessage) */
router.post('/agent', (req, res) => {
  proxyPost(AGENT_WEBHOOK_URL, req, res);
});

export default router;
