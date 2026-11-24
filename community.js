(function () {
  'use strict';

  var API = 'https://crosshair-community.gabrielvalenti37.workers.dev';
  var TOKEN_KEY = 'nex_token';
  var PAGE = 24;

  // Gleiche Werte wie in der App
  var DEFAULTS = {
    shape: 'cross',
    color: '#00ffff', opacity: 1, rotation: 0,
    glow: false, glowSize: 8,
    thickness: 3, gap: 4,
    armTop: true, armBottom: true, armLeft: true, armRight: true,
    lenTop: 16, lenBottom: 16, lenLeft: 16, lenRight: 16,
    radius: 20, filled: false, segments: 1, segmentGap: 20,
    outline: true, outlineColor: '#000000', outlineThickness: 2,
    centerDot: false, dotSize: 3, dotRound: false, dotCustom: false, dotColor: '#ffffff',
    offsetX: 0, offsetY: 0
  };
  var LIMITS = {
    opacity: [0.1, 1], rotation: [0, 359], glowSize: [1, 30],
    thickness: [1, 20], gap: [0, 50],
    lenTop: [0, 60], lenBottom: [0, 60], lenLeft: [0, 60], lenRight: [0, 60],
    radius: [5, 100], segments: [1, 8], segmentGap: [0, 60],
    outlineThickness: [1, 5], dotSize: [1, 30],
    offsetX: [-50, 50], offsetY: [-50, 50]
  };
  var SHAPE_LIST = ['cross', 'tshape', 'dot', 'circle', 'square', 'triangle'];

  var $ = function (id) { return document.getElementById(id); };

  var me = null;
  var offset = 0;
  var filter = { sort: 'new', q: '', user: '' };
  var pendingSettings = null;
  var loadSeq = 0;

  // ---------- Speicher und Server ----------

  function getToken() {
    try { return localStorage.getItem('nex_token') || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = {};
    var t = getToken();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || 'Fehler ' + r.status);
        return d;
      });
    }, function () {
      throw new Error('Der Server ist gerade nicht erreichbar.');
    });
  }

  function notify(text, kind) {
    var n = $('notice');
    n.textContent = text;
    n.className = 'notice' + (kind ? ' ' + kind : '');
    n.hidden = !text;
  }

  function safeAvatar(url) {
    return typeof url === 'string' && url.indexOf('https://cdn.discordapp.com/') === 0 ? url : '';
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error('no clipboard'));
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ---------- Anmeldung ----------

  function readHash() {
    var h = location.hash || '';
    var m = h.match(/token=([a-f0-9]{64})/);
    if (m) {
      setToken(m[1]);
      history.replaceState(null, '', location.pathname + location.search);
      notify('Du bist angemeldet.', 'ok');
    } else if (/error=banned/.test(h)) {
      history.replaceState(null, '', location.pathname + location.search);
      notify('Dein Konto ist gesperrt.', 'err');
    } else if (/error=login/.test(h)) {
      history.replaceState(null, '', location.pathname + location.search);
      notify('Die Anmeldung hat nicht geklappt. Versuche es noch einmal.', 'err');
    }
    var u = (location.hash || '').match(/^#u=(\d{5,25})$/);
    filter.user = u ? u[1] : '';
  }

  function loadMe() {
    if (!getToken()) { me = null; return Promise.resolve(); }
    return api('/api/me').then(function (d) { me = d; }, function (e) {
      if (/anmelden|Nicht angemeldet|401/.test(e.message)) setToken('');
      me = null;
    });
  }

  function renderAuth() {
    var box = $('auth-box');
    box.textContent = '';
    if (me) {
      var who = el('div', 'who');
      var av = safeAvatar(me.avatarUrl);
      if (av) {
        var img = el('img');
        img.src = av; img.alt = ''; img.width = 34; img.height = 34;
        who.appendChild(img);
      }
      who.appendChild(el('span', '', me.name));
      var out = el('button', 'btn-s', 'Abmelden');
      out.type = 'button';
      out.addEventListener('click', function () {
        api('/auth/logout', { method: 'POST' }).catch(function () {}).then(function () {
          setToken(''); me = null; renderAuth(); renderUploadVisibility(); load(true);
        });
      });
      box.appendChild(who);
      box.appendChild(out);
    } else {
      var inBtn = el('button', 'btn-s primary', 'Mit Discord anmelden');
      inBtn.type = 'button';
      inBtn.addEventListener('click', function () { location.href = API + '/auth/login'; });
      box.appendChild(inBtn);
    }
  }

  function renderUploadVisibility() {
    $('upload').hidden = !me || !!me.banned;
  }

  // ---------- Galerie ----------

  function addCard(it) {
    var card = el('article', 'card');

    var thumb = el('div', 'thumb');
    var cv = document.createElement('canvas');
    cv.width = 160; cv.height = 160;
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Vorschau von ' + it.name);
    thumb.appendChild(cv);
    card.appendChild(thumb);
    try { if (it.settings) drawCrosshair(cv, it.settings); } catch (e) {}

    var body = el('div', 'body');
    body.appendChild(el('h3', '', it.name));

    var by = el('a', 'by');
    by.href = '#u=' + it.owner.id;
    var av = safeAvatar(it.owner.avatarUrl);
    if (av) {
      var im = el('img');
      im.src = av; im.alt = ''; im.width = 20; im.height = 20;
      by.appendChild(im);
    }
    by.appendChild(el('span', '', it.owner.name));
    body.appendChild(by);

    if (it.description) body.appendChild(el('p', 'desc', it.description));

    var idrow = el('div', 'idrow');
    idrow.appendChild(el('code', '', it.id));
    var copy = el('button', 'btn-s small-btn primary', 'ID kopieren');
    copy.type = 'button';
    copy.addEventListener('click', function () {
      copyText(it.id).then(function () {
        copy.textContent = 'Kopiert';
        setTimeout(function () { copy.textContent = 'ID kopieren'; }, 1500);
        api('/api/crosshairs/' + it.id + '/copy', { method: 'POST' }).catch(function () {});
      }, function () {
        notify('Kopieren ging nicht. Die ID ist: ' + it.id, 'err');
      });
    });
    idrow.appendChild(copy);
    body.appendChild(idrow);

    body.appendChild(el('div', 'meta', it.copies + (it.copies === 1 ? ' Mal kopiert' : ' Mal kopiert')));

    var actions = el('div', 'actions');
    var own = me && me.id === it.owner.id;
    if (own) {
      var del = el('button', 'btn-s small-btn danger', 'Löschen');
      del.type = 'button';
      del.addEventListener('click', function () {
        if (!confirm('„' + it.name + '“ wirklich löschen?')) return;
        api('/api/crosshairs/' + it.id, { method: 'DELETE' }).then(function () {
          card.remove();
          notify('Gelöscht.', 'ok');
        }, function (e) { notify(e.message, 'err'); });
      });
      actions.appendChild(del);
    } else {
      var rep = el('button', 'btn-s small-btn', 'Melden');
      rep.type = 'button';
      rep.addEventListener('click', function () {
        if (!me) { notify('Bitte melde dich an, um etwas zu melden.', 'err'); return; }
        var reason = prompt('Warum meldest du dieses Crosshair?');
        if (!reason || !reason.trim()) return;
        api('/api/crosshairs/' + it.id + '/report', { method: 'POST', body: { reason: reason.trim() } }).then(
          function () { notify('Danke, die Meldung ist angekommen.', 'ok'); },
          function (e) { notify(e.message, 'err'); }
        );
      });
      actions.appendChild(rep);
    }
    body.appendChild(actions);

    card.appendChild(body);
    $('grid').appendChild(card);
  }

  function load(reset) {
    var seq = ++loadSeq;
    if (reset) { offset = 0; $('grid').textContent = ''; }
    var qs = '?sort=' + filter.sort + '&limit=' + PAGE + '&offset=' + offset +
      (filter.q ? '&q=' + encodeURIComponent(filter.q) : '') +
      (filter.user ? '&user=' + filter.user : '');
    return api('/api/crosshairs' + qs).then(function (d) {
      if (seq !== loadSeq) return;
      d.items.forEach(addCard);
      offset += d.items.length;
      $('more').hidden = d.items.length < PAGE;
      $('empty').hidden = offset > 0;
    }, function (e) {
      if (seq !== loadSeq) return;
      notify(e.message, 'err');
    });
  }

  function renderBanner() {
    var b = $('profile-banner');
    b.textContent = '';
    if (!filter.user) { b.hidden = true; return Promise.resolve(); }
    return api('/api/users/' + filter.user).then(function (u) {
      var av = safeAvatar(u.avatarUrl);
      if (av) {
        var im = el('img');
        im.src = av; im.alt = ''; im.width = 40; im.height = 40;
        b.appendChild(im);
      }
      b.appendChild(el('span', '', 'Crosshairs von ' + u.name + ' (' + u.crosshairCount + ')'));
      var back = el('a', '', 'Alle anzeigen');
      back.href = '#';
      b.appendChild(back);
      b.hidden = false;
    }, function () { b.hidden = true; });
  }

  // ---------- Hochladen ----------

  function bytesFromB64url(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    var bin = atob(str);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function inflate(bytes) {
    var ds = new DecompressionStream('deflate-raw');
    var w = ds.writable.getWriter();
    w.write(bytes);
    w.close();
    return new Response(ds.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function parseId(text) {
    text = text.trim();
    if (text.indexOf('CH1-') !== 0) return Promise.reject(new Error('Das ist keine gültige ID. Sie muss mit CH1- beginnen.'));
    var body = text.slice(4);
    if (!body || body.length > 3000 || !/^[A-Za-z0-9_-]+$/.test(body)) {
      return Promise.reject(new Error('Die ID enthält ungültige Zeichen.'));
    }
    var bytes;
    try { bytes = bytesFromB64url(body); } catch (e) { return Promise.reject(new Error('Die ID ist beschädigt.')); }
    return inflate(bytes).then(function (raw) {
      var obj = JSON.parse(new TextDecoder().decode(raw));
      if (!obj || typeof obj !== 'object' || !obj.s || typeof obj.s !== 'object') throw new Error();
      var s = {};
      Object.keys(DEFAULTS).forEach(function (k) { s[k] = DEFAULTS[k]; });
      Object.keys(DEFAULTS).forEach(function (k) {
        if (!(k in obj.s)) return;
        var v = obj.s[k], d = DEFAULTS[k];
        if (k === 'shape') {
          if (SHAPE_LIST.indexOf(v) < 0) throw new Error();
          s.shape = v;
        } else if (typeof d === 'number') {
          if (typeof v !== 'number' || !isFinite(v)) throw new Error();
          s[k] = Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], v));
        } else if (typeof d === 'boolean') {
          if (typeof v !== 'boolean') throw new Error();
          s[k] = v;
        } else {
          if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error();
          s[k] = v.toLowerCase();
        }
      });
      var name = typeof obj.n === 'string' ? obj.n.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) : '';
      return { name: name, settings: s };
    }).catch(function () {
      throw new Error('Die ID ist beschädigt oder unvollständig kopiert.');
    });
  }

  function setupUpload() {
    var idEl = $('up-id'), nameEl = $('up-name'), descEl = $('up-desc');
    var send = $('up-send'), msg = $('up-msg'), cv = $('up-preview');

    function clearPreview() {
      cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    }
    function refreshButton() {
      send.disabled = !(pendingSettings && nameEl.value.trim());
    }

    idEl.addEventListener('input', function () {
      var v = idEl.value.trim();
      pendingSettings = null;
      clearPreview();
      msg.textContent = '';
      if (!v) { refreshButton(); return; }
      parseId(v).then(function (r) {
        if (idEl.value.trim() !== v) return;
        pendingSettings = r.settings;
        if (!nameEl.value.trim() && r.name) nameEl.value = r.name;
        drawCrosshair(cv, r.settings);
        refreshButton();
      }, function (e) {
        msg.textContent = e.message;
        refreshButton();
      });
    });
    nameEl.addEventListener('input', refreshButton);

    send.addEventListener('click', function () {
      if (!pendingSettings) return;
      send.disabled = true;
      msg.textContent = 'Wird veröffentlicht ...';
      api('/api/crosshairs', {
        method: 'POST',
        body: { name: nameEl.value.trim(), description: descEl.value.trim(), settings: pendingSettings }
      }).then(function (d) {
        msg.textContent = 'Veröffentlicht! Deine ID: ' + d.id;
        idEl.value = ''; nameEl.value = ''; descEl.value = '';
        pendingSettings = null; clearPreview();
        load(true);
      }, function (e) {
        msg.textContent = e.message;
        refreshButton();
      });
    });
  }

  // ---------- Start ----------

  function applyFilterFromHash() {
    var u = (location.hash || '').match(/^#u=(\d{5,25})$/);
    filter.user = u ? u[1] : '';
    renderBanner();
    load(true);
  }

  var searchTimer = null;
  $('search').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      filter.q = $('search').value.trim();
      load(true);
    }, 300);
  });
  $('sort').addEventListener('change', function () {
    filter.sort = $('sort').value;
    load(true);
  });
  $('more').addEventListener('click', function () { load(false); });
  window.addEventListener('hashchange', applyFilterFromHash);

  setupUpload();
  readHash();
  loadMe().then(function () {
    renderAuth();
    renderUploadVisibility();
    renderBanner();
    load(true);
  });
})();
