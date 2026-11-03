# Invoice-to-Payment Agent — task evidence

**Production verification update (4 November 2026 local / 3 November UTC):** The deployed Cloudflare Worker [passed a complete real end-to-end GitHub Actions check](https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent/actions/runs/41695821163) at Pharos block **22034232**. Both Text and JSON invoice samples were parsed successfully, missing/mismatched data was rejected, insufficient balances and absent confirmation blocked drafts, and a real RPC-backed **unsigned 1 USDC** transfer was prepared with reference **HOST-2026-11** preserved as off-chain metadata. No transaction was signed or broadcast. The original live proof JSON is archived in the workflow artifact `invoice-to-payment-live-mainnet-proof`. The earlier HTTP 404 occurred *before deployment* and is now resolved.

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

## Verified direct Mainnet test (3 November 2026)

- [Successful actual Pharos Mainnet CI](https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent/actions/runs/41690624183) demonstrated both invoice formats, missing and mismatched fields blocked, and an actual source-backed unsigned **1 USDC** payment at block **22032563** using invoice reference **HOST-2026-11**.
- [Compact permanent Mainnet evidence](./verified-mainnet.json); original full JSON is archived as the `invoice-to-payment-direct-mainnet-proof` GitHub Actions artifact.
- No signature, transaction hash or actual transfer.
- The initial [deployed Worker smoke test](https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent/actions/runs/41689925627) failed HTTP 404; website deployment remains separately unverified. See [DEPLOYMENT.md](../DEPLOYMENT.md).

## Evidence verification

- Offline tests exercise parsing and real-style mock RPC failures and review gating.
- A **separate deployed live CI workflow** checks both formats through the production Worker, rejects missing/mismatched invoice and unfunded account, blocks missing confirmation, then (when a public sample EOA remains funded) generates a real-data unsigned 1-USDC transaction, decodes ABI recipient and amount and checks the invoice reference is preserved separately.
- The full observed raw output is emitted as a GitHub Actions artifact `invoice-to-payment-live-mainnet-proof` for successful live runs.

Live deployment has now been verified by the successful deployed workflow (run 41695821163). Never claim funds were sent or a sample sender is owned by the project; it has no signing capability. No separate /proof page is needed.

## Sources

[Pharos official RPC and chain](https://github.com/PharosNetwork/pharos-mcp) · [Circle official USDC address](https://www.circle.com/blog/now-available-usdc-cctp-on-pharos) · [EIP-20](https://eips.ethereum.org/EIPS/eip-20) · [EIP-7699 draft on references](https://eips.ethereum.org/EIPS/eip-7699).
