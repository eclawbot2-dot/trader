import { WebSocketProvider, Contract, formatUnits } from 'ethers';
import { config } from '../config.js';
import { bus } from '../notifications/emitter.js';
import { logger } from '../utils/logger.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
const ERC20_TRANSFER_ABI = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
const CTF_RESOLVE_ABI = ['event ConditionResolution(bytes32 indexed conditionId, bytes32 indexed questionId, uint256[] payoutNumerators)'];
export class ChainMonitor {
    provider = new WebSocketProvider(config.chain.rpc.replace('https://', 'wss://'));
    breaker = new CircuitBreaker(5, 20000);
    start() {
        const usdc = new Contract(config.chain.contracts.USDC_E, ERC20_TRANSFER_ABI, this.provider);
        const ctf = new Contract(config.chain.contracts.CTF, [...ERC20_TRANSFER_ABI, ...CTF_RESOLVE_ABI], this.provider);
        usdc.on('Transfer', (from, to, value, ev) => {
            if (!this.breaker.canExecute())
                return;
            bus.emit('chain:transfer', { token: 'USDC', from, to, value: formatUnits(value, 6), txHash: ev.log.transactionHash, ts: Date.now() });
        });
        ctf.on('Transfer', (from, to, value, ev) => {
            if (!this.breaker.canExecute())
                return;
            bus.emit('chain:transfer', { token: 'CTF', from, to, value: value.toString(), txHash: ev.log.transactionHash, ts: Date.now() });
        });
        ctf.on('ConditionResolution', (conditionId, _q, payoutNumerators) => {
            const winningOutcome = payoutNumerators.findIndex((v) => v > 0n).toString();
            bus.emit('chain:marketResolved', { marketId: conditionId, winningOutcome, ts: Date.now() });
        });
        this.provider.on('error', (error) => {
            this.breaker.onFailure();
            logger.error({ err: String(error) }, 'chain websocket error');
            bus.emit('system:error', { module: 'chain-monitor', error: String(error), ts: Date.now() });
        });
        this.provider.on('block', () => this.breaker.onSuccess());
        logger.info('chain monitor started');
    }
    async stop() {
        await this.provider.destroy();
    }
}
