import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

let io: Server | null = null;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: '*' },
    path: '/socket.io',
    allowEIO3: true,
    allowRequest: (_req, callback) => callback(null, true),
  });

  io.on('connection', (socket) => {
    console.log('[WebSocket] Cliente conectado:', socket.id);
    socket.on('join_conversation', (conversacionId: number) => {
      const room = `conversation:${conversacionId}`;
      socket.join(room);
      console.log('[WebSocket] Cliente', socket.id, 'unido a', room);
    });

    // El agente (CRM) también debe unirse a la sala de la conversación al abrirla.
    // Si el CRM ya emite join_conversation, este evento es redundante pero permite
    // unificar desde el backend por si el front no emite a tiempo.
    socket.on('agent_join_conversation', (conversacionId: number) => {
      const room = `conversation:${conversacionId}`;
      socket.join(room);
      console.log('[WebSocket] Agente unido a', room);
    });

    socket.on('leave_conversation', (conversacionId: number) => {
      socket.leave(`conversation:${conversacionId}`);
    });

    socket.on('join_crm', () => {
      socket.join('crm');
    });

    // El agente se registra con su userId para recibir notificaciones personales
    socket.on('register_agent', (userId: number) => {
      if (userId) {
        socket.join(`agent:${userId}`);
        console.log('[WebSocket] Agente', userId, 'registrado en sala agent:' + userId);
      }
    });

    // Indicador "está escribiendo": reenviar a la sala para que el CRM vea la vista previa en vivo
    socket.on('typing', (data: { conversacionId: number; quien: 'contacto' | 'agente'; username?: string; texto?: string }) => {
      const { conversacionId, quien, username, texto } = data || {};
      const id = conversacionId != null ? Number(conversacionId) : NaN;
      if (!Number.isNaN(id)) {
        const room = `conversation:${id}`;
        socket.to(room).emit('user_typing', { quien, username, texto });
      }
    });

    socket.on('typing_stop', (data: { conversacionId: number }) => {
      const id = data?.conversacionId != null ? Number(data.conversacionId) : NaN;
      if (!Number.isNaN(id)) {
        socket.to(`conversation:${id}`).emit('user_typing_stop');
      }
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}
