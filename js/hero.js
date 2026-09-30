/* ==========================================================================
   TRACELINE — hero: a live request travels the service graph and fails.
   Canvas 2D, no dependencies. Pauses off-screen. Static final frame when
   prefers-reduced-motion is set.
   ========================================================================== */
(function () {
  var canvas = document.getElementById('heroCanvas');
  if (!canvas || !canvas.getContext) return;

  var wrap = document.getElementById('stageCanvas');
  var stage = document.getElementById('stage');
  var timeEl = document.getElementById('stageTime');
  var statusEl = document.getElementById('stageStatus');
  var logEl = document.getElementById('stageLog');
  var errEl = document.getElementById('stageErr');
  var tipEl = document.getElementById('stageTip');
  var ctx = canvas.getContext('2d');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ACCENT = [200, 245, 49], ERR = [255, 93, 77], WARN = [255, 194, 77], WHITE = [255, 255, 255], PANEL = [15, 18, 22];
  var MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

  /* ---------- graph ---------- */
  var NODES = {
    client:    { label: 'client',         kind: 'client', tag: '',    land: [0.06, 0.50], port: [0.50, 0.07], depth: 3, info: ['Browser', 'POST /checkout'] },
    gateway:   { label: 'api-gateway',    kind: 'svc',    tag: 'TS',  land: [0.21, 0.50], port: [0.50, 0.20], depth: 5, info: ['Node.js 22', 'p50 4 ms'] },
    auth:      { label: 'auth-svc',       kind: 'svc',    tag: 'RS',  land: [0.38, 0.17], port: [0.16, 0.30], depth: 8, info: ['Rust 1.79', 'p50 26 ms'] },
    orders:    { label: 'orders-svc',     kind: 'svc',    tag: 'PY',  land: [0.40, 0.68], port: [0.62, 0.38], depth: 6, info: ['Python 3.12', 'p50 190 ms'] },
    inventory: { label: 'inventory-svc',  kind: 'svc',    tag: 'GO',  land: [0.62, 0.28], port: [0.16, 0.54], depth: 9, info: ['Go 1.22', 'p50 210 ms'] },
    db:        { label: 'postgres',       kind: 'db',     tag: '',    land: [0.57, 0.90], port: [0.30, 0.70], depth: 4, info: ['PostgreSQL 16', 'p50 12 ms'] },
    payments:  { label: 'payments-svc',   kind: 'svc',    tag: 'GO',  land: [0.74, 0.55], port: [0.76, 0.58], depth: 7, info: ['Go 1.22', 'charge.go:142'] },
    psp:       { label: 'card-processor', kind: 'ext',    tag: 'EXT', land: [0.93, 0.28], port: [0.82, 0.75], depth: 10, info: ['External API', 'timeout 2,000 ms'] },
    queue:     { label: 'orders.events',  kind: 'queue',  tag: '',    land: [0.92, 0.80], port: [0.56, 0.80], depth: 4, info: ['Kafka topic', 'never reached'] }
  };
  var EDGES = [
    { a: 'client', b: 'gateway', bend: 0 },
    { a: 'gateway', b: 'auth', bend: 0.1 },
    { a: 'gateway', b: 'orders', bend: -0.08 },
    { a: 'orders', b: 'inventory', bend: 0.1 },
    { a: 'orders', b: 'db', bend: -0.08 },
    { a: 'orders', b: 'payments', bend: 0.1 },
    { a: 'payments', b: 'psp', bend: 0.12 },
    { a: 'payments', b: 'queue', bend: -0.1, dashed: true }
  ];
  var ids = Object.keys(NODES);
  var edgeMap = {};
  EDGES.forEach(function (e) { edgeMap[e.a + '>' + e.b] = e; e.key = e.a + '>' + e.b; e.fill = 0; e.err = 0; e.amb = { t: Math.random(), v: 0.00009 + Math.random() * 0.00008 }; });

  /* request script: real animation ms in `dur`, trace ms in ta..tb */
  var LEGS = [
    { a: 'client', b: 'gateway', dur: 380, ta: 0, tb: 4, log: ['start', 0, 'api-gateway', 'POST /checkout'] },
    { a: 'gateway', b: 'auth', dur: 300, ta: 4, tb: 12, log: ['start', 4, 'auth-svc', 'verify_token'] },
    { a: 'auth', b: 'gateway', dur: 280, ta: 12, tb: 38, ret: 1, log: ['end', 38, 'auth-svc', 'ok', '34 ms'] },
    { a: 'gateway', b: 'orders', dur: 300, ta: 41, tb: 44, log: ['start', 41, 'orders-svc', 'create_order'] },
    { a: 'orders', b: 'db', dur: 240, ta: 44, tb: 70 },
    { a: 'db', b: 'orders', dur: 220, ta: 70, tb: 92, ret: 1, log: ['end', 92, 'postgres', 'INSERT orders', '48 ms'] },
    { a: 'orders', b: 'inventory', dur: 300, ta: 95, tb: 250, log: ['start', 95, 'inventory-svc', 'reserve_items'] },
    { a: 'inventory', b: 'orders', dur: 280, ta: 250, tb: 412, ret: 1, log: ['end', 412, 'inventory-svc', 'ok', '317 ms'] },
    { a: 'orders', b: 'payments', dur: 320, ta: 420, tb: 424, log: ['start', 420, 'payments-svc', 'charge'] },
    { a: 'payments', b: 'psp', dur: 2200, ta: 490, tb: 2490, slow: 1, log: ['start', 490, 'card-processor', 'POST /v1/charges'] },
    { a: 'payments', b: 'orders', dur: 260, ta: 2490, tb: 2500, err: 1 },
    { a: 'orders', b: 'gateway', dur: 260, ta: 2500, tb: 2512, err: 1 },
    { a: 'gateway', b: 'client', dur: 260, ta: 2512, tb: 2524, err: 1, log: ['end', 2524, 'api-gateway', 'HTTP 500', '2,524 ms', 1] }
  ];
  var FAIL_LOG = [2490, 'payments-svc', 'context deadline exceeded', '2,000 ms', 1];

  /* ---------- state ---------- */
  var W = 0, H = 0, dpr = 1, S = 40, port = false, FS = 11;
  var st = {}; ids.forEach(function (id) { st[id] = { lit: 0, vis: 0, fail: 0, hover: 0, wait: 0, ox: 0, oy: 0, x: 0, y: 0, shake: 0 }; });
  var phase = 'legs', legIdx = 0, legT = 0, pause = 300, failT = 0, holdT = 0, fadeT = 0;
  var fade = 1, tNow = 0, lastMs = -1, hoverId = null, spin = 0;
  var rings = [], parts = [], par = { x: 0, y: 0, tx: 0, ty: 0 };
  var running = false, visible = true, raf = 0, last = 0;

  /* ---------- helpers ---------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }
  function easeIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeO(t) { return 1 - Math.pow(1 - t, 3); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function pad(n) { var s = String(Math.round(n)); while (s.length < 4) s = '0' + s; return s; }

  function layout() {
    var r = wrap.getBoundingClientRect();
    W = Math.max(200, r.width); H = Math.max(200, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    port = W / H < 1.0;
    S = clamp(Math.min(W, H) * 0.092, 28, 46);
    FS = W < 470 ? 10 : 11;
    var mx = port ? 0.09 : 0.06;
    ids.forEach(function (id) {
      var p = NODES[id][port ? 'port' : 'land'];
      st[id].x = clamp(p[0], mx, 1 - mx) * W;
      st[id].y = clamp(p[1], 0.07, 0.93) * H;
    });
    if (reduce || !running) draw();
  }

  function pos(id) { var s = st[id]; return { x: s.x + s.ox, y: s.y + s.oy + 0 }; }
  function ctrl(a, b, bend) { var dx = b.x - a.x, dy = b.y - a.y; return { x: (a.x + b.x) / 2 - dy * bend, y: (a.y + b.y) / 2 + dx * bend }; }
  function bez(a, c, b, t) { var u = 1 - t; return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }; }
  function edgeGeo(e) { var A = pos(e.a), B = pos(e.b); return { A: A, B: B, C: ctrl(A, B, e.bend) }; }
  function strokePart(g, t0, t1) {
    var n = Math.max(4, Math.ceil(28 * (t1 - t0))), i, p;
    ctx.beginPath();
    for (i = 0; i <= n; i++) { p = bez(g.A, g.C, g.B, t0 + (t1 - t0) * i / n); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
    ctx.stroke();
  }

  /* ---------- HUD ---------- */
  function setTime(ms) {
    var r = Math.round(ms);
    if (r === lastMs) return;
    lastMs = r;
    timeEl.textContent = fmt(r) + ' ms';
  }
  function pushLog(t, svc, msg, dur, isErr) {
    var li = document.createElement('li');
    if (isErr) li.className = 'is-err';
    li.innerHTML = '<time>+' + pad(t) + '</time><span class="svc"></span><span class="msg"></span><span class="dur"></span>';
    li.children[1].textContent = svc; li.children[2].textContent = msg; li.children[3].textContent = dur || '';
    logEl.appendChild(li);
    while (logEl.children.length > 6) logEl.removeChild(logEl.firstChild);
  }
  function logFrom(l) { if (l) pushLog(l[1], l[2], l[3], l[4], l[5]); }

  /* ---------- state machine ---------- */
  function resetRun() {
    ids.forEach(function (id) { var s = st[id]; s.lit = s.vis = s.fail = s.wait = s.shake = 0; });
    EDGES.forEach(function (e) { e.fill = 0; e.err = 0; e.broken = 0; });
    rings.length = 0; parts.length = 0;
    logEl.innerHTML = '';
    legIdx = 0; legT = 0; pause = 350; phase = 'legs'; tNow = 0; lastMs = -1;
    stage.classList.remove('is-failed'); errEl.classList.remove('is-on');
    statusEl.textContent = 'Tracing'; setTime(0);
  }

  function arrive(L) {
    var s = st[L.b];
    s.lit = 1; if (!L.err) s.vis = 1;
    var e = edgeMap[L.a + '>' + L.b] || edgeMap[L.b + '>' + L.a];
    if (L.err) e.err = 1; else if (edgeMap[L.a + '>' + L.b]) e.fill = 1;
    if (L.log && L.log[0] === 'end') logFrom(L.log);
    if (L.err) s.vis = 0.4;
  }

  function startFail() {
    phase = 'fail'; failT = 0;
    var e = edgeMap['payments>psp'], g = edgeGeo(e), p = bez(g.A, g.C, g.B, 0.86);
    e.broken = 1;
    var pay = st.payments;
    pay.fail = 0.01; pay.wait = 0; pay.shake = 1;
    for (var i = 0; i < 3; i++) rings.push({ x: pos('payments').x, y: pos('payments').y, t: -i * 0.16 });
    for (i = 0; i < 34; i++) {
      var a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 150;
      parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.7, age: 0, r: 1 + Math.random() * 1.8, w: Math.random() < 0.25 });
    }
    setTime(2490);
    statusEl.textContent = 'Error';
    stage.classList.add('is-failed');
    pushLog(FAIL_LOG[0], FAIL_LOG[1], FAIL_LOG[2], FAIL_LOG[3], 1);
  }

  function update(dt) {
    var i, id, s;
    // parallax + hover easing
    par.x += (par.tx - par.x) * Math.min(1, dt * 0.006);
    par.y += (par.ty - par.y) * Math.min(1, dt * 0.006);
    var k = W / 700;
    for (i = 0; i < ids.length; i++) {
      id = ids[i]; s = st[id];
      s.ox = par.x * NODES[id].depth * k; s.oy = par.y * NODES[id].depth * k;
      s.lit = Math.max(0, s.lit - dt / 900);
      s.hover += ((hoverId === id ? 1 : 0) - s.hover) * Math.min(1, dt * 0.014);
      if (s.shake > 0) { s.shake = Math.max(0, s.shake - dt / 700); }
      if (s.fail > 0 && s.fail < 1) s.fail = Math.min(1, s.fail + dt / 220);
    }
    spin += dt * 0.004;
    for (i = 0; i < EDGES.length; i++) { EDGES[i].amb.t += EDGES[i].amb.v * dt; if (EDGES[i].amb.t > 1) EDGES[i].amb.t = 0; }
    for (i = rings.length - 1; i >= 0; i--) { rings[i].t += dt / 900; if (rings[i].t >= 1) rings.splice(i, 1); }
    for (i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.age += dt / 1000;
      if (p.age > p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vx *= 0.96; p.vy *= 0.96;
    }

    if (phase === 'legs') {
      if (pause > 0) { pause -= dt; return; }
      var L = LEGS[legIdx];
      if (legT === 0 && L.log && L.log[0] === 'start') logFrom(L.log);
      if (legT === 0 && L.slow) st.payments.wait = 1;
      legT += dt;
      var u = Math.min(1, legT / L.dur);
      if (L.slow) tNow = L.ta + (L.tb - L.ta) * clamp((u - 0.12) / 0.88, 0, 1) * 0.985; else tNow = L.ta + (L.tb - L.ta) * easeIO(u);
      setTime(tNow);
      if (legT >= L.dur) {
        legT = 0;
        if (L.slow) { startFail(); return; }
        arrive(L);
        legIdx++; pause = L.err ? 30 : 90;
        if (legIdx >= LEGS.length) { phase = 'hold'; holdT = 0; setTime(2524); statusEl.textContent = 'Failed 500'; errEl.classList.add('is-on'); }
      }
    } else if (phase === 'fail') {
      failT += dt;
      if (failT > 780) { phase = 'legs'; legIdx++; legT = 0; pause = 60; }
    } else if (phase === 'hold') {
      holdT += dt;
      if (holdT > 4200) { phase = 'fade'; fadeT = 0; }
    } else if (phase === 'fade') {
      fadeT += dt; fade = 1 - clamp(fadeT / 600, 0, 1);
      if (fadeT >= 600) { resetRun(); phase = 'in'; fadeT = 0; }
    } else if (phase === 'in') {
      fadeT += dt; fade = clamp(fadeT / 500, 0, 1);
      if (fadeT >= 500) { fade = 1; phase = 'legs'; }
    }
  }

  /* ---------- drawing ---------- */
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  function drawEdges() {
    var i, e, g;
    ctx.lineCap = 'round';
    for (i = 0; i < EDGES.length; i++) {
      e = EDGES[i]; g = edgeGeo(e);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(WHITE, 0.1 + 0.05 * (st[e.a].hover + st[e.b].hover));
      ctx.setLineDash(e.dashed ? [3, 6] : []);
      strokePart(g, 0, 1);
      ctx.setLineDash([]);
      // traversed portion of the trace
      var f = e.fill;
      if (e.key === 'payments>psp' && phase === 'legs' && LEGS[legIdx] && LEGS[legIdx].slow && pause <= 0) {
        var u = clamp(legT / LEGS[legIdx].dur, 0, 1);
        f = u < 0.16 ? easeO(u / 0.16) * 0.5 : 0.5 + 0.36 * ((u - 0.16) / 0.84);
        e.headT = f;
      } else if (e.key === 'payments>psp' && (phase === 'fail' || e.broken)) f = 0.86;
      if (f > 0.001) {
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = rgba(ACCENT, e.err ? 0.25 : 0.7);
        strokePart(g, 0, Math.min(1, f));
      }
      if (e.broken && (phase === 'fail' || phase === 'legs' || phase === 'hold')) {
        ctx.lineWidth = 1.4; ctx.setLineDash([2, 5]);
        ctx.strokeStyle = rgba(ERR, phase === 'fail' ? 0.4 + 0.5 * Math.random() : 0.5);
        strokePart(g, 0.86, 1);
        ctx.setLineDash([]);
      }
      if (e.err > 0) {
        ctx.lineWidth = 2; ctx.strokeStyle = rgba(ERR, 0.9);
        strokePart(g, 0, 1);
      }
    }
  }

  function drawAmbient() {
    if (reduce) return;
    for (var i = 0; i < EDGES.length; i++) {
      var e = EDGES[i], g = edgeGeo(e), t = i % 2 ? 1 - e.amb.t : e.amb.t, p = bez(g.A, g.C, g.B, t);
      ctx.fillStyle = rgba(WHITE, 0.22);
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, 6.283); ctx.fill();
    }
  }

  function drawPacket() {
    if (phase !== 'legs' || pause > 0 || !LEGS[legIdx]) return;
    var L = LEGS[legIdx], e = edgeMap[L.a + '>' + L.b], rev = false;
    if (!e) { e = edgeMap[L.b + '>' + L.a]; rev = true; }
    var g = edgeGeo(e), u = clamp(legT / L.dur, 0, 1), t;
    if (L.slow) t = u < 0.16 ? easeO(u / 0.16) * 0.5 : 0.5 + 0.36 * ((u - 0.16) / 0.84);
    else t = easeIO(u);
    var col = L.err ? ERR : ACCENT;
    var param = rev ? 1 - t : t, span = 0.34, n = 14, i;
    ctx.lineCap = 'round';
    for (i = 0; i < n; i++) {
      var f0 = i / n, f1 = (i + 1) / n;
      var a0 = rev ? param + span * (1 - f0) : param - span * (1 - f0);
      var a1 = rev ? param + span * (1 - f1) : param - span * (1 - f1);
      a0 = clamp(a0, 0, 1); a1 = clamp(a1, 0, 1);
      var p0 = bez(g.A, g.C, g.B, a0), p1 = bez(g.A, g.C, g.B, a1);
      ctx.strokeStyle = rgba(col, 0.05 + 0.95 * f1 * f1);
      ctx.lineWidth = 0.8 + 2.6 * f1;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    var h = bez(g.A, g.C, g.B, param);
    var gr = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, 20);
    gr.addColorStop(0, rgba(col, 0.55)); gr.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(h.x, h.y, 20, 0, 6.283); ctx.fill();
    ctx.fillStyle = L.err ? '#ffd3cd' : '#f4ffc9';
    ctx.beginPath(); ctx.arc(h.x, h.y, 3.4, 0, 6.283); ctx.fill();
  }

  function nodeShape(kind, s) {
    var h = s / 2;
    if (kind === 'client') { ctx.beginPath(); ctx.arc(0, 0, h * 0.95, 0, 6.283); }
    else rr(-h, -h, s, s, s * 0.24);
  }

  function drawNode(id) {
    var n = NODES[id], s = st[id], p = pos(id), h = S / 2;
    var k = Math.max(s.vis * 0.55, s.lit, s.hover * 0.7);
    var sx = 0, sy = 0;
    if (s.shake > 0) { sx = (Math.random() - 0.5) * 9 * s.shake; sy = (Math.random() - 0.5) * 5 * s.shake; }
    ctx.save(); ctx.translate(p.x + sx, p.y + sy);

    // glow
    var glow = Math.max(s.lit, s.fail * 0.9, s.hover * 0.5);
    if (glow > 0.02) {
      var gc = s.fail > 0.02 ? ERR : ACCENT;
      var gr = ctx.createRadialGradient(0, 0, h * 0.4, 0, 0, S * 1.7);
      gr.addColorStop(0, rgba(gc, 0.3 * glow)); gr.addColorStop(1, rgba(gc, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, S * 1.7, 0, 6.283); ctx.fill();
    }

    var strokeA = 0.2 + 0.75 * k;
    var stroke = mix(mix(WHITE, ACCENT, k), ERR, s.fail);
    var fill = mix(mix(PANEL, [30, 38, 12], Math.min(1, k)), [52, 16, 14], s.fail);
    ctx.lineWidth = 1.2 + 0.6 * Math.max(s.lit, s.fail);
    ctx.strokeStyle = rgba(stroke, Math.max(strokeA, s.fail));
    ctx.fillStyle = rgba(fill, 1);

    if (n.kind === 'db') {
      var w = S * 0.92, ry = S * 0.17, top = -h * 0.82, bot = h * 0.82;
      ctx.beginPath(); ctx.moveTo(-w / 2, top); ctx.lineTo(-w / 2, bot); ctx.ellipse(0, bot, w / 2, ry, 0, Math.PI, 0, true); ctx.lineTo(w / 2, top); ctx.ellipse(0, top, w / 2, ry, 0, 0, Math.PI * 2); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, top + (bot - top) * 0.36, w / 2, ry, 0, 0, Math.PI, false); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, top + (bot - top) * 0.68, w / 2, ry, 0, 0, Math.PI, false); ctx.stroke();
    } else if (n.kind === 'queue') {
      var qw = S * 1.3, qh = S * 0.7;
      rr(-qw / 2, -qh / 2, qw, qh, 6); ctx.fill(); ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
      for (var q = 0; q < 3; q++) {
        ctx.fillStyle = rgba(mix(WHITE, ACCENT, k), 0.12 + 0.3 * k);
        rr(-qw / 2 + 6 + q * (qw - 12) / 3, -qh / 2 + 7, (qw - 12) / 3 - 4, qh - 14, 2); ctx.fill();
      }
    } else {
      nodeShape(n.kind, S);
      ctx.fill();
      if (n.kind === 'ext') ctx.setLineDash([3, 3]);
      ctx.stroke(); ctx.setLineDash([]);
      if (n.kind === 'client') {
        ctx.fillStyle = rgba(mix(WHITE, ACCENT, k), 0.5 + 0.5 * k);
        ctx.beginPath(); ctx.moveTo(-h * 0.22, -h * 0.34); ctx.lineTo(h * 0.42, 0); ctx.lineTo(-h * 0.22, h * 0.34); ctx.closePath(); ctx.fill();
      } else {
        ctx.font = '700 ' + (S < 34 ? 9 : 10.5) + 'px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba(mix(mix([150, 158, 172], ACCENT, k), ERR, s.fail), 1);
        ctx.fillText(n.tag, 0, 0.5);
      }
    }

    // wait spinner on payments
    if (id === 'payments' && s.wait > 0) {
      ctx.strokeStyle = rgba(WARN, 0.9); ctx.lineWidth = 1.6; ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -spin * 14;
      rr(-h - 6, -h - 6, S + 12, S + 12, S * 0.24 + 4); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
    // failure badge
    if (s.fail > 0.5) {
      ctx.fillStyle = rgba(ERR, 1); ctx.beginPath(); ctx.arc(h * 0.95, -h * 0.95, 8, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#1a0503'; ctx.font = '800 11px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', h * 0.95, -h * 0.95 + 0.5);
    }
    ctx.restore();

    // label
    ctx.font = '500 ' + FS + 'px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    var lw = ctx.measureText(n.label).width;
    var lx = clamp(p.x + sx, lw / 2 + 6, W - lw / 2 - 6);
    var ly = p.y + (n.kind === 'queue' ? S * 0.35 : h) + FS + 7;
    var lc = mix(mix([128, 137, 151], WHITE, Math.max(s.vis, s.lit, s.hover)), [255, 140, 128], s.fail);
    ctx.fillStyle = 'rgba(12,14,17,0.82)';
    ctx.fillRect(lx - lw / 2 - 4, ly - FS - 1, lw + 8, FS + 6);
    ctx.fillStyle = rgba(lc, 1);
    ctx.fillText(n.label, lx, ly);
    if (id === 'payments' && s.wait > 0 && s.fail < 0.1) {
      ctx.fillStyle = rgba(WARN, 0.9); ctx.font = '500 ' + (FS - 1) + 'px ' + MONO;
      ctx.fillText('waiting on card-processor', clamp(p.x, 84, W - 84), ly + FS + 4);
    }
    if (id === 'payments' && s.fail > 0.5) {
      ctx.fillStyle = rgba(ERR, 1); ctx.font = '600 ' + (FS - 0.5) + 'px ' + MONO;
      ctx.fillText('charge.go:142', clamp(p.x, 50, W - 50), ly + FS + 4);
    }
  }

  function drawFx() {
    var i, r, p, a;
    for (i = 0; i < rings.length; i++) {
      r = rings[i]; if (r.t < 0) continue;
      a = 1 - r.t;
      ctx.strokeStyle = rgba(ERR, 0.7 * a * a); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(r.x, r.y, S * 0.6 + r.t * S * 2.6, 0, 6.283); ctx.stroke();
    }
    for (i = 0; i < parts.length; i++) {
      p = parts[i]; a = 1 - p.age / p.life;
      ctx.fillStyle = rgba(p.w ? WHITE : ERR, a);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = fade;
    drawEdges(); drawAmbient(); drawPacket();
    for (var i = 0; i < ids.length; i++) drawNode(ids[i]);
    drawFx();
    ctx.globalAlpha = 1;
  }

  /* ---------- loop ---------- */
  function frame(ts) {
    if (!running) return;
    var dt = Math.min(48, ts - last || 16); last = ts;
    update(dt); draw();
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || reduce || !visible || document.hidden) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  /* static final state for reduced motion */
  function finalState() {
    resetRun();
    LEGS.forEach(function (L) { arrive(L); if (L.log && L.log[0] === 'start') logFrom(L.log); });
    st.payments.fail = 1; st.payments.lit = 0; st.payments.wait = 0;
    edgeMap['payments>psp'].broken = 1; edgeMap['payments>psp'].fill = 0;
    ids.forEach(function (id) { st[id].lit = 0; });
    logEl.innerHTML = '';
    [['end', 38, 'auth-svc', 'ok', '34 ms'], ['end', 92, 'postgres', 'INSERT orders', '48 ms'], ['end', 412, 'inventory-svc', 'ok', '317 ms'], ['start', 490, 'card-processor', 'POST /v1/charges']].forEach(logFrom);
    pushLog(FAIL_LOG[0], FAIL_LOG[1], FAIL_LOG[2], FAIL_LOG[3], 1);
    pushLog(2524, 'api-gateway', 'HTTP 500', '2,524 ms', 1);
    phase = 'hold'; fade = 1;
    setTime(2524); statusEl.textContent = 'Failed 500';
    stage.classList.add('is-failed'); errEl.classList.add('is-on');
    draw();
  }

  /* ---------- pointer ---------- */
  function onMove(ev) {
    var r = wrap.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    par.tx = clamp((x / r.width - 0.5) * 2, -1, 1); par.ty = clamp((y / r.height - 0.5) * 2, -1, 1);
    var best = null, bd = S * 0.95;
    ids.forEach(function (id) { var p = pos(id), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = id; } });
    if (best !== hoverId) { hoverId = best; showTip(best); if (reduce) draw(); }
  }
  function onLeave() { par.tx = par.ty = 0; hoverId = null; showTip(null); if (reduce) draw(); }
  function showTip(id) {
    if (!id) { tipEl.classList.remove('is-on'); return; }
    var n = NODES[id], p = pos(id);
    tipEl.innerHTML = '<b></b><span></span><br><span></span>';
    tipEl.children[0].textContent = n.label; tipEl.children[1].textContent = n.info[0]; tipEl.children[3].textContent = n.info[1];
    var tw = 176, x = clamp(p.x, tw / 2 + 8, W - tw / 2 - 8), y = Math.max(p.y - S * 0.8, 70);
    tipEl.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-100%)';
    tipEl.classList.add('is-on');
  }
  if (!('ontouchstart' in window)) {
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerleave', onLeave);
  }

  /* ---------- boot ---------- */
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(wrap); else window.addEventListener('resize', layout);
  layout();
  if (reduce) { finalState(); } else { resetRun(); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0.05 }).observe(stage);
  }
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!running) draw(); });
  start();

  // hero grid spotlight follows the pointer
  var hero = document.getElementById('top');
  if (hero && matchMedia('(hover: hover)').matches && !reduce) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      hero.style.setProperty('--my', (e.clientY - r.top) + 'px');
      hero.style.setProperty('--hot', 1);
    });
    hero.addEventListener('pointerleave', function () { hero.style.setProperty('--hot', 0); });
  }
})();
