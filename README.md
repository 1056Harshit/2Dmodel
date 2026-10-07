# Plan to 3D Studio

Upload a drawing for each floor (Ground, First, Top floor…), tell the app how you want to live, and get:

- a 3D model of the complete house (full home, cutaway, or floor by floor)
- an "as drawn" vs "proposed" layout based on your wishes
- suggestions, a design palette, materials, a facade idea, a step-by-step build plan and a rough cost range
- HD export: PNG or JPEG at Full HD or 4K, and a multi-page PDF report

- `index.html` – the website (Three.js 3D viewer, no build step)
- `api/analyze.js` – Vercel serverless function that sends the image to the Claude API
- Access is protected by a password you choose, so only you can run the AI.

## Deploy to Vercel (about 5 minutes)

1. **Get a Claude API key** at https://console.anthropic.com → API Keys. Add some credit under Billing.
2. **Put this folder on GitHub.** Create a new *private* repository and upload all files (keep the `api` folder).
3. **Import to Vercel.** On https://vercel.com → Add New → Project → pick the repo. Framework preset: **Other**. No build command needed.
4. **Add environment variables** (Project → Settings → Environment Variables):
   - `ANTHROPIC_API_KEY` = your Claude API key
   - `APP_PASSWORD` = a password only you know
   - `CLAUDE_MODEL` (optional) = defaults to `claude-sonnet-5-5`. Use `claude-opus-5-5` for higher accuracy at higher cost.
5. **Deploy** (or Redeploy if you added the variables after the first deploy).

Open your `*.vercel.app` link, enter your password, upload a plan and tap **Build 3D model**.

### Deploy without GitHub (Vercel CLI)

```bash
npm i -g vercel
cd plan3d-site
vercel            # first deploy, follow the prompts
vercel env add ANTHROPIC_API_KEY
vercel env add APP_PASSWORD
vercel --prod
```

## Keeping it private

- Nobody can use the AI (or spend your API credit) without `APP_PASSWORD`.
- The page itself (with the example model) is visible to anyone with the link. To hide the whole site, turn on **Vercel Authentication** under Project → Settings → Deployment Protection.

## Notes

- Rooms are modelled as rectangles; L-shaped or angled rooms are approximated.
- Plans with printed dimensions give the most accurate result. For PDFs, screenshot the plan page.
- Large photos are shrunk to 1600 px in the browser before upload.
- Analysing a full house can take 1–3 minutes; `vercel.json` allows the function up to 300 s. Each analysis is one Claude API call, billed to your Anthropic account.
