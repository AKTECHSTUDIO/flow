/* ═══════════════════════════════════════════════════════════════
   Flowmatic Admin v4  —  admin.js
   Secure SHA-256 login · Full JSON editor for ALL pages
   Live preview · GitHub publish · Change password
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ───────────────────────────────────────────────────────────────
   CONSTANTS
─────────────────────────────────────────────────────────────── */
var SESSION_KEY = 'fma_sess_v1';
var DATA_KEY    = 'fma_data_v3';
var GH_KEY      = 'fma_gh_v1';
var DEFAULT_HASH = '97069978a91fcacd3731d5e5ff1cf66cf8dd5acef68fa13c47451a2bc5c3462a'; // flowmatic2025

/* ───────────────────────────────────────────────────────────────
   HELPERS
─────────────────────────────────────────────────────────────── */
function g(id) { return document.getElementById(id); }

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function sha256(str) {
  var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
}

function getPath(obj, path) {
  return path.split('.').reduce(function(o,k){
    return (o && o[k] !== undefined) ? o[k] : '';
  }, obj);
}
function setPath(obj, path, val) {
  var keys = path.split('.');
  var o = obj;
  for (var i = 0; i < keys.length - 1; i++) {
    if (!o[keys[i]] || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = val;
}

/* ───────────────────────────────────────────────────────────────
   SESSION
─────────────────────────────────────────────────────────────── */
function isLoggedIn() {
  try {
    var obj = JSON.parse(atob(sessionStorage.getItem(SESSION_KEY) || ''));
    return obj.exp > Date.now();
  } catch(e) { return false; }
}
function setSession() {
  sessionStorage.setItem(SESSION_KEY, btoa(JSON.stringify({ exp: Date.now() + 8*3600*1000 })));
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

/* ───────────────────────────────────────────────────────────────
   LOGIN SCREEN
─────────────────────────────────────────────────────────────── */
function showLogin(wrongPwd) {
  document.body.style.cssText = '';
  document.body.innerHTML = `
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f0f0f;font-family:'DM Sans',sans-serif;">
  <div style="width:100%;max-width:360px;padding:1.5rem;">
    <div style="text-align:center;margin-bottom:2rem;">
      <div style="font-family:'Instrument Serif',serif;font-size:2rem;color:#f0f0f0;margin-bottom:.3rem;">
        flow<span style="color:#d4522a">matic</span>
      </div>
      <div style="font-size:.68rem;color:#555;letter-spacing:.12em;text-transform:uppercase;">Admin Panel</div>
    </div>
    <div style="background:#1a1a1a;border:1px solid #2e2e2e;border-radius:14px;padding:1.75rem;">
      <label style="display:block;font-size:.7rem;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.07em;margin-bottom:.4rem;">Password</label>
      <input id="pwd-inp" type="password" placeholder="Enter your admin password"
        style="width:100%;background:#222;border:1.5px solid #2e2e2e;border-radius:9px;padding:.75rem 1rem;color:#f0f0f0;font-size:.92rem;font-family:'DM Sans',sans-serif;outline:none;margin-bottom:.75rem;box-sizing:border-box;"
        autocomplete="current-password"/>
      ${wrongPwd ? '<div style="font-size:.75rem;color:#f87171;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.2);border-radius:7px;padding:.5rem .75rem;margin-bottom:.75rem;">Incorrect password — try again</div>' : ''}
      <button id="login-btn"
        style="width:100%;padding:.82rem;background:#d4522a;color:#fff;border:none;border-radius:100px;font-size:.9rem;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;">
        Enter Admin →
      </button>
      <div id="login-hint" style="margin-top:1rem;text-align:center;font-size:.7rem;color:#444;"></div>
    </div>
  </div>
</div>`;

  var inp = g('pwd-inp');
  inp.focus();
  inp.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  g('login-btn').addEventListener('click', doLogin);

  // Show hint if available
  if (window.__FMA_DATA && window.__FMA_DATA._admin && window.__FMA_DATA._admin.hint) {
    g('login-hint').textContent = window.__FMA_DATA._admin.hint;
  }
}

async function doLogin() {
  var inp = g('pwd-inp');
  var btn = g('login-btn');
  if (!inp || !btn) return;
  btn.textContent = 'Checking...'; btn.disabled = true;
  var hash = await sha256(inp.value);
  var stored = (window.__FMA_DATA && window.__FMA_DATA._admin && window.__FMA_DATA._admin.passwordHash) || DEFAULT_HASH;
  if (hash === stored) {
    setSession();
    location.reload();
  } else {
    showLogin(true);
  }
}

/* ───────────────────────────────────────────────────────────────
   DATA
─────────────────────────────────────────────────────────────── */
var data = {};
var saveTimer = null;

function setStatus(state, msg) {
  var dot = g('save-dot'), lbl = g('save-label');
  if (!dot || !lbl) return;
  dot.className = 'save-dot ' + state;
  lbl.textContent = msg;
}

var _toastT;
function toast(msg, err) {
  var t = g('toast'); if (!t) return;
  t.textContent = msg;
  t.style.background = err ? '#7f1d1d' : '#1a7a4a';
  t.classList.add('on'); clearTimeout(_toastT);
  _toastT = setTimeout(function(){ t.classList.remove('on'); }, 2800);
}

function scheduleSave() {
  setStatus('saving', 'Unsaved changes');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function(){
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
      setStatus('saved', 'Saved locally ✓');
      if (previewOpen) renderPreview();
    } catch(e) { setStatus('error', 'Save failed'); }
  }, 400);
}

function loadData(cb) {
  // 1. Try localStorage (most recent edits)
  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(DATA_KEY) || 'null'); } catch(e) {}
  if (cached && cached._admin) { data = cached; setStatus('saved', 'Loaded from cache'); cb(); return; }

  // 2. Try server content.json
  fetch('content.json?v=' + Date.now())
    .then(function(r){ return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function(json){
      data = json;
      window.__FMA_DATA = json;
      setStatus('saved', 'Loaded ✓');
      cb();
    })
    .catch(function(){
      // 3. Embedded fallback
      if (window.__FMA_DATA) { data = JSON.parse(JSON.stringify(window.__FMA_DATA)); setStatus('saved', 'Using embedded data'); cb(); }
      else setStatus('error', 'Cannot load content.json');
    });
}

/* ───────────────────────────────────────────────────────────────
   PANEL NAV
─────────────────────────────────────────────────────────────── */
function switchPanel(id) {
  document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('on'); });
  document.querySelectorAll('.nav-btn').forEach(function(b){ b.classList.remove('on'); });
  var panel = g('p-' + id);
  if (panel) panel.classList.add('on');
  var btn = document.querySelector('[data-panel="' + id + '"]');
  if (btn) btn.classList.add('on');
  if (g('main')) g('main').scrollTop = 0;
}

/* ───────────────────────────────────────────────────────────────
   BIND SIMPLE INPUTS  (data-path)
─────────────────────────────────────────────────────────────── */
function bindInputs() {
  document.querySelectorAll('[data-path]').forEach(function(el){
    var path = el.dataset.path;
    var val = getPath(data, path);
    el.value = (val == null ? '' : val);
    el.addEventListener('input', function(){
      setPath(data, path, el.value);
      scheduleSave();
    });
  });
}

function bindColors() {
  var pairs = [
    ['pop','colors.primary'],['pop2','colors.secondary'],
    ['bg','colors.background'],['ink','colors.ink']
  ];
  pairs.forEach(function(pair){
    var pick = g('cp-'+pair[0]), txt = g('ct-'+pair[0]);
    if (!pick || !txt) return;
    var val = getPath(data, pair[1]) || '#000000';
    txt.value = val;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) pick.value = val;
    pick.addEventListener('input', function(){
      txt.value = pick.value;
      setPath(data, pair[1], pick.value);
      scheduleSave();
    });
    txt.addEventListener('input', function(){
      if (/^#[0-9a-fA-F]{6}$/.test(txt.value)) {
        pick.value = txt.value;
        setPath(data, pair[1], txt.value);
        scheduleSave();
      }
    });
  });
}

/* ───────────────────────────────────────────────────────────────
   DYNAMIC LIST RENDERERS
─────────────────────────────────────────────────────────────── */

/* ── NAV LINKS ── */
function renderNav() {
  var w = g('nav-wrap'); if (!w) return; w.innerHTML = '';
  (data.nav && data.nav.links || []).forEach(function(link, i){
    var rb = document.createElement('div'); rb.className = 'rb';
    rb.innerHTML =
      '<span class="rb-num">'+(i+1)+'</span>' +
      '<button class="rb-del">Delete</button>' +
      '<div class="rb-inner">' +
        '<div class="row2">' +
          '<div class="f"><label>Label</label><input value="'+esc(link.label)+'" data-i="'+i+'" data-k="label"/></div>' +
          '<div class="f"><label>Href / URL</label><input value="'+esc(link.href)+'" data-i="'+i+'" data-k="href"/></div>' +
        '</div>' +
        '<div class="trow"><span>CTA style (filled button)</span>' +
          '<label class="tog"><input type="checkbox" '+(link.cta?'checked':'')+'/><span class="tsl"></span></label>' +
        '</div>' +
      '</div>';
    rb.querySelector('.rb-del').addEventListener('click', function(){ data.nav.links.splice(i,1); renderNav(); scheduleSave(); });
    rb.querySelectorAll('input[type=text],input:not([type])').forEach(function(el){
      el.addEventListener('input', function(){ data.nav.links[i][el.dataset.k] = el.value; scheduleSave(); });
    });
    rb.querySelector('input[type=checkbox]').addEventListener('change', function(){
      data.nav.links[i].cta = this.checked; scheduleSave();
    });
    w.appendChild(rb);
  });
}
g('btn-add-nav').addEventListener('click', function(){
  if (!data.nav) data.nav = {links:[]};
  data.nav.links.push({label:'New link', href:'#', cta:false});
  renderNav(); scheduleSave();
});

/* ── PILLS ── */
function renderPills() {
  var w = g('pills-wrap'); if (!w) return; w.innerHTML = '';
  (data.hero && data.hero.pills || []).forEach(function(p, i){
    var d = document.createElement('div'); d.className = 'pill';
    d.innerHTML = esc(p) + ' <span class="pill-x">&times;</span>';
    d.querySelector('.pill-x').addEventListener('click', function(){ data.hero.pills.splice(i,1); renderPills(); scheduleSave(); });
    w.appendChild(d);
  });
}
g('btn-add-pill').addEventListener('click', function(){
  var inp = g('pill-inp'); var val = inp.value.trim(); if (!val) return;
  if (!data.hero.pills) data.hero.pills = [];
  data.hero.pills.push(val); inp.value = ''; renderPills(); scheduleSave();
});
g('pill-inp').addEventListener('keydown', function(e){ if (e.key==='Enter'){e.preventDefault(); g('btn-add-pill').click();} });

/* ── STATS ── */
function renderStats() {
  var w = g('stats-wrap'); if (!w) return; w.innerHTML = '';
  (data.stats || []).forEach(function(s, i){
    var card = document.createElement('div'); card.className = 'card';
    card.innerHTML =
      '<div class="ct" style="display:flex;justify-content:space-between;align-items:center;">Stat '+(i+1)+
        '<button class="rb-del" style="position:static;">Delete</button></div>' +
      '<div class="row3">' +
        '<div class="f"><label>Number</label><input value="'+esc(s.number)+'" data-k="number"/></div>' +
        '<div class="f"><label>Suffix</label><input value="'+esc(s.suffix)+'" data-k="suffix"/></div>' +
        '<div class="f"><label>Label</label><input value="'+esc(s.label)+'" data-k="label"/></div>' +
      '</div>';
    card.querySelector('.rb-del').addEventListener('click', function(){ data.stats.splice(i,1); renderStats(); scheduleSave(); });
    card.querySelectorAll('input').forEach(function(el){
      el.addEventListener('input', function(){ data.stats[i][el.dataset.k] = el.value; scheduleSave(); });
    });
    w.appendChild(card);
  });
}
g('btn-add-stat').addEventListener('click', function(){
  if (!data.stats) data.stats = [];
  data.stats.push({number:'0', suffix:'', label:'New stat'});
  renderStats(); scheduleSave();
});

/* ── HOW-IT-WORKS STEPS ── */
function renderSteps() {
  var w = g('steps-wrap'); if (!w) return; w.innerHTML = '';
  (data.howItWorks && data.howItWorks.steps || []).forEach(function(s, i){
    var rb = document.createElement('div'); rb.className = 'rb';
    rb.innerHTML =
      '<span class="rb-num">'+(i+1)+'</span><button class="rb-del">Delete</button>' +
      '<div class="rb-inner">' +
        '<div class="row2">' +
          '<div class="f"><label>Tag (e.g. Day 1)</label><input value="'+esc(s.tag)+'" data-k="tag"/></div>' +
          '<div class="f"><label>Title</label><input value="'+esc(s.title)+'" data-k="title"/></div>' +
        '</div>' +
        '<div class="f"><label>Description</label><textarea data-k="body">'+esc(s.body)+'</textarea></div>' +
      '</div>';
    rb.querySelector('.rb-del').addEventListener('click', function(){ data.howItWorks.steps.splice(i,1); renderSteps(); scheduleSave(); });
    rb.querySelectorAll('input,textarea').forEach(function(el){
      el.addEventListener('input', function(){ data.howItWorks.steps[i][el.dataset.k] = el.value; scheduleSave(); });
    });
    w.appendChild(rb);
  });
}
g('btn-add-step').addEventListener('click', function(){
  if (!data.howItWorks) data.howItWorks = {steps:[]};
  if (!data.howItWorks.steps) data.howItWorks.steps = [];
  data.howItWorks.steps.push({tag:'New', title:'New step', body:''});
  renderSteps(); scheduleSave();
});

/* ── HOME SERVICE CARDS ── */
function renderSvcItems() {
  var w = g('svc-wrap'); if (!w) return; w.innerHTML = '';
  (data.services && data.services.items || []).forEach(function(f, i){
    var rb = document.createElement('div'); rb.className = 'rb';
    rb.innerHTML =
      '<span class="rb-num">'+(i+1)+'</span><button class="rb-del">Delete</button>' +
      '<div class="rb-inner">' +
        '<div class="row2">' +
          '<div class="f"><label>Icon (emoji)</label><input value="'+esc(f.icon)+'" data-k="icon" style="max-width:80px"/></div>' +
          '<div class="f"><label>Title</label><input value="'+esc(f.title)+'" data-k="title"/></div>' +
        '</div>' +
        '<div class="f"><label>Description</label><textarea data-k="body">'+esc(f.body)+'</textarea></div>' +
        '<div class="trow"><span>Full-width card</span>' +
          '<label class="tog"><input type="checkbox" '+(f.wide?'checked':'')+'/><span class="tsl"></span></label>' +
        '</div>' +
      '</div>';
    rb.querySelector('.rb-del').addEventListener('click', function(){ data.services.items.splice(i,1); renderSvcItems(); scheduleSave(); });
    rb.querySelectorAll('input[type=text],input:not([type]),textarea').forEach(function(el){
      el.addEventListener('input', function(){ data.services.items[i][el.dataset.k] = el.value; scheduleSave(); });
    });
    rb.querySelector('input[type=checkbox]').addEventListener('change', function(){
      data.services.items[i].wide = this.checked; scheduleSave();
    });
    w.appendChild(rb);
  });
}
g('btn-add-svc').addEventListener('click', function(){
  if (!data.services) data.services = {items:[]};
  if (!data.services.items) data.services.items = [];
  data.services.items.push({icon:'✨', title:'New service', body:'', wide:false});
  renderSvcItems(); scheduleSave();
});

/* ── ABOUT PARAGRAPHS ── */
function renderAboutParas() {
  var w = g('about-paras-wrap'); if (!w) return; w.innerHTML = '';
  (data.about && data.about.paragraphs || []).forEach(function(p, i){
    var rb = document.createElement('div'); rb.className = 'para-rb';
    rb.innerHTML = '<span class="para-num">'+(i+1)+'</span><button class="para-del">✕</button>' +
      '<textarea style="width:100%;background:var(--bg4);border:1px solid var(--b1);border-radius:6px;padding:.5rem .7rem;color:var(--t1);font-size:.83rem;font-family:\'DM Sans\',sans-serif;outline:none;resize:vertical;min-height:60px;line-height:1.5;">'+esc(p)+'</textarea>';
    rb.querySelector('.para-del').addEventListener('click', function(){ data.about.paragraphs.splice(i,1); renderAboutParas(); scheduleSave(); });
    rb.querySelector('textarea').addEventListener('input', function(){ data.about.paragraphs[i] = this.value; scheduleSave(); });
    w.appendChild(rb);
  });
}
g('btn-add-para').addEventListener('click', function(){
  if (!data.about.paragraphs) data.about.paragraphs = [];
  data.about.paragraphs.push('New paragraph.'); renderAboutParas(); scheduleSave();
});

/* ── FOUNDER PARAGRAPHS ── */
function renderFounderParas() {
  var w = g('founder-paras-wrap'); if (!w) return; w.innerHTML = '';
  (data.about && data.about.founderParagraphs || []).forEach(function(p, i){
    var rb = document.createElement('div'); rb.className = 'para-rb';
    rb.innerHTML = '<span class="para-num">'+(i+1)+'</span><button class="para-del">✕</button>' +
      '<textarea style="width:100%;background:var(--bg4);border:1px solid var(--b1);border-radius:6px;padding:.5rem .7rem;color:var(--t1);font-size:.83rem;font-family:\'DM Sans\',sans-serif;outline:none;resize:vertical;min-height:60px;line-height:1.5;">'+esc(p)+'</textarea>';
    rb.querySelector('.para-del').addEventListener('click', function(){ data.about.founderParagraphs.splice(i,1); renderFounderParas(); scheduleSave(); });
    rb.querySelector('textarea').addEventListener('input', function(){ data.about.founderParagraphs[i] = this.value; scheduleSave(); });
    w.appendChild(rb);
  });
}
g('btn-add-founder-para').addEventListener('click', function(){
  if (!data.about.founderParagraphs) data.about.founderParagraphs = [];
  data.about.founderParagraphs.push('New paragraph.'); renderFounderParas(); scheduleSave();
});

/* ── VALUES ── */
function renderValues() {
  var w = g('values-wrap'); if (!w) return; w.innerHTML = '';
  (data.about && data.about.values || []).forEach(function(v, i){
    var rb = document.createElement('div'); rb.className = 'rb';
    rb.innerHTML = '<span class="rb-num">'+(i+1)+'</span><button class="rb-del">Delete</button>' +
      '<div class="rb-inner"><div class="row2">' +
        '<div class="f"><label>Title</label><input value="'+esc(v.title)+'" data-k="title"/></div>' +
        '<div class="f"><label>Description</label><input value="'+esc(v.desc)+'" data-k="desc"/></div>' +
      '</div></div>';
    rb.querySelector('.rb-del').addEventListener('click', function(){ data.about.values.splice(i,1); renderValues(); scheduleSave(); });
    rb.querySelectorAll('input').forEach(function(el){
      el.addEventListener('input', function(){ data.about.values[i][el.dataset.k] = el.value; scheduleSave(); });
    });
    w.appendChild(rb);
  });
}
g('btn-add-value').addEventListener('click', function(){
  if (!data.about.values) data.about.values = [];
  data.about.values.push({title:'New value', desc:''}); renderValues(); scheduleSave();
});

/* ── TESTIMONIALS ── */
function renderTestis() {
  var w = g('testi-wrap'); if (!w) return; w.innerHTML = '';
  (data.testimonials && data.testimonials.items || []).forEach(function(t, i){
    var rb = document.createElement('div'); rb.className = 'rb';
    rb.innerHTML = '<span class="rb-num">'+(i+1)+'</span><button class="rb-del">Delete</button>' +
      '<div class="rb-inner">' +
        '<div class="f"><label>Quote</label><textarea data-k="quote">'+esc(t.quote)+'</textarea></div>' +
        '<div class="row2">' +
          '<div class="f"><label>Name</label><input value="'+esc(t.name)+'" data-k="name"/></div>' +
          '<div class="f"><label>Business</label><input value="'+esc(t.business)+'" data-k="business"/></div>' +
        '</div>' +
        '<div class="f"><label>Avatar initial</label><input value="'+esc(t.initial)+'" maxlength="2" style="max-width:70px" data-k="initial"/></div>' +
      '</div>';
    rb.querySelector('.rb-del').addEventListener('click', function(){ data.testimonials.items.splice(i,1); renderTestis(); scheduleSave(); });
    rb.querySelectorAll('input,textarea').forEach(function(el){
      el.addEventListener('input', function(){ data.testimonials.items[i][el.dataset.k] = el.value; scheduleSave(); });
    });
    w.appendChild(rb);
  });
}
g('btn-add-testi').addEventListener('click', function(){
  if (!data.testimonials) data.testimonials = {items:[]};
  if (!data.testimonials.items) data.testimonials.items = [];
  data.testimonials.items.push({quote:'"Add client quote here."', name:'Client Name', business:'Business, City', initial:'A'});
  renderTestis(); scheduleSave();
});

/* ── PRICING PLANS ── */
function renderPrices() {
  var w = g('price-wrap'); if (!w) return; w.innerHTML = '';
  (data.pricing && data.pricing.plans || []).forEach(function(pl, i){
    var rb = document.createElement('div'); rb.className = 'rb';
    rb.innerHTML = '<span class="rb-num">'+(i+1)+'</span><button class="rb-del">Delete</button>' +
      '<div class="rb-inner">' +
        '<div class="row2">' +
          '<div class="f"><label>Plan name</label><input value="'+esc(pl.tier)+'" data-k="tier"/></div>' +
          '<div class="f"><label>Price (without ₹)</label><input value="'+esc(pl.amount)+'" data-k="amount"/></div>' +
        '</div>' +
        '<div class="row2">' +
          '<div class="f"><label>Note line</label><input value="'+esc(pl.note)+'" data-k="note"/></div>' +
          '<div class="f"><label>Badge (blank = none)</label><input value="'+esc(pl.badge)+'" data-k="badge"/></div>' +
        '</div>' +
        '<div class="trow"><span>Featured / highlighted</span>' +
          '<label class="tog"><input type="checkbox" '+(pl.featured?'checked':'')+'/><span class="tsl"></span></label>' +
        '</div>' +
        '<div class="f"><label>Button text</label><input value="'+esc(pl.buttonText)+'" data-k="buttonText"/></div>' +
        '<div class="f"><label>Features — one per line</label><textarea rows="5" data-k="features-raw">'+esc((pl.features||[]).join('\n'))+'</textarea></div>' +
      '</div>';
    rb.querySelector('.rb-del').addEventListener('click', function(){ data.pricing.plans.splice(i,1); renderPrices(); scheduleSave(); });
    rb.querySelectorAll('input[type=text],input:not([type])').forEach(function(el){
      el.addEventListener('input', function(){ data.pricing.plans[i][el.dataset.k] = el.value; scheduleSave(); });
    });
    rb.querySelector('textarea').addEventListener('input', function(){
      data.pricing.plans[i].features = this.value.split('\n').filter(function(s){ return s.trim(); });
      scheduleSave();
    });
    rb.querySelector('input[type=checkbox]').addEventListener('change', function(){
      data.pricing.plans[i].featured = this.checked; scheduleSave();
    });
    w.appendChild(rb);
  });
}
g('btn-add-price').addEventListener('click', function(){
  if (!data.pricing) data.pricing = {plans:[]};
  if (!data.pricing.plans) data.pricing.plans = [];
  data.pricing.plans.push({tier:'New Plan', amount:'999', note:'one-time', featured:false, badge:'', buttonText:'Get started', features:['Feature 1']});
  renderPrices(); scheduleSave();
});

/* ── PORTFOLIO PROJECTS ── */
function renderPortfolioProjects() {
  var w = g('portfolio-projects-wrap'); if (!w) return; w.innerHTML = '';
  var projects = (data.portfolio && data.portfolio.projects) || [];
  projects.forEach(function(p, i){
    var rb = document.createElement('div'); rb.className = 'rb';
    rb.innerHTML = '<span class="rb-num">'+(i+1)+'</span><button class="rb-del">Delete</button>' +
      '<div class="rb-inner">' +
        '<div class="row2">' +
          '<div class="f"><label>Emoji</label><input value="'+esc(p.emoji)+'" data-k="emoji" style="max-width:80px;font-size:1.2rem;"/></div>' +
          '<div class="f"><label>Client / project title</label><input value="'+esc(p.title)+'" data-k="title"/></div>' +
        '</div>' +
        '<div class="row2">' +
          '<div class="f"><label>Business type · City</label><input value="'+esc(p.biz)+'" data-k="biz"/></div>' +
          '<div class="f"><label>Tag label (e.g. Website)</label><input value="'+esc(p.tag)+'" data-k="tag"/></div>' +
        '</div>' +
        '<div class="f"><label>Result / outcome shown on card</label><input value="'+esc(p.result)+'" data-k="result"/></div>' +
        '<div class="row2">' +
          '<div class="f"><label>Plan used</label><input value="'+esc(p.plan)+'" data-k="plan"/></div>' +
          '<div class="f"><label>Built in (e.g. 4 days)</label><input value="'+esc(p.time)+'" data-k="time"/></div>' +
        '</div>' +
        '<div class="f"><label>Filter categories (space-separated)<br><span style="color:var(--t3);font-size:.68rem;">Options: website gmaps whatsapp food salon retail</span></label>' +
          '<input value="'+esc(p.cats)+'" data-k="cats"/></div>' +
        '<div class="f"><label>Skill tags shown on card (comma-separated)</label>' +
          '<input value="'+esc((p.tags||[]).join(', '))+'" data-k="tags-raw"/></div>' +
      '</div>';
    rb.querySelector('.rb-del').addEventListener('click', function(){ data.portfolio.projects.splice(i,1); renderPortfolioProjects(); scheduleSave(); });
    rb.querySelectorAll('input').forEach(function(el){
      el.addEventListener('input', function(){
        var k = el.dataset.k;
        if (k === 'tags-raw') {
          data.portfolio.projects[i].tags = el.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
        } else {
          data.portfolio.projects[i][k] = el.value;
        }
        scheduleSave();
      });
    });
    w.appendChild(rb);
  });
}
g('btn-add-project').addEventListener('click', function(){
  if (!data.portfolio) data.portfolio = {projects:[], stats:[]};
  if (!data.portfolio.projects) data.portfolio.projects = [];
  data.portfolio.projects.push({id:String(Date.now()), emoji:'🏪', title:'New Client Project', biz:'Business Type · City', tag:'Website', tagColor:'#d4522a', cats:'website', tags:['Website'], result:'Result / outcome here', plan:'Starter plan', time:'4 days', bg:'linear-gradient(135deg,#fdf4f0,#f9e0d4)'});
  renderPortfolioProjects(); scheduleSave();
});

/* ── PORTFOLIO STATS ── */
function renderPortfolioStats() {
  var w = g('portfolio-stats-wrap'); if (!w) return; w.innerHTML = '';
  ((data.portfolio && data.portfolio.stats) || []).forEach(function(s, i){
    var card = document.createElement('div'); card.className = 'card';
    card.innerHTML =
      '<div class="ct" style="display:flex;justify-content:space-between;align-items:center;">Stat '+(i+1)+
        '<button class="rb-del" style="position:static;">Delete</button></div>' +
      '<div class="row2">' +
        '<div class="f"><label>Number / value</label><input value="'+esc(s.number)+'" data-k="number"/></div>' +
        '<div class="f"><label>Label</label><input value="'+esc(s.label)+'" data-k="label"/></div>' +
      '</div>';
    card.querySelector('.rb-del').addEventListener('click', function(){ data.portfolio.stats.splice(i,1); renderPortfolioStats(); scheduleSave(); });
    card.querySelectorAll('input').forEach(function(el){
      el.addEventListener('input', function(){ data.portfolio.stats[i][el.dataset.k] = el.value; scheduleSave(); });
    });
    w.appendChild(card);
  });
}
g('btn-add-portfolio-stat').addEventListener('click', function(){
  if (!data.portfolio) data.portfolio = {projects:[], stats:[]};
  if (!data.portfolio.stats) data.portfolio.stats = [];
  data.portfolio.stats.push({number:'0', label:'New stat'});
  renderPortfolioStats(); scheduleSave();
});

/* ── SERVICES PAGE ITEMS ── */
function renderSvcPageItems() {
  var w = g('svcpage-wrap'); if (!w) return; w.innerHTML = '';
  ((data.servicesPage && data.servicesPage.services) || []).forEach(function(sv, i){
    var rb = document.createElement('div'); rb.className = 'rb';
    rb.innerHTML = '<span class="rb-num">'+(i+1)+'</span><button class="rb-del">Delete</button>' +
      '<div class="rb-inner">' +
        '<div class="row2">' +
          '<div class="f"><label>Icon</label><input value="'+esc(sv.icon)+'" data-k="icon" style="max-width:80px;font-size:1.1rem;"/></div>' +
          '<div class="f"><label>Tag label</label><input value="'+esc(sv.tag)+'" data-k="tag"/></div>' +
        '</div>' +
        '<div class="f"><label>Title</label><input value="'+esc(sv.title)+'" data-k="title"/></div>' +
        '<div class="f"><label>Paragraph 1</label><textarea data-k="para1">'+esc(sv.para1)+'</textarea></div>' +
        '<div class="f"><label>Paragraph 2</label><textarea data-k="para2">'+esc(sv.para2)+'</textarea></div>' +
        '<div class="f"><label>Features list — one per line</label><textarea rows="4" data-k="features-raw">'+esc((sv.features||[]).join('\n'))+'</textarea></div>' +
        '<div class="row2">' +
          '<div class="f"><label>Price chip text</label><input value="'+esc(sv.price)+'" data-k="price"/></div>' +
          '<div class="f"><label>CTA plan key (for URL)</label><input value="'+esc(sv.planKey)+'" data-k="planKey"/></div>' +
        '</div>' +
      '</div>';
    rb.querySelector('.rb-del').addEventListener('click', function(){ data.servicesPage.services.splice(i,1); renderSvcPageItems(); scheduleSave(); });
    rb.querySelectorAll('input,textarea').forEach(function(el){
      el.addEventListener('input', function(){
        var k = el.dataset.k;
        if (k === 'features-raw') {
          data.servicesPage.services[i].features = el.value.split('\n').filter(function(s){ return s.trim(); });
        } else {
          data.servicesPage.services[i][k] = el.value;
        }
        scheduleSave();
      });
    });
    w.appendChild(rb);
  });
}
g('btn-add-svcpage').addEventListener('click', function(){
  if (!data.servicesPage) data.servicesPage = {services:[], faq:[]};
  if (!data.servicesPage.services) data.servicesPage.services = [];
  data.servicesPage.services.push({icon:'✨', tag:'New', title:'New service', para1:'', para2:'', features:[], price:'From ₹999', planKey:'New'});
  renderSvcPageItems(); scheduleSave();
});

/* ── FAQ ── */
function renderFaq() {
  var w = g('faq-wrap'); if (!w) return; w.innerHTML = '';
  ((data.servicesPage && data.servicesPage.faq) || []).forEach(function(f, i){
    var rb = document.createElement('div'); rb.className = 'rb';
    rb.innerHTML = '<span class="rb-num">'+(i+1)+'</span><button class="rb-del">Delete</button>' +
      '<div class="rb-inner">' +
        '<div class="f"><label>Question</label><input value="'+esc(f.q)+'" data-k="q"/></div>' +
        '<div class="f"><label>Answer</label><textarea data-k="a">'+esc(f.a)+'</textarea></div>' +
      '</div>';
    rb.querySelector('.rb-del').addEventListener('click', function(){ data.servicesPage.faq.splice(i,1); renderFaq(); scheduleSave(); });
    rb.querySelectorAll('input,textarea').forEach(function(el){
      el.addEventListener('input', function(){ data.servicesPage.faq[i][el.dataset.k] = el.value; scheduleSave(); });
    });
    w.appendChild(rb);
  });
}
g('btn-add-faq').addEventListener('click', function(){
  if (!data.servicesPage) data.servicesPage = {services:[], faq:[]};
  if (!data.servicesPage.faq) data.servicesPage.faq = [];
  data.servicesPage.faq.push({q:'New question?', a:'Answer here.'});
  renderFaq(); scheduleSave();
});

/* ───────────────────────────────────────────────────────────────
   LIVE PREVIEW
─────────────────────────────────────────────────────────────── */
var previewOpen = false;
var previewPage = 'index';

function openPreview(page) {
  previewPage = page || 'index';
  previewOpen = true;
  g('preview-overlay').classList.add('open');
  g('preview-page-select').value = previewPage;
  renderPreview();
}

function closePreview() {
  previewOpen = false;
  g('preview-overlay').classList.remove('open');
}

function renderPreview() {
  var frame = g('preview-frame'); if (!frame) return;
  var html = previewPage === 'portfolio' ? buildPortfolioPreview()
           : previewPage === 'services'  ? buildServicesPreview()
           : buildIndexPreview();
  var blob = new Blob([html], {type:'text/html'});
  var old = frame.src;
  frame.src = URL.createObjectURL(blob);
  if (old && old.startsWith('blob:')) setTimeout(function(){ try{URL.revokeObjectURL(old);}catch(e){} }, 2000);
}

g('preview-close').addEventListener('click', closePreview);
g('preview-page-select').addEventListener('change', function(){ previewPage = this.value; renderPreview(); });
document.querySelectorAll('.preview-device-btn').forEach(function(btn){
  btn.addEventListener('click', function(){
    document.querySelectorAll('.preview-device-btn').forEach(function(b){ b.classList.remove('on'); });
    btn.classList.add('on');
    var frame = g('preview-frame');
    frame.className = btn.dataset.device;
  });
});
document.querySelectorAll('[data-preview]').forEach(function(btn){
  btn.addEventListener('click', function(){ openPreview(btn.dataset.preview); });
});

/* ── Preview HTML builders ── */
function cssVars(c) {
  c = c || {};
  return '--pop:'+(c.primary||'#d4522a')+';--pop2:'+(c.secondary||'#e8a87c')+
         ';--bg:'+(c.background||'#faf9f6')+';--ink:'+(c.ink||'#0a0a0a')+';';
}

function buildIndexPreview() {
  var d=data, c=d.colors||{}, s=d.site||{}, h=d.hero||{};
  var b1=esc(s.brandFirst||'flow'), b2=esc(s.brandAccent||'matic');
  var navHtml = (d.nav&&d.nav.links||[]).map(function(l){
    return '<li><a href="#"'+(l.cta?' class="nc"':'')+'>'+esc(l.label)+'</a></li>';
  }).join('');
  var pillsHtml = (h.pills||[]).map(function(p){ return '<span class="bpill">'+esc(p)+'</span>'; }).join('');
  var statsHtml = (d.stats||[]).map(function(st){
    return '<div><div class="snum">'+esc(st.number)+'<span>'+esc(st.suffix)+'</span></div><div class="slbl">'+esc(st.label)+'</div></div>';
  }).join('');
  var hw=d.howItWorks||{};
  var stepsHtml = (hw.steps||[]).map(function(st,i){
    return '<div class="step"><div class="stag">'+esc(st.tag)+'</div><h3>'+esc(st.title)+'</h3><p>'+esc(st.body)+'</p></div>';
  }).join('');
  var svc=d.services||{};
  var featsHtml = (svc.items||[]).map(function(f){
    return '<div class="fc'+(f.wide?' fw':'')+'"><div class="fi">'+f.icon+'</div><h3>'+esc(f.title)+'</h3><p>'+esc(f.body)+'</p></div>';
  }).join('');
  var ab=d.about||{};
  var parasHtml = (ab.paragraphs||[]).map(function(p){ return '<p>'+esc(p)+'</p>'; }).join('');
  var valsHtml = (ab.values||[]).map(function(v){
    return '<div class="val"><div class="vd"></div><div><b>'+esc(v.title)+'</b><p>'+esc(v.desc)+'</p></div></div>';
  }).join('');
  var fpHtml = (ab.founderParagraphs||[]).map(function(p){ return '<p>'+esc(p)+'</p>'; }).join('');
  var ts=d.testimonials||{};
  var testiHtml = (ts.items||[]).map(function(t){
    return '<div class="tc"><p class="tq">'+esc(t.quote)+'</p><div class="ta"><div class="tav">'+esc(t.initial)+'</div><div><b>'+esc(t.name)+'</b><small>'+esc(t.business)+'</small></div></div></div>';
  }).join('');
  var pr=d.pricing||{};
  var priceHtml = (pr.plans||[]).map(function(pl){
    var feats=(pl.features||[]).map(function(f){ return '<li>'+esc(f)+'</li>'; }).join('');
    return '<div class="pc'+(pl.featured?' pf':'')+'">'+
      (pl.badge?'<div class="pbadge">'+esc(pl.badge)+'</div>':'')+
      '<div class="pt">'+esc(pl.tier)+'</div><div class="pa">₹'+esc(pl.amount)+'</div><div class="pn">'+esc(pl.note)+'</div>'+
      '<ul class="plist">'+feats+'</ul><button class="pbtn">'+esc(pl.buttonText)+'</button></div>';
  }).join('');
  var ct=d.contact||{}, ft=d.footer||{};
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>'+
    '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>'+
    '<style>*{margin:0;padding:0;box-sizing:border-box;}:root{'+cssVars(c)+'--bg2:#f2f0eb;--bg3:#e8e5de;--r:10px;}'+
    'body{font-family:"DM Sans",sans-serif;background:var(--bg);color:var(--ink);overflow-x:hidden;}'+
    'nav{display:flex;align-items:center;justify-content:space-between;padding:.9rem 2.5rem;background:rgba(250,249,246,.95);border-bottom:1px solid rgba(0,0,0,.07);position:sticky;top:0;z-index:10;}'+
    '.logo{font-family:"Instrument Serif",serif;font-size:1.3rem;text-decoration:none;color:var(--ink);}.logo span{color:var(--pop);}'+
    'ul{list-style:none;display:flex;gap:1.75rem;}a{text-decoration:none;font-size:.82rem;font-weight:500;color:#3a3a3a;}'+
    '.nc{background:var(--ink);color:#fff!important;padding:.4rem 1.1rem;border-radius:100px;}'+
    '#hero{min-height:88vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:5rem 2rem 3rem;position:relative;overflow:hidden;}'+
    '.hbg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 20%,#ffe8de,transparent 70%);pointer-events:none;}'+
    '.badge{display:inline-flex;align-items:center;gap:.4rem;background:#f2f0eb;border:1px solid #e8e5de;border-radius:100px;padding:.3rem .85rem;font-size:.75rem;color:#3a3a3a;margin-bottom:1.5rem;}'+
    '.bd{width:5px;height:5px;border-radius:50%;background:var(--pop);}'+
    'h1{font-family:"Instrument Serif",serif;font-size:clamp(2.2rem,5.5vw,4.2rem);line-height:1.05;letter-spacing:-.03em;max-width:820px;margin-bottom:1.1rem;}'+
    'h1 em{font-style:italic;color:var(--pop);}'+
    '.hs{font-size:.95rem;color:#3a3a3a;max-width:500px;line-height:1.7;margin-bottom:2rem;font-weight:300;}'+
    '.ha{display:flex;gap:.65rem;flex-wrap:wrap;justify-content:center;}'+
    '.bp{background:var(--ink);color:#fff;padding:.75rem 1.6rem;border-radius:100px;font-weight:600;font-size:.88rem;border:none;cursor:pointer;}'+
    '.bg{background:transparent;color:var(--ink);padding:.75rem 1.6rem;border-radius:100px;font-weight:500;font-size:.88rem;border:1.5px solid #e8e5de;cursor:pointer;}'+
    '.pills{margin-top:2.5rem;display:flex;flex-direction:column;align-items:center;gap:.75rem;}'+
    '.pills p{font-size:.7rem;color:#888;letter-spacing:.07em;text-transform:uppercase;}'+
    '.prow{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;}'+
    '.bpill{background:#f2f0eb;border:1px solid #e8e5de;border-radius:100px;padding:.25rem .8rem;font-size:.75rem;font-weight:500;color:#3a3a3a;}'+
    '#stats{background:var(--ink);color:#fff;padding:3rem 2.5rem;display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;text-align:center;}'+
    '.snum{font-family:"Instrument Serif",serif;font-size:2.75rem;letter-spacing:-.03em;}.snum span{color:var(--pop2);}'+
    '.slbl{font-size:.8rem;color:rgba(255,255,255,.45);margin-top:.2rem;}'+
    'section{padding:4.5rem 2.5rem;}.sl{font-size:.7rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--pop);margin-bottom:.8rem;}'+
    '.st{font-family:"Instrument Serif",serif;font-size:clamp(1.7rem,3.5vw,2.5rem);line-height:1.1;letter-spacing:-.03em;margin-bottom:.8rem;}'+
    '.ss{color:#3a3a3a;line-height:1.7;max-width:480px;font-weight:300;font-size:.9rem;}'+
    '#how{background:var(--bg);}.sw{display:grid;grid-template-columns:repeat(3,1fr);gap:1.25rem;margin-top:2.5rem;}'+
    '.step{background:#fff;border-radius:var(--r);border:1px solid #e8e5de;padding:1.75rem;position:relative;}'+
    '.stag{display:inline-block;background:var(--pop);color:#fff;font-size:.62rem;font-weight:600;padding:.18rem .6rem;border-radius:100px;margin-bottom:.65rem;}'+
    '.step h3{font-size:.92rem;font-weight:600;margin-bottom:.4rem;}.step p{font-size:.8rem;color:#3a3a3a;line-height:1.6;font-weight:300;}'+
    '#features{background:#f2f0eb;}.fg{display:grid;grid-template-columns:1fr 1fr;gap:1.1rem;margin-top:2.5rem;}'+
    '.fc{background:#fff;border-radius:var(--r);border:1px solid #e8e5de;padding:1.75rem;}.fc.fw{grid-column:span 2;}'+
    '.fi{width:36px;height:36px;background:var(--pop);border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:.9rem;font-size:1rem;}'+
    '.fc h3{font-size:.9rem;font-weight:600;margin-bottom:.4rem;}.fc p{font-size:.8rem;color:#3a3a3a;line-height:1.6;font-weight:300;}'+
    '#about{background:var(--bg);}.ag{display:grid;grid-template-columns:1fr 1fr;gap:3.5rem;align-items:start;margin-top:2.5rem;}'+
    '.av{background:var(--ink);border-radius:var(--r);padding:2rem;color:#fff;position:relative;overflow:hidden;}'+
    '.av::before{content:"";position:absolute;top:-25px;right:-25px;width:120px;height:120px;background:var(--pop);opacity:.12;border-radius:50%;}'+
    '.ain{width:52px;height:52px;border-radius:50%;background:var(--pop);display:flex;align-items:center;justify-content:center;font-family:"Instrument Serif",serif;font-size:1.5rem;color:#fff;margin-bottom:1rem;}'+
    '.av h3{font-family:"Instrument Serif",serif;font-size:1.2rem;line-height:1.2;margin-bottom:.55rem;}'+
    '.av p{font-size:.82rem;line-height:1.7;color:rgba(255,255,255,.65);font-weight:300;margin-bottom:.55rem;}'+
    '.fsig{font-family:"Instrument Serif",serif;font-style:italic;color:var(--pop2);font-size:.95rem;margin-top:1rem;}'+
    '.at p{color:#3a3a3a;line-height:1.7;font-weight:300;font-size:.88rem;margin-top:.8rem;}'+
    '.vals{display:grid;gap:.75rem;margin-top:1.5rem;}.val{display:flex;gap:.75rem;align-items:flex-start;}'+
    '.vd{width:6px;height:6px;border-radius:50%;background:var(--pop2);flex-shrink:0;margin-top:.35rem;}'+
    '.val b{display:block;font-size:.82rem;font-weight:600;margin-bottom:.1rem;}.val p{font-size:.76rem;color:#3a3a3a;font-weight:300;line-height:1.5;}'+
    '#testimonials{background:#f2f0eb;}.tg{display:grid;grid-template-columns:repeat(3,1fr);gap:1.1rem;margin-top:2.5rem;}'+
    '.tc{background:#fff;border-radius:var(--r);border:1px solid #e8e5de;padding:1.5rem;}'+
    '.tq{font-size:.83rem;color:#3a3a3a;line-height:1.7;font-weight:300;font-style:italic;margin-bottom:.9rem;}'+
    '.ta{display:flex;align-items:center;gap:.55rem;}.tav{width:32px;height:32px;border-radius:50%;background:#f2f0eb;border:1px solid #e8e5de;display:flex;align-items:center;justify-content:center;font-family:"Instrument Serif",serif;font-size:.85rem;color:var(--pop);}'+
    '.ta b{display:block;font-size:.78rem;font-weight:600;}.ta small{font-size:.7rem;color:#888;}'+
    '#pricing{background:var(--bg);}.pg{display:grid;grid-template-columns:repeat(3,1fr);gap:1.1rem;margin-top:2.5rem;}'+
    '.pc{background:#fff;border-radius:var(--r);border:1px solid #e8e5de;padding:1.75rem;}.pf{border:2px solid var(--pop);background:var(--ink);color:#fff;}'+
    '.pbadge{display:inline-block;background:var(--pop);color:#fff;font-size:.62rem;font-weight:700;padding:.18rem .6rem;border-radius:100px;margin-bottom:.9rem;}'+
    '.pt{font-size:.7rem;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem;}.pf .pt{color:rgba(255,255,255,.4);}'+
    '.pa{font-family:"Instrument Serif",serif;font-size:2.2rem;letter-spacing:-.03em;line-height:1;margin-bottom:.22rem;}.pf .pa{color:#fff;}'+
    '.pn{font-size:.7rem;color:#888;margin-bottom:1.3rem;}.pf .pn{color:rgba(255,255,255,.35);}'+
    '.plist{list-style:none;display:grid;gap:.5rem;margin-bottom:1.5rem;}.plist li{font-size:.78rem;color:#3a3a3a;display:flex;gap:.4rem;align-items:flex-start;line-height:1.4;}.pf .plist li{color:rgba(255,255,255,.7);}.plist li::before{content:"✓";color:var(--pop);font-weight:700;flex-shrink:0;}.pf .plist li::before{color:var(--pop2);}'+
    '.pbtn{width:100%;padding:.7rem;border-radius:100px;font-weight:600;font-size:.82rem;cursor:pointer;border:1.5px solid #e8e5de;background:transparent;color:var(--ink);font-family:"DM Sans",sans-serif;}.pf .pbtn{background:var(--pop);color:#fff;border-color:var(--pop);}'+
    '#contact{background:var(--ink);color:#fff;text-align:center;padding:5rem 2.5rem;}'+
    '#contact .sl{color:var(--pop2);}#contact .st{color:#fff;max-width:540px;margin:0 auto .75rem;}'+
    '#contact .ss{color:rgba(255,255,255,.45);margin:0 auto 2.25rem;max-width:420px;}'+
    'footer{background:#050505;color:rgba(255,255,255,.32);padding:1.75rem 2.5rem;display:flex;align-items:center;justify-content:space-between;font-size:.75rem;flex-wrap:wrap;gap:.75rem;}'+
    '.fl{font-family:"Instrument Serif",serif;color:rgba(255,255,255,.55);font-size:1rem;text-decoration:none;}.fl span{color:var(--pop);}'+
    '</style></head><body>'+
    '<nav><a href="#" class="logo">'+b1+'<span>'+b2+'</span></a><ul>'+navHtml+'</ul></nav>'+
    '<section id="hero"><div class="hbg"></div>'+
    '<div class="badge"><span class="bd"></span>'+esc(h.badge||'')+'</div>'+
    '<h1>'+esc(h.headlineLine1||'')+'<br>Now let\'s get it <em>'+esc(h.headlineLine2||'')+'</em></h1>'+
    '<p class="hs">'+esc(h.subheading||'')+'</p>'+
    '<div class="ha"><button class="bp">'+esc(h.primaryBtn||'')+'</button><button class="bg">'+esc(h.secondaryBtn||'')+'</button></div>'+
    '<div class="pills"><p>Perfect for</p><div class="prow">'+pillsHtml+'</div></div>'+
    '</section>'+
    '<div id="stats">'+statsHtml+'</div>'+
    '<section id="how"><div class="sl">'+esc(hw.label||'')+'</div><div class="st">'+esc(hw.title||'')+'</div><p class="ss">'+esc(hw.subtitle||'')+'</p><div class="sw">'+stepsHtml+'</div></section>'+
    '<section id="features"><div class="sl">'+esc(svc.label||'')+'</div><div class="st">'+esc(svc.title||'')+'</div><div class="fg">'+featsHtml+'</div></section>'+
    '<section id="about"><div class="sl">'+esc(ab.label||'')+'</div><div class="ag">'+
    '<div class="at"><div class="st">'+esc(ab.title||'')+'</div>'+parasHtml+'<div class="vals">'+valsHtml+'</div></div>'+
    '<div class="av"><div class="ain">'+esc(ab.founderInitial||'A')+'</div><h3>'+esc(ab.founderHeading||'')+'</h3>'+fpHtml+'<div class="fsig">'+esc(ab.founderSignature||'')+'</div></div>'+
    '</div></section>'+
    '<section id="testimonials"><div class="sl">'+esc(ts.label||'')+'</div><div class="st">'+esc(ts.title||'')+'</div><div class="tg">'+testiHtml+'</div></section>'+
    '<section id="pricing"><div class="sl">'+esc(pr.label||'')+'</div><div class="st">'+esc(pr.title||'')+'</div><p class="ss">'+esc(pr.subtitle||'')+'</p><div class="pg">'+priceHtml+'</div></section>'+
    '<section id="contact"><div class="sl">'+esc(ct.label||'')+'</div><div class="st">'+esc(ct.title||'')+'</div><p class="ss">'+esc(ct.subtitle||'')+'</p></section>'+
    '<footer><a href="#" class="fl">'+b1+'<span>'+b2+'</span></a><div>© '+esc((data.footer||{}).copyright||'')+'</div><div>'+esc((data.footer||{}).emailDisplay||'')+'</div></footer>'+
    '</body></html>';
}

function buildPortfolioPreview() {
  var po=data.portfolio||{}, s=data.site||{}, c=data.colors||{};
  var b1=esc(s.brandFirst||'flow'), b2=esc(s.brandAccent||'matic');
  var pop=c.primary||'#d4522a';
  var cards = (po.projects||[]).map(function(p){
    var tags=(p.tags||[]).map(function(t){ return '<span style="font-size:.67rem;background:#f2f0eb;border:1px solid #e8e5de;padding:.1rem .48rem;border-radius:100px;">'+esc(t)+'</span>'; }).join('');
    return '<div style="background:#fff;border-radius:10px;border:1px solid #e8e5de;overflow:hidden;">'+
      '<div style="height:160px;background:'+esc(p.bg||'#f2f0eb')+';position:relative;display:flex;align-items:center;justify-content:center;font-size:2.5rem;">'+
        '<div style="position:absolute;top:.55rem;left:.55rem;background:'+esc(p.tagColor||pop)+';color:#fff;font-size:.6rem;font-weight:700;padding:.15rem .5rem;border-radius:100px;">'+esc(p.tag||'')+'</div>'+
        '<div style="position:absolute;bottom:.6rem;right:.6rem;font-size:2rem;">'+esc(p.emoji||'🏪')+'</div>'+
      '</div>'+
      '<div style="padding:1rem;"><h3 style="font-size:.88rem;font-weight:600;margin-bottom:.2rem;">'+esc(p.title||'')+'</h3>'+
      '<div style="font-size:.72rem;color:#888;margin-bottom:.55rem;">'+esc(p.biz||'')+'</div>'+
      '<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.5rem;">'+tags+'</div>'+
      '<div style="font-size:.72rem;color:#065f46;background:#f0fff4;border:1px solid #a7f3d0;border-radius:6px;padding:.38rem .55rem;">📈 '+esc(p.result||'')+'</div>'+
      '</div></div>';
  }).join('');
  var stats=(po.stats||[]).map(function(st){
    return '<div><div style="font-family:\'Instrument Serif\',serif;font-size:2rem;color:#e8a87c;">'+esc(st.number||'')+'</div><div style="font-size:.75rem;color:rgba(255,255,255,.42);margin-top:.15rem;">'+esc(st.label||'')+'</div></div>';
  }).join('');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>'+
    '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>'+
    '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:"DM Sans",sans-serif;background:#faf9f6;color:#0a0a0a;}</style>'+
    '</head><body>'+
    '<nav style="display:flex;align-items:center;justify-content:space-between;padding:.9rem 2.5rem;background:rgba(250,249,246,.95);border-bottom:1px solid rgba(0,0,0,.07);">'+
    '<a href="#" style="font-family:\'Instrument Serif\',serif;font-size:1.3rem;text-decoration:none;color:#0a0a0a;">'+b1+'<span style="color:'+pop+'">'+b2+'</span></a>'+
    '<a href="#" style="font-size:.8rem;font-weight:600;color:'+pop+';text-decoration:none;">Get in touch →</a></nav>'+
    '<div style="padding:5rem 2.5rem 3rem;text-align:center;">'+
    '<div style="font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:'+pop+';margin-bottom:.9rem;">'+esc(po.label||'Our Work')+'</div>'+
    '<h1 style="font-family:\'Instrument Serif\',serif;font-size:clamp(2rem,4vw,3rem);line-height:1.1;margin-bottom:.75rem;">'+esc(po.title||'')+'</h1>'+
    '<p style="font-size:.9rem;color:#666;max-width:460px;margin:0 auto;line-height:1.7;font-weight:300;">'+esc(po.subtitle||'')+'</p></div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1.25rem;padding:0 2.5rem 4rem;max-width:1040px;margin:0 auto;">'+cards+'</div>'+
    '<div style="background:#0a0a0a;padding:2.5rem;display:grid;grid-template-columns:repeat(4,1fr);gap:1.5rem;text-align:center;">'+stats+'</div>'+
    '</body></html>';
}

function buildServicesPreview() {
  var sp=data.servicesPage||{}, s=data.site||{}, c=data.colors||{}, pr=data.pricing||{};
  var b1=esc(s.brandFirst||'flow'), b2=esc(s.brandAccent||'matic');
  var pop=c.primary||'#d4522a';
  var svcs = (sp.services||[]).map(function(sv,i){
    var feats=(sv.features||[]).map(function(f){ return '<li style="display:flex;gap:.4rem;font-size:.8rem;color:#3a3a3a;margin-bottom:.4rem;line-height:1.4;"><span style="color:'+pop+';font-weight:700;flex-shrink:0;">✓</span>'+esc(f)+'</li>'; }).join('');
    var bg=i%2===0?'#faf9f6':'#f2f0eb';
    return '<div style="background:'+bg+';padding:3rem 2.5rem;">'+
      '<div style="max-width:900px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:2.5rem;align-items:center;'+(i%2!==0?'direction:rtl;':'')+'" >'+
      '<div style="background:#e8e5de;border-radius:12px;min-height:180px;display:flex;align-items:center;justify-content:center;font-size:4rem;direction:ltr;">'+esc(sv.icon||'')+'</div>'+
      '<div style="direction:ltr;">'+
        '<div style="display:inline-block;background:#f2f0eb;border:1px solid #e8e5de;border-radius:100px;padding:.22rem .75rem;font-size:.68rem;font-weight:600;margin-bottom:.75rem;">'+esc(sv.tag||'')+'</div>'+
        '<h2 style="font-family:\'Instrument Serif\',serif;font-size:clamp(1.4rem,2.5vw,1.9rem);line-height:1.15;margin-bottom:.55rem;">'+esc(sv.title||'')+'</h2>'+
        '<p style="color:#3a3a3a;line-height:1.7;font-weight:300;font-size:.88rem;margin-bottom:.55rem;">'+esc(sv.para1||'')+'</p>'+
        '<p style="color:#3a3a3a;line-height:1.7;font-weight:300;font-size:.88rem;margin-bottom:1.1rem;">'+esc(sv.para2||'')+'</p>'+
        '<ul style="list-style:none;display:grid;gap:.35rem;margin-bottom:1.1rem;">'+feats+'</ul>'+
        '<span style="display:inline-block;background:#0a0a0a;color:#fff;padding:.3rem .85rem;border-radius:100px;font-size:.75rem;font-weight:600;margin-right:.4rem;">'+esc(sv.price||'')+'</span>'+
        '<a href="#" style="display:inline-block;background:'+pop+';color:#fff;padding:.6rem 1.3rem;border-radius:100px;font-size:.82rem;font-weight:600;text-decoration:none;">Get started →</a>'+
      '</div></div></div>';
  }).join('');
  var faqHtml = (sp.faq||[]).map(function(f){
    return '<div style="border-bottom:1px solid #e8e5de;padding:.9rem 0;">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;">'+
        '<span style="font-size:.88rem;font-weight:500;">'+esc(f.q||'')+'</span>'+
        '<span style="color:'+pop+';font-size:1rem;">+</span>'+
      '</div></div>';
  }).join('');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>'+
    '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>'+
    '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:"DM Sans",sans-serif;background:#faf9f6;color:#0a0a0a;}</style>'+
    '</head><body>'+
    '<nav style="display:flex;align-items:center;justify-content:space-between;padding:.9rem 2.5rem;background:rgba(250,249,246,.95);border-bottom:1px solid rgba(0,0,0,.07);">'+
    '<a href="#" style="font-family:\'Instrument Serif\',serif;font-size:1.3rem;text-decoration:none;color:#0a0a0a;">'+b1+'<span style="color:'+pop+'">'+b2+'</span></a>'+
    '<a href="#" style="background:'+pop+';color:#fff;padding:.42rem 1.1rem;border-radius:100px;font-size:.8rem;font-weight:600;text-decoration:none;">Get in touch</a></nav>'+
    '<div style="padding:5.5rem 2.5rem 3rem;text-align:center;background:#faf9f6;">'+
    '<div style="font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:'+pop+';margin-bottom:.9rem;">Services</div>'+
    '<h1 style="font-family:\'Instrument Serif\',serif;font-size:clamp(1.9rem,4vw,2.9rem);line-height:1.1;letter-spacing:-.03em;margin-bottom:.75rem;">'+esc(sp.heroTitle||'')+'</h1>'+
    '<p style="font-size:.9rem;color:#666;max-width:480px;margin:0 auto;line-height:1.7;font-weight:300;">'+esc(sp.heroSubtitle||'')+'</p></div>'+
    svcs+
    '<div style="padding:3.5rem 2.5rem;background:#faf9f6;">'+
    '<h2 style="font-family:\'Instrument Serif\',serif;font-size:clamp(1.5rem,3vw,2.2rem);text-align:center;margin-bottom:2rem;">Common questions</h2>'+
    '<div style="max-width:640px;margin:0 auto;">'+faqHtml+'</div></div>'+
    '</body></html>';
}

/* ───────────────────────────────────────────────────────────────
   GITHUB / PUBLISH
─────────────────────────────────────────────────────────────── */
function loadGhConfig() {
  var cfg = JSON.parse(localStorage.getItem(GH_KEY) || '{}');
  var map = {'gh-token':'token','gh-owner':'owner','gh-repo':'repo','gh-branch':'branch','gh-site-url':'siteUrl'};
  Object.keys(map).forEach(function(id){
    var el = g(id); if (el) el.value = cfg[map[id]] || '';
  });
  if (g('gh-branch') && !g('gh-branch').value) g('gh-branch').value = 'main';
  updatePublishBtns();
}

function updatePublishBtns() {
  var cfg = JSON.parse(localStorage.getItem(GH_KEY) || '{}');
  var ok = !!(cfg.token && cfg.owner && cfg.repo);
  [g('btn-publish'), g('btn-publish-panel')].forEach(function(b){ if(b) b.disabled = !ok; });
}

function doPublish() {
  var cfg = JSON.parse(localStorage.getItem(GH_KEY) || '{}');
  if (!cfg.token || !cfg.owner || !cfg.repo) { toast('Set up GitHub config first in Publish panel', true); return; }
  [g('btn-publish'), g('btn-publish-panel')].forEach(function(b){ if(b){ b.disabled=true; b.textContent='⏳ Publishing...'; } });
  setStatus('saving', 'Publishing to GitHub...');
  var json = JSON.stringify(data, null, 2);
  var encoded = btoa(unescape(encodeURIComponent(json)));
  var apiUrl = 'https://api.github.com/repos/'+cfg.owner+'/'+cfg.repo+'/contents/content.json';
  fetch(apiUrl+'?ref='+cfg.branch, {
    headers: {'Authorization':'token '+cfg.token, 'Accept':'application/vnd.github.v3+json'}
  })
  .then(function(r){ return r.ok ? r.json() : null; })
  .then(function(existing){
    var body = {
      message: 'Update content.json — '+new Date().toLocaleString('en-IN'),
      content: encoded, branch: cfg.branch
    };
    if (existing && existing.sha) body.sha = existing.sha;
    return fetch(apiUrl, {
      method:'PUT',
      headers:{'Authorization':'token '+cfg.token,'Content-Type':'application/json','Accept':'application/vnd.github.v3+json'},
      body: JSON.stringify(body)
    });
  })
  .then(function(r){ if(!r.ok) throw new Error('GitHub API error '+r.status); return r.json(); })
  .then(function(){
    setStatus('saved', 'Published ✓');
    toast('Published to GitHub! Netlify updates in ~30s ✓');
    [g('btn-publish'), g('btn-publish-panel')].forEach(function(b){ if(b){ b.textContent='✓ Published!'; setTimeout(function(){ b.textContent='🚀 Publish'; b.disabled=false; }, 3000); } });
  })
  .catch(function(err){
    setStatus('error', 'Publish failed');
    toast('Publish failed: '+err.message, true);
    [g('btn-publish'), g('btn-publish-panel')].forEach(function(b){ if(b){ b.disabled=false; b.textContent='🚀 Publish'; } });
  });
}

g('btn-save-gh').addEventListener('click', function(){
  var cfg = {
    token:  g('gh-token').value.trim(),
    owner:  g('gh-owner').value.trim(),
    repo:   g('gh-repo').value.trim(),
    branch: g('gh-branch').value.trim() || 'main',
    siteUrl:g('gh-site-url').value.trim()
  };
  localStorage.setItem(GH_KEY, JSON.stringify(cfg));
  updatePublishBtns();
  g('gh-status').textContent = '✓ Saved — Publish button enabled';
  toast('GitHub config saved ✓');
});

[g('btn-publish'), g('btn-publish-panel')].forEach(function(b){ if(b) b.addEventListener('click', doPublish); });

g('btn-download-json').addEventListener('click', function(){
  var blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'content.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  toast('content.json downloaded ✓');
});

/* ───────────────────────────────────────────────────────────────
   CHANGE PASSWORD
─────────────────────────────────────────────────────────────── */
g('btn-change-pwd').addEventListener('click', async function(){
  var cur=g('pwd-current').value, nw=g('pwd-new').value, cf=g('pwd-confirm').value;
  var st=g('pwd-status');
  if (!cur||!nw||!cf) { st.style.color='#f87171'; st.textContent='Please fill all three fields'; return; }
  if (nw !== cf)      { st.style.color='#f87171'; st.textContent='New passwords do not match'; return; }
  if (nw.length < 6)  { st.style.color='#f87171'; st.textContent='Password must be at least 6 characters'; return; }
  var curHash = await sha256(cur);
  var stored  = data._admin && data._admin.passwordHash;
  if (curHash !== stored) { st.style.color='#f87171'; st.textContent='Current password is incorrect'; return; }
  var newHash = await sha256(nw);
  if (!data._admin) data._admin = {};
  data._admin.passwordHash = newHash;
  scheduleSave();
  st.style.color = '#4ade80';
  st.textContent = '✓ Password updated. Click 🚀 Publish to make it permanent on Netlify.';
  g('pwd-current').value = ''; g('pwd-new').value = ''; g('pwd-confirm').value = '';
  toast('Password changed ✓');
});

/* ───────────────────────────────────────────────────────────────
   INIT
─────────────────────────────────────────────────────────────── */
function initAdmin() {
  // Panel navigation
  document.querySelectorAll('.nav-btn').forEach(function(btn){
    btn.addEventListener('click', function(){ switchPanel(btn.dataset.panel); });
  });

  // Logout
  g('btn-logout').addEventListener('click', function(){
    clearSession();
    location.reload();
  });

  // Load data then render all
  loadData(function(){
    bindInputs();
    bindColors();
    renderNav();
    renderPills();
    renderStats();
    renderSteps();
    renderSvcItems();
    renderAboutParas();
    renderFounderParas();
    renderValues();
    renderTestis();
    renderPrices();
    renderPortfolioProjects();
    renderPortfolioStats();
    renderSvcPageItems();
    renderFaq();
    loadGhConfig();
  });
}

/* ───────────────────────────────────────────────────────────────
   BOOT — load data first to get password hash, then check login
─────────────────────────────────────────────────────────────── */
fetch('content.json?v=' + Date.now())
  .then(function(r){ return r.ok ? r.json() : null; })
  .then(function(json){ if (json) window.__FMA_DATA = json; })
  .catch(function(){})
  .finally(function(){
    if (isLoggedIn()) {
      initAdmin();
    } else {
      showLogin(false);
    }
  });

})();
