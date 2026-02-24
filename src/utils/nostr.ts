/**
 * Nostr / NWC helpers
 */

import type { Payment } from '../types';

/**
 * Parse a NWC transaction into our Payment format
 */
export function parseTransaction(tx: any, walletName: string): Payment | null {
  try {
    if (tx.type !== 'incoming' || !tx.settled_at) {
      return null;
    }

    const payment: Payment = {
      id: tx.payment_hash || tx.invoice || `tx_${Date.now()}`,
      wallet: walletName,
      type: tx.invoice ? 'invoice' : 'keysend',
      amount_sats: Math.round((tx.amount || 0) / 1000), // millisats to sats
      description: tx.description || tx.memo || '',
      payment_hash: tx.payment_hash || '',
      preimage: tx.preimage || '',
      payer_pubkey: tx.metadata?.payer_pubkey || '',
      settled_at: tx.settled_at,
      metadata: tx.metadata || {},
    };

    return payment;
  } catch (error) {
    console.error('Error parsing transaction:', error);
    return null;
  }
}

/**
 * Template string replacement
 */
export function fillTemplate(template: string, payment: Payment): string {
  return template
    .replace(/{wallet}/g, payment.wallet)
    .replace(/{amount_sats}/g, payment.amount_sats.toString())
    .replace(/{description}/g, payment.description || '')
    .replace(/{payment_hash}/g, payment.payment_hash)
    .replace(/{preimage}/g, payment.preimage || '')
    .replace(/{payer_pubkey}/g, payment.payer_pubkey || '')
    .replace(/{settled_at}/g, new Date(payment.settled_at * 1000).toISOString())
    .replace(/{type}/g, payment.type)
    .replace(/{id}/g, payment.id);
}
