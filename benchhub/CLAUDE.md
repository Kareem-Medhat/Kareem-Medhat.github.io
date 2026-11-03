# CLAUDE.md — BenchHub

> Working name: **BenchHub**. If the name changes, update it here and in `data/site.json`. Don't hardcode it anywhere else.

## What this project is

BenchHub is a **static website** for PC users, mostly beginners, that does two things:

1. **Guides.** Step-by-step instructions for downloading, installing, configuring and running popular benchmark and stress-test tools (Cinebench, 3DMark, FurMark, Geekbench, etc.).
2. **"Is my score normal?" checker.** The user picks their CPU/GPU and the benchmark they ran, types in their score, and the site compares it with **reference scores collected from trusted sources**, then explains what the result means.

Everything runs in the browser. There is no backend, no database, no user accounts, and user scores are never uploaded anywhere.

## Hosting and tech

- **Hosting:** GitHub Pages. The site must work as plain static files.
- **Stack:** plain **HTML, CSS and vanilla JavaScript (ES modules)**. No frameworks, no build step, no npm dependencies. Don't add any without asking first.
- **Data:** JSON files in `data/`, loaded with `fetch()`.
- **No server code:** no API routes, server-side rendering, environment secrets or anything else that needs a server.

### GitHub Pages rules
- The site may be served from a subpath (`https://<user>.github.io/<repo>/`). **Use relative paths everywhere** (`./css/style.css`, `../data/scores.json`), never root-absolute paths like `/css/style.css`.
- Include an empty `.nojekyll` file in the root so GitHub Pages serves every file as-is.
- Include a `404.html`.
- Don't rely on server-side redirects or URL rewriting. Every page is a real `.html` file.
- Test locally with a simple static server (`python3 -m http.server 8000`), not by opening files directly. `fetch()` doesn't work over `file://`.

## Project structure

```
index.html                  # home: what the site does, links to checker + guides
check.html                  # the "is my score normal?" checker
guides/
  index.html                # list of all guides
  cinebench-2026.html       # one page per guide
  ...
css/
  style.css
js/
  data.js                   # loads and validates the JSON files
  checker.js                # checker page entry: loads data, wires the form
  checker/                  # checker modules: entries (URL/storage), selection, form, result
  stats.js                  # percentile/median/diagnosis (pure functions)
  ui.js                     # shared helpers (nav, theme toggle)
data/
  site.json                 # site name, tagline
  sources.json              # TRUSTED SOURCE ALLOWLIST (owner-maintained)
  benchmarks.json           # benchmark registry
  hardware.json             # CPU/GPU catalog
  scores.json               # reference scores, each one cited
  temperature-limits.json   # makers' published max GPU temperatures, each one cited like a score
assets/
  img/                      # our own screenshots only
.nojekyll
404.html
```

Shared header and footer markup is repeated in each HTML file (no build step). Keep it identical across pages, and when you change it, change every page.

## Trusted sources only (most important rule)

All reference scores on this site come **only** from the sources listed in `data/sources.json`. The site owner maintains that list.

- **Never add a source to `sources.json` yourself.** If a source seems useful, suggest it in chat and let the owner decide.
- **Never invent, estimate, interpolate, average from memory, or "fill in" a score.** If no trusted source has a number for a hardware + benchmark combination, the site shows "No trusted data yet." An empty spot is fine; a made-up number is not.
- **Every entry in `scores.json` must cite** a `sourceId` that exists in `sources.json`, plus the exact `url` of the page where the number appears and the `retrievedDate`.
- **Don't use** user-submitted databases, forums, Reddit threads, YouTube comments, community spreadsheets, or aggregator sites unless they are explicitly on the allowlist.
- **Don't copy** text, charts or screenshots from sources. Record only the numbers and the citation.
- If you can't open a source page to confirm a number, don't add it. Leave a TODO listing what's missing.
- Each score shown in the UI displays its source name with a link, so users can check it.
- `js/data.js` must validate on load: scores whose `sourceId` isn't in `sources.json` are dropped and a warning is logged to the console.

### `data/sources.json` format
```json
[
  {
    "id": "example-source",
    "name": "Example Reviewer",
    "homepage": "https://example.com",
    "type": "review-site",
    "notes": "Why this source is trusted (written by the owner)"
  }
]
```
`type` is one of: `"official-vendor"`, `"review-site"`, `"official-results-database"`.

### `data/scores.json` format
```json
[
  {
    "hardwareId": "amd-ryzen-7-7800x3d",
    "benchmark": "cinebench",
    "version": "2026",
    "test": "multi-core",
    "value": 0,
    "sourceId": "example-source",
    "url": "https://example.com/review-page",
    "retrievedDate": "2026-11-01",
    "conditions": {
      "formFactor": "desktop",
      "stock": true,
      "notes": "Optional: cooler, RAM, power limit as stated by the source"
    }
  }
]
```

## Benchmark rules

### 1. Versions and tests are never mixed
- Cinebench R23, 2024 and 2026 use **different scales**. Each is a separate version and must never share a chart, median or comparison.
- The same applies to 3DMark tests (Time Spy, Time Spy Extreme, Steel Nomad and Speed Way are separate tests) and FurMark presets (1080p vs 1440p vs 4K).
- Two scores are comparable **only if benchmark + version + test/preset all match**, and the checker compares desktop with desktop and laptop with laptop.

### 2. One registry defines every benchmark
`data/benchmarks.json` is the single source of truth. Each entry has:
- `id`, `name`, `vendor`, `officialDownloadUrl`
- `category`: `"cpu" | "gpu" | "storage" | "stress"`
- `versions[]`, each with its `tests[]` or `presets[]`
- `unit` (`pts`, `fps`, `MB/s`) and **`higherIsBetter`** (never assume it's true)
- `comparedBy`: `"cpu"` or `"gpu"`
- `guide`: path to its guide page

Adding a tool means adding a registry entry and a guide page. The JS should not need changes. Never hardcode benchmark names, units or directions in JavaScript.

### 3. Stress tests are not leaderboards
FurMark, OCCT and Prime95 are mainly **stability and temperature tests**. The site treats them as a pass/fail health check (did it stay stable, did temperatures stay safe, did it throttle), not a ranking. Their guides must include the safety warning (see Guides).

### 4. Hardware names
`data/hardware.json` lists each CPU/GPU once with a canonical `id`, `type`, `vendor`, `model`, optional `variant`, and `formFactor` (`desktop` or `laptop`; laptop chips are separate entries, e.g. "GeForce RTX 4060 Laptop GPU"). The checker uses a searchable dropdown from this list. Never compare on free text.

## The checker (`check.html`)

1. User picks hardware type, then their CPU or GPU.
2. User picks the benchmark, version and test. Only show combinations that have trusted data for that hardware.
3. User types their score.
4. The page shows:
   - The trusted reference score(s) with source links and conditions
   - How far the user is from the reference, as a percentage, respecting `higherIsBetter`
   - A plain-language diagnosis from the rules in `js/stats.js`, e.g. within ±5%: "Normal"; 5–15% lower: "A bit low, check background apps and power plan"; more than 15% lower: "Low, check temperatures and power limits", with a link to the guide's troubleshooting section
   - If several trusted sources give a number, show each one and the range. Don't average them into a single "official" number.
5. Nothing is sent anywhere. Optionally remember the user's last entries in `localStorage` (wrapped in try/catch, since it can be unavailable). The page must work fine without it.
6. Make results shareable through the URL query string (e.g. `check.html?hw=...&b=...&v=...&t=...&score=...`).

Keep `js/stats.js` as pure functions with no DOM access, so it's easy to test by hand in the browser console.

## Guides

One HTML page per tool in `guides/`, all using the same layout and this section order:

1. **What it tests and when to use it** (2–3 plain sentences)
2. **Before you start**: close background apps, plug in laptops, install a temperature monitor like HWiNFO, let the PC idle 5 minutes
3. **Download**: link **only to the official vendor page or official store page (e.g. Steam)**. Never host the tools on this site and never link to third-party download mirrors.
4. **Install and set up**: numbered steps, one action per step, with screenshot placeholders
5. **Run the test**: the exact version and test/preset to choose so the result matches the reference data
6. **Read your result**: which number to use and where it appears
7. **Check your score**: link to `check.html?b=<benchmark>&v=<version>`
8. **Troubleshooting**: low score, crashes, thermal throttling

Each guide shows a "Last verified" date and the tool version it was written for.

Stress-test guides need a visible safety warning near the top: watch temperatures, stop if they go above safe limits, avoid long runs on laptops with weak cooling, and running the test is at the user's own risk.

Writing style: second person, short sentences, explain any jargon in one line, always state version numbers. **Don't guess UI labels in third-party tools.** If you're not sure what a button or menu is called in the current version, leave `<!-- TODO: verify label -->` instead of making it up.

## UI / design

- Beginners first: every number has a label, unit and a "higher is better" or "lower is better" hint.
- Mobile-friendly. Many people will read the guide on their phone while the test runs on the PC.
- Accessible: semantic HTML, proper headings, labels on all form fields, keyboard navigable, WCAG AA contrast, color never the only signal.
- Light and dark mode using CSS custom properties and `prefers-color-scheme`, with a manual toggle.
- Fast: no large libraries, no web fonts unless asked, images compressed with `width`/`height` set.
- Each page has its own `<title>` and `<meta name="description">`.

## Legal

- Use tool names as plain text only. No third-party logos.
- Footer note: tool names are trademarks of their owners; BenchHub isn't affiliated with any of them; reference scores are credited to their sources.
- Screenshots must be our own.

## Build order

Get each step working before moving on:

1. Folder structure, `.nojekyll`, `404.html`, shared header/footer, `style.css` with light/dark themes, home page.
2. `benchmarks.json` and `hardware.json` for the starter set: **Cinebench 2026 + R23, 3DMark Time Spy + Steel Nomad, FurMark 2, Geekbench 6**.
3. `sources.json` and `scores.json` **with empty arrays** if the owner hasn't provided sources yet. Ask the owner for the trusted sources before adding any scores.
4. `js/data.js` loading and validation, then `js/stats.js`.
5. `check.html` and `js/checker.js`, including the "No trusted data yet" state.
6. Guide template, then one guide per starter tool.
7. Polish: meta descriptions, favicon, check every link and every relative path works under a subpath.

## When unsure

- If a request in chat conflicts with this file, ask before proceeding.
- If you don't know a fact (a score, a tool's current version, a menu label), say so and leave a TODO. Don't make it up.
- Prefer small changes. At the end of each task, summarize what changed and what's left.
