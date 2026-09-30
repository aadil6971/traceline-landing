/* ==========================================================================
   TRACELINE — interactive trace explorer (waterfall, span detail, source)
   ========================================================================== */
(function () {
  var root = document.getElementById('explorer');
  if (!root) return;

  var treeEl = document.getElementById('exTree');
  var ticksEl = document.getElementById('exTicks');
  var panelSpan = document.getElementById('exPanelSpan');
  var panelSrc = document.getElementById('exPanelSrc');
  var tabSpan = document.getElementById('exTabSpan');
  var tabSrc = document.getElementById('exTabSrc');
  var jumpBtn = document.getElementById('jumpBtn');
  var TOTAL = 2524;
  var ICON = function (n) { return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; };

  /* ---------------------------------------------------------------- data */
  var COLORS = { blue: '#7aa2ff', violet: '#b69cff', cyan: '#56d8e0', amber: '#ffc24d', mint: '#7ee8a8', slate: '#94a3b8', red: '#ff7a6b' };

  var SPANS = [
    { id: 'gw', p: null, svc: 'api-gateway', op: 'POST /checkout', kind: 'server', s: 0, d: 2524, c: 'blue', err: 'prop',
      attrs: [['http.method', 'POST'], ['http.route', '/checkout'], ['http.status_code', '500', 1], ['http.request_id', 'req_01J8ZQ4K7M'], ['net.peer.ip', '203.0.113.9'], ['deploy.version', 'v2026.09.28-3']],
      events: [[2524, 'HTTP 500 returned to client', 1]],
      code: { file: 'gateway/src/routes/checkout.ts', lang: 'ts', start: 31, hit: 34, err: 1, note: 'orders-svc returned 504 after 2,483 ms',
        lines: ['router.post("/checkout", async (req, res) => {', '  const user = await auth.verify(req.headers.authorization);', '  await rateLimit(req);', '  const order = await orders.create({', '    userId: user.id,', '    items: req.body.items,', '  });', '  res.status(201).json(order);', '});'],
        blame: ['5be20d1', 'j.moreau', '11 days ago', 'return 201 with order body'] } },

    { id: 'rl', p: 'gw', svc: 'redis', op: 'INCR rl:203.0.113.9', kind: 'db', s: 1, d: 2, c: 'slate',
      attrs: [['db.system', 'redis'], ['db.statement', 'INCR rl:203.0.113.9'], ['net.peer.name', 'redis-rl.internal']],
      code: { file: 'gateway/src/middleware/ratelimit.ts', lang: 'ts', start: 12, hit: 14,
        lines: ['export async function rateLimit(req: Request) {', '  const key = `rl:${req.ip}`;', '  const count = await redis.incr(key);', '  if (count === 1) await redis.expire(key, 60);', '  if (count > 120) throw new HttpError(429);', '}'],
        blame: ['c0d41e8', 'a.nowak', '4 months ago', 'per-ip limiter, 120 req/min'] } },

    { id: 'auth', p: 'gw', svc: 'auth-svc', op: 'verify_token', kind: 'server', s: 4, d: 34, c: 'violet',
      attrs: [['rpc.system', 'grpc'], ['rpc.method', 'VerifyToken'], ['auth.method', 'jwt'], ['user.id', 'u_48213']],
      code: { file: 'auth/src/verify.rs', lang: 'rs', start: 58, hit: 59,
        lines: ['pub async fn verify_token(ctx: &Ctx, raw: &str) -> Result<Claims, AuthError> {', '    let claims = jwt::decode(raw, &ctx.keys)?;', '    let sid = format!("session:{}", claims.sid);', '    let live = ctx.redis.get::<_, Option<String>>(sid).await?;', '    live.ok_or(AuthError::Expired)?;', '    Ok(claims)', '}'],
        blame: ['91ab7c3', 'p.iyer', '5 weeks ago', 'check session liveness, not just signature'] } },

    { id: 'auth-redis', p: 'auth', svc: 'redis', op: 'GET session:9f2c', kind: 'db', s: 9, d: 4, c: 'slate',
      attrs: [['db.system', 'redis'], ['db.statement', 'GET session:9f2c'], ['cache.hit', 'true']],
      code: { file: 'auth/src/verify.rs', lang: 'rs', start: 58, hit: 61,
        lines: ['pub async fn verify_token(ctx: &Ctx, raw: &str) -> Result<Claims, AuthError> {', '    let claims = jwt::decode(raw, &ctx.keys)?;', '    let sid = format!("session:{}", claims.sid);', '    let live = ctx.redis.get::<_, Option<String>>(sid).await?;', '    live.ok_or(AuthError::Expired)?;', '    Ok(claims)', '}'],
        blame: ['91ab7c3', 'p.iyer', '5 weeks ago', 'check session liveness, not just signature'] } },

    { id: 'orders', p: 'gw', svc: 'orders-svc', op: 'create_order', kind: 'server', s: 41, d: 2471, c: 'cyan', err: 'prop',
      attrs: [['rpc.system', 'grpc'], ['rpc.method', 'CreateOrder'], ['order.id', 'ord_7741'], ['order.total', '84.20 EUR'], ['error.type', 'PaymentTimeout', 1]],
      events: [[2459, 'PaymentTimeout raised, transaction rolled back', 1]],
      code: { file: 'orders/app/create.py', lang: 'py', start: 71, hit: 75, err: 1, note: 'PaymentTimeout after 2,000 ms, transaction rolled back',
        lines: ['async def create_order(cmd: CreateOrder) -> Order:', '    async with db.transaction():', '        order = await repo.insert(cmd)', '        await inventory.reserve(order.items)', '        receipt = await payments.charge(order)', '        await events.publish("order.created", order)', '    return order'],
        blame: ['e7740f2', 'r.bello', '2 weeks ago', 'publish order.created after payment'] } },

    { id: 'pg-insert', p: 'orders', svc: 'postgres', op: 'INSERT orders', kind: 'db', s: 44, d: 48, c: 'slate',
      attrs: [['db.system', 'postgresql'], ['db.statement', 'INSERT INTO orders (user_id, total) VALUES ($1, $2)'], ['db.rows_affected', '1']],
      code: { file: 'orders/app/repo.py', lang: 'py', start: 22, hit: 24,
        lines: ['async def insert(self, cmd: CreateOrder) -> Order:', '    row = await self.pool.fetchrow(', '        "INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING *",', '        cmd.user_id, cmd.total,', '    )', '    return Order.from_row(row)'],
        blame: ['2fd19a0', 'r.bello', '3 months ago', 'move order writes into repo'] } },

    { id: 'inv', p: 'orders', svc: 'inventory-svc', op: 'reserve_items', kind: 'server', s: 95, d: 317, c: 'amber',
      attrs: [['rpc.system', 'grpc'], ['rpc.method', 'ReserveItems'], ['items.count', '3'], ['lock.strategy', 'redis SETNX']],
      code: { file: 'inventory/reserve.go', lang: 'go', start: 40, hit: 40,
        lines: ['func (s *Store) Reserve(ctx context.Context, items []Item) error {', '\ttx, err := s.db.BeginTx(ctx, nil)', '\tif err != nil {', '\t\treturn err', '\t}', '\tdefer tx.Rollback()', '\tfor _, it := range items {', '\t\tif err := s.lock(ctx, it.SKU); err != nil {', '\t\t\treturn err', '\t\t}', '\t\tif err := s.decrement(ctx, tx, it); err != nil {', '\t\t\treturn err', '\t\t}', '\t}', '\treturn tx.Commit()', '}'],
        blame: ['7a3c9de', 'm.haddad', '7 weeks ago', 'reserve all items in one transaction'] } },

    { id: 'inv-lock', p: 'inv', svc: 'redis', op: 'SET lock:sku_2291 NX', kind: 'db', s: 98, d: 6, c: 'slate',
      attrs: [['db.system', 'redis'], ['db.statement', 'SET lock:sku_2291 1 NX EX 5'], ['lock.acquired', 'true']],
      code: { file: 'inventory/lock.go', lang: 'go', start: 18, hit: 19,
        lines: ['func (s *Store) lock(ctx context.Context, sku string) error {', '\tok, err := s.rdb.SetNX(ctx, "lock:"+sku, 1, 5*time.Second).Result()', '\tif err != nil || !ok {', '\t\treturn ErrLocked', '\t}', '\treturn nil', '}'],
        blame: ['b18e0c5', 'm.haddad', '7 weeks ago', 'per-sku lock, 5s expiry'] } },

    { id: 'pg-stock', p: 'inv', svc: 'postgres', op: 'UPDATE stock', kind: 'db', s: 106, d: 224, c: 'slate',
      attrs: [['db.system', 'postgresql'], ['db.statement', 'UPDATE stock SET qty = qty - $1 WHERE sku = $2 AND qty >= $1'], ['db.rows_affected', '1'], ['db.lock_wait_ms', '198']],
      code: { file: 'inventory/stock.go', lang: 'go', start: 63, hit: 64,
        lines: ['func (s *Store) decrement(ctx context.Context, tx *sql.Tx, it Item) error {', '\t_, err := tx.ExecContext(ctx,', '\t\t`UPDATE stock SET qty = qty - $1 WHERE sku = $2 AND qty >= $1`,', '\t\tit.Qty, it.SKU)', '\treturn err', '}'],
        blame: ['7a3c9de', 'm.haddad', '7 weeks ago', 'reserve all items in one transaction'] } },

    { id: 'pay', p: 'orders', svc: 'payments-svc', op: 'charge', kind: 'server', s: 420, d: 2080, c: 'red', err: 'prop',
      attrs: [['rpc.system', 'grpc'], ['rpc.method', 'Charge'], ['payment.provider', 'card-processor'], ['payment.currency', 'EUR'], ['error.type', 'context.DeadlineExceeded', 1]],
      events: [[2070, 'returned error to orders-svc', 1]],
      code: { file: 'payments/charge.go', lang: 'go', start: 130, hit: 142, err: 1, note: 'charge ord_7741: context deadline exceeded',
        lines: ['func (c *Client) Charge(ctx context.Context, o Order) (*Receipt, error) {', '\tif _, err := c.fraud.Score(ctx, o); err != nil {', '\t\treturn nil, ErrDeclined', '\t}', '\t// give up after two seconds; the caller retries with the same key', '\tctx, cancel := context.WithTimeout(ctx, 2*time.Second)', '\tdefer cancel()', '', '\treq := c.psp.NewCharge(o.ID, o.Total, o.Currency)', '\treq.Header.Set("Idempotency-Key", o.ID)', '', '\t// wait for the processor', '\tresp, err := c.psp.Do(ctx, req)', '\tif err != nil {', '\t\treturn nil, fmt.Errorf("charge %s: %w", o.ID, err)', '\t}', '\treturn resp.Receipt(), nil', '}'],
        blame: ['a91c3f2', 'l.karlsson', '3 days ago', 'raise psp timeout, drop retry'] } },

    { id: 'fraud', p: 'pay', svc: 'fraud-svc', op: 'score_transaction', kind: 'server', s: 424, d: 62, c: 'mint',
      attrs: [['rpc.system', 'grpc'], ['rpc.method', 'ScoreTransaction'], ['fraud.score', '0.07'], ['model.version', '2026-09-14']],
      code: { file: 'fraud/src/score.rs', lang: 'rs', start: 21, hit: 21,
        lines: ['pub async fn score_transaction(tx: &Transaction) -> Result<f32, ScoreError> {', '    let features = Features::from(tx);', '    let raw = MODEL.predict(&features).await?;', '    Ok(raw.clamp(0.0, 1.0))', '}'],
        blame: ['3c8d2b7', 'k.osei', '2 weeks ago', 'clamp model output'] } },

    { id: 'psp', p: 'pay', svc: 'card-processor', op: 'POST /v1/charges', kind: 'external', s: 490, d: 2000, c: 'red', err: 'root',
      attrs: [['http.method', 'POST'], ['http.url', 'https://api.cardproc.example/v1/charges'], ['peer.service', 'card-processor'], ['timeout.ms', '2000'], ['retry.attempt', '1'], ['error.type', 'context.DeadlineExceeded', 1]],
      events: [[0, 'request sent'], [2000, 'context deadline exceeded', 1]],
      code: { file: 'payments/charge.go', lang: 'go', start: 130, hit: 142, err: 1, note: 'context deadline exceeded (2,000 ms)',
        lines: ['func (c *Client) Charge(ctx context.Context, o Order) (*Receipt, error) {', '\tif _, err := c.fraud.Score(ctx, o); err != nil {', '\t\treturn nil, ErrDeclined', '\t}', '\t// give up after two seconds; the caller retries with the same key', '\tctx, cancel := context.WithTimeout(ctx, 2*time.Second)', '\tdefer cancel()', '', '\treq := c.psp.NewCharge(o.ID, o.Total, o.Currency)', '\treq.Header.Set("Idempotency-Key", o.ID)', '', '\t// wait for the processor', '\tresp, err := c.psp.Do(ctx, req)', '\tif err != nil {', '\t\treturn nil, fmt.Errorf("charge %s: %w", o.ID, err)', '\t}', '\treturn resp.Receipt(), nil', '}'],
        blame: ['a91c3f2', 'l.karlsson', '3 days ago', 'raise psp timeout, drop retry'],
        stack: [['Client.Charge', 'payments/charge.go:142'], ['Handler.Charge', 'payments/grpc.go:57'], ['Server.handle', 'payments/server.go:203']] } }
  ];

  var byId = {}, kids = {};
  SPANS.forEach(function (sp, i) { byId[sp.id] = sp; sp.i = i; kids[sp.id] = []; });
  SPANS.forEach(function (sp) { sp.lvl = 0; if (sp.p) { kids[sp.p].push(sp.id); var q = sp; while (q.p) { sp.lvl++; q = byId[q.p]; } } });
  var ROOT_CAUSE = 'psp';

  /* ------------------------------------------------------------- helpers */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function ancestors(id) { var a = [], q = byId[id]; while (q.p) { a.push(q.p); q = byId[q.p]; } return a; }
  var expanded = { gw: true, orders: true, pay: true };
  var selected = null, tab = 'span';

  /* -------------------------------------------------------------- header */
  var services = {}; SPANS.forEach(function (s) { services[s.svc] = 1; });
  document.getElementById('exStatSpans').textContent = SPANS.length;
  document.getElementById('exStatSvc').textContent = Object.keys(services).length;
  document.getElementById('exStatErr').textContent = SPANS.filter(function (s) { return s.err === 'root'; }).length;
  document.getElementById('exStatDur').textContent = fmt(TOTAL) + ' ms';

  ticksEl.innerHTML = [0, 1, 2, 3, 4].map(function (k) {
    var ms = Math.round(TOTAL * k / 4 / 10) * 10; if (k === 4) ms = TOTAL;
    return '<i style="left:' + (k * 25) + '%"' + (k === 4 ? ' class="is-last"' : '') + '>' + (k === 0 ? '0 ms' : fmt(ms)) + '</i>';
  }).join('');

  /* ---------------------------------------------------------------- tree */
  function buildTree() {
    var html = '';
    SPANS.forEach(function (sp) {
      var sib = sp.p ? kids[sp.p] : ['gw'];
      var end = (sp.s + sp.d) / TOTAL, start = sp.s / TOTAL, w = Math.max(sp.d / TOTAL * 100, 0.5);
      var lab, cls = '';
      if (end <= 0.8) lab = 'left:calc(' + (end * 100) + '% + 8px)';
      else if (start >= 0.2) { lab = 'left:calc(' + (start * 100) + '% - 8px)'; cls = ' is-left'; }
      else { lab = 'left:calc(' + (end * 100) + '% - 8px)'; cls = ' is-left is-in'; }
      var hasKids = kids[sp.id].length > 0;
      html += '<li class="ex-item' + (sp.err ? ' is-err' : '') + (sp.err === 'root' ? ' is-root' : '') + '" role="treeitem" id="sp-' + sp.id + '" data-id="' + sp.id + '" aria-level="' + (sp.lvl + 1) + '" aria-posinset="' + (sib.indexOf(sp.id) + 1) + '" aria-setsize="' + sib.length + '"' + (hasKids ? ' aria-expanded="false"' : '') + ' aria-selected="false" tabindex="-1">' +
        '<div class="ex-row">' +
          '<div class="ex-name" style="--lvl:' + sp.lvl + '"><span class="ex-twist' + (hasKids ? '' : ' is-leaf') + '" data-twist aria-hidden="true">' + ICON('chevron-down') + '</span>' +
          '<span class="ex-label"><span class="ex-svc">' + esc(sp.svc) + '</span><span class="ex-op">' + esc(sp.op) + '</span></span></div>' +
          '<div class="ex-bar"><span class="ex-fill" aria-hidden="true" style="left:' + (start * 100) + '%;width:' + w + '%;--c:' + COLORS[sp.c] + ';--i:' + sp.i + '"></span>' +
          '<span class="ex-dur' + cls + '" style="' + lab + '">' + fmt(sp.d) + ' ms</span></div>' +
        '</div></li>';
    });
    treeEl.innerHTML = html;
  }

  function visible(id) { return ancestors(id).every(function (a) { return expanded[a]; }); }
  function items() { return Array.prototype.slice.call(treeEl.children); }
  function visibleItems() { return items().filter(function (li) { return !li.hidden; }); }

  function syncTree(animate) {
    items().forEach(function (li) {
      var id = li.dataset.id, was = !li.hidden, show = visible(id);
      li.hidden = !show;
      if (show && !was && animate) { li.classList.remove('is-new'); void li.offsetWidth; li.classList.add('is-new'); }
      if (kids[id].length) li.setAttribute('aria-expanded', expanded[id] ? 'true' : 'false');
    });
  }

  function toggle(id, force) {
    if (!kids[id].length) return;
    expanded[id] = force === undefined ? !expanded[id] : force;
    if (!expanded[id]) { // if the selection is hidden by this collapse, move it to the parent
      if (selected && ancestors(selected).indexOf(id) > -1) select(id);
    }
    syncTree(true);
  }

  function select(id, o) {
    o = o || {};
    if (!byId[id]) return;
    ancestors(id).forEach(function (a) { expanded[a] = true; });
    syncTree(true);
    selected = id;
    items().forEach(function (li) {
      var on = li.dataset.id === id;
      li.setAttribute('aria-selected', on ? 'true' : 'false');
      li.tabIndex = on ? 0 : -1;
    });
    var li = document.getElementById('sp-' + id);
    if (o.focus) li.focus({ preventScroll: false });
    renderSpan(byId[id]); renderSrc(byId[id]);
    if (o.tab) showTab(o.tab);
  }

  /* -------------------------------------------------------------- detail */
  function renderSpan(sp) {
    var childD = kids[sp.id].reduce(function (a, k) { return a + byId[k].d; }, 0);
    var self = Math.max(0, sp.d - childD), share = sp.d / TOTAL;
    var kindLabel = { server: 'Server span', client: 'Client span', db: 'Database span', external: 'External call' }[sp.kind];
    var isErr = !!sp.err;
    var h = '<div class="sp-head"><h3><small>' + kindLabel + '</small>' + esc(sp.svc) + '<br><span style="color:var(--muted);font-weight:400">' + esc(sp.op) + '</span></h3>' +
      '<span class="pill' + (isErr ? ' is-err' : '') + '">' + (sp.err === 'root' ? 'Error' : sp.err ? 'Failed' : 'OK') + '</span></div>';
    if (sp.err === 'root') h += '<div class="sp-err"><b>Root cause.</b> The card processor did not answer within 2,000 ms, so the request context expired.</div>';
    else if (sp.err) h += '<div class="sp-err is-prop"><b>Propagated.</b> This span did not fail on its own. The error came from <button type="button" class="link" data-goto-root>card-processor</button> below it.</div>';
    h += '<dl class="sp-metrics' + (isErr ? ' is-err-detail' : '') + '">' +
      '<div><dt>Start</dt><dd>+' + fmt(sp.s) + ' <small>ms</small></dd></div>' +
      '<div><dt>Duration</dt><dd>' + fmt(sp.d) + ' <small>ms</small></dd></div>' +
      '<div><dt>Self time</dt><dd>' + fmt(self) + ' <small>ms</small></dd></div>' +
      '<div><dt>Of trace</dt><dd>' + (share * 100 < 1 ? '<1' : Math.round(share * 100)) + '<small>%</small><span class="sp-share"><i style="transform:scaleX(' + Math.max(share, 0.01) + ')"></i></span></dd></div></dl>';
    h += '<section class="sp-sec"><h4>Attributes</h4><dl class="attrs">' + sp.attrs.map(function (a) { return '<div><dt>' + esc(a[0]) + '</dt><dd' + (a[2] ? ' class="is-err"' : '') + '>' + esc(a[1]) + '</dd></div>'; }).join('') + '</dl></section>';
    if (sp.events) h += '<section class="sp-sec"><h4>Events</h4><ul class="events">' + sp.events.map(function (e) { return '<li><time>+' + fmt(e[0]) + '</time><span' + (e[2] ? ' class="is-err"' : '') + '>' + esc(e[1]) + '</span></li>'; }).join('') + '</ul></section>';
    var c = sp.code;
    h += '<button type="button" class="sp-goto' + (c.err ? ' is-err' : '') + '" data-goto-src><span>View source<small>' + esc(c.file) + ':' + c.hit + '</small></span>' + ICON('arrow-right') + '</button>';
    panelSpan.innerHTML = h;
  }

  function renderSrc(sp) {
    var c = sp.code, hl = window.TL && window.TL.highlight, lines = '';
    c.lines.forEach(function (ln, k) {
      var n = c.start + k, hit = n === c.hit;
      lines += '<div class="ln' + (hit ? (c.err ? ' is-fail' : ' is-hit') : '') + '"' + (hit ? ' id="exHit"' : '') + '><b>' + n + '</b><code>' + (hl ? hl(ln, c.lang) : esc(ln)) + '</code></div>';
      if (hit) {
        var note = c.note || (sp.svc + ' ' + sp.op + ' runs here, ' + fmt(sp.d) + ' ms');
        lines += '<div class="code__note' + (c.err ? '' : ' is-ok') + '">' + ICON(c.err ? 'circle-alert' : 'check') + esc(note) + '</div>';
      }
    });
    var langIcon = { go: 'lang-go', ts: 'lang-nodedotjs', py: 'lang-python', rs: 'lang-rust' }[c.lang];
    var h = '<div class="src-head">' + ICON(langIcon) + '<strong>' + esc(c.file) + '</strong><span>line ' + c.hit + '</span></div>' +
      '<div class="code" tabindex="0" aria-label="Source code of ' + esc(c.file) + '"><div class="code__in">' + lines + '</div></div>';
    if (c.blame) h += '<div class="blame">' + ICON('git-commit-horizontal') + '<code>' + esc(c.blame[0]) + '</code><span><b>' + esc(c.blame[1]) + '</b>, ' + esc(c.blame[2]) + '</span><span style="color:var(--muted)">&ldquo;' + esc(c.blame[3]) + '&rdquo;</span></div>';
    if (c.stack) h += '<ul class="stack" aria-label="Stack">' + c.stack.map(function (f) { return '<li><b>' + esc(f[0]) + '</b><span>' + esc(f[1]) + '</span></li>'; }).join('') + '</ul>';
    panelSrc.innerHTML = h;
  }

  function showTab(name, focus) {
    tab = name;
    var isSpan = name === 'span';
    tabSpan.setAttribute('aria-selected', isSpan); tabSrc.setAttribute('aria-selected', !isSpan);
    tabSpan.tabIndex = isSpan ? 0 : -1; tabSrc.tabIndex = isSpan ? -1 : 0;
    panelSpan.hidden = !isSpan; panelSrc.hidden = isSpan;
    if (focus) (isSpan ? tabSpan : tabSrc).focus();
  }

  function flashHit() {
    var hit = document.getElementById('exHit');
    if (!hit) return;
    hit.classList.remove('is-flash'); void hit.offsetWidth; hit.classList.add('is-flash');
    var box = hit.closest('.code'), pn = panelSrc;
    if (pn.scrollHeight > pn.clientHeight) pn.scrollTop = Math.max(0, hit.offsetTop + hit.closest('.code').offsetTop - pn.clientHeight / 2);
    if (box && box.scrollHeight > box.clientHeight) box.scrollTop = Math.max(0, hit.offsetTop - box.clientHeight / 2);
  }

  function jump() {
    select(ROOT_CAUSE, { tab: 'src' });
    flashHit();
    var detail = root.querySelector('.ex-detail'), r = detail.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.8 || r.bottom < 0) {
      if (window.TL && window.TL.scrollTo) window.TL.scrollTo(detail, -90); else detail.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* -------------------------------------------------------------- events */
  treeEl.addEventListener('click', function (e) {
    var li = e.target.closest('.ex-item'); if (!li) return;
    var id = li.dataset.id;
    if (e.target.closest('[data-twist]') && kids[id].length) { toggle(id); return; }
    select(id);
  });
  treeEl.addEventListener('dblclick', function (e) {
    var li = e.target.closest('.ex-item'); if (!li || e.target.closest('[data-twist]')) return;
    select(li.dataset.id, { tab: 'src' });
  });

  treeEl.addEventListener('keydown', function (e) {
    var li = e.target.closest('.ex-item'); if (!li || e.target !== li) return;
    var id = li.dataset.id, vis = visibleItems(), idx = vis.indexOf(li), k = e.key;
    if (k === 'ArrowDown') { if (vis[idx + 1]) select(vis[idx + 1].dataset.id, { focus: true }); }
    else if (k === 'ArrowUp') { if (vis[idx - 1]) select(vis[idx - 1].dataset.id, { focus: true }); }
    else if (k === 'Home') { select(vis[0].dataset.id, { focus: true }); }
    else if (k === 'End') { select(vis[vis.length - 1].dataset.id, { focus: true }); }
    else if (k === 'ArrowRight') {
      if (kids[id].length && !expanded[id]) toggle(id, true);
      else if (kids[id].length) select(kids[id][0], { focus: true });
    } else if (k === 'ArrowLeft') {
      if (kids[id].length && expanded[id]) toggle(id, false);
      else if (byId[id].p) select(byId[id].p, { focus: true });
    } else if (k === 'Enter') { select(id, { tab: 'src' }); }
    else if (k === ' ') { select(id); }
    else return;
    e.preventDefault();
  });

  root.addEventListener('keydown', function (e) {
    if ((e.key === 'j' || e.key === 'J') && !e.metaKey && !e.ctrlKey && !e.altKey && !/input|textarea|select/i.test(e.target.tagName)) { jump(); e.preventDefault(); }
  });

  function onDetailClick(e) {
    if (e.target.closest('[data-goto-src]')) { showTab('src'); flashHit(); }
    else if (e.target.closest('[data-goto-root]')) { select(ROOT_CAUSE); }
  }
  panelSpan.addEventListener('click', onDetailClick);

  [tabSpan, tabSrc].forEach(function (b) {
    b.addEventListener('click', function () { showTab(b === tabSpan ? 'span' : 'src'); if (b === tabSrc) flashHit(); });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
        showTab(e.key === 'ArrowLeft' || e.key === 'Home' ? 'span' : 'src', true); e.preventDefault();
      }
    });
  });

  jumpBtn.addEventListener('click', jump);
  document.addEventListener('trace:jump', jump);

  /* ---------------------------------------------------------------- boot */
  buildTree();
  syncTree(false);
  select(ROOT_CAUSE);
  showTab('span');

  // draw the waterfall bars in when the explorer scrolls into view
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { root.classList.add('is-in'); io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe(root);
  } else root.classList.add('is-in');
})();
