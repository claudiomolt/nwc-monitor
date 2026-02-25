/**
 * Nostr/NWC transaction parsing utilities
 */

import type { Payment } from '../types';

export function parseTransaction(tx: any, walletName: string): Payment {
  return {
    wallet: walletName,
    type: tx.type || 'incoming',
    invoice: tx.invoice || '',
    description: tx.description || '',
    description_hash: tx.description_hash || null,
    preimage: tx.preimage || '',
    payment_hash: tx.payment_hash || '',
    amount: tx.amount || 0, // NWC returns millisats
    fees_paid: tx.fees_paid || 0,
    created_at: tx.created_at || 0,
    expires_at: tx.expires_at || null,
    settled_at: tx.settled_at || 0,
    metadata: tx.metadata || {},
  };
}
