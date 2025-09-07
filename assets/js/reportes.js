// assets/js/reportes.js
function getRutas(){ try{return JSON.parse(localStorage.getItem('sisar_rutas'))||[]}catch{return[]} }
function getCitas(){ try{return JSON.parse(localStorage.getItem('sisar_agenda'))||[]}catch{return[]} }

function setKPIsReportes(){
  const pacientes = getPacientes();
  const atenciones = getAtenciones();
  const pendientes = atenciones.filter(a=>a.estado==='pendiente').length;
  const rutas = getRutas();

  document.getElementById('kPacientes').textContent = pacientes.length;
  
  //document.getElementById('kAtenciones').textContent = atenciones.length; // Atenciones realizadas (totales) se registran de inmediato
  // NEW: solo sincronizadas
  const atSync = atenciones.filter(a=>a.estado==='sincronizada').length; // Atenciones realizadas ahora quedan en Pendiente de Sync
  document.getElementById('kAtenciones').textContent = atSync;

  document.getElementById('kPendientes').textContent = pendientes;
  document.getElementById('kRutas').textContent = rutas.length;
}
function chartRiesgo(){
  const ctx = document.getElementById('chartRiesgo'); if(!ctx) return;
  const pacientes = getPacientes();
  const g = {Alto:0, Medio:0, Bajo:0};
  pacientes.forEach(p=> g[p.riesgo] = (g[p.riesgo]||0)+1 );
  new Chart(ctx, { type:'bar', data:{
      labels:Object.keys(g),
      datasets:[{ label:'Pacientes', data:Object.values(g), borderWidth:2 }]
    },
    options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}
function chartAgenda(){
  const ctx = document.getElementById('chartAgenda'); if(!ctx) return;
  const citas = getCitas();
  const g = {pendiente:0, realizada:0, cancelada:0};
  citas.forEach(c=> g[c.estado] = (g[c.estado]||0)+1 );
  new Chart(ctx, { type:'doughnut', data:{
      labels:Object.keys(g),
      datasets:[{ data:Object.values(g) }]
    }, options:{ responsive:true }
  });
}

function exportPacientesCSV(){
  const rows = [['Nombre','RUT','Comuna','Riesgo']];
  getPacientes().forEach(p=> rows.push([p.nombre,p.rut,p.comuna,p.riesgo]));
  const csv = rows.map(r=>r.map(x=>`"${(x||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pacientes.csv';
  a.click();
}

document.addEventListener('DOMContentLoaded', ()=>{
  setKPIsReportes();
  chartRiesgo();
  chartAgenda();
  document.getElementById('btnExportCSV').addEventListener('click', exportPacientesCSV);
});
