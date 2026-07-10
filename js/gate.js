/* 購入者ゲート(自動生成: scripts/build-members.mjs) */
(function(){
  var CFG = { salt: "xo6Bf8FZTlprDudfOOjcrg==", iter: 310000, verify: "Yx1easTI8H76kFd3gSRIXMLV+s9uu2kAj9CRr9DiXCY=" };
  var page = location.pathname.split('/').pop() || 'index.html';
  function toGate(){ location.replace('members.html?next=' + encodeURIComponent(page)); }
  try {
    if (sessionStorage.getItem('members_ok') === CFG.verify) return;
  } catch (e) { toGate(); return; }
  document.documentElement.style.visibility = 'hidden';
  var pw = null;
  try { pw = sessionStorage.getItem('members_pw'); } catch (e) {}
  if (!pw) { toGate(); return; }
  var b2u = function(b){ return Uint8Array.from(atob(b), function(c){ return c.charCodeAt(0); }); };
  crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits'])
    .then(function(bk){ return crypto.subtle.deriveBits({ name:'PBKDF2', salt:b2u(CFG.salt), iterations:CFG.iter, hash:'SHA-256' }, bk, 256); })
    .then(function(bits){ return crypto.subtle.digest('SHA-256', bits); })
    .then(function(h){
      var hb = btoa(String.fromCharCode.apply(null, new Uint8Array(h)));
      if (hb === CFG.verify) {
        sessionStorage.setItem('members_ok', CFG.verify);
        document.documentElement.style.visibility = '';
      } else { toGate(); }
    })
    .catch(toGate);
})();
