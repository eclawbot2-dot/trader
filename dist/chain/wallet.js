import { JsonRpcProvider, Wallet, formatUnits, parseEther } from 'ethers';
import { config } from '../config.js';
import { assertApprovedDestination } from '../security/wallet-guard.js';
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
export class WalletService {
    provider;
    wallet;
    constructor() {
        this.provider = new JsonRpcProvider(config.chain.rpc, config.chain.id);
        this.wallet = new Wallet(config.chain.privateKey, this.provider);
    }
    async getUsdcBalance() {
        const { Contract } = await import('ethers');
        const usdc = new Contract(config.chain.contracts.USDC_E, ERC20_ABI, this.provider);
        const bal = await usdc.balanceOf(this.wallet.address);
        return Number(formatUnits(bal, 6));
    }
    // Any native fund transfer MUST use this method so destination allowlist is enforced.
    async sendNativePol(to, amountPol) {
        assertApprovedDestination(to);
        const tx = await this.wallet.sendTransaction({ to, value: parseEther(String(amountPol)) });
        await tx.wait();
        return tx.hash;
    }
}
