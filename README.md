# Invoice-to-Payment Agent — Pharos Agent Arena

**Medium / Payments (100 points + optional video)**

- **Live application / submission Proof Link (homepage only):** https://invoice-to-payment-agent.trantanlong2411.workers.dev/
- **Public repository:** https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent
- **Offline unit/build CI:** https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent/actions/workflows/verify.yml
- **Deployed on-chain integration CI:** https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent/actions/workflows/verify-deployed.yml

An invoice reader that extracts payee, recipient wallet, amount, token and reference, warns about missing and mismatched fields, validates the payment using **Pharos Pacific Mainnet (chain 1672)**, then presents a clear human-readable review before creating a **transaction that is not signed and not sent**.

## Four challenge criteria

| Arena requirement | Implemented behavior |
| --- | --- |
| 1. Extract from at least 2 invoice formats | Plain-text labeled invoices (e.g. Payee/Recipient Wallet/Amount/Payment Reference) and flat structured JSON invoices with camelCase keys. Extracts payee, recipient, amount, token and invoice number/reference without inventing fields. |
| 2. Flag mismatches and missing fields | Explicit missing field list, duplicate/conflicting invoice lines, unsupported fiat/token, invalid EVM address, numeric precision, and optional expected amount/recipient mismatch. A blocked invoice produces no draft. |
| 3. Payment summary and unsigned transaction with invoice reference | On-chain USDC/PROS validation, current token and native PROS balance, gas estimate, pending nonce. A separate human-readable summary and confirmation precede `/api/prepare`. The returned **envelope** has standard wallet transaction fields and `invoiceMetadata.invoiceReference` in the same JSON. |
| 4. Demo with sample invoices | Two valid interactive invoice samples (Text, JSON), and one deliberately incomplete invoice; buttons populate the live website. CI replays both formats and verifies validation failures. |

### Essential invoice reference limitation

A standard USDC ERC-20 `transfer(address,uint256)` transaction **does not have an invoice memo/reference field**. Therefore, the system returns:

```json
{
  "unsignedTransaction": {
    "chainId": "0x688",
    "from": "0x...",
    "to": "0xC879C018dB60520F4355C26eD1a6D572cdAC1815",
    "value": "0x0",
    "data": "0xa9059cbb...",
    "gas": "0x...",
    "gasPrice": "0x...",
    "nonce": "0x..."
  },
  "invoiceMetadata": {
    "invoiceNumber": "INV-PHAROS-2026-014",
    "invoiceReference": "HOST-2026-11",
    "referenceStorage": "OFF_CHAIN_METADATA_ONLY"
  },
  "signed": false,
  "broadcast": false
}
```

This keeps the invoice reference together with the unsigned transaction for later accounting, **but not inside an on-chain USDC transfer**. It is deliberately not called a completed on-chain invoice settlement. See [ERC-20 specification](https://eips.ethereum.org/EIPS/eip-20) and [ERC-7699 draft extension](https://eips.ethereum.org/EIPS/eip-7699) explaining the missing reference in basic transfers.

## Reviewer demo

1. Open the [live website](https://invoice-to-payment-agent.trantanlong2411.workers.dev/) (no login or wallet connection required).
2. Click **Load text sample**, then **Parse and flag invoice**. Review the amount 1 USDC, `Nova Hosting Ltd`, exact recipient, invoice number and reference.
3. Click **Load JSON sample** and parse. Notice this is a structurally different format with `invoiceNumber`, `recipientWallet`, `amount`, `currency`, and `paymentReference`.
4. Click **Load incomplete example**, parse, and confirm missing recipient is flagged and no payment can be prepared.
5. Try **Expected amount: 2.00** on the 1-USDC sample, parse, and confirm explicit mismatch. Reset to the correct amount (or leave optional expected amount blank).
6. Click **Validate payment on Pharos**. The demo sender is a *public third-party wallet*, previously observed to hold enough USDC and PROS; the Worker always checks its **current** balances, token contract, gas and nonce. If it is no longer funded, the app correctly refuses to prepare an unsigned transaction.
7. When every check passes, inspect the **human-readable summary** and mark the confirmation checkbox. Click **Generate unsigned invoice payment** to produce the unsigned USDC calldata plus `invoiceMetadata.invoiceReference`. Download the complete JSON.
8. This demo does **not** require or perform any real USDC transfer, signature, approval or payment broadcast. The public sender is not controlled by the project and cannot be spent from.

## Development / deployment

```sh
npm install
npm test
npm run build
npx wrangler deploy
```

The `npm run build` command is a **dry-run** bundle used in CI, while `npx wrangler deploy` publishes the Worker. For automatic Cloudflare Builds from GitHub, make sure the connected Worker is named `invoice-to-payment-agent`, production branch `main`, root `/`, and deploy command `npx wrangler deploy`.

The API surface:

- `GET /`: interactive invoice-to-payment UI.
- `GET /api/health`: current build marker, supported formats and safety flags.
- `GET /api/samples`: fixed text, JSON and incomplete invoice examples.
- `POST /api/parse`: extract invoice, report missing/invalid/mismatch fields. No chain read.
- `POST /api/review`: validate invoice against expected fields, real Pharos contract, sender token balance, native PROS and gas; returns a readable review **without** unsigned transaction bytes.
- `POST /api/prepare`: only after `confirmed:true` and the matching prior `reviewId`; revalidates live and returns unsigned transaction + off-chain invoice metadata.

Only official Circle USDC (6 decimals) and native PROS (18 decimals) are supported in this build. Fiat USD is not silently exchanged for or assumed to be USDC. No PDF bytes are parsed directly: to use a PDF invoice, copy its extracted text into the Text invoice box. The task requests **at least two formats**, and Text + JSON are the two implemented formats.

## Sources and security limits

- [Pharos official MCP](https://github.com/PharosNetwork/pharos-mcp): chain 1672, native PROS, `https://rpc.pharos.xyz`.
- [Circle official USDC deployment](https://www.circle.com/blog/now-available-usdc-cctp-on-pharos): `0xC879C018dB60520F4355C26eD1a6D572cdAC1815`.
- [ERC-20 transfer standard](https://eips.ethereum.org/EIPS/eip-20).
- [ERC-7699 reference extension (draft)](https://eips.ethereum.org/EIPS/eip-7699).

The app never asks for private keys, signs, sends or submits transactions. A review fingerprint binds the exact invoice fields and sender for the second check, **not** the wallet owner's identity. The sample public sender is someone else's account, so the user has no ability to spend its assets. An unsigned JSON is not an invoice paid receipt, and the off-chain invoice reference is not visible in a standard on-chain USDC transfer.

## Verified direct Pharos Mainnet result (3 November 2026)

The [direct real-RPC audit](https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent/actions/runs/41690624183) **passed** using the actual Circle USDC contract on Pharos Mainnet 1672. It parsed text and JSON sample invoices (blocks **22032560** and **22032566**), blocked missing/mismatched fields, and successfully generated an **unsigned 1 USDC** transfer draft at block **22032563**, with invoice reference **HOST-2026-11** preserved as off-chain metadata. It did not sign or broadcast. [Permanent compact evidence JSON](./proof/verified-mainnet.json).

The [initial deployed-Worker smoke run](https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent/actions/runs/41689925627) received **HTTP 404** from the expected workers.dev URL, so production website publication **has not been independently verified yet**. See [Cloudflare deployment recovery](./DEPLOYMENT.md). Passing unit or direct-RPC tests does not change that limitation.

## Evidence status

A green unit-test and Worker bundle means the code compiled and behavioral tests passed. It does **not** alone establish a live deployed Worker. After production deployment the separate end-to-end workflow tests both invoice formats, mismatches, insufficient funds, explicit confirmation, and an actual Pharos Mainnet USDC unsigned draft. **Do not claim a live end-to-end success until that job passes.**

The homepage is the intended Pharos **Proof Link**, with no separate proof page; the repository and CI logs provide reviewer-verifiable technical evidence.
