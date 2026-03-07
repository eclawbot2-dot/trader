const origExit = process.exit;
(process as any).exit = function(code: number) {
  console.error('>>> PROCESS.EXIT CALLED WITH CODE:', code);
  console.error(new Error('exit stack trace').stack);
  origExit(code);
};
process.on('exit', (code) => { console.error('>>> PROCESS EXIT EVENT, code:', code); });
process.on('uncaughtException', (e) => { console.error('>>> UNCAUGHT EXCEPTION:', e); });
process.on('unhandledRejection', (e) => { console.error('>>> UNHANDLED REJECTION:', e); });
import('./src/index.ts');
