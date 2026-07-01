# SetGo Kimi Coach Worker

Small Cloudflare Worker proxy for SetGo's AI coach.

## Setup

```powershell
cd workers/kimi-coach
npx wrangler secret put KIMI_API_KEY
npx wrangler deploy
```

After deploy, copy the Worker URL and paste `https://<worker-host>/coach` into SetGo:

`More -> AI Coach -> Worker endpoint`

## Optional Vars

Edit `wrangler.toml`:

```toml
KIMI_MODEL = "kimi-k2.6"
ALLOWED_ORIGIN = "https://jeongjae.github.io"
```

`KIMI_API_KEY` must stay a secret. Do not put it in the SetGo frontend.
