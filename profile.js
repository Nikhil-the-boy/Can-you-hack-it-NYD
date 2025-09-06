// profile.js — profile page with avatars, invites and simple group chat
// Requires common.js (CommonAuth) to be loaded before this script for robust auth/invite behavior.
// Works with LU_CURRENT_USER, LU_USERS, LU_LOCAL_HACKS, MY_GROUPS_<eventId>, MY_EVENTS

(function(){
  'use strict';

  function escapeHtml(s){ return String(s||'').replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  /* ---------- storage helpers ---------- */
  function loadUsers(){ try{ const raw=localStorage.getItem('LU_USERS'); const arr = raw?JSON.parse(raw):[]; return Array.isArray(arr)?arr:[];}catch(e){return[];} }
  function loadEvents(){ try{ const raw=localStorage.getItem('LU_LOCAL_HACKS'); const arr = raw?JSON.parse(raw):[]; return Array.isArray(arr)?arr:[];}catch(e){return[];} }
  function getAllGroups(){
    const out = {};
    Object.keys(localStorage).forEach(k=>{
      if(k.startsWith('MY_GROUPS_')){
        const eid = k.replace('MY_GROUPS_','');
        try{ out[eid] = JSON.parse(localStorage.getItem(k)) || []; }catch(e){ out[eid] = []; }
      }
    });
    return out;
  }
  function saveGroupsForEvent(eid, groups){ localStorage.setItem('MY_GROUPS_'+eid, JSON.stringify(groups)); }

  // legacy invite storage (kept as fallback)
  function idForInviteKey(eid, gid){ return `INVITES_${eid}_${gid}`; }
  function loadInvitesLegacy(eid, gid){ try{ return JSON.parse(localStorage.getItem(idForInviteKey(eid,gid))||'[]'); }catch(e){ return []; } }
  function saveInvitesLegacy(eid,gid, arr){ localStorage.setItem(idForInviteKey(eid,gid), JSON.stringify(arr)); }

  function chatKey(eid,gid){ return `GROUP_CHAT_${eid}_${gid}`; }
  function loadChat(eid,gid){ try{ return JSON.parse(localStorage.getItem(chatKey(eid,gid))||'[]'); }catch(e){ return []; } }
  function saveChat(eid,gid, arr){ localStorage.setItem(chatKey(eid,gid), JSON.stringify(arr)); }

  /* ---------- initial user ---------- */
  const currentUserId = localStorage.getItem('LU_CURRENT_USER');
  if(!currentUserId){ /* redirect to public home or let page handle */ /* no redirect here */ }

  let users = loadUsers();
  let currentUser = users.find(u => String(u.id) === String(currentUserId) || String(u.email) === String(currentUserId));
  if(!currentUser){
    // if CommonAuth exists, try to load via CommonAuth.getCurrentUser()
    if(window.CommonAuth && typeof CommonAuth.getCurrentUser === 'function'){
      const cu = CommonAuth.getCurrentUser();
      if(cu) currentUser = cu;
    }
    if(!currentUser) currentUser = { id: currentUserId, name: currentUserId, email:'', role:'Member', bio:'' };
  }

  /* ---------- rendering ---------- */
  function renderProfile(){
    document.getElementById('profileName').textContent = currentUser.name || currentUser.email || 'You';
    document.getElementById('profileEmail').textContent = currentUser.email || '';
    document.getElementById('profileRole').textContent = currentUser.role || 'Member';
    document.getElementById('profileBio').textContent = currentUser.bio || '—';
    const ava = document.getElementById('profileAvatar');
    if(currentUser.avatarUrl) ava.src = currentUser.avatarUrl; else {
      const initials = (currentUser.name||'').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();
      if(initials){
        try{
          const c = document.createElement('canvas'); c.width=240; c.height=240; const ctx=c.getContext('2d');
          ctx.fillStyle='#e6f4ff'; ctx.fillRect(0,0,c.width,c.height);
          ctx.fillStyle='#0A66C2'; ctx.font='96px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(initials, c.width/2, c.height/2);
          ava.src = c.toDataURL();
        }catch(e){ ava.src='image.png'; }
      } else ava.src = 'image.png';
    }
  }

  function computeGroups(){
    const events = loadEvents();
    const allGroups = getAllGroups();
    const created = []; const joined = [];
    Object.keys(allGroups).forEach(eid=>{
      const groups = allGroups[eid] || [];
      groups.forEach(g=>{
        const creator = g.creator || (Array.isArray(g.members) && g.members.length ? g.members[0] : null);
        const item = { eid, eventName: (events.find(ev=>ev.id===eid)||{}).name || eid, ...g, creator: creator };
        if(String(creator) === String(currentUserId)){
          created.push(item);
        } else if(Array.isArray(g.members) && g.members.includes(currentUserId)){
          joined.push(item);
        }
      });
    });
    return { created, joined };
  }

  function renderGroupLists(){
    users = loadUsers();
    const { created, joined } = computeGroups();
    document.getElementById('statGroupsCreated').textContent = String(created.length || 0);
    document.getElementById('statGroupsJoined').textContent = String(joined.length || 0);

    const cgNode = document.getElementById('createdGroupsList');
    if(!created.length) cgNode.innerHTML = '<div class="muted">No groups created yet.</div>'; else {
      cgNode.innerHTML = created.map(g => `
        <div class="group-item">
          <div>
            <div style="font-weight:700">${escapeHtml(g.name || 'Group')}</div>
            <div class="muted small">${escapeHtml(g.eventName)} • ${new Date(g.createdAt||'').toLocaleString()}</div>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn-ghost view-members" data-eid="${escapeHtml(g.eid)}" data-gid="${escapeHtml(g.id)}">Members</button>
            <button class="btn-ghost open-event" data-eid="${escapeHtml(g.eid)}">Open event</button>
            <button class="danger delete-group" data-eid="${escapeHtml(g.eid)}" data-gid="${escapeHtml(g.id)}">Delete</button>
          </div>
        </div>
      `).join('');
    }

    const jgNode = document.getElementById('joinedGroupsList');
    if(!joined.length) jgNode.innerHTML = '<div class="muted">Not a member of any groups yet.</div>'; else {
      jgNode.innerHTML = joined.map(g => `
        <div class="group-item">
          <div>
            <div style="font-weight:700">${escapeHtml(g.name || 'Group')}</div>
            <div class="muted small">${escapeHtml(g.eventName)} • ${new Date(g.createdAt||'').toLocaleString()}</div>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn-ghost view-members" data-eid="${escapeHtml(g.eid)}" data-gid="${escapeHtml(g.id)}">Members</button>
            <button class="btn-ghost open-event" data-eid="${escapeHtml(g.eid)}">Open event</button>
            <button class="btn-ghost leave-group" data-eid="${escapeHtml(g.eid)}" data-gid="${escapeHtml(g.id)}">Leave</button>
          </div>
        </div>
      `).join('');
    }

    // wire action buttons
    document.querySelectorAll('.open-event').forEach(btn => btn.addEventListener('click', ()=> {
      localStorage.setItem('lastOpenEvent', btn.dataset.eid);
      window.location.href = 'hackathons.html';
    }));

    document.querySelectorAll('.view-members').forEach(btn => btn.addEventListener('click', ()=> {
      showMembersModal(btn.dataset.eid, btn.dataset.gid);
    }));

    document.querySelectorAll('.delete-group').forEach(btn => btn.addEventListener('click', ()=> {
      if(!confirm('Delete this group? This cannot be undone.')) return;
      const eid = btn.dataset.eid; const gid = btn.dataset.gid;
      const groups = JSON.parse(localStorage.getItem('MY_GROUPS_'+eid) || '[]');
      const updated = groups.filter(g => String(g.id) !== String(gid));
      saveGroupsForEvent(eid, updated);
      renderGroupLists();
      alert('Group deleted');
    }));

    document.querySelectorAll('.leave-group').forEach(btn => btn.addEventListener('click', ()=> {
      if(!confirm('Leave this group?')) return;
      const eid = btn.dataset.eid; const gid = btn.dataset.gid;
      const groups = JSON.parse(localStorage.getItem('MY_GROUPS_'+eid) || '[]');
      const found = groups.find(g => String(g.id) === String(gid));
      if(!found) return alert('Group not found');
      found.members = (found.members||[]).filter(m => String(m) !== String(currentUserId));
      const updated = groups.map(g => g.id===gid ? found : g).filter(g => (g.members||[]).length > 0);
      saveGroupsForEvent(eid, updated);
      renderGroupLists();
      alert('You left the group');
    }));
  }

  /* ---------- members modal (avatars, invites, chat) ---------- */

  let activeModal = { eid: null, gid: null };

  function showMembersModal(eid, gid){
    activeModal = { eid, gid };
    const groups = JSON.parse(localStorage.getItem('MY_GROUPS_'+eid) || '[]');
    const g = groups.find(x=>String(x.id)===String(gid));
    const membersList = document.getElementById('membersList');
    const membersTitle = document.getElementById('membersTitle');
    if(!g){
      membersList.innerHTML = '<div class="muted">Group not found</div>';
      membersTitle.textContent = 'Members';
      document.getElementById('membersModal').classList.remove('hidden');
      return;
    }
    membersTitle.textContent = `${g.name || 'Group'} — members (${(g.members||[]).length})`;

    const usersArr = loadUsers();
    // build member rows with avatars
    const html = (g.members||[]).map(uid=>{
      const u = usersArr.find(x => String(x.id) === String(uid) || String(x.email) === String(uid));
      const display = u ? (u.name || u.email) : uid;
      const avatar = (u && u.avatarUrl) ? `<img src="${escapeHtml(u.avatarUrl)}" alt="" class="avatar-sm">` :
        (()=> {
          const initials = u && u.name ? escapeHtml(u.name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()) : escapeHtml((uid+'').slice(0,2).toUpperCase());
          return `<div style="width:40px;height:40px;border-radius:10px;background:#e6f4ff;color:#0A66C2;display:flex;align-items:center;justify-content:center;font-weight:700">${initials}</div>`;
        })();

      return `<div class="member-row">
        <div style="display:flex;align-items:center;gap:10px;">
          <div>${avatar}</div>
          <div>
            <div class="member-name">${escapeHtml(display)}</div>
            <div class="muted small">${escapeHtml(u ? (u.role || '') : '')} ${u && u.email ? ' • ' + escapeHtml(u.email) : ''}</div>
          </div>
        </div>
        <div>
          ${String(g.creator) === String(uid) ? '<div class="muted small">Creator</div>' : ''}
          ${String(uid) === String(currentUserId) ? '<div class="muted small">You</div>' : ''}
        </div>
      </div>`;
    }).join('');

    membersList.innerHTML = html || '<div class="muted">No members</div>';

    // invites
    renderInvitesList(eid,gid);

    // chat
    renderChat(eid,gid);

    document.getElementById('membersModal').classList.remove('hidden');
  }

  document.getElementById('membersClose').addEventListener('click', ()=> {
    document.getElementById('membersModal').classList.add('hidden');
    activeModal = { eid: null, gid: null };
  });

  /* ---------- invites (STEP 4: updated to use CommonAuth) ---------- */

  // Render invites list for the modal (shows invites relevant to this group's invited emails)
  function renderInvitesList(eid,gid){
    const invitesNode = document.getElementById('invitesList');

    // If CommonAuth available, show invites targeted to invited users for this group:
    // We'll fetch invites stored for each invited email (CommonAuth.getInvitesForEmail)
    let invitesForGroup = [];

    // First, prefer to read invites that were stored per-email via CommonAuth
    try {
      if(window.CommonAuth && typeof CommonAuth.getInvitesForEmail === 'function'){
        // To display invites relevant to this group, search all invites keys we might know:
        // We don't have a global index, so we'll check invites for the members/emails we know in LU_USERS + any legacy invites.
        const usersArr = loadUsers();
        // collect candidate emails: users list + any pending legacy invites (fallback)
        const candidateEmails = new Set();
        usersArr.forEach(u => { if(u.email) candidateEmails.add((u.email||'').toLowerCase()); });

        // also add invites that might have been stored in legacy key (INVITES_eid_gid)
        const legacy = loadInvitesLegacy(eid,gid) || [];
        legacy.forEach(x => { if(x && x.email) candidateEmails.add((x.email||'').toLowerCase()); });

        // get invites for each candidate email and filter for this group
        candidateEmails.forEach(email => {
          const arr = CommonAuth.getInvitesForEmail(email) || [];
          arr.forEach(inv => {
            if(String(inv.eid) === String(eid) && String(inv.gid) === String(gid)){
              invitesForGroup.push({ targetEmail: email, invite: inv });
            }
          });
        });

        // Also include invites that were stored via legacy mechanism (so earlier invites are not lost)
        invitesForGroup = invitesForGroup.concat((legacy||[]).map(inv => ({ targetEmail: inv.email || '', invite: inv })));
      } else {
        // fallback: show legacy invites attached to group
        const legacy = loadInvitesLegacy(eid,gid) || [];
        invitesForGroup = legacy.map(inv => ({ targetEmail: inv, invite: { eid, gid, eventName:'', groupName:'', invitedBy:'', ts: '' } }));
      }
    } catch(err){
      console.warn('renderInvitesList error', err);
      const legacy = loadInvitesLegacy(eid,gid) || [];
      invitesForGroup = legacy.map(inv => ({ targetEmail: inv, invite: { eid, gid, eventName:'', groupName:'', invitedBy:'', ts: '' } }));
    }

    if(!invitesForGroup.length){ invitesNode.innerHTML = '<div class="muted small">No invites</div>'; return; }

    const usersArr = loadUsers();
    invitesNode.innerHTML = invitesForGroup.map(item => {
      const inv = item.invite || {};
      const target = item.targetEmail || (inv.email || '');
      const u = usersArr.find(x => (x.email||'').toLowerCase() === (target||'').toLowerCase() || String(x.id) === String(target));
      const display = u ? (u.name || u.email) : target;
      const isForMe = (currentUser && currentUser.email && (currentUser.email||'').toLowerCase() === (target||'').toLowerCase());
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px;border:1px solid #f1f5f9;border-radius:8px;margin-bottom:6px">
        <div>
          <div style="font-weight:700">${escapeHtml(display)}</div>
          <div class="small muted">${escapeHtml(u ? (u.email || '') : target)} ${inv.ts ? ' • ' + escapeHtml(new Date(inv.ts).toLocaleString()) : ''}</div>
        </div>
        <div>
          ${ isForMe ? `<button class="btn-ghost accept-invite" data-eid="${escapeHtml(eid)}" data-gid="${escapeHtml(gid)}" data-target="${escapeHtml(target)}">Accept</button>` : '' }
          <button class="btn-ghost cancel-invite" data-eid="${escapeHtml(eid)}" data-gid="${escapeHtml(gid)}" data-target="${escapeHtml(target)}">Cancel</button>
        </div>
      </div>`;
    }).join('');

    // wire accept/cancel
    invitesNode.querySelectorAll('.accept-invite').forEach(b => b.addEventListener('click', ()=> {
      const eid = b.dataset.eid, gid = b.dataset.gid, target = b.dataset.target;
      acceptInvite(eid,gid, target);
    }));
    invitesNode.querySelectorAll('.cancel-invite').forEach(b => b.addEventListener('click', ()=> {
      const eid = b.dataset.eid, gid = b.dataset.gid, target = b.dataset.target;
      cancelInvite(eid,gid,target);
    }));
  }

  // sendInvite now uses CommonAuth.addInviteForEmail (delivers to target email)
  function sendInvite(eid,gid, invitee){
    if(!invitee) return alert('Enter user id or email to invite');

    const target = (invitee||'').trim();
    if(!target) return alert('Please enter an email or user id');

    // Attempt to resolve to local user by email
    const targetLower = target.toLowerCase();
    let targetUser = null;
    try{ targetUser = (window.CommonAuth && CommonAuth.findUserByEmail) ? CommonAuth.findUserByEmail(target) : loadUsers().find(u=> (u.email||'').toLowerCase() === targetLower || String(u.id) === String(target)); }catch(e){ targetUser = null; }

    // Build invite object
    const events = JSON.parse(localStorage.getItem('LU_LOCAL_HACKS')||'[]');
    const ev = events.find(x => String(x.id) === String(eid)) || {};
    const groups = JSON.parse(localStorage.getItem('MY_GROUPS_'+eid) || '[]');
    const g = groups.find(x => String(x.id) === String(gid)) || {};
    const inviter = (window.CommonAuth && CommonAuth.getCurrentUser) ? (CommonAuth.getCurrentUser()||{}).id : (localStorage.getItem('LU_CURRENT_USER')||'');
    const inviteObj = {
      eid,
      gid,
      eventName: ev.name || '',
      groupName: g.name || '',
      invitedBy: inviter,
      ts: new Date().toISOString(),
      email: targetUser && targetUser.email ? targetUser.email : target
    };

    try {
      if(window.CommonAuth && typeof CommonAuth.addInviteForEmail === 'function'){
        // deliver invite to target email (if user exists, use registered email; else still store under provided identifier)
        const deliverTo = (targetUser && targetUser.email) ? targetUser.email : target;
        CommonAuth.addInviteForEmail(deliverTo, inviteObj);
        alert('Invite added for ' + deliverTo);
      } else {
        // fallback: legacy store per group
        const legacy = loadInvitesLegacy(eid,gid) || [];
        legacy.push(inviteObj);
        saveInvitesLegacy(eid,gid, legacy);
        alert('Invite saved (legacy) for ' + (inviteObj.email || target));
      }
    } catch(err){
      console.warn('sendInvite failed', err);
      alert('Invite failed to save');
    }

    renderInvitesList(eid,gid);
  }

  function cancelInvite(eid,gid, target){
    if(!target) return alert('No invite target specified');
    try {
      if(window.CommonAuth && typeof CommonAuth.removeInviteForEmail === 'function'){
        CommonAuth.removeInviteForEmail(target, eid, gid);
      } else {
        // fallback: remove from legacy key by matching email or invite signature
        let arr = loadInvitesLegacy(eid,gid) || [];
        arr = arr.filter(i => {
          if(!i) return false;
          if(typeof i === 'string') return String(i) !== String(target);
          if(i.email) return (i.email||'').toLowerCase() !== (target||'').toLowerCase();
          return !(String(i.eid) === String(eid) && String(i.gid) === String(gid) && (String(i.email||'') === String(target)));
        });
        saveInvitesLegacy(eid,gid, arr);
      }
    } catch(e){
      console.warn('cancelInvite error', e);
    }
    renderInvitesList(eid,gid);
  }

  function acceptInvite(eid,gid, target){
    // When user accepts, ensure they are the invited target (based on email) or allow if invited by id
    const cur = (window.CommonAuth && typeof CommonAuth.getCurrentUser === 'function') ? CommonAuth.getCurrentUser() : currentUser;
    if(!cur) return alert('You must be logged in to accept invites.');
    const myEmail = (cur.email||'').toLowerCase();
    // If target doesn't match logged-in user's email, disallow
    if(target && myEmail && (target.toLowerCase() !== myEmail) && (String(target) !== String(cur.id))){
      return alert('This invite is not for your account.');
    }

    // add current user to group
    const groups = JSON.parse(localStorage.getItem('MY_GROUPS_'+eid) || '[]');
    const g = groups.find(x => String(x.id) === String(gid));
    if(!g) return alert('Group not found');
    if(!Array.isArray(g.members)) g.members = [];
    if(!g.members.includes(cur.id)) g.members.push(cur.id);
    // save groups
    localStorage.setItem('MY_GROUPS_'+eid, JSON.stringify(groups));

    // remove invite record for this email
    try {
      if(window.CommonAuth && typeof CommonAuth.removeInviteForEmail === 'function' && cur.email){
        CommonAuth.removeInviteForEmail(cur.email, eid, gid);
      } else {
        // fallback: remove from legacy
        let arr = loadInvitesLegacy(eid,gid) || [];
        arr = arr.filter(i => {
          // keep invites that are NOT this one
          if(!i) return true;
          if(typeof i === 'string') return i !== target;
          if(i.email) return (i.email||'').toLowerCase() !== (target||'').toLowerCase();
          return !(String(i.eid) === String(eid) && String(i.gid) === String(gid));
        });
        saveInvitesLegacy(eid,gid, arr);
      }
    } catch(err){
      console.warn('acceptInvite remove failed', err);
    }

    renderGroupLists();
    renderInvitesList(eid,gid);
    alert('Invite accepted — you joined the group');
  }

  // wire send invite button
  document.getElementById('sendInviteBtn').addEventListener('click', ()=> {
    const inv = (document.getElementById('inviteInput').value || '').trim();
    if(!activeModal.eid || !activeModal.gid) return alert('No active group');
    if(!inv) return alert('Enter an email or user id');
    sendInvite(activeModal.eid, activeModal.gid, inv);
    document.getElementById('inviteInput').value = '';
  });

  /* ---------- chat (unchanged) ---------- */

  function renderChat(eid,gid){
    const chatNode = document.getElementById('chatBox');
    chatNode.innerHTML = '';
    const msgs = loadChat(eid,gid) || [];
    const usersArr = loadUsers();
    msgs.forEach(m => {
      const u = usersArr.find(x => String(x.id) === String(m.from) || (x.email && x.email.toLowerCase() === String(m.from).toLowerCase()));
      const avatar = u && u.avatarUrl ? `<img src="${escapeHtml(u.avatarUrl)}" class="avatar-sm" style="width:36px;height:36px;border-radius:8px">` :
        `<div style="width:36px;height:36px;border-radius:8px;background:#e6f4ff;color:#0A66C2;display:flex;align-items:center;justify-content:center;font-weight:700">${escapeHtml(u? (u.name||'').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase() : (String(m.from||'').slice(0,2).toUpperCase()))}</div>`;

      const time = new Date(m.ts).toLocaleString();
      const content = escapeHtml(m.text);
      const html = `<div class="chat-message"><div>${avatar}</div><div><div style="font-weight:700">${escapeHtml(u ? (u.name || u.email) : m.from)} <span class="chat-meta">• ${time}</span></div><div style="margin-top:6px">${content}</div></div></div>`;
      chatNode.insertAdjacentHTML('beforeend', html);
    });
    chatNode.scrollTop = chatNode.scrollHeight;
  }

  document.getElementById('chatSendBtn').addEventListener('click', ()=> {
    const text = (document.getElementById('chatInput').value || '').trim();
    if(!text) return;
    if(!activeModal.eid || !activeModal.gid) return alert('Open a group chat first');
    const msgs = loadChat(activeModal.eid, activeModal.gid);
    msgs.push({ from: currentUserId, text, ts: new Date().toISOString() });
    saveChat(activeModal.eid, activeModal.gid, msgs);
    document.getElementById('chatInput').value = '';
    renderChat(activeModal.eid, activeModal.gid);
  });

  document.getElementById('chatInput').addEventListener('keydown', (e)=> {
    if(e.key === 'Enter'){ e.preventDefault(); document.getElementById('chatSendBtn').click(); }
  });

  /* ---------- create group modal (unchanged) ---------- */

  document.getElementById('createGroupBtn').addEventListener('click', ()=>{
    const events = loadEvents();
    const sel = document.getElementById('cgEventSelect');
    sel.innerHTML = events.map(ev => `<option value="${escapeHtml(ev.id)}">${escapeHtml(ev.name)} • ${escapeHtml(ev.date)}</option>`).join('');
    document.getElementById('cgName').value = '';
    document.getElementById('cgMembers').value = '';
    document.getElementById('createGroupModal').classList.remove('hidden');
  });
  document.getElementById('cgCancel').addEventListener('click', ()=> document.getElementById('createGroupModal').classList.add('hidden'));

  document.getElementById('createGroupForm').addEventListener('submit', function(e){
    e.preventDefault();
    const eid = document.getElementById('cgEventSelect').value;
    const name = document.getElementById('cgName').value.trim() || ('Group ' + Date.now());
    const membersRaw = document.getElementById('cgMembers').value.trim();
    const extra = membersRaw ? membersRaw.split(',').map(s=>s.trim()).filter(Boolean) : [];
    const members = Array.from(new Set([currentUserId, ...extra]));
    const groups = JSON.parse(localStorage.getItem('MY_GROUPS_'+eid) || '[]');
    const gid = 'grp-' + Date.now() + '-' + Math.floor(Math.random()*999);
    const gobj = { id: gid, name, members, createdAt: new Date().toISOString(), creator: currentUserId };
    groups.push(gobj);
    localStorage.setItem('MY_GROUPS_'+eid, JSON.stringify(groups));
    document.getElementById('createGroupModal').classList.add('hidden');
    renderGroupLists();
    alert('Group created');
  });

  /* ---------- edit profile (unchanged) ---------- */

  document.getElementById('editProfileBtn').addEventListener('click', ()=>{
    document.getElementById('pfName').value = currentUser.name || '';
    document.getElementById('pfEmail').value = currentUser.email || '';
    document.getElementById('pfRole').value = currentUser.role || '';
    document.getElementById('pfBio').value = currentUser.bio || '';
    document.getElementById('editProfileModal').classList.remove('hidden');
  });

  document.getElementById('pfCancel').addEventListener('click', ()=> document.getElementById('editProfileModal').classList.add('hidden'));

  document.getElementById('profileForm').addEventListener('submit', function(e){
    e.preventDefault();
    const name = document.getElementById('pfName').value.trim();
    const email = document.getElementById('pfEmail').value.trim();
    const role = document.getElementById('pfRole').value.trim();
    const bio = document.getElementById('pfBio').value.trim();

    try{
      const raw = localStorage.getItem('LU_USERS');
      const arr = raw ? JSON.parse(raw) : [];
      let idx = arr.findIndex(u => String(u.id) === String(currentUserId) || ((u.email||'').toLowerCase() === (email||'').toLowerCase()));
      const userObj = Object.assign({}, arr[idx] || {}, { id: currentUserId, name, email, role, bio, updatedAt: new Date().toISOString() });
      if(idx >= 0) arr[idx] = userObj; else arr.push(userObj);
      localStorage.setItem('LU_USERS', JSON.stringify(arr));
      currentUser = userObj;
      localStorage.setItem('LU_CURRENT_USER', userObj.id);
      renderProfile();
      renderGroupLists();
      document.getElementById('editProfileModal').classList.add('hidden');
      alert('Profile saved');
    }catch(err){
      console.error(err);
      alert('Failed to save profile');
    }
  });

  /* ---------- export profile & logout ---------- */

  document.getElementById('exportProfileBtn').addEventListener('click', ()=>{
    try{
      const users = loadUsers();
      const u = users.find(x => String(x.id) === String(currentUserId) || String(x.email) === String(currentUserId));
      if(!u) return alert('Profile not found');
      const blob = new Blob([JSON.stringify(u, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${(u.name||u.id)}-profile.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }catch(e){ console.warn(e); alert('Export failed'); }
  });

  document.getElementById('logoutBtn').addEventListener('click', ()=>{
    try{ if(window.CommonAuth && CommonAuth.logout) CommonAuth.logout(); }catch(e){}
    localStorage.removeItem('LU_CURRENT_USER');
    window.location.href = 'index.html';
  });

  /* ---------- initial stats render ---------- */

  function renderInitialStats(){
    const events = loadEvents();
    const saved = JSON.parse(localStorage.getItem('MY_EVENTS') || '[]');
    document.getElementById('statEvents').textContent = String(events.length || 0);
    document.getElementById('statSaved').textContent = String((saved||[]).length || 0);
  }

  /* ---------- boot ---------- */
  renderProfile();
  renderGroupLists();
  renderInitialStats();

  // refresh groups
  document.getElementById('refreshGroups').addEventListener('click', ()=> {
    renderGroupLists();
    alert('Refreshed');
  });

})();
