/* ==========================================================================
   TRACELINE — core: smooth scroll, nav, reveals, cursor, counters, install
   tabs + copy, pricing toggle, FAQ, forms.
   ========================================================================== */
(function () {
  var doc = document.documentElement;
  var reduce = doc.classList.contains('reduce');
  var hasG = typeof window.gsap !== 'undefined';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  window.TL = window.TL || {};

  // If the animation library failed to load, never leave content hidden.
  if (!hasG) doc.classList.remove('js');
  if (hasG && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------- smooth scroll */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.1, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
    if (hasG && window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
    }
  }
  function scrollToEl(target, offset) {
    var el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    var off = offset === undefined ? -(parseInt(getComputedStyle(doc).getPropertyValue('--nav-h')) || 64) : offset;
    if (lenis) lenis.scrollTo(el, { offset: off, duration: 1.4, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  window.TL.scrollTo = scrollToEl;

  // in-page anchors
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (href === '#') { e.preventDefault(); return; }
    var t = href.length > 1 && $(href);
    if (!t) return;
    e.preventDefault();
    if (a.hasAttribute('data-jump')) {
      scrollToEl('#demo');
      setTimeout(function () { document.dispatchEvent(new CustomEvent('trace:jump')); }, reduce ? 50 : 1100);
      return;
    }
    closeMenu();
    if (href === '#top') { lenis ? lenis.scrollTo(0, { duration: 1.4 }) : window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); return; }
    scrollToEl(t);
    if (href === '#start') setTimeout(function () { var i = $('#startEmail'); if (i) i.focus({ preventScroll: true }); }, reduce ? 50 : 1000);
    history.replaceState(null, '', href);
  });

  /* ------------------------------------------------------------ nav */
  var nav = $('#nav');
  function navState() { nav.classList.toggle('is-stuck', window.scrollY > 24); }
  window.addEventListener('scroll', navState, { passive: true }); navState();

  var menuBtn = $('#menuBtn'), menu = $('#mobileMenu');
  function openMenu() {
    menu.classList.add('is-open'); menu.inert = false;
    menuBtn.setAttribute('aria-expanded', 'true'); menuBtn.setAttribute('aria-label', 'Close menu');
    lenis && lenis.stop(); doc.style.overflow = 'hidden';
    var first = $('a', menu); first && setTimeout(function () { first.focus(); }, 60);
  }
  function closeMenu() {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open'); menu.inert = true;
    menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.setAttribute('aria-label', 'Open menu');
    lenis && lenis.start(); doc.style.overflow = '';
  }
  menu.inert = true;
  menuBtn.addEventListener('click', function () { menu.classList.contains('is-open') ? closeMenu() : openMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenu(); } });
  // keep Tab inside the open menu (menu button + menu contents)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !menu.classList.contains('is-open')) return;
    var f = [menuBtn].concat($$('a, button', menu)), i = f.indexOf(document.activeElement);
    var n = e.shiftKey ? f[(i <= 0 ? f.length : i) - 1] : f[(i + 1) % f.length];
    n.focus(); e.preventDefault();
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', function (m) { if (m.matches) closeMenu(); });
  $$('#mobileMenu [data-open-demo]').forEach(function (b) { b.addEventListener('click', closeMenu); });

  /* scroll spy: nav links + rail */
  var spyLinks = $$('.nav__links a, .rail a');
  var sections = $$('[data-section]');
  function spy() {
    var line = window.innerHeight * 0.4, cur = sections[0];
    sections.forEach(function (s) { if (s.getBoundingClientRect().top <= line) cur = s; });
    var id = cur ? '#' + cur.id : '';
    spyLinks.forEach(function (a) { if (a.getAttribute('href') === id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  window.addEventListener('scroll', spy, { passive: true }); spy();

  /* ------------------------------------------------------- split text */
  function splitWords(el) {
    var nodes = Array.prototype.slice.call(el.childNodes), out = document.createDocumentFragment();
    nodes.forEach(function (n) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (w) {
          if (!w) return;
          if (/^\s+$/.test(w)) { out.appendChild(document.createTextNode(' ')); return; }
          var o = document.createElement('span'); o.className = 'split-word';
          var i = document.createElement('span'); i.textContent = w; o.appendChild(i); out.appendChild(o);
        });
      } else out.appendChild(n);
    });
    el.textContent = ''; el.appendChild(out);
  }
  $$('[data-split]').forEach(splitWords);

  /* -------------------------------------------------------- reveals */
  if (hasG && window.ScrollTrigger && !reduce) {
    // hero intro
    gsap.fromTo('.hero__title .split-line > span', { yPercent: 112, y: 0 }, { yPercent: 0, y: 0, duration: 1.25, ease: 'expo.out', stagger: 0.09, delay: 0.15 });
    gsap.to('.hero [data-reveal]', { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09, delay: 0.45 });

    // section titles
    $$('[data-split]').forEach(function (h) {
      var words = $$('.split-word > span', h);
      gsap.fromTo(words, { yPercent: 112, y: 0 }, { yPercent: 0, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
    });

    // generic reveals (not inside hero, batched so siblings stagger)
    ScrollTrigger.batch($$('[data-reveal]').filter(function (el) { return !el.closest('.hero'); }), {
      start: 'top 90%', once: true,
      onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08, overwrite: true }); }
    });

    // rules that run across section tops
    $$('.section').forEach(function (s) {
      gsap.fromTo(s, { '--edge': 0, '--edge-o': 1 }, {
        '--edge': 1, '--edge-o': 0, duration: 1.4, ease: 'power2.out',
        scrollTrigger: { trigger: s, start: 'top 85%', once: true }
      });
    });

    // hero parallax on scroll
    gsap.to('.hero .stage', { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__copy', { yPercent: 8, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: '55% top', end: 'bottom top', scrub: true } });

    // footer wordmark + CTA trace
    var w = $('#footWord');
    if (w) ScrollTrigger.create({ trigger: w, start: 'top 95%', end: 'bottom 60%', scrub: 0.6, onUpdate: function (s) { w.style.setProperty('--w', s.progress.toFixed(3)); } });
    var path = $('#ctaPath');
    if (path) {
      var len = path.getTotalLength ? path.getTotalLength() : 1600;
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      gsap.to(path, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '#start', start: 'top 70%', end: 'bottom bottom', scrub: 0.8 } });
    }
  } else {
    doc.classList.remove('js');
    var wd = $('#footWord'); if (wd) wd.style.setProperty('--w', 1);
  }

  /* -------------------------------------------------------- cursor */
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine && !reduce) {
    var cur = $('.cursor'), ring = $('.cursor__ring', cur), dot = $('.cursor__dot', cur), lab = $('.cursor__label', cur);
    var mx = -100, my = -100, rx = -100, ry = -100, shown = false;
    doc.classList.add('has-cursor');
    document.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!shown) { shown = true; rx = mx; ry = my; cur.classList.remove('is-hidden'); }
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      var t = e.target.closest ? e.target : null, link = t && t.closest('a, button, [role="tab"], [role="switch"], label, summary'), tag = t && t.closest('[data-cursor]');
      cur.classList.toggle('is-link', !!link);
      if (tag && !link) { if (lab.textContent !== tag.getAttribute('data-cursor')) lab.textContent = tag.getAttribute('data-cursor'); cur.classList.add('has-label'); }
      else cur.classList.remove('has-label');
      var txt = t && t.closest('input, textarea, select');
      cur.classList.toggle('is-hidden', !!txt);
    });
    document.addEventListener('pointerdown', function () { cur.classList.add('is-down'); });
    document.addEventListener('pointerup', function () { cur.classList.remove('is-down'); });
    document.documentElement.addEventListener('pointerleave', function () { cur.classList.add('is-hidden'); shown = false; });
    (function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
      lab.style.setProperty('--x', rx + 'px');
      cur.style.setProperty('--rx', rx + 'px'); cur.style.setProperty('--ry', ry + 'px');
      requestAnimationFrame(loop);
    })();
    cur.classList.add('is-hidden');
  }

  /* -------------------------------------------------- magnetic buttons */
  if (fine && !reduce && hasG) {
    $$('[data-magnetic]').forEach(function (b) {
      var qx = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3.out' }), qy = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3.out' });
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        qx((e.clientX - (r.left + r.width / 2)) * 0.28); qy((e.clientY - (r.top + r.height / 2)) * 0.36);
      });
      b.addEventListener('pointerleave', function () { qx(0); qy(0); });
    });
  }

  /* -------------------------------------------- spotlight on plan cards */
  $$('.plan').forEach(function (p) {
    p.addEventListener('pointermove', function (e) {
      var r = p.getBoundingClientRect();
      p.style.setProperty('--mx', (e.clientX - r.left) + 'px'); p.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ------------------------------------------------------- copy buttons */
  var copyStatus = $('#copyStatus');
  function legacyCopy(text) {
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      document.body.removeChild(ta);
      ok ? res() : rej();
    });
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    return legacyCopy(text);
  }
  $$('[data-copy-target]').forEach(function (btn) {
    var label = $('[data-copy-label]', btn), timer;
    btn.addEventListener('click', function () {
      var src = $(btn.getAttribute('data-copy-target'));
      if (!src) return;
      copyText(src.textContent.replace(/\s+$/, '')).then(function () {
        btn.classList.add('is-done'); if (label) label.textContent = 'Copied';
        if (copyStatus) copyStatus.textContent = 'Copied to clipboard';
        clearTimeout(timer);
        timer = setTimeout(function () { btn.classList.remove('is-done'); if (label) label.textContent = 'Copy'; if (copyStatus) copyStatus.textContent = ''; }, 1800);
      }).catch(function () {
        if (label) label.textContent = 'Press Ctrl+C';
        var sel = window.getSelection(), rg = document.createRange(); rg.selectNodeContents(src); sel.removeAllRanges(); sel.addRange(rg);
        setTimeout(function () { if (label) label.textContent = 'Copy'; }, 2200);
      });
    });
  });

  /* ------------------------------------------------------- install tabs */
  (function () {
    var tabs = $$('#installTerm [role="tab"]');
    function pick(t, focus) {
      tabs.forEach(function (x) {
        var on = x === t;
        x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
        var p = document.getElementById(x.getAttribute('aria-controls')); p.hidden = !on;
      });
      if (focus) t.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { pick(t); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') n = tabs[0];
        else if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { pick(n, true); e.preventDefault(); }
      });
    });
  })();

  /* ---------------------------------------------------------- counters */
  function fmtNum(v, dec) { return v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  $$('[data-count]').forEach(function (el) {
    var end = parseFloat(el.getAttribute('data-count')), dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    if (!hasG || reduce || !window.ScrollTrigger) { el.textContent = fmtNum(end, dec); return; }
    var o = { v: 0 };
    el.textContent = fmtNum(0, dec);
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: function () { gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: function () { el.textContent = fmtNum(o.v, dec); } }); }
    });
  });

  // latency histogram
  (function () {
    var h = $('#hist'); if (!h) return;
    var n = 44, html = '', i, mu = 0.32, sig = 0.34;
    for (i = 0; i < n; i++) {
      var x = (i + 1) / n * 1.0, v = Math.exp(-Math.pow(Math.log(x) - Math.log(mu), 2) / (2 * sig * sig)) / x;
      var cls = i === 30 ? ' class="is-p99"' : i > 30 ? ' class="is-tail"' : '';
      html += '<i' + cls + ' data-v="' + v.toFixed(4) + '"></i>';
    }
    h.innerHTML = html;
    var bars = $$('i', h), max = Math.max.apply(null, bars.map(function (b) { return parseFloat(b.dataset.v); }));
    bars.forEach(function (b) { b.style.height = Math.max(4, parseFloat(b.dataset.v) / max * 100) + '%'; });
    if (hasG && window.ScrollTrigger && !reduce) {
      gsap.set(bars, { scaleY: 0 });
      ScrollTrigger.create({ trigger: h, start: 'top 90%', once: true, onEnter: function () { gsap.to(bars, { scaleY: 1, duration: 0.9, ease: 'power3.out', stagger: { each: 0.018, from: 'start' } }); } });
    }
  })();

  // live ingest counter: ~41B a day, derived from time of day
  (function () {
    var el = $('#liveCount'); if (!el) return;
    var perSec = 41e9 / 86400;
    function val() { var d = new Date(), s = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000; return Math.floor(perSec * s); }
    function tick() { el.textContent = fmtNum(val(), 0); }
    tick();
    if (!reduce) setInterval(function () { if (!document.hidden) tick(); }, 90);
  })();

  /* ------------------------------------------------------ pricing toggle */
  (function () {
    var sw = $('#billSwitch'); if (!sw) return;
    var bill = sw.parentElement, lm = $('#lblMonthly'), ly = $('#lblYearly'), team = $('#teamPrice'), note = $('#teamNote'), status = $('#priceStatus');
    function build(el, value) {
      var s = String(value), html = '';
      for (var i = 0; i < s.length; i++) {
        var d = parseInt(s[i], 10), col = '';
        for (var k = 0; k <= 9; k++) col += '<span>' + k + '</span>';
        html += '<span class="odo__d"><span class="odo__col" data-d="' + d + '" style="transform:translateY(' + (-d * 1.1) + 'em)">' + col + '</span></span>';
      }
      el.innerHTML = html;
    }
    function roll(el, value) {
      var s = String(value), cols = $$('.odo__col', el);
      if (cols.length !== s.length) { build(el, value); return; }
      cols.forEach(function (c, i) { var d = parseInt(s[i], 10); c.dataset.d = d; c.style.transform = 'translateY(' + (-d * 1.1) + 'em)'; });
    }
    $$('.odo[data-fixed]').forEach(function (el) { build(el, el.getAttribute('data-fixed')); });
    build(team, team.getAttribute('data-monthly'));
    function set(yearly) {
      sw.setAttribute('aria-checked', yearly);
      bill.classList.toggle('is-yearly', yearly);
      lm.classList.toggle('is-on', !yearly); ly.classList.toggle('is-on', yearly);
      var v = team.getAttribute(yearly ? 'data-yearly' : 'data-monthly');
      roll(team, v);
      note.textContent = yearly ? 'Billed yearly, $288 per seat. Save $60.' : 'Billed monthly. Cancel any time.';
      status.textContent = 'Team plan is now $' + v + ' per seat per month, billed ' + (yearly ? 'yearly' : 'monthly') + '.';
    }
    sw.addEventListener('click', function () { set(sw.getAttribute('aria-checked') !== 'true'); });
    lm.addEventListener('click', function () { set(false); });
    ly.addEventListener('click', function () { set(true); });
    [lm, ly].forEach(function (l) { l.style.cursor = 'pointer'; });
  })();

  /* ---------------------------------------------------------------- FAQ */
  (function () {
    var qs = $$('.faq__q'); if (!qs.length) return;
    function set(q, open) {
      var item = q.closest('.faq__item'), panel = document.getElementById(q.getAttribute('aria-controls'));
      q.setAttribute('aria-expanded', open); item.classList.toggle('is-open', open);
      panel.inert = !open;
    }
    qs.forEach(function (q, i) {
      set(q, false);
      q.addEventListener('click', function () {
        var open = q.getAttribute('aria-expanded') !== 'true';
        qs.forEach(function (o) { if (o !== q) set(o, false); });
        set(q, open);
        if (window.ScrollTrigger) setTimeout(function () { ScrollTrigger.refresh(); }, 560);
      });
      q.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowDown') n = qs[(i + 1) % qs.length];
        else if (e.key === 'ArrowUp') n = qs[(i - 1 + qs.length) % qs.length];
        else if (e.key === 'Home') n = qs[0];
        else if (e.key === 'End') n = qs[qs.length - 1];
        if (n) { n.focus(); e.preventDefault(); }
      });
    });
    set(qs[0], true);
  })();

  /* -------------------------------------------------------------- forms */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  (function () {
    var form = $('#startForm'); if (!form) return;
    var input = $('#startEmail'), err = $('#startErr'), done = $('#startDone'), mail = $('#startMail');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!EMAIL.test(v)) {
        input.setAttribute('aria-invalid', 'true');
        err.textContent = v ? 'That email does not look right. Check for typos.' : 'Enter your work email to start.';
        input.focus(); return;
      }
      input.removeAttribute('aria-invalid'); err.textContent = '';
      mail.textContent = v; form.hidden = true; done.hidden = false; done.focus();
    });
    input.addEventListener('input', function () { if (input.getAttribute('aria-invalid')) { input.removeAttribute('aria-invalid'); err.textContent = ''; } });
  })();

  /* -------------------------------------------------------- demo dialog */
  (function () {
    var dlg = $('#demoDialog'); if (!dlg) return;
    var form = $('#demoForm'), opener = null;
    function open(from) {
      opener = from || document.activeElement;
      dlg.classList.remove('is-done'); form.reset();
      $$('.input', form).forEach(function (i) { i.removeAttribute('aria-invalid'); });
      $$('.field__err', form).forEach(function (s) { s.textContent = ''; });
      doc.classList.remove('has-cursor');
      lenis && lenis.stop();
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      var n = $('#dName'); n && n.focus();
    }
    function close() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
    dlg.addEventListener('close', function () {
      if (fine && !reduce) doc.classList.add('has-cursor');
      lenis && lenis.start();
      if (opener && opener.focus) opener.focus();
    });
    document.addEventListener('click', function (e) {
      var o = e.target.closest('[data-open-demo]');
      if (o) { e.preventDefault(); open(o); return; }
      if (e.target.closest('[data-close-demo]')) { close(); return; }
      if (e.target === dlg) close(); // backdrop click
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#dName'), email = $('#dEmail'), ok = true, first = null;
      function bad(inp, id, msg) { inp.setAttribute('aria-invalid', 'true'); $(id).textContent = msg; ok = false; first = first || inp; }
      name.removeAttribute('aria-invalid'); email.removeAttribute('aria-invalid'); $('#dNameErr').textContent = ''; $('#dEmailErr').textContent = '';
      if (!name.value.trim()) bad(name, '#dNameErr', 'Tell us your name.');
      if (!EMAIL.test(email.value.trim())) bad(email, '#dEmailErr', 'Enter a valid work email.');
      if (!ok) { first.focus(); return; }
      dlg.classList.add('is-done');
      var b = $('.success .btn', dlg); b && b.focus();
    });
  })();

  /* ------------------------------------------------ refresh after fonts */
  if (window.ScrollTrigger && document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  window.addEventListener('load', function () { if (window.ScrollTrigger) ScrollTrigger.refresh(); });
})();
