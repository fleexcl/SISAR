// assets/js/rutas.js
const RUTAS_KEY = 'sisar_rutas'; // [{id, fecha, comuna, estado, pacientes:[ids]}]
// Toast seguro (usa showToast si existe; si no, cae a alert)
function _toast(msg, type='info'){
  try{
    if (typeof showToast === 'function') return showToast(msg, type);
  }catch(e){}
  alert(msg);
}

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
  // Cuando el modal se muestre, recalculamos el mapa y lo refrescamos
  document.getElementById('modalRuta').addEventListener('shown.bs.modal', () => {
  // __ensureMap() es la función que devuelve/crea el mapa Leaflet del modal
  if (typeof __ensureMap === 'function') {
    const map = __ensureMap();
    if (map && typeof map.invalidateSize === 'function') map.invalidateSize();
    }
  if (typeof refreshMapRuta === 'function') {
    // vuelve a pintar marcadores/ajustar bounds
    setTimeout(refreshMapRuta, 10);
      }
    });
  document.getElementById('btnNuevaRuta').addEventListener('click', ()=>{
    editingId=null;
    document.getElementById('rFecha').value = new Date().toISOString().slice(0,10);
    document.getElementById('rComuna').value='';
    document.getElementById('rEstado').value='planificada';
    renderCheckPacientes([]);
    setTimeout(refreshMapRuta, 50); // permite que el modal pinte antes de inicializar mapa
    modalRuta.show();
  });
  document.getElementById('btnGuardarRuta').addEventListener('click', ()=>{
    const fecha = document.getElementById('rFecha').value;
    const comuna= document.getElementById('rComuna').value.trim();
    const estado= document.getElementById('rEstado').value;
    const pacientes = Array.from(document.querySelectorAll('.chkPaciente:checked')).map(x=>x.value);

    // Validaciones en Rutas
    if(!fecha || !comuna){ 
        _toast('Completa fecha y comuna.', 'warning');
            return; 
            }
    if(pacientes.length === 0){
        _toast('Debes asignar al menos un paciente a la ruta.', 'warning');
            return;
            }
        saveRuta({ id:editingId, fecha, comuna, estado, pacientes });
        _toast('Ruta guardada.', 'success');
    modalRuta.hide(); renderRutas();
  });

  renderRutas();
});

// Redibuja mapa cuando (des)seleccionas pacientes en el modal
const _rPac = document.getElementById('rPacientes');
if (_rPac) {
  _rPac.addEventListener('change', (e)=>{
    if (e.target && e.target.classList.contains('chkPaciente')) refreshMapRuta();
  });
}
// Centrar en GPS del dispositivo
const _btnGPS = document.getElementById('btnRutaGPS');
if (_btnGPS) {
  _btnGPS.addEventListener('click', centerOnGPS);
}

function renderCheckPacientes(selected){
  const wrap = document.getElementById('rPacientes');
  const list = getPacientes();
  wrap.innerHTML = list.map(p=>{
  const hasGeo = (p.lat!=null && p.lng!=null);
  const geoBadge = hasGeo
    ? '<span class="badge bg-success-subtle text-success ms-1">Geo</span>'
    : '<span class="badge bg-secondary-subtle text-secondary ms-1">Sin geo</span>';
    return `
        <div class="col-6 col-md-4">
          <div class="form-check">
            <input class="form-check-input chkPaciente" type="checkbox" value="${p.id}" id="p_${p.id}" ${selected.includes(p.id)?'checked':''}>
              <label class="form-check-label" for="p_${p.id}">
                ${p.nombre} <span class="text-muted small">(${p.comuna||'-'})</span> ${geoBadge}
              </label>
            </div>
          </div>
          `;
      }).join('');
    }

function openRuta(id){
  const r = listRutas().find(x=>x.id===id);
  if(!r) return;
  editingId = r.id;
  document.getElementById('rFecha').value = r.fecha||'';
  document.getElementById('rComuna').value = r.comuna||'';
  document.getElementById('rEstado').value = r.estado||'planificada';
  renderCheckPacientes(r.pacientes||[]);
  setTimeout(refreshMapRuta, 50);
  modalRuta.show();
}

// === Mapa de Ruta (Leaflet) ===
let __mapRuta = null;
let __mapMarkers = [];
let __yoMarker = null;

// Colores por riesgo
function __colorPorRiesgo(r){
  if(r==='Alto') return '#dc2626';
  if(r==='Medio') return '#f59e0b';
  return '#16a34a';
}

function __ensureMap(){
  const el = document.getElementById('mapRuta');
  if (!el) return null;

  if (!__mapRuta){
    __mapRuta = L.map(el).setView([-38.7359, -72.5904], 11); // Temuco por defecto
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(__mapRuta);
  }
  return __mapRuta;
}

function __clearMarkers(){
  __mapMarkers.forEach(m=> m.remove());
  __mapMarkers = [];
}

function refreshMapRuta(){
  const map = __ensureMap();
  if (!map) return;

  __clearMarkers();

  // Pacientes seleccionados en el modal
  const selIds = Array.from(document.querySelectorAll('.chkPaciente:checked')).map(x=>x.value);
  if (selIds.length === 0){ map.setView([-38.7359, -72.5904], 11); return; }

  const all = getPacientes(); // del storage.js
  const sel = all.filter(p => selIds.includes(p.id) && p.lat!=null && p.lng!=null);

  // Marcadores de pacientes con geo
  const bounds = [];
  sel.forEach(p=>{
    const color = __colorPorRiesgo(p.riesgo || 'Bajo');
    const icon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></div>`,
      iconSize: [14,14],
      iconAnchor: [7,7]
    });
    const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
    m.bindPopup(`
      <b>${p.nombre}</b><br>
      Riesgo: ${p.riesgo||'-'}<br>
      ${p.direccion ? p.direccion+'<br>' : '' }
      <button class="btn btn-sm btn-primary mt-2" onclick="window.open('${__navURL(p.lat,p.lng)}','_blank')">
        <i class="fa-solid fa-turn-up me-1"></i> Navegar
      </button>
    `);
    __mapMarkers.push(m);
    bounds.push([p.lat, p.lng]);
  });

  // Ajusta vista
  if (bounds.length === 1){
    map.setView(bounds[0], 14);
  } else if (bounds.length > 1){
    map.fitBounds(bounds, { padding:[30,30] });
  }
}

function centerOnGPS(){
  const map = __ensureMap();
  if (!map || !navigator.geolocation){
    _toast('GPS no disponible en este dispositivo.', 'warning'); return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos)=>{
      const { latitude, longitude } = pos.coords;
      if (__yoMarker) __yoMarker.remove();
      __yoMarker = L.circleMarker([latitude, longitude], {
        radius: 7, color:'#2563eb', fillColor:'#2563eb', fillOpacity:0.9, weight:2
      }).addTo(map).bindPopup('<b>Tú</b><br>Posición actual');
      map.setView([latitude, longitude], 14);
    },
    ()=>{
      _toast('No fue posible obtener tu ubicación.', 'danger');
    },
    { enableHighAccuracy:true, timeout:8000, maximumAge:0 }
  );
}

// URL simple para abrir Google Maps con destino = lat,lng
function __navURL(lat, lng){
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

window.addEventListener('resize', () => {
  if (window.mapPicker?.invalidateSize) mapPicker.invalidateSize();
  if (typeof __ensureMap === 'function') {
    const map = __ensureMap();
    if (map?.invalidateSize) map.invalidateSize();
  }
});
