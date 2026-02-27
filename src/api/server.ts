import express from 'express';
import { createServer, Server } from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config.js';
import { Db } from '../db/queries.js';
import { AnalyticsEngine } from '../analytics/engine.js';
import { registerRoutes } from './routes.js';
import { attachWs } from './ws-handler.js';

function resolveFrontendDistDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(here, '../../frontend/dist'),
    path.resolve(here, '../../../frontend/dist'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) return candidate;
  }

  return path.resolve(process.cwd(), 'frontend/dist');
}

const API_PREFIXES = ['/health', '/positions', '/trades', '/balance', '/pnl', '/analytics', '/dashboard', '/ws'];

export function startApi(db: Db, analytics: AnalyticsEngine): { app: express.Express; server: Server } {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  registerRoutes(app, db, analytics);

  if (process.env.NODE_ENV === 'production') {
    const frontendDistDir = resolveFrontendDistDir();
    app.use(express.static(frontendDistDir, { index: 'index.html', maxAge: '5m' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendDistDir, 'index.html'));
    });
  } else {
    const viteTarget = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173';
    app.use(
      '/',
      createProxyMiddleware({
        target: viteTarget,
        changeOrigin: true,
        ws: true,
        pathFilter: (pathname) => !API_PREFIXES.some((p) => pathname.startsWith(p)),
      }),
    );
  }

  const server = createServer(app);
  attachWs(server, config.app.wsPath);
  server.listen(config.app.port, '0.0.0.0');

  return { app, server };
}
