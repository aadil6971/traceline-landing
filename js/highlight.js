/* Tiny syntax highlighter — Go, TS/JS, Python, Rust, SQL, shell. No deps. */
(function () {
  var KW = {
    go: 'func return if else for range defer go select switch case default var const type struct interface map chan package import nil true false err',
    ts: 'import export from const let var function return if else for while await async new class extends throw try catch typeof interface type null undefined true false of in',
    py: 'import from def async await return if elif else for while in with as class try except raise pass None True False lambda not and or is yield',
    rs: 'use pub fn async await let mut return if else for while loop match struct enum impl trait mod crate self Self ok_or None Some Ok Err true false as in where',
    sql: 'SELECT FROM WHERE INSERT INTO VALUES UPDATE DELETE JOIN LEFT ON AND OR ANY FOR ORDER BY LIMIT AS SET',
    sh: ''
  };
  var ALIAS = { js: 'ts', tsx: 'ts', javascript: 'ts', typescript: 'ts', python: 'py', rust: 'rs', golang: 'go', shell: 'sh' };

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function set(str) { var o = {}; str.split(' ').forEach(function (w) { if (w) o[w] = 1; }); return o; }
  var CACHE = {};
  function kw(l) { return CACHE[l] || (CACHE[l] = set(KW[l] || '')); }

  function highlight(code, lang) {
    lang = ALIAS[lang] || lang || 'ts';
    if (lang === 'out') return code; // pre-marked output
    var keys = kw(lang);
    var comment = lang === 'py' || lang === 'sh' ? '#[^\\n]*' : '\\/\\/[^\\n]*|--[^\\n]*';
    if (lang === 'sql') comment = '--[^\\n]*';
    var re = new RegExp(
      '(' + comment + ')' +                                   // 1 comment
      '|("(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)' + // 2 string
      '|(\\$\\d+|\\b\\d[\\d_.]*(?:ms|s)?\\b)' +                // 3 number / placeholder
      '|(#\\[[^\\]]*\\])' +                                    // 4 rust attribute
      '|([A-Za-z_][A-Za-z0-9_]*)',                              // 5 word
      'g'
    );
    var out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      var t = m[0];
      if (m[1]) out += '<span class="tk-c">' + esc(t) + '</span>';
      else if (m[2]) out += '<span class="tk-s">' + esc(t) + '</span>';
      else if (m[3]) out += '<span class="tk-n">' + esc(t) + '</span>';
      else if (m[4]) out += '<span class="tk-m">' + esc(t) + '</span>';
      else {
        var after = code.charAt(m.index + t.length);
        if (keys[t] || (lang === 'sql' && keys[t.toUpperCase()])) out += '<span class="tk-k">' + esc(t) + '</span>';
        else if (after === '(' || (lang === 'rs' && after === '!')) out += '<span class="tk-f">' + esc(t) + '</span>';
        else if (/^[A-Z][A-Za-z0-9]*$/.test(t) && t.length > 1 && lang !== 'sh') out += '<span class="tk-t">' + esc(t) + '</span>';
        else out += esc(t);
      }
      last = m.index + t.length;
    }
    return out + esc(code.slice(last));
  }

  function run(root) {
    (root || document).querySelectorAll('code[data-lang]').forEach(function (el) {
      if (el.dataset.hl) return;
      var lang = el.dataset.lang;
      if (lang === 'out') { el.dataset.hl = '1'; return; }
      el.innerHTML = highlight(el.textContent, lang);
      el.dataset.hl = '1';
    });
  }

  window.TL = window.TL || {};
  window.TL.highlight = highlight;
  window.TL.highlightAll = run;
  run();
})();
