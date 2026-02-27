import { EventEmitter } from 'node:events';

export type BusEvents = {
  'market:price': [{ marketId: string; outcome: string; price: number; ts: number }];
  'market:model': [{ marketId: string; outcome: string; probability: number; league?: string; team?: string; ts: number }];
  'edge:signal': [{ marketId: string; outcome: string; edge: number; kelly: number; suggestedSize: number; price: number; probability: number; ts: number }];
  'trade:executed': [{ marketId: string; outcome: string; side: 'BUY' | 'SELL'; price: number; size: number; txHash?: string; edge: number; kelly: number; ts: number }];
  'chain:transfer': [{ token: string; from: string; to: string; value: string; txHash: string; ts: number }];
  'chain:marketResolved': [{ marketId: string; winningOutcome: string; ts: number }];
  'risk:alert': [{ type: string; message: string; value: number; threshold: number; ts: number }];
  'system:error': [{ module: string; error: string; ts: number }];
};

class TypedEmitter extends EventEmitter {
  on<K extends keyof BusEvents>(event: K, listener: (...args: BusEvents[K]) => void): this {
    return super.on(event as string, listener);
  }
  emit<K extends keyof BusEvents>(event: K, ...args: BusEvents[K]): boolean {
    return super.emit(event as string, ...args);
  }
}

export const bus = new TypedEmitter();
