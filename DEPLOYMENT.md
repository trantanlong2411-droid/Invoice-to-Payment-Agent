# Deployment verification — Invoice-to-Payment Agent

**Production verification update (4 November 2026 local / 3 November UTC):** The deployed Cloudflare Worker [passed a complete real end-to-end GitHub Actions check](https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent/actions/runs/41695821163) at Pharos block **22034232**. Both Text and JSON invoice samples were parsed successfully, missing/mismatched data was rejected, insufficient balances and absent confirmation blocked drafts, and a real RPC-backed **unsigned 1 USDC** transfer was prepared with reference **HOST-2026-11** preserved as off-chain metadata. No transaction was signed or broadcast. The original live proof JSON is archived in the workflow artifact `invoice-to-payment-live-mainnet-proof`. The earlier HTTP 404 occurred *before deployment* and is now resolved.

**Verified source:** [GitHub](https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent), with passing Node unit tests and dry-run Wrangler bundle.

**Historical deployment issue (3 Nov 2026, resolved after the successful live run):** the first deployed Worker integration workflow received HTTP **404 HTML** from `https://invoice-to-payment-agent.trantanlong2411.workers.dev/api/health` for all 34 attempts. This means the expected production URL had not published the current Worker code when checked. See [original failing job](https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent/actions/runs/41689925627). Do not claim successful live Cloudflare deployment based only on green unit tests.

## Cloudflare Git integration

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** and select the existing **Invoice-to-Payment Agent** Worker.
2. Go to **Settings → Builds** and confirm the GitHub repository **trantanlong2411-droid/Invoice-to-Payment-Agent** (not the previous Natural Language or Recurring Agent repositories).
3. Production branch: **main**. Project root: **/**.
4. Wrangler config: `wrangler.jsonc` has `name:"invoice-to-payment-agent"`. Check that this exactly matches the linked Worker's name. A different exact name may cause Cloudflare to deploy a different Worker, leaving the original URL stale.
5. Deploy command: **`npx wrangler deploy`**. Do not use **`npm run build`** as the production deploy command: that script is a **dry-run bundle** and does not publish a Worker.
6. Build command: `npm install`, or leave the Cloudflare-generated default if it already installs dependencies. No D1 or KV bindings or other secrets are needed.
7. Deploy the latest `main` commit from **Workers Builds / Deployments**, then open the **exact public Worker URL** printed by Cloudflare, not a URL guessed from the repo name.
8. Confirm `/api/health` returns JSON:
```json
{
  "ok": true,
  "project": "Invoice-to-Payment Agent",
  "version": "pharos-invoice-payment-2026-11-04-v1",
  "chainId": 1672,
  "formats": ["text", "json"],
  "signatures": false,
  "automaticBroadcast": false
}
```
9. Rerun [the deployed end-to-end workflow](https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent/actions/workflows/verify-deployed.yml). The live job must demonstrate both formats, missing/mismatch checks, insufficient-balance blocking and a funded unsigned 1 USDC draft with off-chain invoice reference.
10. Once the deployed workflow passes, the public **homepage URL itself** can be submitted as the task Proof Link, without creating another /proof page.

If the real worker URL differs from the default, set `INVOICE_AGENT_URL` when running `node scripts/smoke-deployed.mjs` or update the base URL in the script.

## Alternative from an already-authorized Cloudflare environment

```sh
git clone https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent.git
cd Invoice-to-Payment-Agent
npm install
npm test
npx wrangler login
npx wrangler deploy
```

Use the output Worker URL and confirm `GET /api/health`. Never put Cloudflare tokens, crypto wallet private keys or seed phrases in GitHub files or chat.

Official docs: [Cloudflare Workers Builds / Git](https://developers.cloudflare.com/workers/ci-cd/builds/), [Cloudflare Workers configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).
