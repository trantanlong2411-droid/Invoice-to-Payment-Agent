---
name: pharos-invoice-to-payment-agent
description: Parse plain-text and JSON invoices, flag missing/mismatched payment fields, check Pharos USDC/PROS balances, and export a human-reviewed unsigned transfer with off-chain invoice reference.
---
# Invoice-to-Payment Agent — Pharos Agent Arena

1. Read user-provided **plain-text labeled invoice** or **flat JSON invoice**. Both must extract payee, token/currency, amount, recipient 0x address, invoice reference and optional invoice number/description. No PDF parser is claimed.
2. Reject missing payee/address/amount/token/reference, duplicate contradictory lines, invalid addresses, unsupported currencies, precision errors, and any mismatch against optional independently supplied expected amount/recipient/payee/reference.
3. Never turn fiat USD into USDC automatically, never guess an ENS alias or a missing wallet address, and never trust only the invoice's claimed payee name as an independent verified identity.
4. Run a read-only Pharos RPC check on mainnet chain **1672**. Verify USDC deployed contract code + symbol + decimals, sender USDC balance, native PROS gas, gas estimate and pending nonce. Native PROS payments are also supported. If validation fails, return a blocked review without unsigned data.
5. Show the human-readable payee, recipient, amount, token, invoice number, invoice reference, source block, balances and gas reserve. The user must explicitly check the confirmation checkbox before generating transaction data.
6. On confirmation, reparse the invoice and revalidate mainnet state. A fingerprint binds sender, recipient, token, amount, payee, invoice reference and invoice number so changes require a new review.
7. Only then produce an unsigned transaction object with standard EVM fields and a separate `invoiceMetadata.invoiceReference` in the same export envelope.
8. The reference **is not included inside standard ERC-20 transfer calldata**. The only encoded transfer fields are recipient and amount. Keep reference in exported off-chain metadata for reconciliation; an on-chain reference would require a compatible extension or a dedicated payment contract.
9. Never access private keys, seed phrases or wallet signatures and never call `eth_sendRawTransaction` or `eth_sendTransaction`.
10. Use the **homepage as the task proof link**, not a separate proof page. Keep two valid samples and an incomplete sample visible, add unit/Worker CI tests, and only claim a successful live build after running the real deployed Worker checks and publishing logs.

Limits: raw PDF invoice uploading is not implemented (paste text extracted from a PDF), sample public wallet is owned by an unrelated third party, unsigned demo does not move assets, and live balance/gas/nonce can change after review.
