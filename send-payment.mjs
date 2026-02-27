import { nwc } from '@getalby/sdk';
import { readFileSync } from 'fs';

const nwcString = readFileSync('/home/agustin/.alby-cli/connection-secret-claudio.key', 'utf-8').trim();
const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcString });

const amount = parseInt(process.argv[2]);
const address = process.argv[3];

if (!amount || !address) {
  console.error('Usage: node send-payment.mjs <amount_sats> <lightning_address>');
  process.exit(1);
}

try {
  console.log(`💸 Sending ${amount} sats to ${address}...`);
  const result = await client.payInvoice({
    invoice: address,
    amount: amount * 1000, // sats to millisats
  });
  console.log('✅ Payment sent!');
  console.log(`Preimage: ${result.preimage}`);
} catch (error) {
  console.error('❌ Payment failed:', error.message);
  process.exit(1);
}
