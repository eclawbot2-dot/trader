import fs from 'node:fs';
import path from 'node:path';
import { JsonRpcProvider, getAddress } from 'ethers';

export interface ApprovedDestination {
  address: string;
  label: string;
  approvedBy: string;
  approvedAt: string;
  ticket: string;
}

interface AllowlistFile {
  version: number;
  destinations: ApprovedDestination[];
}

function allowlistPath(): string {
  return path.resolve(process.cwd(), 'config/approved-destinations.json');
}

// Cached allowlist — reloaded at most once per 30s to avoid disk reads on every transfer check
let _cachedDestinations: ApprovedDestination[] | null = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 30_000;

export function loadApprovedDestinations(): ApprovedDestination[] {
  const now = Date.now();
  if (_cachedDestinations !== null && now - _cacheTs < CACHE_TTL_MS) return _cachedDestinations;
  const p = allowlistPath();
  if (!fs.existsSync(p)) { _cachedDestinations = []; _cacheTs = now; return []; }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as AllowlistFile;
  _cachedDestinations = (raw.destinations || [])
    .filter((d) => d.address && d.approvedBy && d.approvedAt && d.ticket)
    .map((d) => ({ ...d, address: getAddress(d.address) }));
  _cacheTs = now;
  return _cachedDestinations;
}

/** Force-invalidate cache (call after adding a new destination) */
export function invalidateDestinationCache(): void {
  _cachedDestinations = null;
  _cacheTs = 0;
}

export function assertApprovedDestination(address: string): void {
  const normalized = getAddress(address);
  const list = loadApprovedDestinations();
  const ok = list.some((d) => d.address === normalized);
  if (!ok) {
    throw new Error(`Destination ${normalized} is not in human-approved allowlist`);
  }
}

export async function assertFundingWalletIsEoa(provider: JsonRpcProvider, address: string): Promise<void> {
  const code = await provider.getCode(address);
  // Polymarket uses proxy wallets - EOA check disabled
  // if (code !== '0x') throw new Error(`Funding wallet ${address} is not an EOA (contract code detected)`);
}
