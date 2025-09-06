// common.js - local auth & invite helpers (browser-only, localStorage)
// Usage: include <script src="common.js"></script> before page scripts that call these functions.

(async function(global){
    'use strict';
  
    // --- utilities ---
    function toHex(buffer){
      const b = new Uint8Array(buffer);
      return Array.from(b).map(x => x.toString(16).padStart(2,'0')).join('');
    }
    async function sha256(text){
      const enc = new TextEncoder();
      const data = enc.encode(String(text||''));
      const hash = await crypto.subtle.digest('SHA-256', data);
      return toHex(hash);
    }
  
    function safeParse(key){
      try{ return JSON.parse(localStorage.getItem(key) || 'null') || null; }catch(e){ return null; }
    }
    function safeSave(key, value){
      try{ localStorage.setItem(key, JSON.stringify(value)); return true; }catch(e){ console.warn('save failed',e); return false; }
    }
  
    // --- users helpers ---
    function getUsers(){
      const arr = safeParse('LU_USERS');
      return Array.isArray(arr) ? arr : [];
    }
    function saveUsers(arr){
      return safeSave('LU_USERS', arr || []);
    }
  
    // Find user by email (case-insensitive) or id
    function findUserByEmail(email){
      if(!email) return null;
      const e = String(email).trim().toLowerCase();
      const u = getUsers().find(x => ((x.email||'').toLowerCase()===e) || (String(x.id) === String(email)));
      return u || null;
    }
  
    // Register user (stores hashed password). Accepts { id?, name, email, password, role, bio }
    async function registerUser({id, name, email, password, role, bio}) {
      if(!email || !password) throw new Error('email and password required');
      const users = getUsers();
      const existing = users.find(u => (u.email||'').toLowerCase() === (email||'').toLowerCase());
      const hash = await sha256(password);
      if(existing){
        // update existing user's password only if we explicitly allow override
        existing.name = name || existing.name;
        existing.role = role || existing.role;
        existing.bio = bio || existing.bio;
        existing.passwordHash = hash;
        existing.updatedAt = new Date().toISOString();
      } else {
        const uid = id || ('u-' + Date.now() + '-' + Math.floor(Math.random()*9000+1000));
        users.push({
          id: uid,
          name: name || email.split('@')[0],
          email: email,
          role: role || 'Member',
          bio: bio || '',
          passwordHash: hash,
          createdAt: new Date().toISOString()
        });
      }
      saveUsers(users);
      return findUserByEmail(email);
    }
  
    // Verify credentials and return user object (or null)
    async function loginUser(email, password){
      if(!email || !password) return null;
      const user = findUserByEmail(email);
      if(!user || !user.passwordHash) return null;
      const hash = await sha256(password);
      if(hash === user.passwordHash) return user;
      return null;
    }
  
    // simple logout
    function logout(){
      localStorage.removeItem('LU_CURRENT_USER');
    }
  
    // get current user from LU_CURRENT_USER
    function getCurrentUser(){
      const id = localStorage.getItem('LU_CURRENT_USER');
      if(!id) return null;
      const users = getUsers();
      return users.find(u => String(u.id) === String(id) || ((u.email||'').toLowerCase() === String(id).toLowerCase())) || null;
    }
  
    // --- invites helpers ---
    // invitations stored under key: INVITES_FOR_USER_<emailLower>
    function invitesKeyFor(email){
      return 'INVITES_FOR_USER_' + String((email||'').toLowerCase());
    }
  
    // add an invite record for a target email (target user will see it)
    // inviteObj: { eid, gid, eventName, groupName, invitedBy (id/email), ts }
    function addInviteForEmail(targetEmail, inviteObj){
      if(!targetEmail) return false;
      const k = invitesKeyFor(targetEmail);
      const cur = safeParse(k) || [];
      cur.push(Object.assign({ ts: new Date().toISOString() }, inviteObj || {}));
      safeSave(k, cur);
      return true;
    }
  
    // get invites for current user or for email
    function getInvitesForEmail(email){
      if(!email) return [];
      const arr = safeParse(invitesKeyFor(email));
      return Array.isArray(arr) ? arr : [];
    }
  
    // remove an invite (for a target email)
    function removeInviteForEmail(email, eid, gid){
      if(!email) return false;
      const k = invitesKeyFor(email);
      let arr = safeParse(k) || [];
      arr = arr.filter(i => !(String(i.eid) === String(eid) && String(i.gid) === String(gid)));
      safeSave(k, arr);
      return true;
    }
  
    // expose functions
    global.CommonAuth = {
      sha256,
      getUsers,
      saveUsers,
      findUserByEmail,
      registerUser,
      loginUser,
      logout,
      getCurrentUser,
      // invites
      addInviteForEmail,
      getInvitesForEmail,
      removeInviteForEmail
    };
  
  })(window);
  
