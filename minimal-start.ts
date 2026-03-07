import { config } from './src/config.js';
import { Db } from './src/db/queries.js';
import { AnalyticsEngine } from './src/analytics/engine.js';
import { startApi } from './src/api/server.js';

process.on('uncaughtException', (e) => { console.error('UNCAUGHT:', e); });
process.on('unhandledRejection', (e) => { console.error('REJECTION:', e); });

const db = new Db(config.db.path);
const analytics = new AnalyticsEngine(db);
const { server } = startApi(db, analytics);
console.log('API server started on port', config.app.port);
setInterval(() => { console.log('alive', new Date().toISOString()); }, 10000);
