// assets/js/dashboard.js
function setKPIs() {
  document.getElementById('kpiRutas').textContent = 12;
  document.getElementById('kpiAtenciones').textContent = 12;
  document.getElementById('kpiPacientes').textContent = 5;
  document.getElementById('kpiAlertas').textContent = 3;
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
