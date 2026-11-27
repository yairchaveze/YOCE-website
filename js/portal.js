// Portal del personal: sesión con usuario y contraseña; cada módulo se muestra solo si el usuario tiene acceso.
(function () {
  var API = document.body.dataset.api, KEY = 'yct-portal', token = '', profile = null, docs = [];
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var store = {
    get: function () { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
    set: function (v) { try { v ? sessionStorage.setItem(KEY, JSON.stringify(v)) : sessionStorage.removeItem(KEY); } catch (e) {} }
  };
  function call(path, body) {
    var h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return fetch(API + path, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); });
  }
  window.YCT = { call: function (p, b) { return call(p, b); }, expired: function () { expired(); } };
  function view(id) {
    ['login', 'home', 'm-calidad', 'm-administracion', 'm-cultivo', 'm-qc'].forEach(function (v) { $(v).hidden = v !== id; });
    $('stage').scrollTop = 0; window.scrollTo(0, 0);
  }
  function expired() { signOut(); $('msg').textContent = 'Tu sesión terminó. Entra de nuevo.'; }
  function signIn(t, p) {
    token = t; profile = p; store.set({ token: t, profile: p });
    $('who').hidden = false; $('whoName').textContent = p.name.split(' ')[0];
    $('hello').textContent = 'Hola, ' + p.name.split(' ')[0] + '.';
    document.querySelectorAll('.tile').forEach(function (b) { b.hidden = p.modules.indexOf(b.dataset.mod) < 0; });
    view('home');
    if (p.modules.indexOf('administracion') >= 0) document.querySelector('[data-state="administracion"]').classList.add('ok');
    if (p.modules.indexOf('calidad') >= 0) {
      call('/qms/list').then(function (r) {
        if (r.status === 401) return expired();
        if (r.status !== 200) return;
        docs = r.body.docs;
        document.querySelector('[data-state="calidad"]').textContent = docs.length + ' documentos';
        document.querySelector('[data-state="calidad"]').classList.add('ok');
        renderDocs();
      });
    }
  }
  function signOut() {
    token = ''; profile = null; docs = []; store.set(null);
    $('who').hidden = true; $('docs').innerHTML = ''; $('dBody').innerHTML = '';
    $('pw').value = ''; view('login');
  }
  function renderDocs() {
    $('docs').innerHTML = docs.map(function (d) {
      return '<li><button type="button" data-doc="' + esc(d.code) + '"><span class="dc">' + esc(d.code) + '</span><span class="dt">' + esc(d.title) + '</span><span class="dm">Versión ' + esc(d.version) + ' · ' + esc(d.status) + '</span></button></li>';
    }).join('');
  }

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var u = $('user').value.trim(), p = $('pw').value, msg = $('msg');
    if (!u || !p) { msg.textContent = 'Escribe tu usuario y contraseña.'; return; }
    msg.textContent = 'Verificando...';
    token = '';
    call('/auth/login', { user: u, password: p }).then(function (r) {
      if (r.status !== 200) { msg.textContent = 'Usuario o contraseña incorrectos.'; $('pw').value = ''; $('pw').focus(); return; }
      msg.textContent = ''; signIn(r.body.token, r.body.profile);
    }).catch(function () { msg.textContent = 'No se pudo conectar. Revisa tu conexión.'; });
  });
  $('logout').addEventListener('click', signOut);
  $('tiles').addEventListener('click', function (e) {
    var b = e.target.closest('.tile'); if (!b) return;
    if (b.dataset.mod === 'calidad') { $('viewer').hidden = true; $('docList').hidden = false; }
    view('m-' + b.dataset.mod);
    document.dispatchEvent(new CustomEvent('yct:open', { detail: b.dataset.mod }));
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-home]')) { document.title = 'Portal del personal | YoCellTherapy'; view('home'); }
  });
  $('docs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-doc]'); if (!b) return;
    var label = b.querySelector('.dm'), old = label.textContent; label.textContent = 'Abriendo...';
    call('/qms/doc', { doc: b.dataset.doc }).then(function (r) {
      label.textContent = old;
      if (r.status === 401) return expired();
      if (r.status !== 200) return;
      var d = r.body, ctl = d.code + ', versión ' + d.version + ', emisión ' + d.issued;
      $('dTitle').textContent = d.title; $('dBody').innerHTML = d.html; $('dCtl').textContent = ctl;
      $('pageBoxes').textContent = '@media print { @page { size: letter; margin: 15mm 15mm 18mm; @bottom-left { content: "' + ctl.replace(/"/g, '') + '"; font: 8pt sans-serif; color: #506267; } @bottom-center { content: "Página " counter(page) " de " counter(pages); font: 8pt sans-serif; color: #506267; } @bottom-right { content: "yocelltherapy.com"; font: 8pt sans-serif; color: #506267; } } }';
      document.title = d.code + ' ' + d.title + ' | YoCellTherapy';
      $('docList').hidden = true; $('viewer').hidden = false; $('stage').scrollTop = 0; window.scrollTo(0, 0);
    }).catch(function () { label.textContent = old; });
  });
  $('back').addEventListener('click', function () { $('viewer').hidden = true; $('docList').hidden = false; document.title = 'Portal del personal | YoCellTherapy'; });
  $('print').addEventListener('click', function () { window.print(); });

  var saved = store.get();
  if (saved && saved.token) {
    token = saved.token;
    call('/auth/me').then(function (r) { r.status === 200 ? signIn(saved.token, r.body.profile) : signOut(); }).catch(function () { signOut(); });
  }
})();
