// assets/js/config.js
function seedDemo(){
  // Pacientes
  if(getPacientes().length===0){
    addPaciente({ nombre:'Ana Rivas', rut:'11.111.111-1', comuna:'Temuco', riesgo:'Alto' });
    addPaciente({ nombre:'Carlos Soto', rut:'22.222.222-2', comuna:'Pitrufquén', riesgo:'Medio' });
    addPaciente({ nombre:'Daniela Pérez', rut:'33.333.333-3', comuna:'Villarrica', riesgo:'Bajo' });
  }
  // Atenciones
  addAtencion({ pacienteId:getPacientes()[0].id, fechaISO:new Date().toISOString(), notas:'Control general demo' });
  // Rutas básicas
  const rutas = JSON.parse(localStorage.getItem('sisar_rutas')||'[]');
  if(rutas.length===0){
    const pids = getPacientes().map(p=>p.id);
    rutas.push({ id:Date.now().toString(), fecha:new Date().toISOString().slice(0,10), comuna:'Temuco', estado:'planificada', pacientes:pids.slice(0,2) });
    localStorage.setItem('sisar_rutas', JSON.stringify(rutas));
  }
  // Agenda básica
  const agenda = JSON.parse(localStorage.getItem('sisar_agenda')||'[]');
  if(agenda.length===0){
    agenda.push({ id:(Date.now()+1).toString(), fechaISO:new Date().toISOString().slice(0,16), pacienteId:getPacientes()[0].id, responsable:'Clínico Demo', estado:'pendiente' });
    localStorage.setItem('sisar_agenda', JSON.stringify(agenda));
  }
  //alert('Datos de demostración cargados.');
  _toast('Datos de demostración cargados','success');
}
function clearAll(){
  if(!confirm('¿Borrar todos los datos locales?')) return;
  localStorage.removeItem('sisar_pacientes');
  localStorage.removeItem('sisar_atenciones');
  localStorage.removeItem('sisar_rutas');
  localStorage.removeItem('sisar_agenda');
  alert('Datos locales eliminados.');
  location.reload();
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('appBuild').textContent = new Date().toLocaleString();
  document.getElementById('btnSeed').addEventListener('click', seedDemo);
  document.getElementById('btnClear').addEventListener('click', clearAll);
});
