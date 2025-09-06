// hackathons.js (module) — local-only mode
// Generates local hackathons and provides event page + teammate search
// Teammate search looks into localStorage LU_USERS AND users.csv (same folder)
// IMPORTANT: Serve files from localhost (Live Server) so fetch('users.csv') works.

const PAGE_SIZE = 10;
let currentPage = 1;
let HACKS = [];
let FILTERED = [];

// Pools for generation
const SKILL_POOL = ['JavaScript','Python','React','Node.js','SQL','AWS','Docker','TypeScript','Django','Flask','TensorFlow','Figma','Unity','C++','Go'];
const THEMES = ['Health','Education','Fintech','Sustainability','Agritech','GovTech','Games','Study Group'];
const VERBS = ['Optimize','Detect','Predict','Automate','Visualize','Secure','Gamify','Improve'];
const DOMAINS = ['user retention','fraud','energy usage','crop yield','traffic','supply chain','learning outcomes','team formation'];

function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a; }
function escapeHtml(s){ return String(s||'').replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Create a single hackathon object
function makeHackathon(i){
  const theme = THEMES[i % THEMES.length];
  const verb = VERBS[i % VERBS.length];
  const domain = DOMAINS[i % DOMAINS.length];
  const name = `${theme} Hackathon #${i} — ${verb} ${domain}`;
  const date = new Date(Date.now() + (i*24*60*60*1000)).toISOString().slice(0,10);
  const problem = `Build a ${theme.toLowerCase()} prototype to ${verb.toLowerCase()} ${domain}. Focus on reliability and low-cost infra.`;
  const skills = shuffle([...SKILL_POOL]).slice(0, randInt(3,6));
  return { id:`local-${i}`, name, date, problem, skills, theme, domain, createdAt: new Date().toISOString() };
}

/* ---------- rendering ---------- */
function renderGrid(list){
  const grid = document.getElementById('grid'); if(!grid) return;
  grid.innerHTML = '';
  if(!Array.isArray(list)) list = [];
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if(currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  pageItems.forEach(h=>{
    const card = document.createElement('div'); card.className = 'card';
    // Include skills as chips and small "open" action
    const skillsHtml = (h.skills || []).map(s => `<span class="chip">${escapeHtml(s)}</span>`).join(' ');
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <div style="flex:1">
          <h3 style="margin:0 0 6px 0">${escapeHtml(h.name)}</h3>
          <div class="meta small-muted" style="margin-bottom:8px">${escapeHtml(h.date)} • ${escapeHtml(h.theme)}</div>
          <p class="problem" style="margin:0 0 8px 0">${escapeHtml(h.problem)}</p>
          <div>${skillsHtml}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">
          <div class="card-footer">
            <button class="btn btn-open" data-id="${escapeHtml(h.id)}">Open</button>
          </div>
          <div class="small-muted">ID: ${escapeHtml(h.id)}</div>
        </div>
      </div>`;
    const btn = card.querySelector('button.btn-open');
    if(btn) btn.addEventListener('click', ()=> openEvent(h.id));
    grid.appendChild(card);
  });

  renderPagination(total, totalPages, currentPage);
}
function renderPagination(total, totalPages, activePage){
  const pager = document.getElementById('pagination'); if(!pager) return;
  pager.innerHTML = '';
  if(total <= PAGE_SIZE) return;
  const prev = document.createElement('button'); prev.className='page-btn'; prev.textContent='Prev';
  prev.onclick = ()=>goToPage(activePage-1); prev.disabled = activePage===1; pager.appendChild(prev);
  const maxButtons = 7;
  let start = Math.max(1, activePage - Math.floor(maxButtons/2));
  let end = Math.min(totalPages, start + maxButtons - 1);
  if(end - start + 1 < maxButtons) start = Math.max(1, end - maxButtons + 1);
  for(let p=start;p<=end;p++){
    const b = document.createElement('button'); b.className = 'page-btn' + (p===activePage?' active':''); b.textContent = p;
    b.onclick = (function(pp){ return function(){ goToPage(pp); }; })(p);
    pager.appendChild(b);
  }
  const next = document.createElement('button'); next.className='page-btn'; next.textContent='Next';
  next.onclick = ()=>goToPage(activePage+1); next.disabled = activePage===totalPages; pager.appendChild(next);
  const info = document.createElement('div'); info.style.color='#6b7280'; info.style.marginLeft='10px';
  info.textContent = `Showing ${Math.min(total, (activePage-1)*PAGE_SIZE+1)}–${Math.min(total, activePage*PAGE_SIZE)} of ${total}`;
  pager.appendChild(info);
}
function goToPage(page){
  const totalPages = Math.max(1, Math.ceil(FILTERED.length / PAGE_SIZE));
  if(page < 1) page = 1;
  if(page > totalPages) page = totalPages;
  currentPage = page;
  renderGrid(FILTERED);
}

/* ---------- filtering ---------- */
function filterGrid(){
  const el = document.getElementById('globalSearch'); const q = el ? el.value.trim().toLowerCase() : '';
  if(!q){ FILTERED = HACKS.slice(); currentPage=1; renderGrid(FILTERED); return; }
  FILTERED = HACKS.filter(h => (`${h.name} ${h.theme} ${h.domain} ${h.problem} ${(h.skills||[]).join(' ')}`).toLowerCase().includes(q));
  currentPage=1; renderGrid(FILTERED);
}
window.filterGrid = filterGrid;
window.resetFilter = function(){ const el=document.getElementById('globalSearch'); if(el) el.value=''; filterGrid(); };

/* ---------- helper: minimal skill-suggestion "API" stub ---------- */
function suggestSkillsForProblem(problem, existingSkills){
  if(Array.isArray(existingSkills) && existingSkills.length) return existingSkills;
  return shuffle([...SKILL_POOL]).slice(0,5);
}

/* ---------- CSV parse (simple, supports quoted fields) ---------- */
function parseCSV(text){
  // returns array of objects using first row as header
  const rows = [];
  let cur = '', row = [], inQuotes = false;
  const pushCell = () => { row.push(cur); cur = ''; };
  for(let i=0;i<text.length;i++){
    const ch = text[i];
    if(ch === '"' ){
      // if quote and next is quote, it's escaped quote
      if(inQuotes && text[i+1] === '"'){
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if(ch === ',' && !inQuotes){
      pushCell();
    } else if((ch === '\n' || ch === '\r') && !inQuotes){
      // handle CRLF and LF
      if(cur !== '' || row.length>0){
        pushCell();
        rows.push(row);
        row = [];
      }
      // skip possible \r\n by ignoring immediate extra newline
      if(ch === '\r' && text[i+1] === '\n') { /* skip, will be handled by next loop */ }
    } else {
      cur += ch;
    }
  }
  // final cell
  if(cur !== '' || row.length>0){
    pushCell();
    rows.push(row);
  }
  if(rows.length === 0) return [];
  const headers = rows[0].map(h => String(h||'').trim().toLowerCase());
  const out = [];
  for(let r=1;r<rows.length;r++){
    const obj = {};
    const rr = rows[r];
    for(let c=0;c<headers.length;c++){
      const key = headers[c] || `col${c}`;
      obj[key] = typeof rr[c] === 'undefined' ? '' : String(rr[c]).trim();
    }
    out.push(obj);
  }
  return out;
}

/* ---------- load users from LU_USERS (localStorage) AND users.csv ---------- */
async function loadAllUsersMerged(){
  const fromLocal = (function(){
    try{
      const raw = localStorage.getItem('LU_USERS');
      const arr = raw ? JSON.parse(raw) : [];
      if(!Array.isArray(arr)) return [];
      return arr.map(u => ({
        id: u.id || u.email || ('local-'+Math.random()),
        name: u.name || u.fullname || u.email || '',
        email: u.email || '',
        role: u.role || '',
        experience: (typeof u.experience === 'number') ? u.experience : (parseInt(u.experience,10) || 0),
        skills: Array.isArray(u.skills) ? u.skills : (typeof u.skills === 'string' ? u.skills.split(',').map(s=>s.trim()).filter(Boolean) : []),
        bio: u.bio || ''
      }));
    }catch(e){
      console.warn('LU_USERS parse failed', e);
      return [];
    }
  })();

  // attempt to fetch users.csv (best-effort). If fails, return local only.
  let fromCSV = [];
  try{
    const resp = await fetch('users.csv', { cache: 'no-store' });
    if(resp.ok){
      const txt = await resp.text();
      const parsed = parseCSV(txt); // array of row objects (keys lowercased)
      fromCSV = parsed.map((r,idx) => {
        // common headers: name, fullname, email, role, experience, skills, bio
        const name = r['name'] || r['fullname'] || r['full name'] || r['full_name'] || '';
        const email = r['email'] || '';
        const role = r['role'] || '';
        const experience = parseInt(r['experience']||r['exp']||'0',10) || 0;
        const skillsRaw = r['skills'] || r['skill'] || '';
        const skills = skillsRaw ? skillsRaw.split(',').map(s=>s.trim()).filter(Boolean) : [];
        const bio = r['bio'] || r['about'] || '';
        return {
          id: email || `csv-${idx}-${Date.now()}`,
          name,
          email,
          role,
          experience,
          skills,
          bio
        };
      });
    }
  }catch(e){
    // fetch failed (file missing or CORS). That's okay — we continue with local only.
    console.warn('users.csv not loaded:', e);
  }

  // merge: prefer LU_USERS entries when email matches; otherwise include both
  const mergedByEmail = {};
  fromCSV.forEach(u => {
    const k = (u.email||'').toLowerCase();
    if(k) mergedByEmail[k] = u;
  });
  fromLocal.forEach(u => {
    const k = (u.email||'').toLowerCase();
    if(k){
      // if exists from CSV, merge fields (local overrides)
      if(mergedByEmail[k]){
        mergedByEmail[k] = { ...mergedByEmail[k], ...u };
      } else {
        mergedByEmail[k] = u;
      }
    } else {
      // no email — create artificial id
      mergedByEmail[u.id || ('local-'+Math.random())] = u;
    }
  });

  // also include csv-only users with no email (rare)
  const result = Object.keys(mergedByEmail).map(k => mergedByEmail[k]);

  // ensure unique ids for array entries that had no email key
  return result;
}

/* ---------- event page builder (embedded script uses loadAllUsersMerged) ---------- */
function buildEventPage(h){
  const requiredSkills = suggestSkillsForProblem(h.problem, h.skills).map(s => escapeHtml(s));
  const skillsHtml = requiredSkills.map(s => `<span class="chip">${s}</span>`).join(' ');
  const embeddedScript = `
    (async function(){
      ${parseCSV.toString()}
      ${suggestSkillsForProblem.toString()}
      ${escapeHtml.toString()}
      // parseCSV, suggestSkillsForProblem available here
      // load LU_USERS from localStorage
      function loadLocalUsers(){
        try{ const raw = localStorage.getItem('LU_USERS'); return raw ? JSON.parse(raw) : []; }catch(e){ return []; }
      }
      async function loadCSV(){
        try{
          const resp = await fetch('users.csv', { cache:'no-store' });
          if(!resp.ok) return [];
          const txt = await resp.text();
          return parseCSV(txt);
        }catch(e){ return []; }
      }
      function normalizeRowToUser(r, idx){
        const name = r['name'] || r['fullname'] || r['full name'] || '';
        const email = r['email'] || '';
        const role = r['role'] || '';
        const exp = parseInt(r['experience']||r['exp']||'0',10) || 0;
        const skillsRaw = r['skills'] || r['skill'] || '';
        const skills = skillsRaw ? skillsRaw.split(',').map(s=>s.trim()).filter(Boolean) : [];
        const bio = r['bio'] || '';
        return { id: email || ('csv-'+idx+'-'+Date.now()), name, email, role, experience: exp, skills, bio };
      }
      function computeMatchPercent(userSkills, requiredSkills){
        if(!Array.isArray(requiredSkills) || requiredSkills.length===0) return 0;
        const us = (Array.isArray(userSkills)?userSkills:(userSkills?String(userSkills).split(','):[])).map(x=>String(x||'').toLowerCase().trim());
        if(!us.length) return 0;
        const req = requiredSkills.map(x=>String(x||'').toLowerCase().trim());
        const matched = req.filter(r => us.some(u => u === r || u.includes(r) || r.includes(u)));
        return (matched.length / req.length) * 100;
      }
      // Compose users from localStorage and CSV
      const local = loadLocalUsers().map((u,idx)=>({
        id: u.id || u.email || ('local-'+idx),
        name: u.name || u.fullname || u.email || '',
        email: u.email || '',
        role: u.role || '',
        experience: (typeof u.experience==='number'?u.experience:(parseInt(u.experience,10)||0)),
        skills: Array.isArray(u.skills)?u.skills:(typeof u.skills==='string'?u.skills.split(',').map(s=>s.trim()).filter(Boolean):[]),
        bio: u.bio || ''
      }));
      let csvUsers = [];
      try{
        const parsed = await loadCSV();
        csvUsers = parsed.map((r,i)=>normalizeRowToUser(r,i));
      }catch(e){ csvUsers = []; }
      // merge by email (local overrides csv)
      const byEmail = {};
      csvUsers.forEach(u => { if((u.email||'').trim()) byEmail[(u.email||'').toLowerCase()] = u; else byEmail[u.id] = u; });
      local.forEach(u => { const k = (u.email||'').toLowerCase(); if(k){ byEmail[k] = { ...byEmail[k], ...u }; } else { byEmail[u.id] = u; } });
      const users = Object.keys(byEmail).map(k => byEmail[k]);
      // initial ranking by match % using required skills
      const required = ${JSON.stringify(requiredSkills)};
      users.forEach(u => { u._matchPercent = computeMatchPercent(u.skills || [], required); });
      users.sort((a,b)=> (b._matchPercent||0) - (a._matchPercent||0));
      // render UI
      function escapeHtmlLocal(s){ return String(s||'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c])); }
      const results = document.getElementById('teammateResults');
      function renderList(list){
        if(!results) return;
        results.innerHTML = '';
        if(!list.length){ results.innerHTML = '<div style="color:#6b7280">No matching users found.</div>'; return; }
        list.forEach(u=>{
          const div = document.createElement('div');
          div.style.borderBottom = '1px solid #eef6ff';
          div.style.padding = '10px 0';

          /* clickable username anchor */
          const uid = encodeURIComponent(u.id || (u.email || u.name || '').replace(/\\s+/g, '-'));
          const nameLink = '<a class="profile-link" href="profile-visit.html?uid=' + uid + '" target="_blank" rel="noopener" style="font-weight:700;color:inherit;text-decoration:none">' + escapeHtmlLocal(u.name||u.email) + '</a>';

          div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><div>' +
                          '<div>' + nameLink + '</div>' +
                          '<div style="color:#6b7280;font-size:13px">' + escapeHtmlLocal(u.role||'') + ' • ' + escapeHtmlLocal(String(u.experience||'')) + ' yrs</div>' +
                          '</div><div style="text-align:right"><div style="font-size:13px;color:#0a66c2">Match: ' + (u._matchPercent?u._matchPercent.toFixed(0):0) + '%</div></div></div>' +
                          '<div style="margin-top:6px;color:#173043;font-size:13px">' + escapeHtmlLocal(u.bio||'') + '</div>' +
                          '<div style="margin-top:8px;color:#6b7280;font-size:13px">Skills: ' + escapeHtmlLocal((u.skills||[]).join(', ')) + '</div>';
          results.appendChild(div);
        });
      }
      // initial
      renderList(users.slice(0,200));
      // search wiring
      const searchInput = document.getElementById('skillSearch');
      const searchBtn = document.getElementById('skillSearchBtn');
      function doSearch(){
        const q = (searchInput.value||'').trim().toLowerCase();
        let filtered = users;
        if(q){
          filtered = users.filter(u=>{
            const us = (Array.isArray(u.skills)?u.skills:u.skills?String(u.skills).split(','):[]).map(x=>String(x||'').toLowerCase());
            return us.some(s => s.includes(q)) || (u.name||'').toLowerCase().includes(q) || (u.role||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q);
          });
        }
        filtered.forEach(u => { u._matchPercent = computeMatchPercent(u.skills || [], required); });
        filtered.sort((a,b)=> (b._matchPercent||0) - (a._matchPercent||0));
        renderList(filtered.slice(0,500));
      }
      if(searchBtn) searchBtn.addEventListener('click', doSearch);
      if(searchInput) searchInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); doSearch(); }});
    })();
  `;

  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"><title>${escapeHtml(h.name)}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <style>
      body{font-family:system-ui,Arial;margin:18px;color:#0b2540;background:#f7fbff}
      .card{background:#fff;padding:16px;border-radius:10px;border:1px solid #eef6ff;max-width:980px;margin:0 auto}
      .chip{display:inline-block;padding:6px 10px;border-radius:999px;background:#f3f4f6;margin-right:6px;margin-bottom:6px}
      .muted{color:#6b7280}
      #teammateResults{margin-top:12px}
      .searchRow{display:flex;gap:8px;align-items:center;margin-top:10px}
      input[type="search"]{flex:1;padding:10px;border-radius:8px;border:1px solid #e6eef8}
      button.primary{background:linear-gradient(90deg,#0A66C2,#2b9cff);color:#fff;padding:8px 12px;border-radius:8px;border:none;cursor:pointer}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${escapeHtml(h.name)}</h1>
      <div class="muted">${escapeHtml(h.date)} • ${escapeHtml(h.theme)} • ${escapeHtml(h.domain)}</div>
      <p style="margin-top:10px">${escapeHtml(h.problem)}</p>

      <h3 style="margin-top:12px">Required / Suggested skills</h3>
      <div id="requiredSkills" style="margin-top:8px">${skillsHtml}</div>

      <h3 style="margin-top:18px">Search teammates (from local saved users + users.csv)</h3>
      <div class="searchRow">
        <input id="skillSearch" type="search" placeholder="Type skill (e.g. React), name, email or role and press Enter" />
        <button id="skillSearchBtn" class="primary">Search</button>
      </div>
      <div id="teammateResults" style="margin-top:12px"></div>
    </div>

    <script>${embeddedScript}</script>
  </body>
  </html>`;
}

/* ---------- init & generate ---------- */
function regenLocal(n = 100){
  HACKS = [];
  const count = Number.isFinite(n) ? n : 100;
  for(let i=1;i<=count;i++) HACKS.push(makeHackathon(i));
  FILTERED = HACKS.slice();
  currentPage = 1;
  renderGrid(FILTERED);
  try{ localStorage.setItem('LU_LOCAL_HACKS', JSON.stringify(HACKS)); }catch(e){}
}
window.regen = regenLocal;
window.openEvent = (id)=>{ const hack = HACKS.find(h=>String(h.id)===String(id)); if(!hack){ alert('Event not found'); return;} const html = buildEventPage(hack); const w = window.open('','_blank'); w.document.open(); w.document.write(html); w.document.close(); };

/* ---------- DOM ready ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  // try load cached local hacks
  let loaded = false;
  try{
    const raw = localStorage.getItem('LU_LOCAL_HACKS');
    if(raw){
      const arr = JSON.parse(raw);
      if(Array.isArray(arr) && arr.length){
        HACKS = arr;
        FILTERED = HACKS.slice();
        loaded = true;
      }
    }
  }catch(e){ /* ignore */ }

  if(!loaded) regenLocal(100); // generate 100 like original

  // wire search input
  const globalSearch = document.getElementById('globalSearch');
  if(globalSearch) globalSearch.addEventListener('input', filterGrid);

  // wire regen button if present
  const regenBtn = document.getElementById('regenBtn');
  if(regenBtn) regenBtn.addEventListener('click', ()=> { if(confirm('Regenerate 100 sample hackathons? This will overwrite LU_LOCAL_HACKS.')) { regenLocal(100); alert('Regenerated 100 hackathons'); } });

  // populate category filter if present
  const categoryFilter = document.getElementById('categoryFilter');
  if(categoryFilter){
    const cats = Array.from(new Set((HACKS||[]).map(h=>h.theme))).filter(Boolean);
    categoryFilter.innerHTML = '<option value="">All categories</option>' + cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    categoryFilter.addEventListener('change', function(){
      const v = categoryFilter.value;
      if(!v){ FILTERED = HACKS.slice(); renderGrid(FILTERED); return; }
      FILTERED = HACKS.filter(h => String(h.theme) === String(v));
      currentPage = 1; renderGrid(FILTERED);
    });
  }

  // populate skill cloud (quick filters)
  const skillCloud = document.getElementById('skillCloud');
  if(skillCloud){
    const pool = new Set();
    (HACKS||[]).forEach(h => (h.skills||[]).forEach(s => pool.add(s)));
    skillCloud.innerHTML = Array.from(pool).map(s => `<span class="chip" data-skill="${escapeHtml(s)}">${escapeHtml(s)}</span>`).join(' ');
    // click to filter by skill
    skillCloud.querySelectorAll && skillCloud.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', ()=>{
      const sk = ch.dataset.skill;
      FILTERED = HACKS.filter(h => (h.skills||[]).map(x=>String(x||'').toLowerCase()).includes(String(sk||'').toLowerCase()));
      currentPage = 1; renderGrid(FILTERED);
    }));
  }

  // update user count (if element exists) using LU_USERS + users.csv
  (async function updateUserCount(){
    try{
      const users = await loadAllUsersMerged();
      const el = document.getElementById('userCount');
      if(el) el.textContent = String(users.length || 0);
    }catch(e){}
  })();

  renderGrid(FILTERED);
});

// --- CLICK-DELEGATE: open profile page when username / row clicked ---
document.addEventListener('click', function (e) {
  // if clicked an actual anchor -> let it work normally
  if (e.target.tagName === 'A') return;

  // 1) if click landed on element with .profile-link inside -> open its href
  const linkEl = e.target.closest && e.target.closest('.profile-link');
  if (linkEl && linkEl.getAttribute) {
    const href = linkEl.getAttribute('href');
    if (href) {
      window.open(href, '_blank', 'noopener');
      e.preventDefault();
      return;
    }
  }

  // 2) fallback: find closest node with data-uid attribute and open profile-visit.html
  const row = e.target.closest && e.target.closest('[data-uid]');
  if (!row) return;
  const uid = row.getAttribute('data-uid') || row.dataset && row.dataset.uid;
  if (!uid) return;
  // open profile visit page (use the file you created)
  const url = 'profile-visit.html?uid=' + encodeURIComponent(uid);
  window.open(url, '_blank', 'noopener');
});
