// assets/js/importer.js
// Importación masiva de pacientes desde XLSX/CSV, con preview y commit.
// Permisos sugeridos: admin, coordinador.

// === Utilidades ===
function _toast(msg, type='info'){
  if (typeof showToast === 'function') showToast(msg, type); else alert(msg);
}
function _norm(str){ return (str||'').toString().trim(); }
function _titleCase(s){ return _norm(s).toLowerCase().replace(/\b\p{L}/gu, c=>c.toUpperCase()); }
function _normalizeRiesgo(v){
  const x = _norm(v).toLowerCase();
  if (x === 'alto') return 'Alto';
  if (x === 'medio') return 'Medio';
  if (x === 'bajo') return 'Bajo';
  return null;
}
function _rutClean(rut){ return _norm(rut).replace(/\./g,'').replace(/-/g,'').toUpperCase(); }
function validarRUT(rut){
  rut = _rutClean(rut);
  if(!/^[0-9]+[0-9K]$/.test(rut)) return false;
  const cuerpo = rut.slice(0,-1), dv = rut.slice(-1);
  let suma=0, mul=2;
  for (let i=cuerpo.length-1; i>=0; i--){
    suma += parseInt(cuerpo[i]) * mul;
    mul = (mul===7) ? 2 : mul+1;
  }
  const res = 11 - (suma % 11);
  const dvEsperado = (res===11)?'0':(res===10)?'K':String(res);
  return dv === dvEsperado;
}
function _headersOk(headers){
  const wanted = ['nombre','rut','comuna','riesgo'];
  const got = headers.map(h => _norm(h).toLowerCase());
  return wanted.every(w => got.includes(w));
}
function _detectDelimiter(text){
  // Detecta ; o , (simple)
  const firstLine = text.split(/\r?\n/)[0] || '';
  return (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
}

// === Estado de importación (en memoria) ===
let __impRows = []; // [{row, nombre, rut, comuna, riesgo, status: 'ok'|'error'|'dup'|'update', reason? }]
let __impPreviewTableBody = null;
let __impStatsEls = {read:null, valid:null, updatable:null, dup:null, err:null};
let __impUpdateExisting = true;

// === UI wiring generico (sirve para Config y Pacientes) ===
document.addEventListener('DOMContentLoaded', ()=>{
  // Botón de pacientes.html
  const btnImp = document.getElementById('btnImportar');
  if (btnImp) btnImp.addEventListener('click', openImportModal);

  // Controles del modal (si existe en la página)
  if (document.getElementById('modalImport')) {
    __impPreviewTableBody = document.getElementById('impPreviewBody');
    __impStatsEls.read = document.getElementById('impRead');
    __impStatsEls.valid= document.getElementById('impValid');
    __impStatsEls.updatable = document.getElementById('impUpdatable');
    __impStatsEls.dup = document.getElementById('impDup');
    __impStatsEls.err = document.getElementById('impErr');

    const chk = document.getElementById('chkActualizar');
    if (chk) chk.addEventListener('change', ()=> __impUpdateExisting = !!chk.checked);

    const btnPrev = document.getElementById('btnPreview');
    if (btnPrev) btnPrev.addEventListener('click', handlePreviewFromModal);

    const btnCommit = document.getElementById('btnCommit');
    if (btnCommit) btnCommit.addEventListener('click', commitImport);

    const btnTpl = document.getElementById('btnPlantilla');
    if (btnTpl) btnTpl.addEventListener('click', downloadTemplateCSV);
  }

  // Tarjeta inline de config.html
  const btnPrevCfg = document.getElementById('btnPreviewCfg');
  const fileCfg = document.getElementById('fileImportCfg');
  const chkCfg = document.getElementById('chkActualizarExistentes');
  const btnTplCfg = document.getElementById('btnPlantillaCfg');

  if (chkCfg) chkCfg.addEventListener('change', ()=> __impUpdateExisting = !!chkCfg.checked);
  if (btnPrevCfg && fileCfg){
    btnPrevCfg.addEventListener('click', async ()=>{
      __impUpdateExisting = !!(chkCfg && chkCfg.checked);
      const file = fileCfg.files && fileCfg.files[0];
      if (!file) { _toast('Selecciona un archivo.', 'warning'); return; }
      const ok = await parseAndPreviewFile(file);
      if (ok) _toast('Previsualización lista. Desplázate para ver el detalle.', 'info');
    });
  }
  if (btnTplCfg) btnTplCfg.addEventListener('click', downloadTemplateCSV);
});

function openImportModal(){
  __impRows = [];
  // limpia UI
  if (__impPreviewTableBody) __impPreviewTableBody.innerHTML = '';
  if (__impStatsEls.read) { __impStatsEls.read.textContent='0'; __impStatsEls.valid.textContent='0'; __impStatsEls.updatable.textContent='0'; __impStatsEls.dup.textContent='0'; __impStatsEls.err.textContent='0'; }
  const btnCommit = document.getElementById('btnCommit'); if (btnCommit) btnCommit.disabled = true;
  const modal = new bootstrap.Modal(document.getElementById('modalImport'));
  modal.show();
}
async function handlePreviewFromModal(){
  const file = document.getElementById('fileImport').files[0];
  __impUpdateExisting = !!(document.getElementById('chkActualizar')?.checked);
  if (!file) { _toast('Selecciona un archivo.', 'warning'); return; }
  const ok = await parseAndPreviewFile(file);
  if (ok) _toast('Previsualización lista. Revisa los estados antes de importar.', 'info');
}

// === Parse + Preview ===
async function parseAndPreviewFile(file){
  try{
    const rows = await _readFileToRows(file);
    if (!rows || rows.length === 0) { _toast('El archivo está vacío.', 'warning'); return false; }

    const headers = rows[0].map(c=>_norm(c));
    if (!_headersOk(headers)) { _toast('Encabezados inválidos. Usa la plantilla.', 'danger'); return false; }

    // Mapear posiciones
    const idx = {
      nombre: headers.map(h=>h.toLowerCase()).indexOf('nombre'),
      rut:    headers.map(h=>h.toLowerCase()).indexOf('rut'),
      comuna: headers.map(h=>h.toLowerCase()).indexOf('comuna'),
      riesgo: headers.map(h=>h.toLowerCase()).indexOf('riesgo'),
    };

    // Lee filas de datos
    const dataRows = rows.slice(1).filter(r => r && r.some(c => _norm(c) !== ''));
    const seenInFile = new Set();
    const existing = getPacientes(); // lista local
    const mapByRut = new Map(existing.map(p => [_rutClean(p.rut), p]));

    __impRows = dataRows.map((r, i)=>{
      const rowNo = i + 2; // cuenta encabezado
      const obj = {
        row: rowNo,
        nombre: _titleCase(r[idx.nombre]),
        rut: _norm(r[idx.rut]),
        comuna: _titleCase(r[idx.comuna]),
        riesgo: _normalizeRiesgo(r[idx.riesgo]),
        status: 'ok',
        reason: ''
      };
      // Validaciones
      if (!obj.nombre || !obj.rut || !obj.comuna || !obj.riesgo){
        obj.status = 'error'; obj.reason = 'Campos obligatorios vacíos'; return obj;
      }
      if (!validarRUT(obj.rut)){
        obj.status = 'error'; obj.reason = 'RUT inválido'; return obj;
      }
      const rutKey = _rutClean(obj.rut);
      if (seenInFile.has(rutKey)){
        obj.status = 'dup'; obj.reason = 'Duplicado en archivo'; return obj;
      }
      seenInFile.add(rutKey);

      if (mapByRut.has(rutKey)){
        obj.status = __impUpdateExisting ? 'update' : 'dup';
        obj.reason = __impUpdateExisting ? 'Actualizable' : 'Ya existe';
      }
      return obj;
    });

    // Render preview + counters
    _renderPreview(__impRows);
    const btnCommit = document.getElementById('btnCommit');
    if (btnCommit) btnCommit.disabled = __impRows.filter(x => x.status==='ok' || x.status==='update').length === 0;

    return true;
  }catch(err){
    console.error(err);
    _toast('No se pudo procesar el archivo.', 'danger');
    return false;
  }
}

function _renderPreview(rows){
  if (!__impPreviewTableBody) return;
  __impPreviewTableBody.innerHTML = rows.map((r, i)=>{
    const badge =
      r.status==='ok'     ? '<span class="badge bg-success-subtle text-success">OK</span>' :
      r.status==='update' ? '<span class="badge bg-primary-subtle text-primary">Actualiza</span>' :
      r.status==='dup'    ? '<span class="badge bg-warning-subtle text-warning">Duplicado</span>' :
      '<span class="badge bg-danger-subtle text-danger">Error</span>';
    const reason = r.reason || '';
    return `<tr>
      <td>${i+1}</td>
      <td>${r.nombre||''}</td>
      <td>${r.rut||''}</td>
      <td>${r.comuna||''}</td>
      <td>${r.riesgo||''}</td>
      <td>${badge} <span class="text-muted small">${reason}</span></td>
    </tr>`;
  }).join('');

  // Stats
  const read = rows.length;
  const ok = rows.filter(r=>r.status==='ok').length;
  const upd = rows.filter(r=>r.status==='update').length;
  const dup = rows.filter(r=>r.status==='dup').length;
  const err = rows.filter(r=>r.status==='error').length;

  if (__impStatsEls.read){ __impStatsEls.read.textContent = read; __impStatsEls.valid.textContent = ok; __impStatsEls.updatable.textContent = upd; __impStatsEls.dup.textContent = dup; __impStatsEls.err.textContent = err; }
}

// Lee archivo a matriz de filas/columnas
async function _readFileToRows(file){
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')){
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, {type:'array'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:''});
    return rows;
  } else if (name.endsWith('.csv')){
    const text = await file.text();
    const delim = _detectDelimiter(text);
    return text.split(/\r?\n/).map(line => line.split(delim)).map(cols => cols.map(c=>c.replace(/^\uFEFF/,'')));
  } else {
    throw new Error('Formato no soportado');
  }
}

// === Commit (importar a localStorage) ===
function commitImport(){
  if (!__impRows || __impRows.length===0){ _toast('No hay datos para importar.', 'warning'); return; }

  const existing = getPacientes();
  const byRut = new Map(existing.map(p => [_rutClean(p.rut), p]));
  let imported = 0, updated = 0, errors = 0;

  __impRows.forEach(r=>{
    if (r.status==='ok'){
      addPaciente({ nombre:r.nombre, rut:r.rut, comuna:r.comuna, riesgo:r.riesgo });
      imported++;
    } else if (r.status==='update'){
      const key = _rutClean(r.rut);
      const p = byRut.get(key);
      if (p){
        p.nombre = r.nombre;
        p.rut = r.rut;
        p.comuna = r.comuna;
        p.riesgo = r.riesgo;
      }
      updated++;
    } else if (r.status==='error'){
      errors++;
    }
  });

  // Persistir actualizaciones
  localStorage.setItem('sisar_pacientes', JSON.stringify(Array.from(byRut.values())));

  // Auditoría ligera
  const auditKey = 'sisar_import_auditoria';
  const me = (typeof currentUser === 'function' ? currentUser() : null);
  const batch = {
    id: Date.now().toString(),
    dt: new Date().toISOString(),
    user: me ? `${me.nombre} (${me.role})` : 'desconocido',
    totals: {
      read: __impRows.length,
      imported, updated,
      dup: __impRows.filter(r=>r.status==='dup').length,
      errors
    },
    sample: __impRows.slice(0,3).map(r=>({row:r.row, rut:r.rut, status:r.status}))
  };
  const audit = JSON.parse(localStorage.getItem(auditKey)||'[]');
  audit.push(batch);
  localStorage.setItem(auditKey, JSON.stringify(audit));

  // UI feedback
  _toast(`Importadas ${imported}, actualizadas ${updated}, omitidas ${__impRows.length - imported - updated}.`, 'success');

  // Refrescar vistas si existen
  if (typeof renderPacientes === 'function') renderPacientes();
  if (typeof setKPIs === 'function') setKPIs();
  if (typeof setKPIsReportes === 'function') setKPIsReportes();

  // Cerrar modal si está abierto
  const el = document.getElementById('modalImport');
  if (el){ const m = bootstrap.Modal.getInstance(el); if (m) m.hide(); }
}

// Plantilla CSV
function downloadTemplateCSV(){
  const rows = [
    ['Nombre','RUT','Comuna','Riesgo'],
    ['Ana Rivas','11.111.111-1','Temuco','Alto'],
    ['Carlos Soto','22.222.222-2','Pitrufquén','Medio'],
    ['Daniela Pérez','33.333.333-3','Villarrica','Bajo'],
  ];
  const csv = rows.map(r=>r.map(x=>`"${(x||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'plantilla_pacientes.csv';
  a.click();
}
