import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

let io: Server | null = null;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: '*' },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    console.log('[WebSocket] Cliente conectado:', socket.id);
    socket.on('join_conversation', (conversacionId: number) => {
      const room = `conversation:${conversacionId}`;
      socket.join(room);
      console.log('[WebSocket] Cliente', socket.id, 'unido a', room);
    });

    socket.on('leave_conversation', (conversacionId: number) => {
      socket.leave(`conversation:${conversacionId}`);
    });

    socket.on('join_crm', () => {
      socket.join('crm');
    });

    // Indicador "está escribiendo": reenviar a la sala para que el otro lado lo vea en tiempo real
    socket.on('typing', (data: { conversacionId: number; quien: 'contacto' | 'agente'; username?: string }) => {
      const { conversacionId, quien, username } = data || {};
      if (conversacionId) {
        socket.to(`conversation:${conversacionId}`).emit('user_typing', { quien, username });
      }
    });

    socket.on('typing_stop', (data: { conversacionId: number }) => {
      const conversacionId = data?.conversacionId;
      if (conversacionId) {
        socket.to(`conversation:${conversacionId}`).emit('user_typing_stop');
      }
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}
