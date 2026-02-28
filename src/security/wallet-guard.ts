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

export function loadApprovedDestinations(): ApprovedDestination[] {
  const p = allowlistPath();
  if (!fs.existsSync(p)) return [];
  const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as AllowlistFile;
  return (raw.destinations || [])
    .filter((d) => d.address && d.approvedBy && d.approvedAt && d.ticket)
    .map((d) => ({ ...d, address: getAddress(d.address) }));
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
  if (code !== '0x') throw new Error(`Funding wallet ${address} is not an EOA (contract code detected)`);
}
