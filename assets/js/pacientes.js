// assets/js/pacientes.js — MVP Geo
// - Alta/edición de paciente con direccion/lat/lng/precision
// - Botón "Usar mi ubicación" (GPS)
// - Map picker (Leaflet) con pin arrastrable por clic

// ==== Utilidades UI ===========================================
// Toast seguro (usa showToast si existe; si no, cae a alert)
function _toast(msg, type='info'){
  try{
    if (typeof showToast === 'function') return showToast(msg, type);
  }catch(e){}
  alert(msg);
  _toast(msg, 'danger');
}
function badgeByRisk(r){
  if(r === 'Alto') return 'bg-danger-subtle text-danger';
  if(r === 'Medio') return 'bg-warning-subtle text-warning';
  return 'bg-success-subtle text-success';
}

// ==== Tabla de pacientes ======================================
function renderPacientes(){
  const tbody = document.getElementById('tbodyPacientes');
  const list = getPacientes();

  // Semilla si está vacío (como tenías)
  if(list.length === 0){
    addPaciente({ nombre:'Elvis Matías Carrasco Báez', rut:'12.345.678-9', comuna:'Temuco', riesgo:'Alto' });
    addPaciente({ nombre:'María Torres', rut:'9.876.543-2', comuna:'Pitrufquén', riesgo:'Medio' });
    addPaciente({ nombre:'Luis González', rut:'7.654.321-1', comuna:'Villarrica', riesgo:'Bajo' });
  }

  const rows = getPacientes().map(p => {
    const hasGeo = (p.lat != null && p.lng != null);
    const chipGeo = hasGeo
      ? '<span class="badge bg-success-subtle text-success">Geo: Sí</span>'
      : '<span class="badge bg-secondary-subtle text-secondary">Geo: No</span>';
    return `
      <tr>
        <td>${p.nombre}</td>
        <td>${p.rut}</td>
        <td>${p.comuna||'-'}</td>
        <td>
          <span class="badge ${badgeByRisk(p.riesgo)}">${p.riesgo||'-'}</span>
          <div class="small mt-1">${chipGeo}</div>
        </td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-secondary me-1" onclick="openPaciente('${p.id}')">
            <i class="fa-solid fa-pen me-1"></i>Editar
          </button>
          <button class="btn btn-sm btn-outline-primary" onclick="registrarAtencion('${p.id}')">
            <i class="fa-solid fa-notes-medical me-1"></i> Atención (offline)
          </button>
        </td>
      </tr>
    `;
  }).join('');
  tbody.innerHTML = rows;
}

// ==== Validación RUT (tu misma lógica) ========================
function validarRUT(rut) {
  rut = (rut||'').replace(/\./g,'').replace(/-/g,'').toUpperCase();
  if(!/^[0-9]+[0-9K]$/.test(rut)) return false;
  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1);
  let suma = 0, mul = 2;
  for(let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (suma % 11);
  const dvEsperado = res === 11 ? '0' : res === 10 ? 'K' : res.toString();
  return dv === dvEsperado;
}

// ==== Atenciones (como ya tenías) =============================
function registrarAtencion(pacienteId){
  const fechaISO = new Date().toISOString();
  addAtencion({ pacienteId, fechaISO, notas:'Controles básicos registrados (demo)' });
  _toast('Atención registrada en modo offline (pendiente de sincronización).','success');
  if (typeof updatePendBadge === 'function') updatePendBadge();
}

// ==== Modal Paciente + Geo ====================================
let modalPac, editingId=null;
let mapPicker = null, mapMarker = null;

// === Autocompletar (Nominatim / OSM) =========================
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

// Debounce: espera a que el usuario deje de tipear
function debounce(fn, wait=500){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); };
}

// Buscar sugerencias en Nominatim (limit 5, idioma ES, sesgo a Chile)
async function fetchSugerenciasDireccion(q, comuna){
  if(!q || q.trim().length < 3) return [];
  const params = new URLSearchParams({
    q: comuna ? `${q}, ${comuna}, Chile` : `${q}, Chile`,
    format: 'json',
    addressdetails: '1',
    limit: '5',
    'accept-language': 'es'
  });
  const url = `${NOMINATIM_ENDPOINT}?${params.toString()}`;

  // Nota: el Referer lo envía el navegador, suficiente para uso demo responsable.
  const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if(!resp.ok) return [];
  const data = await resp.json();
  return data.map(item => ({
    display: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon)
  }));
}

// Pintar/ocultar la lista
function renderDirSuggest(items){
  const list = document.getElementById('dirSuggest');
  if(!list) return;
  if(!items || items.length === 0){
    list.innerHTML = '';
    list.classList.add('d-none');
    list.removeAttribute('data-items');
    return;
  }
  list.innerHTML = items.map((it, idx)=>`
    <div class="autocomplete-item" data-idx="${idx}">${it.display}</div>
  `).join('');
  list.classList.remove('d-none');
  list.dataset.items = JSON.stringify(items);
}

// Selección desde la lista (click o Enter)
function selectDirItem(idx){
  const list = document.getElementById('dirSuggest');
  const items = JSON.parse(list?.dataset?.items || '[]');
  const it = items[idx];
  if(!it) return;
  const input = document.getElementById('pDireccion');
  if(input) input.value = it.display;
  // Mueve pin + rellena lat/lng (readonly) y marca precisión "aprox"
  setMarker(it.lat, it.lon, 'aprox');
  list.classList.add('d-none');
}

// Navegación con teclado en la lista
function onDirKeyDown(e){
  const list = document.getElementById('dirSuggest');
  if(!list || list.classList.contains('d-none')) return;

  const items = Array.from(list.querySelectorAll('.autocomplete-item'));
  let idx = items.findIndex(el => el.classList.contains('active'));

  if(e.key === 'ArrowDown'){
    e.preventDefault();
    idx = Math.min((idx<0?0:idx+1), items.length-1);
    items.forEach(el=>el.classList.remove('active'));
    items[idx]?.classList.add('active');
  } else if(e.key === 'ArrowUp'){
    e.preventDefault();
    idx = Math.max((idx<0?items.length-1:idx-1), 0);
    items.forEach(el=>el.classList.remove('active'));
    items[idx]?.classList.add('active');
  } else if(e.key === 'Enter'){
    e.preventDefault();
    if(idx >= 0) selectDirItem(idx);
  } else if(e.key === 'Escape'){
    list.classList.add('d-none');
  }
}

// Click en una sugerencia
function onDirClick(e){
  const row = e.target.closest('.autocomplete-item');
  if(!row) return;
  const idx = parseInt(row.dataset.idx, 10);
  selectDirItem(idx);
}

function initMapPicker(){
  const el = document.getElementById('mapPicker');
  if (!el) return;

  if (!mapPicker){
    // Centro por defecto (Araucanía/Temuco)
    mapPicker = L.map(el).setView([-38.7359, -72.5904], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(mapPicker);

    mapPicker.on('click', (e)=>{
      setMarker(e.latlng.lat, e.latlng.lng, 'aprox');
    });
  }
}

function setMarker(lat, lng, precision='aprox'){
  if (!mapPicker) return;
  if (!mapMarker){
    mapMarker = L.marker([lat, lng], { draggable:false }).addTo(mapPicker);
  }else{
    mapMarker.setLatLng([lat, lng]);
  }
  mapPicker.setView([lat, lng], Math.max(mapPicker.getZoom(), 14));

  document.getElementById('pLat').value = String(lat.toFixed(6));
  document.getElementById('pLng').value = String(lng.toFixed(6));
  document.getElementById('pPrecision').value = precision;
}

function clearGeo(){
  if (mapMarker){ mapMarker.remove(); mapMarker=null; }
  document.getElementById('pLat').value='';
  document.getElementById('pLng').value='';
  document.getElementById('pPrecision').value='sin';
}

function useGPS(){
  if (!navigator.geolocation){
    _toast('Este dispositivo no soporta GPS.', 'warning'); return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos)=>{
      const { latitude, longitude } = pos.coords;
      setMarker(latitude, longitude, 'gps');
      _toast('Ubicación obtenida por GPS.', 'success');
    },
    (err)=>{
      console.warn(err);
      _toast('No fue posible obtener tu ubicación.', 'danger');
    },
    { enableHighAccuracy:true, timeout:8000, maximumAge:0 }
  );
}

function openNuevo(){
  editingId = null;
  document.getElementById('modalPacienteTitle').textContent = 'Nuevo Paciente';
  document.getElementById('pNombre').value='';
  document.getElementById('pRut').value='';
  document.getElementById('pComuna').value='';
  document.getElementById('pRiesgo').value='Medio';
  document.getElementById('pDireccion').value='';
  clearGeo();
  initMapPicker();
  modalPac.show();
}

function openPaciente(id){
  const p = getPacientes().find(x=>x.id===id);
  if(!p){ _toast('Paciente no encontrado','danger'); return; }
  editingId = id;
  document.getElementById('modalPacienteTitle').textContent = 'Editar Paciente';
  document.getElementById('pNombre').value=p.nombre||'';
  document.getElementById('pRut').value=p.rut||'';
  document.getElementById('pComuna').value=p.comuna||'';
  document.getElementById('pRiesgo').value=p.riesgo||'Medio';
  document.getElementById('pDireccion').value=p.direccion||'';
  initMapPicker();
  if(p.lat!=null && p.lng!=null){ setMarker(p.lat, p.lng, p.precision||'aprox'); }
  else { clearGeo(); }
  modalPac.show();
}

function guardarPaciente(){
  const nombre = (document.getElementById('pNombre').value||'').trim();
  const rut    = (document.getElementById('pRut').value||'').trim();
  const comuna = (document.getElementById('pComuna').value||'').trim();
  const riesgo = document.getElementById('pRiesgo').value||'Medio';
  const direccion = (document.getElementById('pDireccion').value||'').trim();
  const lat = parseFloat(document.getElementById('pLat').value||'');
  const lng = parseFloat(document.getElementById('pLng').value||'');
  const precision = document.getElementById('pPrecision').value||'sin';

  if(!nombre || !rut || !comuna){
    _toast('Completa Nombre, RUT y Comuna.','warning'); return;
  }
  if(!validarRUT(rut)){
    _toast('RUT inválido.','danger'); return;
  }

  const common = {
    nombre, rut, comuna, riesgo,
    direccion: direccion || null,
    lat: isFinite(lat)? lat : null,
    lng: isFinite(lng)? lng : null,
    precision: (['gps','aprox'].includes(precision) ? precision : 'sin'),
    updatedAt: new Date().toISOString()
  };

  if(!editingId){
    addPaciente(common);
    _toast('Paciente creado.','success');
  }else{
    updatePaciente(editingId, common);
    _toast('Paciente actualizado.','success');
  }

  modalPac.hide();
  renderPacientes();
}

// ==== Inicio ==================================================
document.addEventListener('DOMContentLoaded', ()=>{
  
  renderPacientes();

  const modalEl = document.getElementById('modalPaciente');
  modalPac = new bootstrap.Modal(modalEl);

  document.getElementById('btnNuevo').addEventListener('click', openNuevo);
  document.getElementById('btnGuardarPaciente').addEventListener('click', guardarPaciente);
  document.getElementById('btnUseGPS').addEventListener('click', useGPS);
  document.getElementById('btnClearGeo').addEventListener('click', clearGeo);

  // Guard + roles + badge Sync (igual que otras páginas)
  const me = currentUser();
  if(!me){ location.href = 'login.html'; }
  const ui = document.getElementById('userInfo');
  if (ui) ui.textContent = `${me.nombre} — ${me.role}`;

    // --- Autocompletar de direcciones ---
  const dirInput = document.getElementById('pDireccion');
  const dirList  = document.getElementById('dirSuggest');

  const debouncedSearch = debounce(async ()=>{
    const q = dirInput?.value || '';
    const comuna = document.getElementById('pComuna')?.value || '';
    try{
      const items = await fetchSugerenciasDireccion(q, comuna);
      renderDirSuggest(items);
    }catch(e){
      // posiblemente sin conexión o error del proveedor
      renderDirSuggest([]);
    }
  }, 500);

  if (dirInput && dirList){
    dirInput.addEventListener('input', debouncedSearch);
    dirInput.addEventListener('keydown', onDirKeyDown);
    dirList.addEventListener('click', onDirClick);
  }

  // Ocultar lista al cerrar el modal o al hacer click fuera
  modalEl.addEventListener('hidden.bs.modal', ()=> renderDirSuggest([]));
  document.addEventListener('click', (e)=>{
    if (!dirList) return;
    if (!dirList.contains(e.target) && e.target !== dirInput){
      dirList.classList.add('d-none');
    }
  });
});

window.addEventListener('resize', () => {
  if (window.mapPicker?.invalidateSize) mapPicker.invalidateSize();
  if (typeof __ensureMap === 'function') {
    const map = __ensureMap();
    if (map?.invalidateSize) map.invalidateSize();
  }
});
