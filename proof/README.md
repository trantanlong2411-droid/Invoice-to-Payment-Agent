# Invoice-to-Payment Agent — task evidence

**Task:** Pharos Agent Arena · Medium / Payments · Invoice-to-Payment Agent

- **Live homepage / intended Proof Link:** https://invoice-to-payment-agent.trantanlong2411.workers.dev/
- **Repo:** https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent
- **Unit + build tests:** https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent/actions/workflows/verify.yml
- **Deployed Worker actual blockchain test:** https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent/actions/workflows/verify-deployed.yml

## The four grading requirements

1. Text and structured JSON: each sample has payee, 1 USDC amount, verified-format recipient wallet and payment reference. The parser operates on the submitted content, not canned static outputs.
2. Missing/mismatch: rejects omitted wallet, repeated contradictory fields, unexpected currency, precision problems and independently expected-amount/recipient mismatches. It never fills in a missing payee.
3. Payment summary first: on-chain chain ID 1672, real Circle USDC contract metadata, sender token balance, native PROS, gas and nonce. Only after explicit confirmation are unsigned EVM fields returned with `invoiceMetadata.invoiceReference` in the same envelope. Reference remains **off-chain**, not encoded in an ERC-20 `transfer(address,uint256)`.
4. Live demo: home page has Load text sample, Load JSON sample, Load incomplete example. Examples are immediately parseable. A public funded sample sender is revalidated on demand and **is not owned by the user**.

## Evidence verification

- Offline tests exercise parsing and real-style mock RPC failures and review gating.
- A **separate deployed live CI workflow** checks both formats through the production Worker, rejects missing/mismatched invoice and unfunded account, blocks missing confirmation, then (when a public sample EOA remains funded) generates a real-data unsigned 1-USDC transaction, decodes ABI recipient and amount and checks the invoice reference is preserved separately.
- The full observed raw output is emitted as a GitHub Actions artifact `invoice-to-payment-live-mainnet-proof` for successful live runs.

Never claim live deployment or success until a real deployed workflow run finishes green. Never claim funds were sent or a sample sender is owned by the project; it has no signing capability. No separate /proof page is needed.

## Sources

[Pharos official RPC and chain](https://github.com/PharosNetwork/pharos-mcp) · [Circle official USDC address](https://www.circle.com/blog/now-available-usdc-cctp-on-pharos) · [EIP-20](https://eips.ethereum.org/EIPS/eip-20) · [EIP-7699 draft on references](https://eips.ethereum.org/EIPS/eip-7699).
