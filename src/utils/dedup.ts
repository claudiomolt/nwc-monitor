/**
 * Simple file-based deduplication
 * One hash per line in seen-hashes.txt
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const SEEN_FILE = join(DATA_DIR, 'seen-hashes.txt');

// In-memory cache for fast lookups
let seenCache: Set<string> | null = null;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadSeenHashes(): Set<string> {
  if (seenCache) return seenCache;

  ensureDataDir();
  
  if (!existsSync(SEEN_FILE)) {
    seenCache = new Set();
    return seenCache;
  }

  try {
    const content = readFileSync(SEEN_FILE, 'utf-8');
    const hashes = content.split('\n').filter(h => h.trim().length > 0);
    seenCache = new Set(hashes);
    return seenCache;
  } catch (e) {
    console.error('Failed to load seen hashes:', e);
    seenCache = new Set();
    return seenCache;
  }
}

export function hasSeen(hash: string): boolean {
  const seen = loadSeenHashes();
  const result = seen.has(hash);
  if (result) {
    console.log(`[DEDUP] Hash ${hash.substring(0, 16)}... already seen (${seen.size} total)`);
  }
  return result;
}

export function markSeen(hash: string): void {
  const seen = loadSeenHashes();
  
  if (seen.has(hash)) {
    console.log(`[DEDUP] Hash ${hash.substring(0, 16)}... already marked, skipping`);
    return; // Already marked
  }
  
  seen.add(hash);
  console.log(`[DEDUP] Marking new hash ${hash.substring(0, 16)}... (now ${seen.size} total)`);
  
  ensureDataDir();
  try {
    appendFileSync(SEEN_FILE, hash + '\n', 'utf-8');
  } catch (e) {
    console.error('Failed to mark hash as seen:', e);
  }
}
