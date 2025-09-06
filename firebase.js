// hackathons.js (module)
import { getAllHackathons, addHackathon, setHackathonWithId, deleteHackathonById, getAllUsers } from "./firebase.js";

/* ---------- config & helpers ---------- */
const PAGE_SIZE = 10;
let currentPage = 1;
let HACKS = [];
let FILTERED = [];

window.USER_POOL_GLOBAL = null;
window.LOGGED_IN_USER = null;

function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function shuffleArray(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a; }
function escapeHtml(s){ return String(s||'').replace(/[&<>\"']/g,tag=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'})[tag]); }

/* Small static pools used for generation (kept short for clarity) */
const SKILL_POOL = ['JavaScript','Python','React','Node.js','SQL','AWS','Docker'];
const THEMES = ['Health','Education','Fintech','Sustainability'];
const VERBS = ['Optimize','Detect','Predict','Automate'];
const DOMAINS = ['user retention','fraud','energy usage','crop yield'];

/* ---------- simple generator for local hackathons ---------- */
function generateProblemStatement(theme,domain){
  const templates = [
    `In the ${theme} space, build a solution to ${domain} with limited compute.`,
    `Create an end-to-end ${theme} prototype to ${domain}.`
  ];
  return templates[Math.floor(Math.random()*templates.length)];
}
function makeHackathon(i){
  const theme = THEMES[i % THEMES.length] || 'General';
  const verb = VERBS[i % VERBS.length] || 'Build';
  const domain = DOMAINS[i % DOMAINS.length] || 'problem';
  const name = `${theme} Challenge #${i} — ${verb} ${domain}`;
  const date = new Date(Date.now() + (i*24*60*60*1000)).toISOString().slice(0,10);
  const problem = generateProblemStatement(theme, domain);
  const skills = shuffleArray([...SKILL_POOL]).slice(0,3);
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
    const displayedId = escapeHtml(String(h.id));
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px">
        <div style="flex:1">
          <h3>${escapeHtml(h.name)}</h3>
          <div class="meta">${escapeHtml(h.date)} • ${escapeHtml(h.theme)}</div>
          <p class="problem">${escapeHtml(h.problem)}</p>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <div class="card-footer">
            <button class="btn" data-id="${displayedId}" onclick="openEvent('${displayedId}')">Open</button>
            <button class="btn" style="background:#f3f4f6;color:#0b2540" data-id="${displayedId}" onclick="deleteHackathon('${displayedId}')">Delete</button>
          </div>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  renderPagination(total, Math.max(1, totalPages), currentPage);
}
function renderPagination(total, totalPages, activePage){
  const pager = document.getElementById('pagination'); if(!pager) return;
  pager.innerHTML = '';
  if(total <= PAGE_SIZE) return;
  const prev = document.createElement('button'); prev.className='page-btn'; prev.textContent='Prev';
  prev.onclick = ()=>goToPage(activePage-1); prev.disabled = activePage===1; pager.appendChild(prev);
  for(let p=1;p<=totalPages;p++){
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
  FILTERED = HACKS.filter(h => (`${h.name} ${h.theme} ${h.domain} ${h.problem}`).toLowerCase().includes(q));
  currentPage=1; renderGrid(FILTERED);
}
function resetFilter(){ const el = document.getElementById('globalSearch'); if(el) el.value=''; filterGrid(); }

/* ---------- Firestore integration (uses firebase.js helpers) ---------- */
async function fetchHackathonsFromFirebase(){
  try{
    const docs = await getAllHackathons(5000);
    if(!Array.isArray(docs)) return [];
    HACKS = docs.map((d,idx) => ({
      id: d.id || `f${idx+1}`,
      name: d.name || `Hackathon ${idx+1}`,
      date: d.date || (d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toISOString().slice(0,10) : String(d.createdAt).slice(0,10)) : ''),
      problem: d.problem || '',
      skills: Array.isArray(d.skills) ? d.skills : [],
      theme: d.theme || '',
      domain: d.domain || '',
      createdAt: d.createdAt || new Date().toISOString()
    }));
    FILTERED = HACKS.slice();
    currentPage = 1;
    renderGrid(FILTERED);
    console.log('Fetched', HACKS.length, 'hackathons from Firestore.');
    return HACKS;
  }catch(err){
    console.error('Error fetching hackathons from Firebase:', err);
    return [];
  }
}

/* ---------- Users: fetch from firebase (if available) ---------- */
async function fetchUsersFromFirebase(limit = 1000){
  try{
    const users = await getAllUsers(limit);
    return Array.isArray(users) ? users : [];
  }catch(err){
    console.warn('getAllUsers() failed:', err);
    return [];
  }
}

/* ---------- Excel/CSV import for USERS (SheetJS) ---------- */
/**
 * parseFileToObjects(file)
 * Accepts File object (xlsx/csv) and returns Promise -> array of row objects
 */
async function parseFileToObjects(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * mapRowToUser(row, idx)
 * Expected Excel column names (case-insensitive): id, name, email, role, skills
 * Skills can be comma-separated.
 */
function mapRowToUser(row, idx){
  const norm = {};
  Object.keys(row).forEach(k => norm[k.trim().toLowerCase()] = row[k]);

  const id = norm['id'] || norm['userid'] || `u-local-${Date.now()}-${idx}`;
  const name = norm['name'] || norm['fullname'] || `User ${idx+1}`;
  const email = norm['email'] || '';
  const role = norm['role'] || 'Member';
  const skillsRaw = norm['skills'] || '';
  const skills = (typeof skillsRaw === 'string' ? skillsRaw.split(',') : Array.isArray(skillsRaw) ? skillsRaw : [])
                  .map(s => String(s).trim()).filter(Boolean);

  return { id, name, email, role, skills };
}

/**
 * importUsersFromFile(file, { append=true })
 * Parses file, maps rows to users, sets window.USER_POOL_GLOBAL and localStorage
 */
async function importUsersFromFile(file, { append = true } = {}){
  const statusEl = document.getElementById('importStatus');
  if(statusEl) statusEl.textContent = 'Parsing...';
  let rows;
  try {
    rows = await parseFileToObjects(file);
  } catch(err){
    console.error('Parse error', err);
    if(statusEl) statusEl.textContent = 'Parse error';
    alert('Failed to parse file: ' + (err && err.message ? err.message : err));
    return [];
  }

  if(!rows || rows.length === 0){
    if(statusEl) statusEl.textContent = 'No rows';
    alert('No rows found in sheet.');
    return [];
  }

  // map to users
  const users = rows.map((r, i) => mapRowToUser(r, i));

  // merge with existing (append) or replace
  let existing = [];
  try { existing = JSON.parse(localStorage.getItem('LU_USER_POOL_GLOBAL') || '[]'); } catch(e){ existing = []; }
  const merged = append ? existing.concat(users) : users;

  // dedupe by id (keep last)
  const byId = {};
  for(const u of merged) byId[u.id] = u;
  const final = Object.values(byId);

  // store
  window.USER_POOL_GLOBAL = final;
  window.LOGGED_IN_USER = final[0] || null;
  try{
    localStorage.setItem('LU_USER_POOL_GLOBAL', JSON.stringify(final));
    localStorage.setItem('LU_LOGGED_IN_USER', JSON.stringify(window.LOGGED_IN_USER));
  }catch(e){ console.warn('localStorage write failed', e); }

  if(statusEl) statusEl.textContent = `Imported ${final.length} users`;
  updateLoginUI();
  alert('Users imported: ' + final.length);
  return final;
}

/* wire toolbar buttons if present */
function wireUserImportToolbar() {
  const fileEl = document.getElementById('importFile');
  const appendBtn = document.getElementById('importAppendBtn');
  const replaceBtn = document.getElementById('importReplaceBtn');
  const statusEl = document.getElementById('importStatus');
  if(!fileEl || (!appendBtn && !replaceBtn)) return;

  appendBtn.onclick = async () => {
    const f = fileEl.files[0];
    if(!f){ alert('Select a file first'); return; }
    if(statusEl) statusEl.textContent = 'Importing...';
    await importUsersFromFile(f, { append: true });
    if(statusEl) statusEl.textContent = 'Import complete (append)';
  };

  replaceBtn.onclick = async () => {
    const f = fileEl.files[0];
    if(!f){ alert('Select a file first'); return; }
    if(!confirm('Replace current users with sheet data?')) return;
    if(statusEl) statusEl.textContent = 'Replacing...';
    await importUsersFromFile(f, { append: false });
    if(statusEl) statusEl.textContent = 'Replace complete';
  };
}

/* ---------- login handling (wired to Login button) ---------- */
async function handleLogin(){
  // first try localStorage (imported users)
  try{
    const poolRaw = localStorage.getItem('LU_USER_POOL_GLOBAL');
    if(poolRaw){
      window.USER_POOL_GLOBAL = JSON.parse(poolRaw);
      window.LOGGED_IN_USER = JSON.parse(localStorage.getItem('LU_LOGGED_IN_USER')) || window.USER_POOL_GLOBAL[0] || null;
      updateLoginUI();
      alert('Users loaded from localStorage: ' + (window.USER_POOL_GLOBAL?window.USER_POOL_GLOBAL.length:0));
      return;
    }
  }catch(e){ /* ignore */ }

  // else try Firebase (if available)
  const users = await fetchUsersFromFirebase(1000);
  if(Array.isArray(users) && users.length){
    // normalize and store in window + localStorage
    window.USER_POOL_GLOBAL = users.map((u,idx)=>({
      id: u.id || ('u'+(idx+1)),
      name: u.name || u.displayName || ('User_'+(idx+1)),
      role: u.role || 'Member',
      experience: typeof u.experience === 'number' ? u.experience : (parseInt(u.experience,10)||0),
      skills: Array.isArray(u.skills) ? u.skills : (typeof u.skills === 'string' ? u.skills.split(',').map(s=>s.trim()).filter(Boolean) : [])
    }));
    window.LOGGED_IN_USER = window.USER_POOL_GLOBAL[0] || null;
    try{
      localStorage.setItem('LU_USER_POOL_GLOBAL', JSON.stringify(window.USER_POOL_GLOBAL));
      localStorage.setItem('LU_LOGGED_IN_USER', JSON.stringify(window.LOGGED_IN_USER));
    }catch(e){ console.warn('localStorage write failed', e); }
    updateLoginUI();
    alert('Login simulated — users loaded: ' + (window.USER_POOL_GLOBAL ? window.USER_POOL_GLOBAL.length : 0));
    return;
  }

  // else fallback: offer to create small local pool
  if(!confirm('No users in local storage or Firebase. Create a small local dummy user pool?')) {
    return;
  }
  const pool = [];
  for(let i=1;i<=50;i++){
    pool.push({ id:`local-u-${i}`, name:`User_${i}`, role:'Member', experience: Math.floor(Math.random()*6), skills: ['JavaScript','React'] });
  }
  window.USER_POOL_GLOBAL = pool;
  window.LOGGED_IN_USER = pool[0] || null;
  try{
    localStorage.setItem('LU_USER_POOL_GLOBAL', JSON.stringify(window.USER_POOL_GLOBAL));
    localStorage.setItem('LU_LOGGED_IN_USER', JSON.stringify(window.LOGGED_IN_USER));
  }catch(e){}
  updateLoginUI();
  alert('Local dummy users created: ' + window.USER_POOL_GLOBAL.length);
}

/* ---------- update profile/login UI ---------- */
function updateLoginUI(){
  try{
    const poolRaw = localStorage.getItem('LU_USER_POOL_GLOBAL');
    const userRaw = localStorage.getItem('LU_LOGGED_IN_USER');
    if(poolRaw && (!window.USER_POOL_GLOBAL || window.USER_POOL_GLOBAL.length===0)) window.USER_POOL_GLOBAL = JSON.parse(poolRaw);
    if(userRaw && !window.LOGGED_IN_USER) window.LOGGED_IN_USER = JSON.parse(userRaw);
  }catch(e){ /* ignore */ }

  const userCount = document.getElementById('userCount');
  const profileAvatar = document.getElementById('profileAvatar');
  const profileName = document.getElementById('profileName');
  const profileRole = document.getElementById('profileRole');
  const loginBtn = document.getElementById('loginBtn');

  if(window.USER_POOL_GLOBAL && window.USER_POOL_GLOBAL.length){
    if(userCount) userCount.textContent = `${window.USER_POOL_GLOBAL.length} users`;
    if(loginBtn){ loginBtn.textContent = 'Logged in'; loginBtn.disabled = true; }
    if(profileAvatar) profileAvatar.textContent = (window.LOGGED_IN_USER && window.LOGGED_IN_USER.name) ? (''+window.LOGGED_IN_USER.name).charAt(0).toUpperCase() : 'U';
    if(profileName) profileName.textContent = (window.LOGGED_IN_USER && window.LOGGED_IN_USER.name) ? window.LOGGED_IN_USER.name : 'User';
    if(profileRole) profileRole.textContent = (window.LOGGED_IN_USER && window.LOGGED_IN_USER.role) ? window.LOGGED_IN_USER.role : 'Member';
  } else {
    if(userCount) userCount.textContent = 'Not logged in';
    if(loginBtn){ loginBtn.textContent = 'Login (fetch users)'; loginBtn.disabled = false; }
    if(profileAvatar) profileAvatar.textContent = '--';
    if(profileName) profileName.textContent = 'Guest';
    if(profileRole) profileRole.textContent = 'Not logged';
  }
}

/* ---------- open profile (simple) ---------- */
function openProfile(){
  if(window.LOGGED_IN_USER){
    // optionally navigate to profile page if exists
    alert('Logged in as: ' + (window.LOGGED_IN_USER.name || window.LOGGED_IN_USER.id));
  } else {
    if(confirm('Not logged in. Import users now?')) {
      const f = document.getElementById('importFile');
      if(f) f.click();
    }
  }
}

/* ---------- event page builder ---------- */
function buildEventPage(h){
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(h.name)}</title>
  <style>body{font-family:system-ui;padding:20px;color:#111}.meta{color:#6b7280}</style></head><body>
  <h1>${escapeHtml(h.name)}</h1><div class="meta">${escapeHtml(h.date)} • ${escapeHtml(h.theme)}</div>
  <p>${escapeHtml(h.problem)}</p>
  <h3>Skills</h3><div>${(h.skills||[]).map(s=>`<span style="display:inline-block;margin:4px;padding:6px 8px;background:#f3f4f6;border-radius:6px">${escapeHtml(s)}</span>`).join('')}</div>
  </body></html>`;
}
function openEvent(id){
  const h = HACKS.find(x=>String(x.id)===String(id));
  if(!h) return alert('Event not found');
  const w = window.open('', '_blank');
  w.document.open();
  w.document.write(buildEventPage(h));
  w.document.close();
}

/* ---------- delete helper (local only if not in firestore) ---------- */
async function deleteHackathon(id){
  if(!confirm('Delete this hackathon?')) return;
  if(typeof deleteHackathonById === 'function' && !String(id).startsWith('local-')){
    try{
      await deleteHackathonById(id);
      await fetchHackathonsFromFirebase();
      alert('Deleted.');
      return;
    }catch(err){
      console.warn('firebase delete failed', err);
    }
  }
  HACKS = HACKS.filter(h => String(h.id) !== String(id));
  FILTERED = HACKS.slice();
  renderGrid(FILTERED);
  try{ localStorage.setItem('LU_LOCAL_HACKS', JSON.stringify(HACKS)); }catch(e){}
}

/* ---------- local generation / init ---------- */
function regenLocal(n = null){
  const req = typeof n === 'number' ? n : parseInt(document.getElementById('count')?.value || '1000',10);
  const num = Number.isFinite(req) && req>0 ? req : 100;
  HACKS = [];
  for(let i=1;i<=num;i++) HACKS.push(makeHackathon(i));
  FILTERED = HACKS.slice();
  currentPage = 1;
  renderGrid(FILTERED);
  try{ localStorage.setItem('LU_LOCAL_HACKS', JSON.stringify(HACKS)); }catch(e){}
}

/* ---------- expose to window ---------- */
window.openEvent = openEvent;
window.regen = () => regenLocal();
window.filterGrid = filterGrid;
window.resetFilter = resetFilter;
window.handleLogin = handleLogin;
window.deleteHackathon = deleteHackathon;
window.openProfile = openProfile;

/* ---------- init ---------- */
async function init(){
  // wire import toolbar (SheetJS)
  try { wireUserImportToolbar(); } catch(e){ console.warn('wire import toolbar failed', e); }

  // try firebase first (if configured)
  let loaded = false;
  try{
    const docs = await fetchHackathonsFromFirebase();
    loaded = Array.isArray(docs) && docs.length > 0;
  }catch(e){ console.warn('fetchHackathonsFromFirebase failed', e); }

  if(!loaded){
    // try local cache
    try{
      const cached = localStorage.getItem('LU_LOCAL_HACKS');
      if(cached){
        HACKS = JSON.parse(cached);
        FILTERED = HACKS.slice();
        renderGrid(FILTERED);
        loaded = true;
      }
    }catch(e){}
  }

  if(!loaded){
    // generate a small default set (200 might be heavy)
    regenLocal(200);
  }

  updateCols?.();
  updateLoginUI();
}

document.addEventListener('DOMContentLoaded', init);
