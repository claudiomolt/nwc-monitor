import { nwc } from '@getalby/sdk';
import { readFileSync } from 'fs';

const nwcString = readFileSync('/home/agustin/.alby-cli/connection-secret-claudio.key', 'utf-8').trim();
const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcString });

const amount = parseInt(process.argv[2]);
const lnaddress = process.argv[3]; // e.g. satoshi@spark101.tech

if (!amount || !lnaddress) {
  console.error('Usage: node send-lnaddress.mjs <amount_sats> <lightning_address>');
  process.exit(1);
}

const [username, domain] = lnaddress.split('@');

try {
  // 1. Fetch LNURL endpoint
  console.log(`🔍 Resolving ${lnaddress}...`);
  const lnurlUrl = `https://${domain}/.well-known/lnurlp/${username}`;
  const lnurlRes = await fetch(lnurlUrl);
  const lnurlData = await lnurlRes.json();
  
  if (lnurlData.status === 'ERROR') {
    throw new Error(`LNURL error: ${lnurlData.reason}`);
  }
  
  // 2. Request invoice
  console.log(`💸 Requesting invoice for ${amount} sats...`);
  const invoiceUrl = `${lnurlData.callback}?amount=${amount * 1000}`; // millisats
  const invoiceRes = await fetch(invoiceUrl);
  const invoiceData = await invoiceRes.json();
  
  if (invoiceData.status === 'ERROR') {
    throw new Error(`Invoice error: ${invoiceData.reason}`);
  }
  
  const invoice = invoiceData.pr;
  console.log(`📄 Invoice: ${invoice.substring(0, 40)}...`);
  
  // 3. Pay via NWC
  console.log(`⚡ Paying...`);
  const result = await client.payInvoice({ invoice });
  
  console.log('✅ Payment sent!');
  console.log(`Preimage: ${result.preimage}`);
} catch (error) {
  console.error('❌ Payment failed:', error.message);
  process.exit(1);
}
