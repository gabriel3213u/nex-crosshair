(function () {
  'use strict';

  var API = 'https://crosshair-community.gabrielvalenti37.workers.dev';
  var $ = function (id) { return document.getElementById(id); };
  var currentTab = 'reports';

  function getToken() {
    try { return localStorage.getItem('nex_token') || ''; } catch (e) { return ''; }
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

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function safeAvatar(url) {
    return typeof url === 'string' && url.indexOf('https://cdn.discordapp.com/') === 0 ? url : '';
  }

  function when(ms) {
    try { return new Date(ms).toLocaleString('de-DE'); } catch (e) { return ''; }
  }

  function button(label, cls, onClick) {
    var b = el('button', 'btn-s small-btn ' + (cls || ''), label);
    b.type = 'button';
    b.addEventListener('click', function () {
      b.disabled = true;
      onClick().then(null, function (e) {
        notify(e.message, 'err');
        b.disabled = false;
      });
    });
    return b;
  }

  function after(msg) {
    notify(msg, 'ok');
    return loadTab();
  }

  // ---------- Karten ----------

  function crosshairCard(it, hiddenLook) {
    var card = el('article', 'card' + (hiddenLook ? ' hiddenbadge' : ''));

    var thumb = el('div', 'thumb');
    var cv = document.createElement('canvas');
    cv.width = 160; cv.height = 160;
    thumb.appendChild(cv);
    card.appendChild(thumb);
    try { if (it.settings) drawCrosshair(cv, it.settings); } catch (e) {}

    var body = el('div', 'body');
    body.appendChild(el('h3', '', it.name));

    var by = el('div', 'by');
    by.appendChild(el('span', '', 'von ' + it.owner.name + ' (' + it.owner.id + ')'));
    body.appendChild(by);

    if (it.description) body.appendChild(el('p', 'desc', it.description));

    var idrow = el('div', 'idrow');
    idrow.appendChild(el('code', '', it.id));
    body.appendChild(idrow);
    body.appendChild(el('div', 'meta', it.copies + ' Mal kopiert · ' + (it.hidden ? 'versteckt' : 'sichtbar')));

    card.appendChild(body);
    return { card: card, body: body };
  }

  function actionsFor(it, extra) {
    var a = el('div', 'actions');
    extra.forEach(function (b) { a.appendChild(b); });

    a.appendChild(button('Löschen', 'danger', function () {
      if (!confirm('„' + it.name + '“ endgültig löschen?')) return Promise.resolve();
      return api('/api/crosshairs/' + it.id, { method: 'DELETE' }).then(function () { return after('Gelöscht.'); });
    }));
    a.appendChild(button('Nutzer sperren', 'danger', function () {
      if (!confirm(it.owner.name + ' sperren? Alle seine Crosshairs verschwinden aus der Galerie.')) return Promise.resolve();
      return api('/api/admin/users/' + it.owner.id + '/ban', { method: 'POST', body: { banned: true } })
        .then(function () { return after(it.owner.name + ' ist gesperrt.'); });
    }));
    return a;
  }

  // ---------- Tabs ----------

  function showEmpty(text) {
    var e = $('empty');
    e.textContent = text;
    e.hidden = false;
  }

  function loadReports() {
    return api('/api/admin/reports').then(function (d) {
      if (!d.items.length) { showEmpty('Keine offenen Meldungen.'); return; }
      d.items.forEach(function (r) {
        var it = r.crosshair;
        var parts = crosshairCard(it, it.hidden);

        var reason = el('div', 'reason', r.reason);
        reason.appendChild(el('small', '', 'Gemeldet am ' + when(r.reportedAt)));
        parts.body.insertBefore(reason, parts.body.firstChild.nextSibling);

        var extra = [
          button('Meldung erledigt', '', function () {
            return api('/api/admin/reports/' + r.reportId + '/resolve', { method: 'POST' })
              .then(function () { return after('Meldung abgehakt.'); });
          })
        ];
        if (!it.hidden) {
          extra.push(button('Verstecken', '', function () {
            return api('/api/admin/crosshairs/' + it.id + '/hide', { method: 'POST', body: { hidden: true } })
              .then(function () { return after('Versteckt.'); });
          }));
        }
        parts.body.appendChild(actionsFor(it, extra));
        $('list').appendChild(parts.card);
      });
    });
  }

  function loadHidden() {
    return api('/api/admin/hidden').then(function (d) {
      if (!d.items.length) { showEmpty('Nichts versteckt.'); return; }
      d.items.forEach(function (it) {
        var parts = crosshairCard(it, true);
        var extra = [
          button('Einblenden', 'primary', function () {
            return api('/api/admin/crosshairs/' + it.id + '/hide', { method: 'POST', body: { hidden: false } })
              .then(function () { return after('Wieder sichtbar. Offene Meldungen wurden abgehakt.'); });
          })
        ];
        parts.body.appendChild(actionsFor(it, extra));
        $('list').appendChild(parts.card);
      });
    });
  }

  function loadBanned() {
    return api('/api/admin/banned').then(function (d) {
      if (!d.items.length) { showEmpty('Niemand ist gesperrt.'); return; }
      d.items.forEach(function (u) {
        var card = el('article', 'card user-card');
        var row = el('div', 'row');
        var av = safeAvatar(u.avatarUrl);
        if (av) {
          var im = el('img');
          im.src = av; im.alt = ''; im.width = 36; im.height = 36;
          row.appendChild(im);
        }
        row.appendChild(el('strong', '', u.name));
        card.appendChild(row);
        card.appendChild(el('div', 'meta', 'Discord-ID ' + u.id + ' · seit ' + when(u.createdAt) + ' bekannt'));
        card.appendChild(button('Entsperren', 'primary', function () {
          return api('/api/admin/users/' + u.id + '/ban', { method: 'POST', body: { banned: false } })
            .then(function () { return after(u.name + ' ist entsperrt.'); });
        }));
        $('list').appendChild(card);
      });
    });
  }

  function loadTab() {
    $('list').textContent = '';
    $('empty').hidden = true;
    var fn = currentTab === 'hidden' ? loadHidden : currentTab === 'banned' ? loadBanned : loadReports;
    return fn().then(null, function (e) { notify(e.message, 'err'); });
  }

  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('on'); });
      t.classList.add('on');
      currentTab = t.getAttribute('data-tab');
      notify('');
      loadTab();
    });
  });

  // ---------- Start ----------

  function deny(text) {
    $('who').textContent = text;
    $('panel').hidden = true;
  }

  if (!getToken()) {
    deny('Du bist nicht angemeldet. Melde dich zuerst auf der Community-Seite an.');
    return;
  }

  api('/api/me').then(function (me) {
    if (!me.isAdmin) {
      deny('Kein Zugriff. Dieser Bereich ist nur für den Admin.');
      return;
    }
    $('who').textContent = 'Angemeldet als ' + me.name + ' (Discord-ID ' + me.id + ') · Admin';
    $('panel').hidden = false;
    loadTab();
  }, function (e) {
    deny('Anmeldung nicht gültig. Melde dich auf der Community-Seite neu an. (' + e.message + ')');
  });
})();
