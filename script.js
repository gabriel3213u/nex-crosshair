// Crosshair im Demo-Feld folgt der Maus, Farbe wählbar
(function () {
  var scope = document.getElementById('scope');
  var xh = document.getElementById('xh');
  function move(e) {
    var r = scope.getBoundingClientRect();
    xh.style.left = Math.max(0, Math.min(r.width, e.clientX - r.left)) + 'px';
    xh.style.top = Math.max(0, Math.min(r.height, e.clientY - r.top)) + 'px';
  }
  scope.addEventListener('pointermove', move);
  scope.addEventListener('pointerdown', move);

  var btns = document.querySelectorAll('.swatches button');
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      btns.forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      xh.style.setProperty('--c', getComputedStyle(b).getPropertyValue('--c').trim());
    });
  });
})();

// Download-Knopf: direkter Link zur neuesten Version, sonst Release-Seite
(function () {
  var btn = document.getElementById('download');
  var info = document.getElementById('dl-info');
  fetch('https://api.github.com/repos/gabriel3213u/nex-crosshair/releases/latest')
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (rel) {
      var asset = (rel.assets || []).find(function (a) { return /\.exe$/i.test(a.name); });
      if (!asset) return;
      btn.href = asset.browser_download_url;
      var mb = Math.round(asset.size / 1048576);
      info.textContent = 'Version ' + String(rel.tag_name || '').replace(/^v/, '') + ', ' + mb + ' MB. Kostenlos, Windows 10 und 11.';
    })
    .catch(function () {});
})();
