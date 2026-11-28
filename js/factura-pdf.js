// Representación impresa de un CFDI 4.0 con la marca YoCellTherapy, a partir del XML timbrado.
(function () {
  var CAT = {
    regimen: { '601': 'General de Ley Personas Morales', '603': 'Personas Morales con Fines no Lucrativos', '605': 'Sueldos y Salarios', '612': 'Personas Físicas con Actividades Empresariales y Profesionales', '616': 'Sin obligaciones fiscales', '626': 'Régimen Simplificado de Confianza' },
    uso: { G01: 'Adquisición de mercancías', G03: 'Gastos en general', I08: 'Otra maquinaria y equipo', S01: 'Sin efectos fiscales', D01: 'Honorarios médicos, dentales y gastos hospitalarios', CP01: 'Pagos' },
    forma: { '01': 'Efectivo', '02': 'Cheque nominativo', '03': 'Transferencia electrónica de fondos', '04': 'Tarjeta de crédito', '28': 'Tarjeta de débito', '99': 'Por definir' },
    metodo: { PUE: 'Pago en una sola exhibición', PPD: 'Pago en parcialidades o diferido' },
    tipo: { I: 'Ingreso', E: 'Egreso', P: 'Pago', T: 'Traslado' },
    objeto: { '01': 'No objeto de impuesto', '02': 'Sí objeto de impuesto', '03': 'Sí objeto, no obligado al desglose' },
    impuesto: { '001': 'ISR', '002': 'IVA', '003': 'IEPS' },
    exportacion: { '01': 'No aplica', '02': 'Definitiva', '03': 'Temporal' }
  };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (n) { return '$' + (+n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var cat = function (c, k) { return k ? k + ' ' + (CAT[c][k] || '') : ''; };

  // Importe con letra
  var U = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  var D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  var C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  function hasta999(n) {
    if (n === 100) return 'CIEN';
    var c = Math.floor(n / 100), r = n % 100, out = C[c];
    if (r) out += (out ? ' ' : '') + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : ''));
    return out;
  }
  function letras(n) {
    if (n === 0) return 'CERO';
    var mill = Math.floor(n / 1e6), miles = Math.floor((n % 1e6) / 1000), resto = n % 1000, out = [];
    if (mill) out.push(mill === 1 ? 'UN MILLÓN' : hasta999(mill).replace(/UNO$/, 'UN') + ' MILLONES');
    if (miles) out.push(miles === 1 ? 'MIL' : hasta999(miles).replace(/UNO$/, 'UN') + ' MIL');
    if (resto) out.push(hasta999(resto));
    return out.join(' ');
  }
  function conLetra(total, moneda) {
    var ent = Math.floor(total + 1e-9), cents = Math.round((total - ent) * 100);
    var nombre = moneda === 'USD' ? (ent === 1 ? 'DÓLAR' : 'DÓLARES') : (ent === 1 ? 'PESO' : 'PESOS');
    return letras(ent).replace(/UNO$/, 'UN') + ' ' + (/ILLONES$|ILLÓN$/.test(letras(ent)) ? 'DE ' : '') + nombre + ' ' + String(cents).padStart(2, '0') + '/100 ' + (moneda === 'USD' ? 'USD' : 'M.N.');
  }

  function parse(xml) {
    var d = new DOMParser().parseFromString(xml, 'text/xml');
    var one = function (t, root) { return (root || d).getElementsByTagNameNS('*', t)[0]; };
    var all = function (t, root) { return [].slice.call((root || d).getElementsByTagNameNS('*', t)); };
    var a = function (el, n) { return el ? el.getAttribute(n) || '' : ''; };
    var c = one('Comprobante'), tfd = one('TimbreFiscalDigital');
    if (!c || !tfd) throw new Error('No es un CFDI timbrado.');
    var conceptos = all('Concepto').map(function (k) {
      return { clave: a(k, 'ClaveProdServ'), cant: a(k, 'Cantidad'), unidad: a(k, 'ClaveUnidad'), unidadNombre: a(k, 'Unidad'), desc: a(k, 'Descripcion'), vu: a(k, 'ValorUnitario'), imp: a(k, 'Importe'), objeto: a(k, 'ObjetoImp'), noId: a(k, 'NoIdentificacion'),
        tax: all('Traslado', k).map(function (t) { return { tipo: 'Traslado', imp: a(t, 'Impuesto'), base: a(t, 'Base'), factor: a(t, 'TipoFactor'), tasa: a(t, 'TasaOCuota'), importe: a(t, 'Importe') }; })
          .concat(all('Retencion', k).map(function (t) { return { tipo: 'Retención', imp: a(t, 'Impuesto'), base: a(t, 'Base'), factor: a(t, 'TipoFactor'), tasa: a(t, 'TasaOCuota'), importe: a(t, 'Importe') }; })) };
    });
    var em = one('Emisor'), re = one('Receptor');
    return {
      c: { serie: a(c, 'Serie'), folio: a(c, 'Folio'), fecha: a(c, 'Fecha'), sello: a(c, 'Sello'), forma: a(c, 'FormaPago'), metodo: a(c, 'MetodoPago'), cert: a(c, 'NoCertificado'), sub: +a(c, 'SubTotal'), desc: +a(c, 'Descuento') || 0, moneda: a(c, 'Moneda'), tc: a(c, 'TipoCambio'), total: +a(c, 'Total'), tipo: a(c, 'TipoDeComprobante'), exp: a(c, 'Exportacion'), lugar: a(c, 'LugarExpedicion'), version: a(c, 'Version') },
      em: { rfc: a(em, 'Rfc'), nombre: a(em, 'Nombre'), regimen: a(em, 'RegimenFiscal') },
      re: { rfc: a(re, 'Rfc'), nombre: a(re, 'Nombre'), cp: a(re, 'DomicilioFiscalReceptor'), regimen: a(re, 'RegimenFiscalReceptor'), uso: a(re, 'UsoCFDI') },
      t: { uuid: a(tfd, 'UUID').toUpperCase(), fecha: a(tfd, 'FechaTimbrado'), pac: a(tfd, 'RfcProvCertif'), certSat: a(tfd, 'NoCertificadoSAT'), selloCfd: a(tfd, 'SelloCFD'), selloSat: a(tfd, 'SelloSAT'), version: a(tfd, 'Version'), leyenda: a(tfd, 'Leyenda') },
      conceptos: conceptos
    };
  }

  function qrSvg(f) {
    var url = 'https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=' + f.t.uuid + '&re=' + encodeURIComponent(f.em.rfc) + '&rr=' + encodeURIComponent(f.re.rfc) + '&tt=' + f.c.total.toFixed(6) + '&fe=' + f.c.sello.slice(-8);
    var q = qrcode(0, 'M'); q.addData(url); q.make();
    return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
  }

  var LOGO = '<svg viewBox="0 0 512 512" aria-hidden="true"><defs><radialGradient id="fg"><stop offset="0" stop-color="#7F9CFF" stop-opacity=".55"/><stop offset="1" stop-color="#7F9CFF" stop-opacity="0"/></radialGradient></defs><g transform="translate(256 256) scale(1.55) translate(-256 -256)"><circle cx="256" cy="256" r="96" fill="#43C6A5" fill-opacity="0.17"/><circle cx="256" cy="256" r="150" fill="none" stroke="#43C6A5" stroke-width="24"/><path d="M202 199L256 260.5L310 199M256 260.5V323.5" fill="none" stroke="#0C1A1D" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/><circle cx="371.8" cy="183.8" r="52" fill="url(#fg)"/><circle cx="371.8" cy="183.8" r="28" fill="#7F9CFF"/></g></svg>';

  function render(xml) {
    var f = parse(xml), c = f.c;
    var tras = 0, ret = 0, byTax = {};
    f.conceptos.forEach(function (k) { k.tax.forEach(function (t) {
      var key = t.tipo + ' ' + (CAT.impuesto[t.imp] || t.imp) + ' ' + (t.tasa ? (+t.tasa * 100).toFixed(2).replace(/\.?0+$/, '') + '%' : '');
      byTax[key] = (byTax[key] || 0) + (+t.importe || 0); if (t.tipo === 'Traslado') tras += +t.importe || 0; else ret += +t.importe || 0;
    }); });
    var cadena = '||' + [f.t.version, f.t.uuid, f.t.fecha, f.t.pac].concat(f.t.leyenda ? [f.t.leyenda] : []).concat([f.t.selloCfd, f.t.certSat]).join('|') + '||';
    var row = function (l, v) { return '<div><dt>' + l + '</dt><dd>' + esc(v) + '</dd></div>'; };
    return '<article class="cfdi">' +
      '<header class="cf-head"><div class="cf-brand">' + LOGO + '<div><p class="cf-mark">Yo<b>Cell</b>Therapy</p><p class="cf-tag">Consultoría científica en terapia celular</p></div></div>' +
      '<div class="cf-title"><p class="cf-kind">Factura · ' + esc(CAT.tipo[c.tipo] || c.tipo) + '</p><p class="cf-folio">' + esc(c.serie + c.folio) + '</p></div></header>' +
      '<section class="cf-parties"><div class="cf-box"><h3>Emisor</h3><p class="cf-name">' + esc(f.em.nombre) + '</p><dl>' + row('RFC', f.em.rfc) + row('Régimen fiscal', cat('regimen', f.em.regimen)) + row('Lugar de expedición', 'C.P. ' + c.lugar) + '</dl></div>' +
      '<div class="cf-box"><h3>Receptor</h3><p class="cf-name">' + esc(f.re.nombre) + '</p><dl>' + row('RFC', f.re.rfc) + row('Domicilio fiscal', 'C.P. ' + f.re.cp) + row('Régimen fiscal', cat('regimen', f.re.regimen)) + row('Uso del CFDI', cat('uso', f.re.uso)) + '</dl></div>' +
      '<div class="cf-box cf-fiscal"><h3>Datos fiscales</h3><dl>' + row('Folio fiscal (UUID)', f.t.uuid) + row('Fecha de emisión', c.fecha.replace('T', ' ')) + row('Fecha de certificación', f.t.fecha.replace('T', ' ')) + row('Certificado del emisor', c.cert) + row('Certificado del SAT', f.t.certSat) + row('Exportación', cat('exportacion', c.exp)) + '</dl></div></section>' +
      '<table class="cf-items"><thead><tr><th>Clave</th><th>Cant.</th><th>Unidad</th><th>Descripción</th><th class="n">Valor unitario</th><th class="n">Importe</th></tr></thead><tbody>' +
      f.conceptos.map(function (k) {
        return '<tr><td>' + esc(k.clave) + '</td><td>' + esc(+k.cant) + '</td><td>' + esc(k.unidad) + '<small>' + esc(k.unidadNombre) + '</small></td><td>' + esc(k.desc) + '<small>' + esc(CAT.objeto[k.objeto] || '') + (k.tax.length ? ' · ' + k.tax.map(function (t) { return (CAT.impuesto[t.imp] || t.imp) + ' ' + t.tipo.toLowerCase() + ' ' + (+t.tasa * 100).toFixed(2).replace(/\.?0+$/, '') + '%'; }).join(', ') : '') + '</small></td><td class="n">' + money(k.vu) + '</td><td class="n">' + money(k.imp) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<section class="cf-sum"><div class="cf-pay"><dl>' + row('Moneda', c.moneda + (c.tc ? ' (TC ' + c.tc + ')' : '')) + row('Forma de pago', cat('forma', c.forma)) + row('Método de pago', cat('metodo', c.metodo)) + '</dl><p class="cf-letra">' + esc(conLetra(c.total, c.moneda)) + '</p></div>' +
      '<dl class="cf-totals">' + row('Subtotal', money(c.sub)) + (c.desc ? row('Descuento', money(c.desc)) : '') + Object.keys(byTax).map(function (k) { return row(k, (k.indexOf('Retención') === 0 ? '− ' : '') + money(byTax[k])); }).join('') + '<div class="cf-total"><dt>Total</dt><dd>' + money(c.total) + '</dd></div></dl></section>' +
      '<section class="cf-seal"><div class="cf-qr">' + qrSvg(f) + '</div><div class="cf-seals"><h4>Sello digital del CFDI</h4><p>' + esc(f.t.selloCfd) + '</p><h4>Sello digital del SAT</h4><p>' + esc(f.t.selloSat) + '</p><h4>Cadena original del complemento de certificación digital del SAT</h4><p>' + esc(cadena) + '</p></div></section>' +
      '<footer class="cf-foot"><span>Este documento es una representación impresa de un CFDI ' + esc(c.version) + '.</span><span>RFC del proveedor de certificación: ' + esc(f.t.pac) + '</span><span>yocelltherapy.com</span></footer></article>';
  }
  window.YCTFactura = { render: render, parse: parse };
})();
