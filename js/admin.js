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
  var facturas = [], loaded = false;
  var now = new Date(), ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  $('fMonth').value = ym; $('sMonth').value = ym;

  function call(p, b) {
    return window.YCT.call(p, b).then(function (r) { if (r.status === 401) { window.YCT.expired(); throw new Error('sesion'); } return r; });
  }
  function load() {
    return call('/adm/fact/list').then(function (r) { facturas = r.body.facturas || []; loaded = true; renderList(); renderSum(); fillRfcs(); });
  }
  document.addEventListener('yct:open', function (e) { if (e.detail === 'administracion' && !loaded) load().catch(function () {}); });

  // Pestañas
  var tabs = ['fact', 'new', 'sum'];
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
    call('/adm/fact/save', { factura: f }).then(function () { renderList(); renderSum(); });
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
      formaPago: attr(c, 'FormaPago'), metodoPago: attr(c, 'MetodoPago'), emisorRfc: attr(em, 'Rfc'), tipo: attr(c, 'TipoDeComprobante')
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
        call('/adm/fact/save', { factura: f, xml: t }).then(function (r) {
          var saved = r.body.factura, i = facturas.findIndex(function (x) { return x.id === saved.id; });
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
    call('/adm/fact/save', { factura: f }).then(function (r) {
      facturas.push(r.body.factura); fillRfcs();
      $('fMonth').value = monthOf(r.body.factura); renderList(); renderSum();
      msg.textContent = 'Guardada como "Por timbrar". Ahora timbra en el SAT y sube el XML.';
    }).catch(function () { msg.textContent = 'No se pudo guardar.'; });
  });
  calc();

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
    var isr = r2(ing * tasa), isrPagar = Math.max(0, r2(isr - ret)), ivaPagar = Math.max(0, r2(iva - ivaRet));
    var dueM = mo === 12 ? 1 : mo + 1, dueY = mo === 12 ? y + 1 : y;
    $('sDue').textContent = 'Declaración de ' + MESES[mo - 1] + ': a más tardar el 17 de ' + MESES[dueM - 1] + ' de ' + dueY;
    var card = function (l, v, s, cls) { return '<div class="sc' + (cls ? ' ' + cls : '') + '"><span>' + l + '</span><b>' + v + '</b>' + (s ? '<small>' + s + '</small>' : '') + '</div>'; };
    $('sum').innerHTML =
      card('Ingresos cobrados', money(ing), cob.length + ' factura(s) cobradas; ' + emit.length + ' emitida(s) en el mes' + (pend ? '; ' + pend + ' por timbrar' : '')) +
      card('ISR del mes', money(isr), 'Tasa RESICO ' + (tasa * 100).toFixed(2).replace(/\.?0+$/, '') + '%') +
      card('ISR que ya te retuvieron', '− ' + money(ret), 'Lo retienen las personas morales (1.25%)') +
      card('ISR estimado a pagar', money(isrPagar), '', 'hi') +
      card('IVA cobrado', money(iva), ivaRet ? 'Menos IVA retenido ' + money(ivaRet) : 'Sin IVA retenido') +
      card('IVA estimado a pagar', money(ivaPagar), 'Antes de restar el IVA de tus gastos', 'hi');
  }
  $('sMonth').addEventListener('change', renderSum);
})();
