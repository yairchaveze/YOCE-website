// Asesorías: biblioteca de documentos de referencia y guía (checklist) para escribir un protocolo nuevo.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var dmy = function (d) { return (d || '').slice(0, 10).split('-').reverse().join('/'); };
  var today = function () { var d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  var items = [], loaded = false;

  function call(p, b) { return window.YCT.call(p, b).then(function (r) { if (r.status === 401) { window.YCT.expired(); throw new Error('sesion'); } return r; }); }
  document.addEventListener('yct:open', function (e) {
    if (e.detail !== 'asesorias' || loaded) return;
    call('/lib/list').then(function (r) { items = r.body.items || []; loaded = true; renderLib(); renderGuia(); });
  });
  ['lib', 'guia'].forEach(function (t, _, all) {
    $('tb-' + t).addEventListener('click', function () { all.forEach(function (o) { $('tb-' + o).setAttribute('aria-selected', o === t); $('p-' + o).hidden = o !== t; }); });
  });

  // Biblioteca
  function renderLib() {
    var q = $('lQ').value.trim().toLowerCase();
    var rows = items.filter(function (d) { return !q || (d.titulo + ' ' + d.tipo + ' ' + (d.notas || '')).toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return (refTipo(b) ? 1 : 0) - (refTipo(a) ? 1 : 0) || (b.fecha || '').localeCompare(a.fecha || ''); });
    $('lEmpty').hidden = items.length > 0;
    $('lList').innerHTML = rows.map(function (d) {
      return '<li><div><b>' + esc(d.titulo) + '</b><small>' + esc(d.tipo) + (d.version ? ' · versión ' + esc(d.version) : '') + ' · subido ' + esc(dmy(d.fecha)) + (d.notas ? ' · ' + esc(d.notas) : '') + '</small>' + (refTipo(d) ? '<span class="pill ok">Referencia: ' + (refTipo(d) === 'manual' ? 'manual del investigador' : 'protocolo clínico') + '</span>' : '') + '</div><div class="acts"><button type="button" data-view="' + esc(d.id) + '">Ver</button><button type="button" data-dl="' + esc(d.id) + '">Descargar</button><button type="button" data-del="' + esc(d.id) + '">Eliminar</button></div></li>';
    }).join('');
  }
  $('lQ').addEventListener('input', renderLib);
  function blobOf(r) { var bin = atob(r.data), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: r.type }); }
  var cache = {};
  function open(id, page, asDownload) {
    var win = asDownload ? null : window.open('', '_blank');
    var go = function (f) {
      if (asDownload) { var a = document.createElement('a'); a.href = f.url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); }
      else if (win) win.location.href = f.url + (page && /pdf/.test(f.type) ? '#page=' + page : '');
    };
    if (cache[id]) return go(cache[id]);
    call('/lib/file', { id: id }).then(function (r) {
      if (r.status !== 200) { if (win) win.close(); return; }
      cache[id] = { url: URL.createObjectURL(blobOf(r.body)), name: r.body.name, type: r.body.type }; go(cache[id]);
    }).catch(function () { if (win) win.close(); });
  }
  $('lList').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.view) open(b.dataset.view);
    else if (b.dataset.dl) open(b.dataset.dl, 0, true);
    else if (b.dataset.del) {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Seguro?'; b.classList.add('warn'); return; }
      call('/lib/delete', { id: b.dataset.del }).then(function () { items = items.filter(function (x) { return x.id !== b.dataset.del; }); renderLib(); renderGuia(); });
    }
  });
  var lf = $('lForm');
  $('lNew').addEventListener('click', function () { lf.reset(); lf.hidden = false; lf.titulo.focus(); });
  $('lCancel').addEventListener('click', function () { lf.hidden = true; });
  lf.file.addEventListener('change', function () {
    var f = lf.file.files[0]; if (!f) return;
    if (!lf.titulo.value) lf.titulo.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    var kind = /manual.*investigador|investigator|brochure/i.test(f.name) ? 'manual' : (/ensayo|protocolo/i.test(f.name) ? 'protocolo' : '');
    if (kind === 'protocolo') lf.tipo.value = 'Protocolo clínico';
    if (kind === 'manual') lf.tipo.value = 'Artículo o guía';
    if (kind && !items.some(function (x) { return refTipo(x) === kind; })) lf.referencia.value = kind;
  });
  lf.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = lf.file.files[0], msg = $('lMsg');
    if (!lf.titulo.value.trim() || !f) { msg.textContent = 'Pon un título y elige el archivo.'; return; }
    if (f.size > 14 * 1024 * 1024) { msg.textContent = 'El archivo pesa más de 14 MB.'; return; }
    msg.textContent = 'Subiendo...';
    var rd = new FileReader();
    rd.onload = function () {
      var ref = lf.referencia.value;
      var save = function () { return call('/lib/save', { item: { titulo: lf.titulo.value.trim(), tipo: lf.tipo.value, version: lf.version.value.trim(), notas: lf.notas.value.trim(), referencia: ref, fecha: today() }, file: { name: f.name, type: f.type || 'application/octet-stream', data: rd.result.split(',')[1] } }); };
      // Solo un documento puede ser la referencia de la guía
      var prev = ref ? items.filter(function (x) { return refTipo(x) === ref; }) : [];
      Promise.all(prev.map(function (x) { x.referencia = ''; return call('/lib/save', { item: x }); })).then(save).then(function (r) {
        if (r.status !== 200) throw new Error();
        items.push(r.body.item); lf.hidden = true; msg.textContent = 'Documento guardado.'; renderLib(); renderGuia();
      }).catch(function () { msg.textContent = 'No se pudo subir. Revisa el tamaño del archivo.'; });
    };
    rd.readAsDataURL(f);
  });

  // Guía: estructura del protocolo MB-CART19.1 (CARLLA-B1) como checklist. p = página del protocolo de referencia.
  var GUIAS = {};
  GUIAS.protocolo = [
    { t: 'Antes de escribir: trámites y requisitos', items: [
      ['Definir producto, plataforma de manufactura y proveedor del vector', 'Quién fabrica, dónde y con qué equipo (p. ej. CliniMACS Prodigy).'],
      ['Manual del investigador vigente del producto', 'El protocolo lo cita para la descripción del producto.'],
      ['Comité de Investigación y Comité de Ética en Investigación', 'Dictamen favorable antes de iniciar.'],
      ['Comité de Bioseguridad', 'Necesario si el producto usa organismos genéticamente modificados (vector lentiviral).'],
      ['Autorización de COFEPRIS del protocolo', 'Con el expediente del producto y los dictámenes de los comités.'],
      ['Póliza de seguro del estudio', 'Cobertura de daños relacionados con la investigación.'],
      ['Carta de consentimiento informado', 'En lenguaje claro, con riesgos, beneficios, confidencialidad y derecho a retirarse.'],
      ['Registro público del ensayo', 'ClinicalTrials.gov o el registro que pida la institución.'],
      ['Capacidad instalada', 'Aféresis, laboratorio de control de calidad, criopreservación, unidad clínica y terapia intensiva.']
    ] },
    { t: '1. Antecedentes', p: 6, items: [
      ['Descripción del producto', 'Qué es, construcción del CAR, dominios de señalización.', 6],
      ['Datos clínicos previos', 'Resultados publicados de productos comparables.', 6],
      ['Riesgos y beneficios potenciales', '', 6],
      ['Justificación, propósito e hipótesis', '', 7],
      ['Justificación de la dosis y esquema terapéutico', '', 7],
      ['Consideraciones éticas y legales; categoría de riesgo', 'Regulación nacional e institucional.', 9],
      ['Población a estudiar y marco teórico', '', 10]
    ] },
    { t: '2. Objetivos y criterios de valoración', p: 11, items: [['Objetivo primario (seguridad) y secundarios (eficacia)', 'Cada objetivo con su criterio de valoración medible.', 11], ['Objetivos exploratorios', 'Calidad de vida, persistencia, biomarcadores.', 11]] },
    { t: '3. Diseño del ensayo', p: 13, items: [['Diseño general y fases', '', 13], ['Descripción farmacéutica, envasado y etiquetado del producto', '', 13], ['Variables', '', 13], ['Definición de fin de estudio y cierre temprano', '', 14]] },
    { t: '4. Selección y retiro de sujetos', p: 14, items: [['Criterios de inclusión', '', 15], ['Criterios de exclusión', '', 16], ['Criterios de eliminación', '', 16], ['Aleatorización y cegamiento (si aplica)', '', 17]] },
    { t: '5. Tratamiento de los sujetos', p: 17, items: [
      ['Reclutamiento escalonado', 'Intervalo entre los primeros pacientes para vigilar seguridad.', 17],
      ['Evaluación inicial: historia, laboratorio y perfil viral', '', 18],
      ['Colecta de células (aféresis)', '', 20],
      ['Esquema de tratamiento y terapia puente', '', 20],
      ['Quimioterapia de linfodepleción', 'Fármacos, dosis y días.', 21],
      ['Infusión: preparación, administración y vigilancia', 'Incluye qué hacer si el producto tiene desarrollo microbiológico.', 21],
      ['Seguimiento por visitas y criterios de egreso', 'Calendario de visitas hasta el seguimiento a largo plazo.', 25]
    ] },
    { t: '5.11 Manejo de toxicidad', p: 32, items: [
      ['Síndrome de liberación de citocinas', 'Clasificación ASTCT y manejo.', 33], ['ICANS', 'Escala ICE y manejo.', 35], ['Citopenias y aplasia de células B', '', 37],
      ['Hemofagocitosis, coagulopatía y CID', '', 40], ['Toxicidad a largo plazo: fertilidad y neoplasias secundarias', '', 42],
      ['Terapia concomitante: profilaxis y medicamentos prohibidos', '', 42], ['Ajuste de dosis, segunda aplicación, retiro y pérdidas de seguimiento', '', 44]
    ] },
    { t: '6. Eficacia', p: 46, items: [['Criterios de respuesta (RC, RCi, enfermedad mínima residual)', '', 47], ['Recaída, progresión y duración de la respuesta', 'Supervivencia libre de evento y global.', 47]] },
    { t: '7. Seguridad', p: 48, items: [['Parámetros de seguridad', '', 50], ['Eventos adversos y de especial interés: definición y reporte', '', 50], ['Eventos adversos graves y embarazo', 'Tiempos de notificación.', 52], ['Seguimiento de sujetos con eventos adversos', '', 54]] },
    { t: '8. Estadística', p: 55, items: [['Tamaño de muestra, justificación y factibilidad', '', 55], ['Plan de análisis de objetivos y variables exploratorias', '', 56], ['Reglas de interrupción, datos faltantes y desviaciones', '', 57]] },
    { t: '9 a 13. Datos, calidad, ética y apego', p: 57, items: [['Acceso directo a datos y documentos fuente', '', 57], ['Control y garantía de calidad', 'Monitoreo y auditorías.', 57], ['Aspectos éticos, privacidad y confidencialidad', '', 58], ['Manejo de datos, archivo y uso futuro', '', 59], ['Apego al protocolo y desviaciones', '', 61]] },
    { t: '14 y 15. Financiamiento y publicación', p: 61, items: [['Fuentes de financiamiento y costos para participantes', '', 61], ['Seguro, indemnización y conflictos de interés', '', 61], ['Política de publicación', '', 62]] },
    { t: 'Referencias y apéndices', p: 63, items: [['Referencias', '', 63], ['Escalas ICANS, ICE y SLC (ASTCT)', '', 68], ['Cuestionarios de calidad de vida (PROMIS-29, FACT)', '', 69], ['Clase funcional', '', 75]] }
  ];

  // Manual del investigador MB-CART19.1 (estructura ICH E6, sección 7). p = página del manual de referencia.
  GUIAS.manual = [
    { t: 'Antes de escribir', items: [
      ['Definir patrocinador y producto en investigación', 'Nombre, patrocinador institucional y versión.'],
      ['Reunir la información del fabricante del vector o del producto', 'Datos no clínicos, certificado de análisis y especificaciones.'],
      ['Alinear con el protocolo', 'El manual es la guía rápida; no sustituye al protocolo extenso.'],
      ['Plan de actualización', 'Revisar al menos una vez al año o cuando haya nueva información de seguridad.']
    ] },
    { t: 'Portada, control y confidencialidad', p: 1, items: [['Portada: producto, patrocinador y versión', '', 1], ['Control de cambios', 'Versión, fecha, descripción, sección y responsable.', 2], ['Declaración de confidencialidad', 'Quién puede inspeccionar registros y dónde se resguardan los datos.', 2], ['Índice', '', 3]] },
    { t: '2 y 3. Resumen e introducción', p: 5, items: [['Resumen del producto', '', 5], ['Datos clínicos clave', '', 5], ['Introducción', 'Mecanismo de acción e indicación propuesta.', 7]] },
    { t: '4. Información del producto', p: 8, items: [
      ['Propiedades físicas, químicas y farmacéuticas', '', 8], ['Formulación y lista de excipientes', '', 8], ['Periodo de validez', '', 9],
      ['Manejo del producto e instrucciones de precaución', '', 9], ['Conservación y traslado', 'Temperatura, cadena de frío y criopreservación.', 10], ['Eliminación del producto', '', 10], ['Envasado y etiquetado', '', 10]
    ] },
    { t: '5. Estudios no clínicos', p: 12, items: [
      ['Estudios in vitro publicados', '', 12], ['Estudios in vivo', '', 13], ['Estudios del fabricante', '', 13], ['Farmacología no clínica', '', 18],
      ['Farmacocinética y metabolismo en animales', '', 19], ['Toxicología: genotoxicidad y riesgo germinal', '', 19], ['Presencia de vector lentiviral (RCL)', '', 20]
    ] },
    { t: '6. Efectos en seres humanos', p: 21, items: [['Farmacocinética y metabolismo en humanos', 'Expansión y persistencia.', 22], ['Seguridad en ensayos clínicos', 'SLC, ICANS, citopenias.', 23], ['Eficacia en ensayos clínicos', '', 25], ['Experiencia poscomercialización', '', 28]] },
    { t: '7. Resumen y guía para el investigador', p: 29, items: [['Resumen de datos no clínicos y clínicos', '', 29], ['Guía práctica para el investigador', 'Riesgos esperados, vigilancia y manejo.', 29], ['Farmacocinética y metabolismo en humanos', '', 30]] },
    { t: 'Referencias y apéndices', p: 31, items: [['Referencias', '', 31], ['Lista de tablas y de abreviaturas', '', 34]] }
  ];
  var KEY = 'yct-guia';
  function state() { try { return JSON.parse(localStorage.getItem(KEY + '-' + tipo()) || (tipo() === 'protocolo' ? localStorage.getItem(KEY) : '') || '{}'); } catch (e) { return {}; } }
  function setState(s) { try { localStorage.setItem(KEY + '-' + tipo(), JSON.stringify(s)); } catch (e) {} }
  function refTipo(x) { return x.referencia === true ? 'protocolo' : (x.referencia || ''); }
  function ref() { var t = tipo(); return items.find(function (x) { return refTipo(x) === t; }); }
  function tipo() { return $('gTipo').value; }
  function renderGuia() {
    var s = state(), r = ref(), n = 0, done = 0;
    $('gProj').value = s.proyecto || '';
    var nom = tipo() === 'manual' ? 'manual del investigador' : 'protocolo';
    $('gRefNote').innerHTML = r ? 'Las páginas abren tu ' + nom + ' de referencia: <b>' + esc(r.titulo) + '</b>.' : 'Sube tu ' + nom + ' en <b>Biblioteca</b> y márcalo como referencia para abrir cada sección desde aquí.';
    $('guia').innerHTML = GUIAS[tipo()].map(function (g, gi) {
      return '<section class="gsec"><h3>' + esc(g.t) + (g.p && r ? ' <button type="button" class="pg" data-pg="' + g.p + '">pág. ' + g.p + '</button>' : '') + '</h3><ul>' + g.items.map(function (it, ii) {
        var id = gi + '.' + ii, on = !!(s.done || {})[id]; n++; if (on) done++;
        return '<li><label><input type="checkbox" data-id="' + id + '"' + (on ? ' checked' : '') + '><span><b>' + esc(it[0]) + '</b>' + (it[1] ? '<small>' + esc(it[1]) + '</small>' : '') + '</span></label>' + (it[2] && r ? '<button type="button" class="pg" data-pg="' + it[2] + '">pág. ' + it[2] + '</button>' : '') + '</li>';
      }).join('') + '</ul></section>';
    }).join('');
    $('gProg').textContent = done + ' de ' + n + ' listos';
  }
  $('guia').addEventListener('change', function (e) {
    var c = e.target.closest('input[data-id]'); if (!c) return;
    var s = state(); s.done = s.done || {}; if (c.checked) s.done[c.dataset.id] = 1; else delete s.done[c.dataset.id]; setState(s); renderGuia();
  });
  $('guia').addEventListener('click', function (e) { var b = e.target.closest('button[data-pg]'); if (b && ref()) open(ref().id, +b.dataset.pg); });
  $('gProj').addEventListener('input', function () { var s = state(); s.proyecto = $('gProj').value; setState(s); });
  $('gReset').addEventListener('click', function (e) {
    var b = e.currentTarget; if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Borrar avance?'; return; }
    b.dataset.sure = ''; b.textContent = 'Nuevo proyecto'; setState({}); renderGuia(); $('gProj').focus();
  });
  $('gPrint').addEventListener('click', function () { document.body.classList.add('print-guia'); window.print(); setTimeout(function () { document.body.classList.remove('print-guia'); }, 500); });
  $('gTipo').addEventListener('change', renderGuia);
  renderGuia();
})();
