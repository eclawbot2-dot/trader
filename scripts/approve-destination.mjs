#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getAddress } from 'ethers';

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const address = getArg('--address');
const label = getArg('--label') || 'unnamed';
const approvedBy = getArg('--approved-by');
const ticket = getArg('--ticket');
const phrase = getArg('--confirm');

if (!address || !approvedBy || !ticket || phrase !== 'I_AM_HUMAN') {
  console.error('Usage: node scripts/approve-destination.mjs --address <0x...> --label <name> --approved-by <human> --ticket <id> --confirm I_AM_HUMAN');
  process.exit(1);
}

const normalized = getAddress(address);
const file = path.resolve(process.cwd(), 'config/approved-destinations.json');
const data = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, 'utf8'))
  : { version: 1, destinations: [] };

const exists = data.destinations.find((d) => d.address.toLowerCase() === normalized.toLowerCase());
if (exists) {
  console.log('Already approved:', normalized);
  process.exit(0);
}

data.destinations.push({
  address: normalized,
  label,
  approvedBy,
  approvedAt: new Date().toISOString(),
  ticket,
});

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log('Approved destination added:', normalized);
