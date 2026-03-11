/**
 * Proxy para webhooks externos (agente Isa / HGInet).
 * Evita CORS: el widget llama a este backend y el backend reenvía al webhook externo.
 * Variables de entorno opcionales: ISA_REGISTRO_WEBHOOK_URL, ISA_AGENT_WEBHOOK_URL
 */
import { Router, Request, Response } from 'express';

const router = Router();

const REGISTRO_WEBHOOK_URL =
  process.env.ISA_REGISTRO_WEBHOOK_URL ||
  'https://agentehgi.hginet.com.co/webhook/1986379d-e2f5-4eb3-b925-146875342724';
const AGENT_WEBHOOK_URL =
  process.env.ISA_AGENT_WEBHOOK_URL ||
  'https://agentehgi.hginet.com.co/webhook/72919732-5851-4c49-966f-36f638298c88';

async function proxyPost(targetUrl: string, req: Request, res: Response): Promise<void> {
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        Accept: req.headers['accept'] || 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const contentType = response.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', contentType.includes('charset') ? contentType : `${contentType}; charset=utf-8`);

    const text = await response.text();
    res.status(response.status).send(text);
  } catch (err) {
    console.error('[webhook-proxy] Error forwarding request:', err);
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
