// Administración: facturas (por timbrar y timbradas) y resumen mensual para el SAT (RESICO).
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var r2 = function (n) { return Math.round((+n + Number.EPSILON) * 100) / 100; };
  var money = function (n) { return '$' + (+n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  // Tasas mensuales de ISR del RESICO para personas físicas (art. 113-E LISR), sobre ingresos cobrados sin IVA.
  var RESICO = [[25000, 0.01], [50000, 0.011], [83333.33, 0.015], [208333.33, 0.02], [3500000, 0.025]];
  var localIso = function () { var d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19); };
  var facturas = [], gastos = [], docs = [], emisor = {}, loaded = false;
  var MI_RFC = 'CAEY941215T23';
  var now = new Date(), ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  $('fMonth').value = ym; $('sMonth').value = ym; $('gMonth').value = ym;

  function call(p, b) {
    return window.YCT.call(p, b).then(function (r) { if (r.status === 401) { window.YCT.expired(); throw new Error('sesion'); } return r; });
  }
  function load() {
    return Promise.all([call('/adm/fact/list'), call('/adm/gasto/list'), call('/adm/doc/list'), call('/adm/config')]).then(function (rs) {
      facturas = rs[0].body.items || []; gastos = rs[1].body.items || []; docs = rs[2].body.items || []; emisor = rs[3].body.emisor || {};
      loaded = true; renderList(); renderGas(); renderSum(); fillRfcs(); renderDocs(); renderFis();
    });
  }
  document.addEventListener('yct:open', function (e) { if (e.detail === 'administracion' && !loaded) load().catch(function () {}); });

  // Pestañas
  var tabs = ['fact', 'new', 'gas', 'sum', 'doc'];
  tabs.forEach(function (t) {
    $('tb-' + t).addEventListener('click', function () {
      tabs.forEach(function (o) { $('tb-' + o).setAttribute('aria-selected', o === t); $('p-' + o).hidden = o !== t; });
    });
  });

  // Lista
  function monthOf(f) { return (f.fecha || '').slice(0, 7); }
  function renderList() {
    var m = $('fMonth').value;
    var rows = facturas.filter(function (f) { return monthOf(f) === m; }).sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); });
    $('fEmpty').hidden = rows.length > 0;
    $('fRows').innerHTML = rows.map(function (f) {
      var st = f.estado === 'timbrada' ? '<span class="pill ok">Timbrada</span>' : '<span class="pill">Por timbrar</span>';
      var cob = '<label class="cob"><input type="checkbox" data-cob="' + esc(f.id) + '"' + (f.cobrada ? ' checked' : '') + '> ' + (f.cobrada ? 'Cobrada' + (f.fechaCobro ? ' ' + esc(f.fechaCobro.split('-').reverse().join('/')) : '') : 'Por cobrar') + '</label>';
      var acts = (f.tieneXml ? '<button type="button" data-xml="' + esc(f.id) + '">XML</button>' : '') + '<button type="button" data-copy="' + esc(f.id) + '">Repetir</button>' + '<button type="button" data-del="' + esc(f.id) + '">Eliminar</button>';
      return '<tr><td>' + esc((f.fecha || '').slice(0, 10).split('-').reverse().join('/')) + '</td><td>' + esc((f.serie || '') + (f.folio || '—')) + '</td><td><b>' + esc(f.receptorNombre) + '</b><small>' + esc(f.descripcion || '') + '</small></td><td class="num">' + money(f.total) + '</td><td>' + st + '</td><td>' + cob + '</td><td class="acts">' + acts + '</td></tr>';
    }).join('');
  }
  $('fMonth').addEventListener('change', renderList);
  $('fRows').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.xml) {
      call('/adm/fact/xml', { id: b.dataset.xml }).then(function (r) {
        if (r.status !== 200) return;
        var f = facturas.find(function (x) { return x.id === b.dataset.xml; }) || {};
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([r.body.xml], { type: 'text/xml' }));
        a.download = (f.uuid || 'factura') + '.xml'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      });
    } else if (b.dataset.copy) {
      var f = facturas.find(function (x) { return x.id === b.dataset.copy; }); fillForm(f, true); $('tb-new').click();
    } else if (b.dataset.del) {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Seguro?'; b.classList.add('warn'); return; }
      call('/adm/fact/delete', { id: b.dataset.del }).then(function () { facturas = facturas.filter(function (x) { return x.id !== b.dataset.del; }); renderList(); renderSum(); });
    }
  });
  $('fRows').addEventListener('change', function (e) {
    var c = e.target.closest('input[data-cob]'); if (!c) return;
    var f = facturas.find(function (x) { return x.id === c.dataset.cob; }); if (!f) return;
    f.cobrada = c.checked; f.fechaCobro = c.checked ? localIso().slice(0, 10) : '';
    if (c.checked && monthOf(f) === $('fMonth').value && f.metodoPago === 'PUE') f.fechaCobro = (f.fecha || '').slice(0, 10);
    call('/adm/fact/save', { item: f }).then(function () { renderList(); renderSum(); });
  });

  // Subir XML timbrado (CFDI 4.0)
  function attr(el, n) { return el ? el.getAttribute(n) || '' : ''; }
  function parseCfdi(text) {
    var d = new DOMParser().parseFromString(text, 'text/xml');
    var one = function (tag) { return d.getElementsByTagNameNS('*', tag)[0]; };
    var c = one('Comprobante'), em = one('Emisor'), re = one('Receptor'), tfd = one('TimbreFiscalDigital');
    if (!c || !tfd) throw new Error('No parece un CFDI timbrado.');
    var conceptos = [].slice.call(d.getElementsByTagNameNS('*', 'Concepto'));
    var sumTax = function (tag, imp) { return [].slice.call(d.getElementsByTagNameNS('*', tag)).filter(function (t) { return attr(t, 'Impuesto') === imp && t.parentNode.parentNode.parentNode.localName === 'Concepto'; }).reduce(function (s, t) { return s + (+attr(t, 'Importe') || 0); }, 0); };
    var f = {
      estado: 'timbrada', serie: attr(c, 'Serie'), folio: attr(c, 'Folio'), uuid: attr(tfd, 'UUID').toUpperCase(), fecha: attr(c, 'Fecha'),
      receptorRfc: attr(re, 'Rfc'), receptorNombre: attr(re, 'Nombre'), receptorCp: attr(re, 'DomicilioFiscalReceptor'), receptorRegimen: attr(re, 'RegimenFiscalReceptor'), usoCfdi: attr(re, 'UsoCFDI'),
      descripcion: conceptos.map(function (k) { return attr(k, 'Descripcion'); }).join(' | '), claveProdServ: attr(conceptos[0], 'ClaveProdServ'),
      cantidad: +attr(conceptos[0], 'Cantidad') || 1, valorUnitario: +attr(conceptos[0], 'ValorUnitario') || 0,
      subtotal: +attr(c, 'SubTotal') || 0, iva: r2(sumTax('Traslado', '002')), isrRet: r2(sumTax('Retencion', '001')), ivaRet: r2(sumTax('Retencion', '002')), total: +attr(c, 'Total') || 0,
      formaPago: attr(c, 'FormaPago'), metodoPago: attr(c, 'MetodoPago'), emisorRfc: attr(em, 'Rfc'), emisorNombre: attr(em, 'Nombre'), tipo: attr(c, 'TipoDeComprobante')
    };
    f.cobrada = f.metodoPago === 'PUE'; f.fechaCobro = f.cobrada ? f.fecha.slice(0, 10) : '';
    return f;
  }
  $('fXml').addEventListener('change', function (e) {
    var files = [].slice.call(e.target.files), msg = $('fMsg'), done = 0, errs = [];
    if (!files.length) return;
    msg.textContent = 'Leyendo...';
    var next = function () {
      if (!files.length) { msg.textContent = done + ' factura(s) registradas.' + (errs.length ? ' ' + errs.join(' ') : ''); e.target.value = ''; renderList(); renderSum(); fillRfcs(); return; }
      var file = files.shift();
      file.text().then(function (t) {
        var f;
        try { f = parseCfdi(t); } catch (err) { errs.push(file.name + ': ' + err.message); return next(); }
        if (f.tipo && f.tipo !== 'I') { errs.push(file.name + ': no es factura de ingreso.'); return next(); }
        var same = facturas.find(function (x) { return x.uuid && x.uuid === f.uuid; })
          || facturas.find(function (x) { return x.estado !== 'timbrada' && x.receptorRfc === f.receptorRfc && Math.abs((+x.total || 0) - f.total) < 0.01; });
        if (same) { f.id = same.id; if (same.cobrada && !f.cobrada) { f.cobrada = true; f.fechaCobro = same.fechaCobro; } }
        call('/adm/fact/save', { item: f, xml: t }).then(function (r) {
          var saved = r.body.item, i = facturas.findIndex(function (x) { return x.id === saved.id; });
          if (i >= 0) facturas[i] = saved; else facturas.push(saved);
          if (monthOf(saved) !== $('fMonth').value) $('fMonth').value = monthOf(saved);
          done++; next();
        }).catch(function () { errs.push(file.name + ': no se pudo guardar.'); next(); });
      });
    };
    next();
  });

  // Nueva factura
  var nf = $('nf');
  function calc() {
    var sub = r2((+nf.cantidad.value || 0) * (+nf.valorUnitario.value || 0));
    var iva = r2(sub * 0.16), ret = nf.retIsr.checked ? r2(sub * 0.0125) : 0, tot = r2(sub + iva - ret);
    $('tSub').textContent = money(sub); $('tIva').textContent = money(iva); $('tRet').textContent = money(ret); $('tTot').textContent = money(tot);
    return { subtotal: sub, iva: iva, isrRet: ret, ivaRet: 0, total: tot };
  }
  nf.addEventListener('input', function (e) {
    if (e.target.name === 'receptorRfc') {
      var v = e.target.value.toUpperCase().trim(); e.target.value = v;
      nf.retIsr.checked = v.length === 12;
      if (v.length >= 12) { var k = facturas.find(function (x) { return x.receptorRfc === v; }); if (k) fillForm(k, false); }
    }
    calc();
  });
  nf.addEventListener('change', calc);
  function fillForm(f, all) {
    ['receptorRfc', 'receptorNombre', 'receptorCp', 'receptorRegimen', 'usoCfdi'].forEach(function (k) { if (f[k]) nf[k].value = f[k]; });
    if (all) ['descripcion', 'claveProdServ', 'cantidad', 'valorUnitario', 'formaPago', 'metodoPago'].forEach(function (k) { if (f[k] != null && f[k] !== '') nf[k].value = f[k]; });
    nf.retIsr.checked = (f.receptorRfc || '').length === 12;
    calc();
  }
  function fillRfcs() {
    var seen = {};
    $('rfcs').innerHTML = facturas.filter(function (f) { if (!f.receptorRfc || seen[f.receptorRfc]) return false; seen[f.receptorRfc] = 1; return true; })
      .map(function (f) { return '<option value="' + esc(f.receptorRfc) + '">' + esc(f.receptorNombre) + '</option>'; }).join('');
  }
  nf.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('nfMsg'), rfc = nf.receptorRfc.value.trim();
    if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) { msg.textContent = 'Revisa el RFC del cliente.'; nf.receptorRfc.focus(); return; }
    if (!nf.receptorNombre.value.trim() || !/^\d{5}$/.test(nf.receptorCp.value) || !nf.descripcion.value.trim() || !(+nf.valorUnitario.value > 0)) { msg.textContent = 'Completa nombre, código postal, descripción y valor unitario.'; return; }
    var f = Object.assign({
      estado: 'por_timbrar', fecha: localIso(),
      receptorRfc: rfc, receptorNombre: nf.receptorNombre.value.trim().toUpperCase(), receptorCp: nf.receptorCp.value, receptorRegimen: nf.receptorRegimen.value, usoCfdi: nf.usoCfdi.value,
      descripcion: nf.descripcion.value.trim(), claveProdServ: nf.claveProdServ.value, cantidad: +nf.cantidad.value || 1, valorUnitario: +nf.valorUnitario.value,
      formaPago: nf.formaPago.value, metodoPago: nf.metodoPago.value, cobrada: false, fechaCobro: ''
    }, calc());
    msg.textContent = 'Guardando...';
    call('/adm/fact/save', { item: f }).then(function (r) {
      facturas.push(r.body.item); fillRfcs();
      $('fMonth').value = monthOf(r.body.item); renderList(); renderSum();
      msg.textContent = 'Guardada como "Por timbrar". Ahora timbra en el SAT y sube el XML.';
    }).catch(function () { msg.textContent = 'No se pudo guardar.'; });
  });
  calc();


  // Gastos
  function gMonthOf(g) { return (g.fecha || '').slice(0, 7); }
  var dmy = function (d) { return (d || '').slice(0, 10).split('-').reverse().join('/'); };
  function renderGas() {
    var m = $('gMonth').value;
    var rows = gastos.filter(function (g) { return gMonthOf(g) === m; }).sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); });
    $('gEmpty').hidden = rows.length > 0;
    var tot = rows.reduce(function (s, g) { return s + (+g.total || 0); }, 0), iva = rows.filter(function (g) { return g.tieneXml; }).reduce(function (s, g) { return s + (+g.iva || 0); }, 0);
    $('gTot').textContent = rows.length ? 'Gastos del mes: ' + money(tot) + ' · IVA acreditable (con XML): ' + money(iva) : '';
    var cats = ['Equipo de laboratorio', 'Material y reactivos', 'Servicios profesionales', 'Software y suscripciones', 'Otro'];
    $('gRows').innerHTML = rows.map(function (g) {
      var sel = '<select data-cat="' + esc(g.id) + '" aria-label="Categoría">' + cats.map(function (c) { return '<option' + (c === g.categoria ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select>';
      var comp = (g.tieneXml ? '<span class="pill ok">XML</span>' : '<span class="pill warn">Sin factura</span>') + (g.archivo ? ' <span class="pill">Foto/PDF</span>' : '');
      var acts = (g.tieneXml ? '<button type="button" data-gxml="' + esc(g.id) + '">XML</button>' : '') + (g.archivo ? '<button type="button" data-gfile="' + esc(g.id) + '">Ver</button>' : '') + '<button type="button" data-gdel="' + esc(g.id) + '">Eliminar</button>';
      return '<tr><td>' + esc(dmy(g.fecha)) + '</td><td><b>' + esc(g.emisorNombre || '—') + '</b><small>' + esc(g.concepto || '') + '</small></td><td>' + sel + '</td><td class="num">' + money(g.iva) + '</td><td class="num">' + money(g.total) + '</td><td>' + comp + '</td><td class="acts">' + acts + '</td></tr>';
    }).join('');
  }
  $('gMonth').addEventListener('change', renderGas);
  function saveGasto(item, extra) {
    return call('/adm/gasto/save', Object.assign({ item: item }, extra || {})).then(function (r) {
      if (r.status !== 200) throw new Error('save');
      var g = r.body.item, i = gastos.findIndex(function (x) { return x.id === g.id; });
      if (i >= 0) gastos[i] = g; else gastos.push(g);
      return g;
    });
  }
  $('gRows').addEventListener('change', function (e) {
    var c = e.target.closest('select[data-cat]'); if (!c) return;
    var g = gastos.find(function (x) { return x.id === c.dataset.cat; }); if (!g) return;
    g.categoria = c.value; saveGasto(g);
  });
  function download(name, blob) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  $('gRows').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.gxml) call('/adm/gasto/xml', { id: b.dataset.gxml }).then(function (r) { if (r.status === 200) download(b.dataset.gxml + '.xml', new Blob([r.body.xml], { type: 'text/xml' })); });
    else if (b.dataset.gfile) call('/adm/gasto/file', { id: b.dataset.gfile }).then(function (r) {
      if (r.status !== 200) return;
      var bin = atob(r.body.data), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      download(r.body.name, new Blob([arr], { type: r.body.type }));
    });
    else if (b.dataset.gdel) {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Seguro?'; b.classList.add('warn'); return; }
      call('/adm/gasto/delete', { id: b.dataset.gdel }).then(function () { gastos = gastos.filter(function (x) { return x.id !== b.dataset.gdel; }); renderGas(); renderSum(); });
    }
  });
  $('gXml').addEventListener('change', function (e) {
    var files = [].slice.call(e.target.files), msg = $('gMsg'), done = 0, errs = [];
    if (!files.length) return;
    msg.textContent = 'Leyendo...';
    var next = function () {
      if (!files.length) { msg.textContent = done + ' gasto(s) registrados.' + (errs.length ? ' ' + errs.join(' ') : ''); e.target.value = ''; renderGas(); renderSum(); return; }
      var file = files.shift();
      file.text().then(function (t) {
        var f; try { f = parseCfdi(t); } catch (err) { errs.push(file.name + ': ' + err.message); return next(); }
        if (f.receptorRfc && f.receptorRfc !== MI_RFC) errs.push(file.name + ': está a nombre de otro RFC (' + f.receptorRfc + '), no cuenta como tu gasto.');
        if (f.tipo && f.tipo !== 'I') { errs.push(file.name + ': no es factura de compra.'); return next(); }
        var dup = gastos.find(function (x) { return x.uuid && x.uuid === f.uuid; });
        var g = { id: dup ? dup.id : undefined, fecha: f.fecha.slice(0, 10), uuid: f.uuid, emisorRfc: f.emisorRfc, emisorNombre: f.emisorNombre, concepto: f.descripcion, categoria: dup ? dup.categoria : 'Otro', subtotal: f.subtotal, iva: f.iva, total: f.total, formaPago: f.formaPago, metodoPago: f.metodoPago };
        saveGasto(g, { xml: t }).then(function (saved) { if (gMonthOf(saved) !== $('gMonth').value) $('gMonth').value = gMonthOf(saved); done++; next(); })
          .catch(function () { errs.push(file.name + ': no se pudo guardar.'); next(); });
      });
    };
    next();
  });
  // Foto o PDF: se comprime la foto y se capturan los datos a mano
  var gf = $('gForm'), pendingFile = null;
  function shrink(file) {
    return new Promise(function (res, rej) {
      if (file.type === 'application/pdf') {
        if (file.size > 5 * 1024 * 1024) return rej(new Error('El PDF pesa más de 5 MB.'));
        var rd = new FileReader(); rd.onload = function () { res({ name: file.name, type: file.type, data: rd.result.split(',')[1] }); }; rd.onerror = rej; rd.readAsDataURL(file); return;
      }
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1800 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res({ name: (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.82).split(',')[1] });
      };
      img.onerror = function () { rej(new Error('No se pudo leer la imagen.')); };
      img.src = url;
    });
  }
  $('gFile').addEventListener('change', function (e) {
    var file = e.target.files[0]; if (!file) return;
    $('gMsg').textContent = 'Preparando...';
    shrink(file).then(function (f) {
      pendingFile = f; $('gMsg').textContent = ''; gf.reset(); gf.fecha.value = localIso().slice(0, 10);
      $('gFileName').textContent = f.name; gf.hidden = false; gf.emisorNombre.focus();
    }).catch(function (err) { $('gMsg').textContent = err.message; }).then(function () { e.target.value = ''; });
  });
  function gIva() { if (gf.conIva.checked) { var t = +gf.total.value || 0; gf.iva.value = t ? r2(t - t / 1.16).toFixed(2) : ''; } }
  gf.total.addEventListener('input', gIva);
  gf.conIva.addEventListener('change', function () { if (!gf.conIva.checked) gf.iva.value = '0'; else gIva(); });
  $('gCancel').addEventListener('click', function () { gf.hidden = true; pendingFile = null; });
  gf.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!gf.fecha.value || !gf.emisorNombre.value.trim() || !gf.concepto.value.trim() || !(+gf.total.value > 0)) { $('gMsg').textContent = 'Completa fecha, proveedor, concepto y total.'; return; }
    var total = r2(+gf.total.value), iva = r2(+gf.iva.value || 0);
    var g = { fecha: gf.fecha.value, emisorNombre: gf.emisorNombre.value.trim(), emisorRfc: gf.emisorRfc.value.trim().toUpperCase(), concepto: gf.concepto.value.trim(), categoria: gf.categoria.value, total: total, iva: iva, subtotal: r2(total - iva) };
    $('gMsg').textContent = 'Guardando...';
    saveGasto(g, pendingFile ? { file: pendingFile } : {}).then(function (saved) {
      gf.hidden = true; pendingFile = null; $('gMonth').value = gMonthOf(saved); renderGas(); renderSum();
      $('gMsg').textContent = 'Gasto guardado. Pide la factura (XML) al proveedor para que cuente.';
    }).catch(function () { $('gMsg').textContent = 'No se pudo guardar (archivo muy grande o sin conexión).'; });
  });
  // Exportar año (facturas y gastos) para el contador
  $('gCsv').addEventListener('click', function () {
    var y = ($('gMonth').value || ym).slice(0, 4);
    var q = function (v) { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = [['Tipo', 'Fecha', 'Folio fiscal (UUID)', 'RFC', 'Nombre', 'Concepto', 'Categoría', 'Subtotal', 'IVA', 'Retención ISR', 'Total', 'Estado', 'Comprobante']];
    facturas.filter(function (f) { return (f.fecha || '').slice(0, 4) === y; }).forEach(function (f) {
      rows.push(['Ingreso', dmy(f.fecha), f.uuid || '', f.receptorRfc, f.receptorNombre, f.descripcion, '', f.subtotal, f.iva, f.isrRet || 0, f.total, f.estado === 'timbrada' ? (f.cobrada ? 'Cobrada ' + dmy(f.fechaCobro) : 'Por cobrar') : 'Por timbrar', f.tieneXml ? 'XML' : '']);
    });
    gastos.filter(function (g) { return (g.fecha || '').slice(0, 4) === y; }).forEach(function (g) {
      rows.push(['Gasto', dmy(g.fecha), g.uuid || '', g.emisorRfc || '', g.emisorNombre, g.concepto, g.categoria, g.subtotal, g.iva, '', g.total, '', g.tieneXml ? 'XML' : (g.archivo ? 'Foto/PDF sin factura' : '')]);
    });
    download('YoCellTherapy-ingresos-y-gastos-' + y + '.csv', new Blob(['﻿' + rows.map(function (r) { return r.map(q).join(','); }).join('\r\n')], { type: 'text/csv' }));
  });


  // Documentos legales y datos fiscales
  function fisRows() {
    return [['RFC', emisor.rfc], ['Nombre', emisor.nombre], ['Código postal', emisor.cp], ['Régimen fiscal', emisor.regimen + ' ' + (emisor.regimenNombre || '')], ['Uso del CFDI', 'G03 Gastos en general']];
  }
  function renderFis() {
    $('fisList').innerHTML = fisRows().map(function (r, i) { return '<div><dt>' + r[0] + '</dt><dd><span>' + esc(r[1]) + '</span><button type="button" data-fis="' + i + '">Copiar</button></dd></div>'; }).join('');
  }
  function copy(text, label) {
    var done = function () { $('fisMsg').textContent = label + ' copiado.'; setTimeout(function () { $('fisMsg').textContent = ''; }, 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {}); else done();
  }
  $('fisList').addEventListener('click', function (e) { var b = e.target.closest('button[data-fis]'); if (!b) return; var r = fisRows()[+b.dataset.fis]; copy(r[1], r[0]); });
  $('fisCopy').addEventListener('click', function () { copy(fisRows().map(function (r) { return r[0] + ': ' + r[1]; }).join('\n'), 'Todo'); });

  function renderDocs() {
    $('dEmpty').hidden = docs.length > 0;
    var today = localIso().slice(0, 10);
    $('dList').innerHTML = docs.slice().sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); }).map(function (d) {
      var venc = d.vigencia ? (d.vigencia < today ? '<span class="pill warn">Vencido ' + esc(dmy(d.vigencia)) + '</span>' : '<span class="pill ok">Vigente hasta ' + esc(dmy(d.vigencia)) + '</span>') : '';
      return '<li><div><b>' + esc(d.titulo) + '</b><small>' + esc(d.categoria) + ' · subido ' + esc(dmy(d.fecha)) + '</small>' + venc + '</div><div class="acts"><button type="button" data-dview="' + esc(d.id) + '">Ver</button><button type="button" data-ddl="' + esc(d.id) + '">Descargar</button><button type="button" data-ddel="' + esc(d.id) + '">Eliminar</button></div></li>';
    }).join('');
  }
  function fileBlob(r) { var bin = atob(r.data), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: r.type }); }
  $('dList').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.dview || b.dataset.ddl) {
      var id = b.dataset.dview || b.dataset.ddl, win = b.dataset.dview ? window.open('', '_blank') : null, old = b.textContent;
      b.textContent = 'Abriendo...';
      call('/adm/doc/file', { id: id }).then(function (r) {
        b.textContent = old; if (r.status !== 200) { if (win) win.close(); return; }
        var blob = fileBlob(r.body);
        if (win) win.location.href = URL.createObjectURL(blob); else download(r.body.name, blob);
      }).catch(function () { b.textContent = old; if (win) win.close(); });
    } else if (b.dataset.ddel) {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Seguro?'; b.classList.add('warn'); return; }
      call('/adm/doc/delete', { id: b.dataset.ddel }).then(function () { docs = docs.filter(function (x) { return x.id !== b.dataset.ddel; }); renderDocs(); });
    }
  });
  var df = $('dForm');
  $('dNew').addEventListener('click', function () { df.reset(); df.hidden = false; df.titulo.focus(); });
  $('dCancel').addEventListener('click', function () { df.hidden = true; });
  df.file.addEventListener('change', function () {
    var f = df.file.files[0]; if (f && !df.titulo.value) df.titulo.value = /constancia|csf|cif/i.test(f.name) ? 'Constancia de situación fiscal' : f.name.replace(/\.[^.]+$/, '');
    if (f && /constancia|csf|cif/i.test(f.name)) df.categoria.value = 'Fiscal';
  });
  df.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = df.file.files[0], msg = $('dMsg');
    if (!df.titulo.value.trim() || !f) { msg.textContent = 'Pon un nombre y elige el archivo.'; return; }
    if (f.type === 'application/pdf' && f.size > 6 * 1024 * 1024) { msg.textContent = 'El archivo pesa más de 6 MB.'; return; }
    msg.textContent = 'Subiendo...';
    (f.type === 'application/pdf' ? new Promise(function (res, rej) { var rd = new FileReader(); rd.onload = function () { res({ name: f.name, type: f.type, data: rd.result.split(',')[1] }); }; rd.onerror = rej; rd.readAsDataURL(f); }) : shrink(f))
      .then(function (file) {
        return call('/adm/doc/save', { item: { titulo: df.titulo.value.trim(), categoria: df.categoria.value, vigencia: df.vigencia.value, fecha: localIso().slice(0, 10) }, file: file });
      }).then(function (r) {
        if (r.status !== 200) throw new Error();
        docs.push(r.body.item); renderDocs(); df.hidden = true; msg.textContent = 'Documento guardado.';
      }).catch(function () { msg.textContent = 'No se pudo subir. Revisa el tamaño del archivo.'; });
  });

  // Resumen mensual RESICO
  function renderSum() {
    var m = $('sMonth').value; if (!m) return;
    var y = +m.slice(0, 4), mo = +m.slice(5, 7);
    var cob = facturas.filter(function (f) { return f.estado === 'timbrada' && f.cobrada && (f.fechaCobro || '').slice(0, 7) === m; });
    var emit = facturas.filter(function (f) { return f.estado === 'timbrada' && monthOf(f) === m; });
    var pend = facturas.filter(function (f) { return f.estado !== 'timbrada' && monthOf(f) === m; }).length;
    var ing = r2(cob.reduce(function (s, f) { return s + (+f.subtotal || 0); }, 0));
    var iva = r2(cob.reduce(function (s, f) { return s + (+f.iva || 0); }, 0));
    var ret = r2(cob.reduce(function (s, f) { return s + (+f.isrRet || 0); }, 0));
    var ivaRet = r2(cob.reduce(function (s, f) { return s + (+f.ivaRet || 0); }, 0));
    var tasa = 0; for (var i = 0; i < RESICO.length; i++) { if (ing <= RESICO[i][0]) { tasa = RESICO[i][1]; break; } }
    if (!tasa && ing > 0) tasa = 0.025;
    var ivaGas = r2(gastos.filter(function (g) { return g.tieneXml && gMonthOf(g) === m; }).reduce(function (s, g) { return s + (+g.iva || 0); }, 0));
    var isr = r2(ing * tasa), isrPagar = Math.max(0, r2(isr - ret)), ivaNeto = r2(iva - ivaRet - ivaGas), ivaPagar = Math.max(0, ivaNeto);
    var dueM = mo === 12 ? 1 : mo + 1, dueY = mo === 12 ? y + 1 : y;
    $('sDue').textContent = 'Declaración de ' + MESES[mo - 1] + ': a más tardar el 17 de ' + MESES[dueM - 1] + ' de ' + dueY;
    var card = function (l, v, s, cls) { return '<div class="sc' + (cls ? ' ' + cls : '') + '"><span>' + l + '</span><b>' + v + '</b>' + (s ? '<small>' + s + '</small>' : '') + '</div>'; };
    $('sum').innerHTML =
      card('Ingresos cobrados', money(ing), cob.length + ' factura(s) cobradas; ' + emit.length + ' emitida(s) en el mes' + (pend ? '; ' + pend + ' por timbrar' : '')) +
      card('ISR del mes', money(isr), 'Tasa RESICO ' + (tasa * 100).toFixed(2).replace(/\.?0+$/, '') + '%') +
      card('ISR que ya te retuvieron', '− ' + money(ret), 'Lo retienen las personas morales (1.25%)') +
      card('ISR estimado a pagar', money(isrPagar), '', 'hi') +
      card('IVA cobrado', money(iva), ivaRet ? 'Menos IVA retenido ' + money(ivaRet) : 'Sin IVA retenido') +
      card('IVA de tus gastos', '− ' + money(ivaGas), 'Solo gastos con factura (XML) a tu RFC') +
      card(ivaNeto < 0 ? 'Saldo a favor de IVA' : 'IVA estimado a pagar', money(ivaNeto < 0 ? -ivaNeto : ivaPagar), ivaNeto < 0 ? 'Se puede aplicar en meses siguientes' : '', 'hi');
  }
  $('sMonth').addEventListener('change', renderSum);
})();
