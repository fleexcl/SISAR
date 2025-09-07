// assets/js/rutas.js
const RUTAS_KEY = 'sisar_rutas'; // [{id, fecha, comuna, estado, pacientes:[ids]}]

function _rutasRead(){ try{ return JSON.parse(localStorage.getItem(RUTAS_KEY))||[] }catch{ return [] } }
function _rutasWrite(list){ localStorage.setItem(RUTAS_KEY, JSON.stringify(list)); }

function listRutas(){ return _rutasRead(); }
function saveRuta(r){
  const list = _rutasRead();
  if(!r.id){ r.id = Date.now().toString(); list.push(r); }
  else{
    const i = list.findIndex(x=>x.id===r.id);
    if(i>=0) list[i]=r; else list.push(r);
  }
  _rutasWrite(list);
}
function deleteRuta(id){
  _rutasWrite(_rutasRead().filter(x=>x.id!==id));
}

function renderRutas(){
  const tbody = document.getElementById('tbodyRutas');
  const list = listRutas().sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));
  tbody.innerHTML = list.map(r=>`
    <tr>
      <td>${r.fecha||'-'}</td>
      <td>${r.comuna||'-'}</td>
      <td>${(r.pacientes||[]).length}</td>
      <td>
        <span class="badge ${r.estado==='terminada'?'bg-success-subtle text-success':r.estado==='en_curso'?'bg-warning-subtle text-warning':'bg-secondary-subtle text-secondary'}">
          ${r.estado||'planificada'}
        </span>
      </td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-secondary me-1" onclick="openRuta('${r.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-sm btn-outline-success me-1" onclick="markRuta('${r.id}','terminada')"><i class="fa-solid fa-flag-checkered"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="if(confirm('Eliminar ruta?')){deleteRuta('${r.id}');renderRutas();}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function markRuta(id, estado){
  const list = _rutasRead();
  const r = list.find(x=>x.id===id);
  if(!r) return;
  r.estado = estado;
  _rutasWrite(list);
  renderRutas();
}

// Modal
let modalRuta, editingId=null;
document.addEventListener('DOMContentLoaded', ()=>{
  modalRuta = new bootstrap.Modal(document.getElementById('modalRuta'));
  document.getElementById('btnNuevaRuta').addEventListener('click', ()=>{
    editingId=null;
    document.getElementById('rFecha').value = new Date().toISOString().slice(0,10);
    document.getElementById('rComuna').value='';
    document.getElementById('rEstado').value='planificada';
    renderCheckPacientes([]);
    modalRuta.show();
  });
  document.getElementById('btnGuardarRuta').addEventListener('click', ()=>{
    const fecha = document.getElementById('rFecha').value;
    const comuna= document.getElementById('rComuna').value.trim();
    const estado= document.getElementById('rEstado').value;
    const pacientes = Array.from(document.querySelectorAll('.chkPaciente:checked')).map(x=>x.value);

    // Validaciones en Rutas
    if(!fecha || !comuna){ 
        showToast('Completa fecha y comuna.', 'warning');
            return; 
            }
    if(pacientes.length === 0){
        showToast('Debes asignar al menos un paciente a la ruta.', 'warning');
            return;
            }
        saveRuta({ id:editingId, fecha, comuna, estado, pacientes });
        showToast('Ruta guardada.', 'success');
    modalRuta.hide(); renderRutas();
  });

  renderRutas();
});

function renderCheckPacientes(selected){
  const wrap = document.getElementById('rPacientes');
  const list = getPacientes();
  wrap.innerHTML = list.map(p=>`
    <div class="col-6 col-md-4">
      <div class="form-check">
        <input class="form-check-input chkPaciente" type="checkbox" value="${p.id}" id="p_${p.id}" ${selected.includes(p.id)?'checked':''}>
        <label class="form-check-label" for="p_${p.id}">${p.nombre} <span class="text-muted small">(${p.comuna})</span></label>
      </div>
    </div>
  `).join('');
}

function openRuta(id){
  const r = listRutas().find(x=>x.id===id);
  if(!r) return;
  editingId = r.id;
  document.getElementById('rFecha').value = r.fecha||'';
  document.getElementById('rComuna').value = r.comuna||'';
  document.getElementById('rEstado').value = r.estado||'planificada';
  renderCheckPacientes(r.pacientes||[]);
  modalRuta.show();
}
