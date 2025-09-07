// assets/js/agenda.js
const AGENDA_KEY = 'sisar_agenda'; // [{id, fechaISO, pacienteId, responsable, estado}]

function _aRead(){ try{ return JSON.parse(localStorage.getItem(AGENDA_KEY))||[] }catch{ return [] } }
function _aWrite(list){ localStorage.setItem(AGENDA_KEY, JSON.stringify(list)); }

function listCitas(){ return _aRead().sort((a,b)=> (a.fechaISO||'').localeCompare(b.fechaISO||'')); }
function saveCita(c){
  const list = _aRead();
  if(!c.id){ c.id=Date.now().toString(); list.push(c); }
  else{
    const i=list.findIndex(x=>x.id===c.id);
    if(i>=0) list[i]=c; else list.push(c);
  }
  _aWrite(list);
}
function deleteCita(id){ _aWrite(_aRead().filter(x=>x.id!==id)); }

let modalCita, editingId=null;
function renderAgenda(){
  const tbody = document.getElementById('tbodyAgenda');
  const citas = listCitas();
  const pacientes = getPacientes();
  tbody.innerHTML = citas.map(c=>{
    const p = pacientes.find(x=>x.id===c.pacienteId);
    return `
      <tr>
        <td>${new Date(c.fechaISO).toLocaleString()}</td>
        <td>${p? p.nombre : '-'}</td>
        <td>${c.responsable||'-'}</td>
        <td>
          <span class="badge ${c.estado==='realizada'?'bg-success-subtle text-success':c.estado==='cancelada'?'bg-danger-subtle text-danger':'bg-warning-subtle text-warning'}">${c.estado}</span>
        </td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-secondary me-1" onclick="openCita('${c.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-outline-success me-1" onclick="updateEstado('${c.id}','realizada')"><i class="fa-solid fa-check"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="if(confirm('Eliminar cita?')){deleteCita('${c.id}');renderAgenda();}"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}
function updateEstado(id,estado){
  const list=_aRead(); const c=list.find(x=>x.id===id); if(!c) return;
  c.estado=estado; _aWrite(list); renderAgenda();
}
function loadPacientesSelect(selId, selected){
  const sel = document.getElementById(selId); const list=getPacientes();
  sel.innerHTML = list.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${p.nombre}</option>`).join('');
}
document.addEventListener('DOMContentLoaded', ()=>{
  modalCita = new bootstrap.Modal(document.getElementById('modalCita'));
  document.getElementById('btnNuevaCita').addEventListener('click', ()=>{
    editingId=null;
    document.getElementById('cFecha').value = new Date().toISOString().slice(0,16);
    loadPacientesSelect('cPaciente', null);
    document.getElementById('cResp').value='';
    document.getElementById('cEstado').value='pendiente';
    modalCita.show();
  });
  document.getElementById('btnGuardarCita').addEventListener('click', ()=>{
    const fechaISO = document.getElementById('cFecha').value;
    const pacienteId= document.getElementById('cPaciente').value;
    const responsable= document.getElementById('cResp').value.trim();
    const estado= document.getElementById('cEstado').value;

    // Validaciones en Agenda
    if(!fechaISO || !pacienteId || !responsable){
        showToast('Completa fecha, paciente y responsable.', 'warning');
            return;
                }
        saveCita({ id:editingId, fechaISO, pacienteId, responsable, estado });
        showToast('Cita guardada.', 'success');
 
    modalCita.hide(); renderAgenda();
  });
  renderAgenda();
});
function openCita(id){
  const c = listCitas().find(x=>x.id===id); if(!c) return;
  editingId=c.id;
  document.getElementById('cFecha').value=c.fechaISO;
  loadPacientesSelect('cPaciente', c.pacienteId);
  document.getElementById('cResp').value=c.responsable||'';
  document.getElementById('cEstado').value=c.estado||'pendiente';
  modalCita.show();
}
