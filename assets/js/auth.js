// assets/js/auth.js
const SISAR_AUTH_KEY = 'sisar_user';

// "Base" de usuarios de demo: email -> {password, role, nombre}
const USERS = {
  'admin@sisar.cl':   { password: '1234', role: 'admin',       nombre: 'Administrador | Elvis Carrasco Báez' },
  'coord@sisar.cl':   { password: '1234', role: 'coordinador', nombre: 'Coordinador | Juanito Perez' },
  'clinico@sisar.cl': { password: '1234', role: 'clinico',     nombre: 'Personal Clínico | Marcela Gutierrez' },
  'conductor@sisar.cl': { password: '1234', role: 'conductor', nombre: 'Conductor | David Fuentes' },
  'analista@sisar.cl':  { password: '1234', role: 'analista',  nombre: 'Analista | Pedro Jimenez' }
};

function login(email, password){
  const u = USERS[email];
  if(!u) return { ok:false, msg:'Usuario no registrado' };
  if(u.password !== password) return { ok:false, msg:'Contraseña incorrecta' };

  const user = { email, role: u.role, nombre: u.nombre };
  localStorage.setItem(SISAR_AUTH_KEY, JSON.stringify(user));
  return { ok:true, user };
}

function currentUser(){
  try { return JSON.parse(localStorage.getItem(SISAR_AUTH_KEY)); }
  catch { return null; }
}

function logout(){
  localStorage.removeItem(SISAR_AUTH_KEY);
  location.href = 'login.html';
}

//reutilizable en todas las páginas Badge para Sync con variable()
function wireSyncButton(options = {}) {
  const btn = document.getElementById('btnSync');
  if (!btn) return;
  btn.addEventListener('click', ()=>{
    const n = syncPendientes();
    if (typeof updatePendBadge === 'function') updatePendBadge();
    if (typeof options.onAfterSync === 'function') options.onAfterSync(n);
    //alert(n ? `Sincronizadas ${n} atenciones pendientes.` : 'No hay atenciones pendientes.');
    showToast(n ? `Sincronizadas ${n} atenciones pendientes.` : 'No hay atenciones pendientes.', n ? 'success' : 'info');
  });
}

// Helper de notificación visual (Bootstrap Toast)
function showToast(message, type='info') {
  const toastEl = document.getElementById('appToast');
  const bodyEl  = document.getElementById('appToastBody');
  if (!toastEl || !bodyEl) { console.warn('Toast container no encontrado'); return; }

  // Reset estilos y aplicar según tipo
  toastEl.className = 'toast align-items-center border-0';
  bodyEl.className  = 'toast-body';
  const stylesByType = {
    success: 'text-bg-success',
    danger:  'text-bg-danger',
    warning: 'text-bg-warning',
    info:    'text-bg-primary'
  };
  toastEl.classList.add(stylesByType[type] || stylesByType.info);
  bodyEl.textContent = message;

  const t = bootstrap.Toast.getOrCreateInstance(toastEl);
  t.show();
}
