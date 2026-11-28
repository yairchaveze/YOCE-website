// Reel de YoCellTherapy Laboratorio (16 s): glóbulos rojos forman la célula, nace la Y, se analizan tres muestras.
(function () {
  var cv = document.getElementById('reel'); if (!cv) return;
  var ctx = cv.getContext('2d'), tc = document.getElementById('tc'), btn = document.getElementById('reelBtn'), ico = document.getElementById('reelIco');
  var L = 16, W = 0, H = 0, S = 0;
  function size() { var r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height; cv.width = Math.round(W * d); cv.height = Math.round(H * d); ctx.setTransform(d, 0, 0, d, 0, 0); S = Math.min(W, H); }
  var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  var N = 64, P = []; for (var i = 0; i < N; i++) P.push({ sx: rnd(), sy: rnd(), dx: rnd() * 2 - 1, dy: rnd() * 2 - 1, j: rnd() * 6.283, s: .8 + rnd() * .5, a: i / N * Math.PI * 2 + (rnd() - .5) * .04, tilt: rnd() * 3.14 });
  var clamp = function (x, a, b) { return Math.max(a == null ? 0 : a, Math.min(b == null ? 1 : b, x)); };
  var seg = function (t, a, b) { return clamp((t - a) / (b - a)); };
  var eio = function (p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
  var eo = function (p) { return 1 - Math.pow(1 - p, 3); };
  var css = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); };
  var rgba = function (hex, a) { var n = parseInt(hex.replace('#', ''), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };
  var WORDS = ['Biometría hemática', 'Química sanguínea', 'Examen de orina', 'Resultados con folio', 'San Buenaventura'];
  var SAMPLES = [
    { t0: 6.0, a: -2.5, code: 'BH', cap: '#9B8CF2', fill: '#B0283C' },
    { t0: 8.1, a: 0.32, code: 'QS', cap: '#E8C35A', fill: '#E9D79A' },
    { t0: 10.2, a: 2.82, code: 'EGO', cap: '#F4ECEB', fill: '#EFD88A' }
  ];
  var BURST = []; (function () { var bs = 29, br = function () { bs = (bs * 16807) % 2147483647; return (bs - 1) / 2147483646; };
    var cols = ['#FFFFFF', '#F4ECEB', '#E0574A', '#E0574A', '#F6B3A6', '#7F9CFF'];
    for (var i = 0; i < 110; i++) { var ling = br() < .22; BURST.push({ a: br() * 6.283, r0: 1.06 + br() * .07, travel: (ling ? .05 : .09) + br() * .22, len: .015 + br() * .045, w: .004 + br() * .005, delay: br() * .12, dur: ling ? 2.2 + br() * .8 : .9 + br() * .6, ling: ling, col: cols[Math.floor(br() * cols.length)] }); } })();

  function rbc(x, y, r, tilt, alpha, deep, acc) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(1, .82);
    var g = ctx.createRadialGradient(0, 0, r * .1, 0, 0, r);
    g.addColorStop(0, rgba(acc, .55 * alpha)); g.addColorStop(.45, rgba(deep, .75 * alpha)); g.addColorStop(1, rgba(deep, alpha));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill(); ctx.restore();
  }
  function tube(x, y, h, cap, fill, a, ink) {
    var w = h * .32;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = rgba(fill, .9); ctx.beginPath(); ctx.moveTo(x - w / 2, y - h * .1); ctx.lineTo(x - w / 2, y + h * .5 - w / 2); ctx.arc(x, y + h * .5 - w / 2, w / 2, Math.PI, 0, true); ctx.lineTo(x + w / 2, y - h * .1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba(ink, .9); ctx.lineWidth = S * .004; ctx.beginPath(); ctx.moveTo(x - w / 2, y - h * .5); ctx.lineTo(x - w / 2, y + h * .5 - w / 2); ctx.arc(x, y + h * .5 - w / 2, w / 2, Math.PI, 0, true); ctx.lineTo(x + w / 2, y - h * .5); ctx.stroke();
    ctx.fillStyle = cap; ctx.fillRect(x - w / 2 - S * .006, y - h * .5 - h * .16, w + S * .012, h * .2);
    ctx.restore();
  }
  function draw(t, still) {
    var bg = css('--reel-bg'), ink = css('--reel-ink'), acc = css('--reel-accent'), deep = css('--reel-deep'), pop = css('--reel-pop');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    var cx = W / 2, cy = H * .4, R = S * .23;
    // Retícula de cámara de Neubauer
    var gs = S / 12, k, x, y; ctx.lineWidth = 1;
    for (k = 0, x = (W % gs) / 2; x <= W; x += gs, k++) { ctx.strokeStyle = rgba(ink, k % 4 === 0 ? .08 : .035); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (k = 0, y = (H % gs) / 2; y <= H; y += gs, k++) { ctx.strokeStyle = rgba(ink, k % 4 === 0 ? .08 : .035); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    var fin = 1 - seg(t, 13.4, 14.4), asm = eio(seg(t, .2, 2.4)), ringP = seg(t, 1.9, 2.9), dis = eio(seg(t, 13.6, 15.6));
    // Glóbulos rojos que se reúnen y luego se dispersan
    var pa = 0;
    if (t < 2.9) pa = (.35 + .65 * asm) * (1 - ringP);
    else if (t >= 13.4) pa = seg(t, 13.4, 13.9) * (1 - seg(t, 15, 15.9));
    if (pa > 0) P.forEach(function (p) {
      var rx = cx + Math.cos(p.a) * R, ry = cy + Math.sin(p.a) * R, px, py;
      if (t < 2.9) { var w = (1 - asm) * S * .03; px = p.sx * W + (rx - p.sx * W) * asm + Math.sin(t * 1.4 + p.j) * w; py = p.sy * H + (ry - p.sy * H) * asm + Math.cos(t * 1.1 + p.j) * w; }
      else { px = rx + p.dx * S * .6 * dis; py = ry + p.dy * S * .6 * dis; }
      rbc(px, py, S * .016 * p.s * (t < 2.9 ? 1 - asm * .45 : 1), p.tilt + t * .3, pa, deep, acc);
    });
    var ACT = 4.3, ka = t - ACT;
    var snap = ka < -.25 ? 0 : ka < 0 ? (ka + .25) / .25 : ka < .65 ? 1 : Math.max(0, 1 - (ka - .65) / 1.4);
    var wob = ringP >= 1 && !still ? S * .007 * (1 - snap) : 0;
    // Membrana
    if (ringP > 0 && fin > 0) {
      ctx.strokeStyle = rgba(acc, fin); ctx.lineWidth = S * .011; ctx.lineCap = 'round'; ctx.beginPath();
      if (wob > 0) { for (var i = 0; i <= 96; i++) { var a = i / 96 * 6.283, rr = R + wob * (.5 * Math.sin(3 * a + t * .9) + .3 * Math.sin(5 * a - t * 1.3) + .2 * Math.sin(2 * a + t * .6)); var X = cx + Math.cos(a) * rr, Y = cy + Math.sin(a) * rr; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.closePath(); }
      else ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + 6.283 * ringP);
      ctx.stroke();
    }
    var dp = eo(seg(t, 2.4, 3.4));
    if (dp > 0 && fin > 0) { ctx.fillStyle = rgba(acc, .17 * fin); ctx.beginPath(); ctx.arc(cx, cy, R * .64 * dp, 0, 6.283); ctx.fill(); }
    // La Y
    if (t >= 3 && fin > 0) {
      var wgt = eo(seg(t, 3, 3.35)), gp = seg(t, 3.35, 4.3), g = gp <= 0 ? 0 : 1 + 2.6 * Math.pow(gp - 1, 3) + 1.6 * Math.pow(gp - 1, 2), bx = cx, by = cy + R * .03;
      ctx.strokeStyle = rgba(ink, fin); ctx.lineWidth = Math.max(.1, S * .024 * wgt); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      ctx.moveTo(bx + (cx - R * .36 - bx) * g, by + (cy - R * .38 - by) * g); ctx.lineTo(bx, by); ctx.lineTo(bx + (cx + R * .36 - bx) * g, by + (cy - R * .38 - by) * g);
      ctx.moveTo(bx, by); ctx.lineTo(bx, by + (cy + R * .45 - by) * g); ctx.stroke();
    }
    // Activación: destello y estallido
    if (!still && ka >= 0 && ka < 3.2 && fin > 0) {
      var ph = ka / 1.6;
      if (ph < 1) { ctx.strokeStyle = rgba(acc, .55 * (1 - ph)); ctx.lineWidth = S * .006; ctx.beginPath(); ctx.arc(cx, cy, R * (.4 + ph * 1.25), 0, 6.283); ctx.stroke(); }
      var f = ka < .06 ? ka / .06 : ka < .5 ? 1 - (ka - .06) / .44 : 0;
      if (f > 0) { var fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.75); fg.addColorStop(0, 'rgba(255,255,255,' + (.75 * f) + ')'); fg.addColorStop(.45, rgba('#F7F2F1', .6 * f)); fg.addColorStop(1, rgba('#F7F2F1', 0)); ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H); }
      ctx.lineCap = 'round';
      BURST.forEach(function (b) {
        var q = (ka - b.delay) / b.dur; if (q < 0 || q > 1) return;
        var e = 1 - Math.pow(1 - q, b.ling ? 2 : 4), rr = R * b.r0 + S * b.travel * e, len = S * b.len * (1 - q) * (b.ling ? .35 : 1) + (b.ling ? S * .004 : 0), c = Math.cos(b.a), sn = Math.sin(b.a);
        ctx.strokeStyle = rgba(b.col, Math.min(1, q * 10) * (1 - Math.pow(q, b.ling ? 1.5 : 2))); ctx.lineWidth = S * b.w;
        ctx.beginPath(); ctx.moveTo(cx + c * rr, cy + sn * rr); ctx.lineTo(cx + c * (rr + len), cy + sn * (rr + len)); ctx.stroke();
      });
    }
    // Punto satélite azul
    var sp = eo(seg(t, 3.8, 5.1));
    if (t > 3.8 && fin > 0) {
      var ta = Math.atan2(-.48, .77), ang = ta - (1 - sp) * Math.PI * 3, rad = R * .91 + (1 - sp) * R * .85;
      var sx = cx + Math.cos(ang) * rad, sy = cy + Math.sin(ang) * rad, sa = seg(t, 3.8, 4.1) * fin;
      var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, S * .06); sg.addColorStop(0, rgba(pop, .45 * sa)); sg.addColorStop(1, rgba(pop, 0));
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, S * .06, 0, 6.283); ctx.fill();
      ctx.fillStyle = rgba(pop, sa); ctx.beginPath(); ctx.arc(sx, sy, S * .017, 0, 6.283); ctx.fill();
    }
    // Barrido del analizador
    var scanOn = seg(t, 5.6, 6) * (1 - seg(t, 12.6, 13.2));
    if (scanOn > 0 && fin > 0 && !still) {
      var sy2 = cy + Math.sin(t * 1.6) * R * .9, half = Math.sqrt(Math.max(0, R * R - (sy2 - cy) * (sy2 - cy)));
      var lg = ctx.createLinearGradient(cx - half, 0, cx + half, 0); lg.addColorStop(0, rgba(acc, 0)); lg.addColorStop(.5, rgba(acc, .55 * scanOn)); lg.addColorStop(1, rgba(acc, 0));
      ctx.strokeStyle = lg; ctx.lineWidth = S * .004; ctx.beginPath(); ctx.moveTo(cx - half, sy2); ctx.lineTo(cx + half, sy2); ctx.stroke();
    }
    // Muestras analizadas: llega el tubo, se conecta con la célula y queda el resultado
    SAMPLES.forEach(function (sm) {
      var lt = t - sm.t0; if (lt < 0 || t > 13.4 + .6) return;
      var app = eo(clamp(lt / 1.1)), hold = fin, dist = R + S * .17 + (1 - app) * S * .25;
      var tx = cx + Math.cos(sm.a) * dist, ty = cy + Math.sin(sm.a) * dist, a = app * hold;
      if (still) { a = 1; tx = cx + Math.cos(sm.a) * (R + S * .17); ty = cy + Math.sin(sm.a) * (R + S * .17); }
      var link = seg(lt, 1, 1.5) * (1 - seg(lt, 1.9, 2.3));
      if (link > 0 && !still) {
        var pu = .5 + .5 * Math.sin(lt * 16); ctx.strokeStyle = rgba(acc, .7 * link * pu); ctx.lineWidth = S * .006; ctx.setLineDash([S * .012, S * .012]);
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(sm.a) * (R + S * .02), cy + Math.sin(sm.a) * (R + S * .02)); ctx.lineTo(tx - Math.cos(sm.a) * S * .05, ty - Math.sin(sm.a) * S * .05); ctx.stroke(); ctx.setLineDash([]);
      }
      tube(tx, ty, S * .11, sm.cap, sm.fill, a, ink);
      var done = still ? 1 : eo(seg(lt, 1.8, 2.3));
      if (done > 0) {
        var lx = tx, ly = ty + S * .1;
        ctx.font = '600 ' + (S * .028) + 'px "Bricolage Grotesque","Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = rgba(ink, done * a); ctx.fillText(sm.code, lx - S * .018, ly);
        ctx.strokeStyle = rgba(acc, done * a); ctx.lineWidth = S * .006; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        var ck = lx + ctx.measureText(sm.code).width / 2 - S * .004;
        ctx.beginPath(); ctx.moveTo(ck, ly - S * .01); ctx.lineTo(ck + S * .008, ly - S * .002); ctx.lineTo(ck + S * .024 * done, ly - S * .022 * done); ctx.stroke();
      }
    });
    // Marca
    var wp = eo(seg(t, 4.6, 5.6));
    if (wp > 0 && fin > 0) {
      var fs = S * .078, wy = cy + R + S * .25 + (1 - wp) * S * .03;
      var f1 = '300 ' + fs + 'px "Bricolage Grotesque","Helvetica Neue",Arial,sans-serif', f2 = '600 ' + fs + 'px "Bricolage Grotesque","Helvetica Neue",Arial,sans-serif';
      ctx.textBaseline = 'alphabetic'; ctx.font = f1; var w1 = ctx.measureText('Yo').width, w3 = ctx.measureText('Therapy').width; ctx.font = f2; var w2 = ctx.measureText('Cell').width;
      var wx = cx - (w1 + w2 + w3) / 2; ctx.textAlign = 'left';
      ctx.font = f1; ctx.fillStyle = rgba(ink, wp * fin); ctx.fillText('Yo', wx, wy); wx += w1;
      ctx.font = f2; ctx.fillStyle = rgba(acc, wp * fin); ctx.fillText('Cell', wx, wy); wx += w2;
      ctx.font = f1; ctx.fillStyle = rgba(ink, wp * fin); ctx.fillText('Therapy', wx, wy);
      ctx.font = '600 ' + (S * .026) + 'px "Bricolage Grotesque","Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = rgba(acc, wp * fin);
      if ('letterSpacing' in ctx) ctx.letterSpacing = (S * .012) + 'px';
      ctx.fillText('LABORATORIO', cx + S * .006, wy + S * .05);
      var word, wa; if (still) { word = WORDS[0]; wa = 1; } else { var kk = Math.floor(clamp((t - 5.8) / 1.52, 0, 4.999)), lt2 = (t - 5.8) - kk * 1.52; word = WORDS[kk]; wa = t < 5.8 ? 0 : Math.min(seg(lt2, 0, .3), 1 - seg(lt2, 1.2, 1.52)); }
      if (t > 13) wa *= fin;
      if ('letterSpacing' in ctx) ctx.letterSpacing = (S * .003) + 'px';
      ctx.font = '400 ' + (S * .03) + 'px "Bricolage Grotesque","Helvetica Neue",Arial,sans-serif'; ctx.fillStyle = rgba(ink, .72 * wa);
      ctx.fillText(word.toUpperCase(), cx, wy + S * .11);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    if (tc) tc.textContent = '00:' + String(Math.floor(t)).padStart(2, '0') + ' / 00:16';
  }
  size();
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var playing = !reduce, start = performance.now(), pausedAt = reduce ? 11.8 : 0, visible = true, raf = 0;
  var now = function () { return playing ? ((performance.now() - start) / 1000) % L : pausedAt; };
  function loop() { draw(now(), false); if (playing && visible) raf = requestAnimationFrame(loop); }
  function setIcon() { ico.innerHTML = playing ? '<rect x="2" y="1.5" width="2.6" height="9"/><rect x="7.4" y="1.5" width="2.6" height="9"/>' : '<path d="M3 1.5v9l7.5-4.5z"/>'; btn.setAttribute('aria-label', playing ? 'Pausar animación' : 'Reproducir animación'); }
  btn.addEventListener('click', function () { if (playing) { pausedAt = now(); playing = false; cancelAnimationFrame(raf); } else { start = performance.now() - pausedAt * 1000; playing = true; loop(); } setIcon(); });
  setIcon();
  if (reduce) draw(pausedAt, true); else loop();
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && playing) { cancelAnimationFrame(raf); loop(); } }).observe(cv);
  addEventListener('resize', function () { size(); draw(now(), reduce); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!playing) draw(now(), reduce); });
  window.__labReelDraw = function (t) { draw(t, false); };
})();
