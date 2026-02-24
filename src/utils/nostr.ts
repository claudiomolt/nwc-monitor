// Nostr/NWC transaction parsing utilities

import type { Payment } from '../types';
import type { Nip47Transaction } from '@getalby/sdk/dist/NWCClient';

export function parseTransaction(tx: Nip47Transaction, walletName: string): Payment {
  // Generate unique ID from payment hash and settled_at
  const id = `${tx.payment_hash}_${tx.settled_at || tx.created_at}`;
  
  // Determine payment type from transaction type
  const type = tx.type as 'invoice' | 'keysend' | 'incoming' | 'outgoing';
  
  return {
    id,
    wallet: walletName,
    type,
    amount_sats: Math.abs(tx.amount / 1000), // Convert from msats to sats
    description: tx.description,
    payment_hash: tx.payment_hash,
    preimage: tx.preimage,
    payer_pubkey: tx.metadata?.payer_pubkey as string | undefined,
    settled_at: (tx.settled_at || tx.created_at) * 1000, // Convert to milliseconds
    metadata: tx.metadata,
  };
}

export function isIncomingTransaction(tx: Nip47Transaction): boolean {
  return tx.type === 'incoming';
}

export function shouldProcessTransaction(tx: Nip47Transaction, sinceTimestamp?: number): boolean {
  // Only process incoming transactions
  if (!isIncomingTransaction(tx)) {
    return false;
  }
  
  // Must be settled
  if (!tx.settled_at || tx.state !== 'settled') {
    return false;
  }
  
  // Check if transaction is newer than since timestamp
  if (sinceTimestamp && tx.settled_at <= sinceTimestamp) {
    return false;
  }
  
  return true;
}
