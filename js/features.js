/* ==========================================================================
   TRACELINE — features: sticky stage that changes with scroll position
   ========================================================================== */
(function () {
  var feat = document.getElementById('feat');
  if (!feat) return;

  var list = document.getElementById('featList');
  var stageEl = document.getElementById('featStage');
  var items = Array.prototype.slice.call(list.querySelectorAll('.feat__item'));
  var vizs = Array.prototype.slice.call(stageEl.querySelectorAll('.viz'));
  var dots = stageEl.querySelectorAll('.stage-frame__dots i');
  var figLabel = document.getElementById('figLabel');
  var LABELS = ['fig. 01 — propagation', 'fig. 02 — source jump', 'fig. 03 — queues and queries', 'fig. 04 — tail sampling', 'fig. 05 — trace diff'];
  var reduce = document.documentElement.classList.contains('reduce');
  var hasG = typeof window.gsap !== 'undefined';
  var active = -1, inView = false, timelines = [];

  // rail
  var rail = document.createElement('span'); rail.className = 'feat__rail'; rail.setAttribute('aria-hidden', 'true'); rail.innerHTML = '<i></i>';
  list.appendChild(rail);

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ------------------------------------------------------------- viz 0 */
  function buildV0() {
    var svg = stageEl.querySelector('.v0'), nodes = svg.querySelectorAll('.v0-node'), paths = [svg.getElementById ? svg.getElementById('v0p1') : svg.querySelector('#v0p1'), svg.querySelector('#v0p2'), svg.querySelector('#v0p3')];
    var packet = svg.querySelector('.v0-packet'), lens = paths.map(function (p) { return p.getTotalLength(); });
    function place(pi, v) { var pt = paths[pi].getPointAtLength(lens[pi] * v); packet.setAttribute('transform', 'translate(' + pt.x + ' ' + pt.y + ')'); }
    function reset() {
      nodes.forEach(function (n) { n.classList.remove('is-hit'); });
      paths.forEach(function (p) { p.classList.remove('is-lit'); });
      packet.style.opacity = 0; packet.setAttribute('transform', 'translate(230 62)');
    }
    function finalState() { nodes.forEach(function (n) { n.classList.add('is-hit'); }); paths.forEach(function (p) { p.classList.add('is-lit'); }); packet.style.opacity = 0; }
    if (!hasG || reduce) { finalState(); return null; }
    var tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5, paused: true });
    var o = { v: 0 };
    tl.call(reset).call(function () { nodes[0].classList.add('is-hit'); }, null, 0.25);
    [0, 1, 2].forEach(function (i) {
      var at = 0.6 + i * 1.15;
      tl.call(function () { paths[i].classList.add('is-lit'); place(i, 0); packet.style.opacity = 1; }, null, at);
      tl.fromTo(o, { v: 0 }, { v: 1, duration: 0.85, ease: 'power2.inOut', onUpdate: function () { place(i, o.v); } }, at);
      tl.call(function () { nodes[i + 1].classList.add('is-hit'); }, null, at + 0.85);
    });
    tl.to(packet, { opacity: 0, duration: 0.3 }, 4.2);
    tl.to({}, { duration: 1.6 }, 4.3);
    return tl;
  }

  /* ------------------------------------------------------------- viz 1 */
  function buildV1() {
    var code = stageEl.querySelector('.v1__code'), scan = code.querySelector('.v1__scan'), hit = code.querySelector('.v1__hit');
    if (!hasG || reduce) { code.classList.add('is-found'); return null; }
    var tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4, paused: true });
    tl.call(function () { code.classList.remove('is-found'); gsap.set(scan, { opacity: 1, y: code.querySelector('.ln').offsetTop }); }, null, 0);
    tl.to(scan, { y: function () { return hit.offsetTop; }, duration: 1.5, ease: 'steps(6)' }, 0.5);
    tl.call(function () { code.classList.add('is-found'); gsap.set(scan, { opacity: 0 }); }, null, 2.05);
    tl.to({}, { duration: 3.6 }, 2.1);
    return tl;
  }

  /* ------------------------------------------------------------- viz 2 */
  function buildV2() {
    var n1 = document.getElementById('v2n1'), i, h = '';
    var pattern = [0.5, 0.62, 0.55, 0.7, 0.6, 0.66, 0.52, 0.74, 0.58, 0.68, 0.6, 0.72, 0.64, 0.56, 0.7, 0.6];
    for (i = 0; i < 48; i++) h += '<i style="height:' + Math.round(pattern[i % pattern.length] * 100) + '%"></i>';
    n1.innerHTML = h;
    if (!hasG || reduce) return null;
    var bars = stageEl.querySelectorAll('.v2__bar'), qs = n1.querySelectorAll('i'), flag = stageEl.querySelector('.v2__flag'), sql = stageEl.querySelector('.v2__sql');
    var tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8, paused: true });
    tl.set(bars, { scaleX: 0 }, 0).set(qs, { scaleY: 0 }, 0).set([flag, sql], { opacity: 0, y: 8 }, 0);
    tl.to(bars, { scaleX: 1, duration: 0.7, ease: 'power3.out', stagger: 0.28 }, 0.2);
    tl.to(sql, { opacity: 1, y: 0, duration: 0.4 }, 1.2);
    tl.to(qs, { scaleY: 1, duration: 0.35, ease: 'power2.out', stagger: 0.03 }, 1.3);
    tl.to(flag, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 2.9);
    tl.to({}, { duration: 3 }, 3.4);
    return tl;
  }

  /* ------------------------------------------------------------- viz 3 */
  var sampler = (function () {
    var cv = document.getElementById('samplerCanvas');
    if (!cv) return null;
    var c = cv.getContext('2d'), W = 0, H = 0, dpr = 1, dotsA = [], tray = [], acc = 0, last = 0, raf = 0, on = false;
    var MONO = '"JetBrains Mono", ui-monospace, monospace';
    function size() {
      var r = cv.getBoundingClientRect(); W = r.width; H = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    function spawn() {
      var lanes = 9, lane = (Math.random() * lanes) | 0;
      dotsA.push({ x: W * (0.1 + 0.8 * (lane + 0.5) / lanes) + (Math.random() - 0.5) * 6, y: -6, vy: 150 + Math.random() * 70, err: Math.random() < 0.03, state: 0, a: 1, vx: 0 });
    }
    function draw() {
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      var sy = H * 0.5, ty = H * 0.72;
      // sampler line
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1; c.setLineDash([4, 5]);
      c.beginPath(); c.moveTo(0, sy); c.lineTo(W, sy); c.stroke(); c.setLineDash([]);
      c.font = '500 11px ' + MONO; c.textAlign = 'left'; c.fillStyle = '#8f98a6';
      c.fillText('every trace', 10, 16);
      c.fillText('tail sampler: decides after the request ends', 10, sy - 8);
      c.fillStyle = '#c8f531'; c.fillText('kept', 10, ty - 10);
      // tray
      c.strokeStyle = 'rgba(200,245,49,0.35)'; c.strokeRect(0.5, ty, W - 1, H - ty - 1);
      var i, d;
      for (i = 0; i < tray.length; i++) {
        d = tray[i]; c.globalAlpha = d.a * 0.9; c.fillStyle = d.err ? '#ff5d4d' : '#c8f531';
        c.beginPath(); c.arc(d.x, d.y, 3.4, 0, 6.283); c.fill();
      }
      c.globalAlpha = 1;
      for (i = 0; i < dotsA.length; i++) {
        d = dotsA[i]; c.globalAlpha = d.a;
        if (d.err) { var g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, 14); g.addColorStop(0, 'rgba(255,93,77,0.6)'); g.addColorStop(1, 'rgba(255,93,77,0)'); c.fillStyle = g; c.beginPath(); c.arc(d.x, d.y, 14, 0, 6.283); c.fill(); }
        c.fillStyle = d.err ? '#ff5d4d' : (d.state === 1 ? '#c8f531' : 'rgba(255,255,255,0.55)');
        c.beginPath(); c.arc(d.x, d.y, d.err ? 4 : 3, 0, 6.283); c.fill();
      }
      c.globalAlpha = 1;
    }
    function step(dt) {
      var sy = H * 0.5, i, d, ty = H * 0.72;
      acc += dt; while (acc > 0.045) { acc -= 0.045; spawn(); }
      for (i = dotsA.length - 1; i >= 0; i--) {
        d = dotsA[i]; d.y += d.vy * dt; d.x += d.vx * dt;
        if (d.state === 0 && d.y >= sy) {
          d.keep = d.err || Math.random() < 0.04; d.state = d.keep ? 1 : 2;
          if (!d.keep) { d.vx = (Math.random() - 0.5) * 90; d.vy *= 0.5; }
        }
        if (d.state === 2) d.a -= dt * 2.2;
        if (d.state === 1 && d.y >= ty + 14) {
          var col = tray.length % 24, row = (tray.length / 24) | 0;
          tray.push({ x: 14 + col * ((W - 28) / 23), y: H - 14 - (row % 3) * 11, err: d.err, a: 1 });
          if (tray.length > 72) tray.shift();
          tray.forEach(function (t, k) { t.a = 0.25 + 0.75 * (k / tray.length); t.x = 14 + (k % 24) * ((W - 28) / 23); t.y = H - 14 - (((k / 24) | 0) % 3) * 11; });
          dotsA.splice(i, 1); continue;
        }
        if (d.a <= 0 || d.y > H + 10) dotsA.splice(i, 1);
      }
    }
    function frame(ts) {
      if (!on) return;
      var dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
      step(dt); draw(); raf = requestAnimationFrame(frame);
    }
    function seedStatic() {
      var i, k; tray = []; dotsA = [];
      for (i = 0; i < 26; i++) tray.push({ x: 0, y: 0, err: i % 9 === 0, a: 1 });
      tray.forEach(function (t, k2) { t.a = 0.25 + 0.75 * (k2 / tray.length); t.x = 14 + (k2 % 24) * ((W - 28) / 23); t.y = H - 14 - (((k2 / 24) | 0) % 3) * 11; });
      for (i = 0; i < 40; i++) { k = Math.random(); dotsA.push({ x: W * (0.1 + 0.8 * Math.random()), y: k * H * 0.5, err: i === 5, state: 0, a: 1 }); }
    }
    size();
    if ('ResizeObserver' in window) new ResizeObserver(function () { size(); if (!on) draw(); }).observe(cv);
    return {
      start: function () { if (on || reduce) { if (reduce) { size(); seedStatic(); draw(); } return; } on = true; last = performance.now(); raf = requestAnimationFrame(frame); },
      stop: function () { on = false; cancelAnimationFrame(raf); }
    };
  })();

  /* ------------------------------------------------------------- viz 4 */
  function buildV4() {
    if (!hasG || reduce) { stageEl.querySelector('.v4__delta').style.cssText = 'opacity:1;transform:none'; return null; }
    var base = stageEl.querySelectorAll('.v4__set:not(.v4__set--slow) .v4__track i'), slow = stageEl.querySelectorAll('.v4__set--slow .v4__track i:not(.v4__grow)'), grow = stageEl.querySelector('.v4__grow'), delta = stageEl.querySelector('.v4__delta');
    var tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8, paused: true });
    tl.set([base, slow, grow], { scaleX: 0 }, 0).set(delta, { opacity: 0, y: 6 }, 0);
    tl.to(base, { scaleX: 1, duration: 0.6, ease: 'power3.out', stagger: 0.1 }, 0.2);
    tl.to(slow, { scaleX: 1, duration: 0.6, ease: 'power3.out', stagger: 0.1 }, 1.0);
    tl.to(grow, { scaleX: 0.45, duration: 0.5, ease: 'power3.out' }, 1.4);
    tl.to(grow, { scaleX: 1, duration: 1.1, ease: 'power2.inOut' }, 2.0);
    tl.to(delta, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 3.0);
    tl.to({}, { duration: 2.4 }, 3.4);
    return tl;
  }

  var builders = [buildV0, buildV1, buildV2, null, buildV4];
  function timeline(i) {
    if (timelines[i] === undefined) timelines[i] = builders[i] ? builders[i]() : null;
    return timelines[i];
  }

  /* --------------------------------------------------------- activation */
  function playActive() {
    timelines.forEach(function (t, k) { if (t && k !== active) t.pause(); });
    if (sampler && active !== 3) sampler.stop();
    if (!inView) return;
    if (active === 3) { sampler && sampler.start(); return; }
    var t = timeline(active);
    if (t) t.restart();
  }

  function setActive(i) {
    if (i === active) return;
    active = i;
    items.forEach(function (it, k) { it.classList.toggle('is-active', k === i); });
    vizs.forEach(function (v, k) { v.classList.toggle('is-active', k === i); });
    dots.forEach(function (d, k) { d.classList.toggle('is-on', k <= i); });
    if (figLabel) figLabel.textContent = LABELS[i];
    if (i !== 0 || timelines[0] !== undefined || inView) playActive();
    if (reduce) { timeline(i); if (i === 3 && sampler) sampler.start(); }
  }

  /* ------------------------------------------------------------- scroll */
  var ticking = false, mq = window.matchMedia('(max-width: 900px)');
  function measure() {
    ticking = false;
    var vh = window.innerHeight, line = mq.matches ? vh * 0.7 : vh * 0.5, best = 0, bd = Infinity, i, r;
    for (i = 0; i < items.length; i++) {
      r = items[i].getBoundingClientRect();
      var c = (r.top + r.bottom) / 2, d = Math.abs(c - line);
      if (line >= r.top && line <= r.bottom) { best = i; bd = -1; break; }
      if (d < bd) { bd = d; best = i; }
    }
    setActive(best);
    var lr = list.getBoundingClientRect();
    var p = clamp((line - lr.top) / lr.height, 0, 1);
    list.style.setProperty('--fp', p.toFixed(4));
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(measure); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      var v = en[0].isIntersecting;
      if (v === inView) return;
      inView = v;
      if (v) playActive(); else { timelines.forEach(function (t) { if (t) t.pause(); }); sampler && sampler.stop(); }
    }, { threshold: 0, rootMargin: '-10% 0px -10% 0px' }).observe(feat);
  } else inView = true;

  // initial state
  measure();
  if (reduce) { for (var k = 0; k < builders.length; k++) timeline(k); if (sampler) sampler.start(); }
})();
