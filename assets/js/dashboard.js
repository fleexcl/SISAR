// assets/js/dashboard.js
function setKPIs() {
  // Fuentes reales desde storage.js y localStorage
  const pacientes  = getPacientes();    // []
  const atenciones = getAtenciones();   // []
  const rutas      = JSON.parse(localStorage.getItem('sisar_rutas') || '[]');

  // Cálculos (alineados con reportes.js)
  const rutasTerminadas = rutas.filter(r => r.estado === 'terminada').length;
  const pendientesSync  = atenciones.filter(a => a.estado === 'pendiente').length;

  // Pintar KPIs
  document.getElementById('kpiRutas').textContent      = rutasTerminadas;     // Rutas recorridas
  
  //document.getElementById('kpiAtenciones').textContent = atenciones.length;   // Atenciones realizadas (totales) se registran de inmediato
  
  // NEW: solo sincronizadas
  const atSync = atenciones.filter(a => a.estado === 'sincronizada').length; // Atenciones realizadas ahora quedan en Pendiente de Sync
  document.getElementById('kpiAtenciones').textContent = atSync;

  document.getElementById('kpiPacientes').textContent  = pacientes.length;    // Pacientes activos
  document.getElementById('kpiAlertas').textContent    = pendientesSync;      // “Alertas” = pend. de Sync
}

function renderCharts() {
  const ctx1 = document.getElementById('chartRevenue');
  if (!ctx1) return;
  new Chart(ctx1, {
    type: 'line',
    data: {
      labels: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],
      datasets: [{
        label: 'Grafico Semanal',
        data: [12, 7, 16, 9, 14, 11, 18],
        fill: true,
        tension: 0.35,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: { tooltip: { backgroundColor:'rgba(0,0,0,.75)', padding:10, cornerRadius:8 } },
      scales: { y: { beginAtZero: true } }
    }
  });
}
