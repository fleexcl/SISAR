// Utilidades simples de "persistencia" en localStorage
const DB_KEYS = {
  PACIENTES: 'sisar_pacientes',
  ATENCIONES: 'sisar_atenciones' // {id, pacienteId, fechaISO, notas, estado: 'pendiente'|'sincronizada'}
};

function _read(key){
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function _write(key, arr){ localStorage.setItem(key, JSON.stringify(arr)); }

// === Pacientes ===
function getPacientes(){ return _read(DB_KEYS.PACIENTES); }
function addPaciente(p){
  const list = getPacientes();
  const id = Date.now().toString();
  list.push({ id, ...p });
  _write(DB_KEYS.PACIENTES, list);
  return id;
}

// === Atenciones ===
function getAtenciones(){ return _read(DB_KEYS.ATENCIONES); }
function addAtencion(a){
  const list = getAtenciones();
  const id = Date.now().toString();
  list.push({ id, ...a, estado:'pendiente' });
  _write(DB_KEYS.ATENCIONES, list);
  return id;
}
function syncPendientes(){
  const list = getAtenciones();
  let count = 0;
  const synced = list.map(x=>{
    if(x.estado === 'pendiente'){ count++; return { ...x, estado:'sincronizada' }; }
    return x;
  });
  _write(DB_KEYS.ATENCIONES, synced);
  return count; // cuántas sincronizó
}
