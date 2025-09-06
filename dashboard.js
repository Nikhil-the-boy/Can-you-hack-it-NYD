// dashboard.js — minimal dashboard logic (reads LU_CURRENT_USER, LU_USERS, LU_LOCAL_HACKS, MY_GROUPS_*)

function escapeHtml(s){ return String(s||'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function loadAllUsersMerged(){
  try{
    const raw = localStorage.getItem('LU_USERS');
    const arr = raw ? JSON.parse(raw) : [];
    if(!Array.isArray(arr)) return [];
    return arr.map((u,idx)=>({
      id: u.id || u.email || `local-${Date.now()}-${idx}`,
      name: u.name || u.fullname || u.email || '',
      email: u.email || '',
      role: u.role || '',
      experience: (typeof u.experience === 'number') ? u.experience : (parseInt(u.experience,10)||0),
      skills: Array.isArray(u.skills) ? u.skills : (typeof u.skills==='string'?u.skills.split(',').map(s=>s.trim()).filter(Boolean):[]),
      bio: u.bio || ''
    }));
  }catch(e){ return []; }
}

function loadEvents(){
  try{ const raw = localStorage.getItem('LU_LOCAL_HACKS'); const arr = raw?JSON.parse(raw):[]; return Array.isArray(arr)?arr:[]; }catch(e){ return []; }
}

function loadMyEvents(){ try{ const r = localStorage.getItem('MY_EVENTS'); return r?JSON.parse(r):[] }catch(e){ return []; } }

function loadGroupsForAllEvents(){
  const out = {}; Object.keys(localStorage).forEach(k => { if(k.startsWith('MY_GROUPS_')){ const eid = k.replace('MY_GROUPS_',''); try{ out[eid] = JSON.parse(localStorage.getItem(k)) || []; }catch(e){ out[eid] = []; } } }); return out;
}

async function renderDashboard(){
  const currentUserId = localStorage.getItem('LU_CURRENT_USER');
  if(!currentUserId){ window.location.href = 'index.html'; return; }

  const users = await loadAllUsersMerged();
  const current = users.find(u => String(u.id) === String(currentUserId));
  const events = loadEvents();
  const myEvents = loadMyEvents();
  const groupsMap = loadGroupsForAllEvents();

  document.getElementById('dashName').textContent = current ? (current.name || current.email) : 'Guest';
  document.getElementById('dashEmail').textContent = current ? current.email : '';
  document.getElementById('dashRole').textContent = current ? (current.role || 'Member') : 'Member';
  document.getElementById('dashBio').textContent = current ? (current.bio || '—') : 'No bio yet';
  document.getElementById('welcomeName').textContent = current ? (`Hi, ${current.name || current.email}`) : 'Welcome';

  const avatar = document.getElementById('dashAvatar');
  if(current && current.avatarUrl) avatar.src = current.avatarUrl;
  else {
    const initials = current && current.name ? current.name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase() : '';
    if(initials){
      try{
        const c = document.createElement('canvas'); c.width=120; c.height=120; const ctx=c.getContext('2d');
        ctx.fillStyle='#e6f4ff'; ctx.fillRect(0,0,c.width,c.height);
        ctx.fillStyle='#0A66C2'; ctx.font='60px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(initials, c.width/2, c.height/2);
        avatar.src = c.toDataURL();
      }catch(e){ avatar.src='image.png'; }
    } else avatar.src='image.png';
  }

  document.getElementById('statEvents').textContent = String(events.length || 0);
  document.getElementById('statSaved').textContent = String(myEvents.length || 0);

  let userGroupsList = [];
  Object.keys(groupsMap).forEach(eid => {
    const groups = groupsMap[eid] || [];
    groups.forEach(g => {
      if(Array.isArray(g.members) && String(g.members).includes(String(currentUserId))) userGroupsList.push({ eventId: eid, group: g });
      // Note: above line uses includes; better logic is find, but keep simple
      if(Array.isArray(g.members) && g.members.includes(currentUserId)) userGroupsList.push({ eventId: eid, group: g });
    });
  });
  // remove duplicates
  userGroupsList = userGroupsList.filter((v,i,a)=> a.findIndex(x=>x.group.id===v.group.id)===i);
  document.getElementById('statGroups').textContent = String(userGroupsList.length || 0);

  const themeCounts = {};
  events.forEach(ev => { themeCounts[ev.theme] = (themeCounts[ev.theme] || 0) + 1; });
  const categoryStatsNode = document.getElementById('categoryStats');
  categoryStatsNode.innerHTML = Object.keys(themeCounts).length ? Object.keys(themeCounts).map(t=>{
    const pct = Math.round((themeCounts[t] / events.length) * 100);
    return `<div class="p-3 border rounded-lg">
      <div class="text-sm muted">${escapeHtml(t)}</div>
      <div class="text-xl font-bold text-[#0A66C2]">${themeCounts[t]} <span class="text-sm muted">(${pct}%)</span></div>
    </div>`;
  }).join('') : '<div class="muted">No events found.</div>';

  const userGroupsNode = document.getElementById('userGroups');
  if(!userGroupsList.length){ userGroupsNode.innerHTML = '<div class="muted">You have not joined/created any groups yet.</div>'; }
  else {
    userGroupsNode.innerHTML = userGroupsList.map(entry=>{
      const g = entry.group;
      const ev = events.find(x=>x.id === entry.eventId) || { name: entry.eventId };
      return `<div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700">${escapeHtml(g.name)}</div>
          <div class="muted text-sm">${escapeHtml(ev.name || 'Event')} • ${new Date(g.createdAt).toLocaleString()}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <a class="text-[#0A66C2] text-sm" href="hackathons.html" onclick="localStorage.setItem('lastOpenEvent','${escapeHtml(entry.eventId)}')">Open Event</a>
          <button class="btn-ghost" data-gid="${escapeHtml(g.id)}" data-eid="${escapeHtml(entry.eventId)}" onclick="leaveGroupHandler(event)">Leave</button>
        </div>
      </div>`;
    }).join('');
  }

  const recentNode = document.getElementById('recentActivity');
  const recentLines = [];
  if(myEvents.length) recentLines.push(`Saved ${myEvents.length} events`);
  if(userGroupsList.length) recentLines.push(`Member of ${userGroupsList.length} groups`);
  recentNode.innerHTML = recentLines.length ? recentLines.map(l=>`<div>${escapeHtml(l)}</div>`).join('') : '<div class="muted">No recent activity</div>';
}

function leaveGroupHandler(ev){
  const btn = ev.currentTarget;
  const gid = btn.dataset.gid;
  const eid = btn.dataset.eid;
  const uid = localStorage.getItem('LU_CURRENT_USER');
  if(!gid || !eid || !uid) return alert('Cannot leave group');
  const key = `MY_GROUPS_${eid}`;
  const groups = JSON.parse(localStorage.getItem(key) || '[]');
  const found = groups.find(g=>g.id===gid);
  if(!found) return alert('Group not found');
  found.members = (found.members || []).filter(m => m !== uid);
  const updated = groups.map(g => g.id===gid ? found : g).filter(g => (g.members || []).length > 0);
  localStorage.setItem(key, JSON.stringify(updated));
  renderDashboard();
  alert('You left the group');
}

document.addEventListener('DOMContentLoaded', ()=>{
  renderDashboard();

  document.getElementById('logoutBtn').onclick = ()=> { localStorage.removeItem('LU_CURRENT_USER'); window.location.href = 'index.html'; };
  document.getElementById('goEvents').onclick = ()=> { window.location.href = 'hackathons.html'; };
  document.getElementById('viewProfile').onclick = ()=> { window.location.href = 'profile.html'; };

  document.getElementById('createEvent').onclick = ()=> {
    const arr = JSON.parse(localStorage.getItem('LU_LOCAL_HACKS') || '[]');
    const next = arr.length + 1;
    const ev = { id:`ev-new-${Date.now()}`, name:`New Event ${next}`, date: new Date().toISOString().slice(0,10), theme:'Hackathon', domain:'custom', problem:'Ad-hoc event', skills: ['JavaScript'] };
    arr.push(ev); localStorage.setItem('LU_LOCAL_HACKS', JSON.stringify(arr));
    renderDashboard(); alert('Event created locally. Go to Events to manage.');
  };

  document.getElementById('openAllGroups')?.addEventListener('click', ()=>{ window.location.href = 'hackathons.html'; });
  document.getElementById('exportProfileBtn').onclick = ()=>{
    const uid = localStorage.getItem('LU_CURRENT_USER');
    const users = JSON.parse(localStorage.getItem('LU_USERS')||'[]');
    const u = users.find(x=>String(x.id)===String(uid));
    if(!u) return alert('Profile not found');
    const blob = new Blob([JSON.stringify(u, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${u.name || uid}-profile.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  document.getElementById('editProfileBtn').onclick = async ()=>{
    // quick redirect to profile page for editing
    window.location.href = 'profile.html';
  };
});
