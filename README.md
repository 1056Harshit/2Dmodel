# Plan to 3D Studio

Upload a drawing for each floor (Ground, First, Top floor…), tell the app how you want to live, and get:

- a 3D model of the complete house (full home, cutaway, or floor by floor)
- an "as drawn" vs "proposed" layout based on your wishes
- suggestions, a design palette, materials, a facade idea, a step-by-step build plan and a rough cost range
- HD export: PNG or JPEG at Full HD or 4K, and a multi-page PDF report

**Multi-page PDFs and agents.** Upload images or a multi-page PDF. Every page gets its own design agent. For each page you pick the floor, the tasks (improve layout, interior & furniture, flooring & finishes, switches & wiring, parking style) and your notes for that floor. The agents work in parallel (up to 3 at a time). A lead-architect agent then combines them into the whole-home design, palette, cost and build plan.

**What the agents produce.** A furnished 3D model with textured floors, a Dollhouse view, villa front styles with evening lighting, furnished 2D plans, and electrical plans: switchboards, sockets, power points, lights, fans, AC, geyser, EV, the DB, and colour-coded circuits with MCB and wire sizes. Each agent follows a built-in architect's playbook (NBC room minimums, zoning, ventilation, electrical practice).

- `dreamhouse/index.html` – the website, served at `/dreamhouse` (Three.js 3D viewer, no build step)
- `api/analyze.js` – Vercel serverless function that sends the image to the Claude API
- Access is protected by a password you choose, so only you can run the AI.

## Deploy to Vercel (about 5 minutes)

1. **Get a Claude API key** at https://console.anthropic.com → API Keys. Add some credit under Billing.
2. **Put this folder on GitHub.** Create a new *private* repository and upload all files (keep the `api` folder).
3. **Import to Vercel.** On https://vercel.com → Add New → Project → pick the repo. Framework preset: **Other**. No build command needed.
4. **Add environment variables** (Project → Settings → Environment Variables):
   - `ANTHROPIC_API_KEY` = your Claude API key
   - `APP_PASSWORD` = a password only you know
   - `ANTHROPIC_WORKSPACE_ID` (optional) = only if your key is not tied to a workspace
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

## Custom domain: pvtfrnd.com/dreamhouse

The app lives at `/dreamhouse` and calls its API at `/dreamhouse/api/analyze`, so it can sit under a path on any domain.

- **pvtfrnd.com has no other site:** in this Vercel project open Settings → Domains, add `pvtfrnd.com` (and `www.pvtfrnd.com`), and set the DNS records Vercel shows at your domain registrar. `pvtfrnd.com` redirects to `pvtfrnd.com/dreamhouse`.
- **pvtfrnd.com already hosts another site:** keep that site and forward `/dreamhouse` to this project. On a Vercel or Next.js site add a rewrite from `/dreamhouse/:path*` to `https://2dmodel3d.vercel.app/dreamhouse/:path*` (plus `/dreamhouse` → `https://2dmodel3d.vercel.app/dreamhouse`).

## Keeping it private

- Nobody can use the AI (or spend your API credit) without `APP_PASSWORD`.
- The page itself (with the example model) is visible to anyone with the link. To hide the whole site, turn on **Vercel Authentication** under Project → Settings → Deployment Protection.

## Notes

- Rooms are modelled as rectangles; L-shaped or angled rooms are approximated.
- Plans with printed dimensions give the most accurate result. For PDFs, screenshot the plan page.
- Large photos are shrunk to 1600 px in the browser before upload.
- Analysing a full house can take 1–3 minutes; `vercel.json` allows the function up to 300 s. Each analysis is one Claude API call, billed to your Anthropic account.
