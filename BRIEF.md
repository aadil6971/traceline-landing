# Brief — TRACELINE: real-time error tracing for backend teams

**Client:** TRACELINE is a developer tool that follows a single request across every service, queue and database it touches, and shows you the exact line where it failed. Works with Node, Go, Python, Rust. One-line install. Free up to 50k traces/month; Team $29/seat; Enterprise custom. (Fictional product — invent plausible details, no real company logos.)

**Goal:** sign up free (primary CTA "Start tracing free"), or book a demo (secondary).

**Art direction:** dark, precise, technical and fast — like a very well-designed IDE or a Linear/Vercel-level product page, but with its own identity (not a clone). Monospace accents, a sharp accent colour of your choice, crisp grid lines. Motion should feel instant and exact.

**Required sections (your layout):**
1. Hero with a live animated visual of a request flowing through services and one of them failing (your wow moment — canvas/SVG/WebGL).
2. Interactive demo — a fake trace explorer the visitor can click: expand spans, see timings, jump to the failing line of code with syntax highlighting.
3. Install — tabbed code snippets per language with a working copy button.
4. Features — 4–6 features in a layout that isn't a boring 3-column card grid.
5. Numbers — animated stats (latency overhead, traces/day, etc.).
6. Pricing — 3 tiers with a monthly/yearly toggle that updates prices.
7. Social proof — 3 fictional engineer quotes (name, role, fictional company).
8. FAQ (accessible accordion), final CTA and footer.
## Rules for every page (read carefully)

You are the sole art director, copywriter and front-end engineer. The result will be recorded on video: real-time scroll-throughs, hover interactions, mobile recordings and close-ups of the details. Build the best landing page you can — something a top design studio would be proud of, not a template.

**Ambition bar**
- At least one real "wow" moment that only works on the web: WebGL/Three.js scene, canvas/SVG generative visual, scroll-driven animation sequence, or physics interaction. It must be tied to the brand, not decoration.
- Scroll storytelling: sections should reveal, pin, move, morph or animate as you scroll (GSAP + ScrollTrigger, Lenis, Three.js via CDN are fine — or vanilla).
- Micro-interactions everywhere: hover states, magnetic/animated buttons, cursor details (desktop), animated counters, toggles that feel good.
- A distinctive typographic system (Google Fonts are fine) and a clear art direction that matches the client below. Avoid generic "AI landing page" look: no default purple gradients, no generic glassmorphism cards, no emoji icons.
- Write all copy yourself. No lorem ipsum. No exclamation-mark hype.

**Images**
- You may generate up to **6 images** with the Higgsfield tools (image models only, no video). Make them feel like one coherent series. Save them in `assets/` as optimised WebP/JPG with width/height set. You can also draw visuals in code.

**Technical**
- Deliver `index.html` (+ `css/`, `js/`, `assets/`) in THIS directory. Must run from a plain static server, no build step.
- Responsive and polished at 375, 768, 1280 and 1920 px. No horizontal scroll. Mobile menu.
- Semantic HTML, keyboard navigable, visible focus, AA contrast, labelled form fields, respects `prefers-reduced-motion`.
- Zero console errors, no broken assets. Aim for Lighthouse Performance ≥ 85 and Accessibility ≥ 95 on desktop.
- Test it in a real browser yourself (screenshots at several widths) before you say you're done.

**Time**: aim to finish within about 60 minutes.

**When done**: print a short summary — headline, concept in one sentence, the wow moment, images generated, anything unfinished.
