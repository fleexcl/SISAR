// Render de tabla + alta y "registrar atención (offline)"
function renderPacientes(){
  const tbody = document.getElementById('tbodyPacientes');
  const list = getPacientes();

  // Si no hay datos, semilla rápida
  if(list.length === 0){
    addPaciente({ nombre:'Elvis Matías Carrasco Báez', rut:'12.345.678-9', comuna:'Temuco', riesgo:'Alto' });
    addPaciente({ nombre:'María Torres', rut:'9.876.543-2', comuna:'Pitrufquén', riesgo:'Medio' });
    addPaciente({ nombre:'Luis González', rut:'7.654.321-1', comuna:'Villarrica', riesgo:'Bajo' });
  }

  const rows = getPacientes().map(p => `
    <tr>
      <td>${p.nombre}</td>
      <td>${p.rut}</td>
      <td>${p.comuna}</td>
      <td>
        <span class="badge ${badgeByRisk(p.riesgo)}">${p.riesgo}</span>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick="registrarAtencion('${p.id}')">
          <i class="fa-solid fa-notes-medical me-1"></i> Registrar Atención (offline)
        </button>
      </td>
    </tr>
  `).join('');
  tbody.innerHTML = rows;
}

function badgeByRisk(r){
  if(r === 'Alto') return 'bg-danger-subtle text-danger';
  if(r === 'Medio') return 'bg-warning-subtle text-warning';
  return 'bg-success-subtle text-success';
}

function registrarAtencion(pacienteId){
  const fechaISO = new Date().toISOString();
  addAtencion({ pacienteId, fechaISO, notas:'Controles básicos registrados (demo)' });
  alert('Atención registrada en modo offline (pendiente de sincronización).');
}

// Modal: alta rápida
document.addEventListener('DOMContentLoaded', ()=>{
  renderPacientes();

  const modalEl = document.getElementById('modalPaciente');
  const modal = new bootstrap.Modal(modalEl);

  document.getElementById('btnNuevo').addEventListener('click', ()=> modal.show());
  document.getElementById('btnGuardarPaciente').addEventListener('click', ()=>{
    const nombre = document.getElementById('pNombre').value.trim();
    const rut    = document.getElementById('pRut').value.trim();
    const comuna = document.getElementById('pComuna').value.trim();
    const riesgo = document.getElementById('pRiesgo').value;
    if(!nombre || !rut || !comuna){ alert('Completa los campos.'); return; }
    addPaciente({ nombre, rut, comuna, riesgo });
    modal.hide();
    renderPacientes();
  });
});