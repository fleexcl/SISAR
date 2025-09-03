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
