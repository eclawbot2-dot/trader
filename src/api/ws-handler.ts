import { WebSocketServer } from 'ws';
import { Server } from 'node:http';
import { bus } from '../notifications/emitter.js';

export function attachWs(server: Server, path: string): WebSocketServer {
  const wss = new WebSocketServer({ server, path });

  function broadcast(type: string, payload: unknown): void {
    const msg = JSON.stringify({ type, payload, ts: Date.now() });
    for (const c of wss.clients) {
      if (c.readyState === c.OPEN) c.send(msg);
    }
  }

  bus.on('market:price', (p) => broadcast('market:price', p));
  bus.on('trade:executed', (t) => broadcast('trade:executed', t));
  bus.on('risk:alert', (a) => broadcast('risk:alert', a));

  return wss;
}
