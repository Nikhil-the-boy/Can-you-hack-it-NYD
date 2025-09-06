/* home-logged.js
   Behaviour for the logged-in homepage (home-logged.html)
   Works with localStorage keys: LU_CURRENT_USER, LU_USERS, LU_LOCAL_HACKS, MY_GROUPS_<eventId>, MY_EVENTS, CONNECTIONS
*/

(function(){
  'use strict';

  function escapeHtml(s){ return String(s||'').replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // load basic app data
  async function loadUsers(){
    try{
      const raw = localStorage.getItem('LU_USERS');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function loadEvents(){
    try{
      const raw = localStorage.getItem('LU_LOCAL_HACKS');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function loadMyEvents(){
    try{ const r = localStorage.getItem('MY_EVENTS'); return r?JSON.parse(r):[]; }catch(e){ return []; }
  }
  function loadGroupsForAllEvents(){
    const out = {}; Object.keys(localStorage).forEach(k=>{
      if(k.startsWith('MY_GROUPS_')) {
        const eid = k.replace('MY_GROUPS_','');
        try{ out[eid] = JSON.parse(localStorage.getItem(k)) || []; }catch(e){ out[eid] = []; }
      }
    });
    return out;
  }
  function loadConnections(){
    try{ const r = localStorage.getItem('CONNECTIONS'); return r?JSON.parse(r):{} }catch(e){ return {}; }
  }

  async function computeRecommendedEvents(user, events){
    if(!user) return [];
    const uSkills = (Array.isArray(user.skills) ? user.skills : (user.skills?String(user.skills).split(','):[])).map(s=>String(s||'').toLowerCase());
    const scored = events.map(ev=>{
      const es = (ev.skills||[]).map(s=>String(s||'').toLowerCase());
      const matches = es.filter(x=> uSkills.includes(x) || uSkills.some(us=> x.includes(us) || us.includes(x) ) );
      return { ev, score: matches.length };
    }).sort((a,b)=> b.score - a.score);
    return scored.filter(s=>s.score>0).map(s=>s.ev).slice(0,6);
  }

  // render functions
  async function renderHeaderAndProfile(users, me) {
    document.getElementById('navName').textContent = me ? (me.name || me.email) : 'You';
    document.getElementById('navRole').textContent = me ? (me.role || '') : '';
    const navA = document.getElementById('navAvatar');
    if(me && me.avatarUrl) navA.src = me.avatarUrl; else navA.src = 'image.png';
    document.getElementById('profileBadge').onclick = ()=> { window.location.href = 'profile.html'; };
    document.getElementById('heroGreeting').textContent = me ? `Welcome back, ${me.name || me.email}` : 'Welcome back!';
    document.getElementById('heroSub').textContent = 'Find teammates, create groups and join events tailored to you.';
  }

  function renderStats(blocks) {
    document.getElementById('hpEvents').textContent = String(blocks.events || 0);
    document.getElementById('hpSaved').textContent = String(blocks.saved || 0);
    document.getElementById('hpGroups').textContent = String(blocks.groups || 0);
    document.getElementById('hpConnections').textContent = String(blocks.connections || 0);
    document.getElementById('statEvents')?.textContent && (document.getElementById('statEvents').textContent = String(blocks.events || 0));
  }

  function renderRecommendedList(rec, fallbackEvents) {
    const recList = document.getElementById('hpRecList');
    if(!recList) return;
    const list = rec && rec.length ? rec : (fallbackEvents || []).slice(0,4);
    if(!list.length) { recList.innerHTML = '<div class="muted small">No recommendations yet.</div>'; return; }
    recList.innerHTML = list.map(ev=>`<div><a href="#" class="text-sm text-[#0A66C2] rec-event" data-eid="${escapeHtml(ev.id)}">${escapeHtml(ev.name)}</a><div class="muted small">${escapeHtml(ev.date)} • ${escapeHtml(ev.theme)}</div></div>`).join('');
    // wire rec-event links
    recList.querySelectorAll('.rec-event').forEach(a => a.addEventListener('click', (ev)=>{
      ev.preventDefault(); const eid = a.dataset.eid; localStorage.setItem('lastOpenEvent', eid); window.location.href = 'hackathons.html';
    }));
  }

  function renderRecEventsGrid(list) {
    const recEventsNode = document.getElementById('recEvents');
    if(!recEventsNode) return;
    recEventsNode.innerHTML = '';
    if(!list.length) { recEventsNode.innerHTML = '<div class="muted">No events to show</div>'; return; }
    list.slice(0,6).forEach(ev=>{
      const div = document.createElement('div');
      div.className = 'rec-ev-card';
      div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1">
          <div class="font-semibold text-sm">${escapeHtml(ev.name)}</div>
          <div class="small muted">${escapeHtml(ev.date)} • ${escapeHtml(ev.theme)}</div>
          <div class="mt-2 small">${escapeHtml(ev.problem || '—')}</div>
        </div>
        <div style="text-align:right">
          <button class="btn-ghost open-ev" data-eid="${escapeHtml(ev.id)}">Open</button>
        </div>
      </div>`;
      recEventsNode.appendChild(div);
    });
    recEventsNode.querySelectorAll('.open-ev').forEach(b=> b.addEventListener('click', (ev)=>{
      const eid = b.dataset.eid; localStorage.setItem('lastOpenEvent', eid); window.location.href = 'hackathons.html';
    }));
  }

  function renderGroupsList(userGroups) {
    const groupsNode = document.getElementById('hpGroupsList');
    if(!groupsNode) return;
    if(!userGroups.length) { groupsNode.innerHTML = '<div class="muted small">You are not in any groups yet.</div>'; return; }
    groupsNode.innerHTML = userGroups.map(g=>`<div class="group-item"><div><div class="font-semibold">${escapeHtml(g.group.name)}</div><div class="muted small">${escapeHtml(g.eid)}</div></div><div><button class="btn-ghost open-g" data-eid="${escapeHtml(g.eid)}" data-gid="${escapeHtml(g.group.id)}">Open</button></div></div>`).join('');
    groupsNode.querySelectorAll('.open-g').forEach(b=> b.addEventListener('click', ()=> { localStorage.setItem('lastOpenEvent', b.dataset.eid); window.location.href='hackathons.html'; }));
  }

  function renderProfileSidebar(me) {
    if(!me) return;
    const hpName = document.getElementById('hpName'); const hpRole = document.getElementById('hpRole'); const hpBio = document.getElementById('hpBio'); const hpAvatar = document.getElementById('hpAvatar');
    if(hpName) hpName.textContent = me.name || me.email; if(hpRole) hpRole.textContent = me.role || ''; if(hpBio) hpBio.textContent = me.bio || '—';
    if(hpAvatar) hpAvatar.src = me.avatarUrl || 'image.png';
    document.getElementById('hpEditProfile')?.addEventListener('click', ()=> window.location.href = 'profile.html');
    document.getElementById('hpViewProfile')?.addEventListener('click', ()=> window.location.href = 'profile.html');
  }

  function renderCategorySummary(events) {
    const categoryNode = document.getElementById('hpCategorySummary'); if(!categoryNode) return;
    const themeCounts = {};
    events.forEach(ev => { themeCounts[ev.theme] = (themeCounts[ev.theme]||0) + 1; });
    if(!Object.keys(themeCounts).length) { categoryNode.innerHTML = '<div class="muted small">No categorized data</div>'; return; }
    categoryNode.innerHTML = Object.keys(themeCounts).map(t=> `<div>${escapeHtml(t)} <span class="muted">(${themeCounts[t]})</span></div>`).join('');
  }

  /* ---------- bootstrap render ---------- */
  document.addEventListener('DOMContentLoaded', async ()=>{
    const current = localStorage.getItem('LU_CURRENT_USER');
    if(!current){ window.location.href = 'index.html'; return; }

    const users = await loadUsers();
    const me = users.find(u => String(u.id) === String(current) || String(u.email) === String(current));
    const events = loadEvents();
    const myEvents = loadMyEvents();
    const groupsMap = loadGroupsForAllEvents();
    const connections = loadConnections();

    // compute statistics
    const groupsForUser = [];
    Object.keys(groupsMap).forEach(eid => {
      (groupsMap[eid] || []).forEach(g => {
        if(Array.isArray(g.members) && g.members.includes(current)) groupsForUser.push({ eid, group: g });
      });
    });

    // connections: count distinct uids connected anywhere
    const connectedUids = new Set();
    Object.keys(connections).forEach(uid => {
      const byEv = connections[uid] || {};
      Object.keys(byEv).forEach(eid => connectedUids.add(uid));
    });

    // render header/profile
    renderHeaderAndProfile(users, me);

    // stats
    renderStats({ events: events.length || 0, saved: myEvents.length || 0, groups: groupsForUser.length || 0, connections: connectedUids.size || 0 });

    // recommended
    const rec = await computeRecommendedEvents(me, events);
    renderRecommendedList(rec, events);
    renderRecEventsGrid(rec.length ? rec : events);

    // groups & sidebar & categories
    renderGroupsList(groupsForUser);
    renderProfileSidebar(me);
    renderCategorySummary(events);

    // wire quick buttons
    document.getElementById('ctaBrowse')?.addEventListener('click', ()=> window.location.href = 'hackathons.html');
    document.getElementById('ctaCreate')?.addEventListener('click', ()=>{
      const arr = loadEvents();
      const id = 'ev-' + (arr.length + 1) + '-' + Date.now();
      arr.push({ id, name: 'New Event', date: new Date().toISOString().slice(0,10), theme:'Hackathon', domain:'custom', problem:'Ad-hoc event', skills:['JavaScript'] });
      localStorage.setItem('LU_LOCAL_HACKS', JSON.stringify(arr));
      location.reload();
    });

    document.getElementById('manageGroups')?.addEventListener('click', ()=> window.location.href = 'hackathons.html');
    document.getElementById('refreshRec')?.addEventListener('click', async ()=> {
      const rec2 = await computeRecommendedEvents(me, events);
      alert('Refreshed recommendations: ' + (rec2.length || 0));
    });

    // footer year
    try{ document.getElementById('year').textContent = new Date().getFullYear(); }catch(e){}
  });

})();
