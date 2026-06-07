/* ====================================================
   ExpoEduca 2026 — Game Engine v2
   Escuela Secundaria Dr. Gabino Barreda · Atlixco, Pue.
   Turno Vespertino
   Correcciones v2:
     - Árboles y entradas SIEMPRE sobre edificios (z-order)
     - Domo I = rectángulo (no círculo)
     - Audiovisual/Segundos/Dirección renombrado y reubicado al sur
     - Carretera pasa al costado de la tienda
     - Sonido bip en salto (Web Audio API, sin archivos externos)
     - Carga en móvil: fetch con fallback inline, sin CORS issues
   ==================================================== */

'use strict';

/* ═══════════════════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════════════════ */
const STATE = {
  activities: [],
  discovered: new Set(),
  zoom: 1,
  panX: 0,
  panY: 0,
  frogX: 420,
  frogY: 310,
  frogFaceLeft: false,
  draggingFrog: false,
  draggingMap: false,
  lastTouchDist: 0,
  activeBuilding: null,
  explorerOpen: false,
  audioCtx: null,
  frogName: 'Explorador',
  entryUnlocked: false,
  achievements: [
    { id:'first',    threshold:1,  icon:'🐸', title:'¡Primera Visita!',    desc:'Exploraste tu primer espacio.' },
    { id:'explorer', threshold:4,  icon:'🗺️', title:'Explorador',           desc:'4 espacios descubiertos.' },
    { id:'half',     threshold:6,  icon:'⭐', title:'Mitad del Camino',     desc:'Más de la mitad explorado.' },
    { id:'expert',   threshold:9,  icon:'🏆', title:'Casi Experto',         desc:'9 espacios visitados.' },
    { id:'master',   threshold:14, icon:'🎓', title:'¡Maestro ExpoEduca!',  desc:'¡Mapa completo explorado!' }
  ],
  unlockedAchievements: new Set()
};

/* ═══════════════════════════════════════════════════
   DATOS DE ACTIVIDADES (fallback si no carga el JSON)
   Modifica actividades.json para cambiar estos textos.
═══════════════════════════════════════════════════ */
const ACTIVIDADES_DEFAULT = [
  { id:'futbol',          nombre:'Cancha de Fútbol',              actividad:'Torneo Relámpago de Fútbol',        horario:'11:00 - 14:00', responsable:'Academia de Ed. Física',       descripcion:'Torneo relámpago entre equipos de cada grupo. ¡A meter goles!',                                     color:'#4ADE80', emoji:'⚽' },
  { id:'snte',            nombre:'SNTE',                           actividad:'Estimysterios',                     horario:'09:00 - 14:00', responsable:'Academia de Matemáticas',        descripcion:'Retos de estimación.',                                                                               color:'#EC4899', emoji:'📋' },
  { id:'terceros_primeros',nombre:'Salones Terceros / Primeros',   actividad:'Proyectos Integradores',            horario:'09:30 - 13:30', responsable:'Academia Interdisciplinaria',    descripcion:'Exposición de proyectos integradores: medio ambiente, historia local y matemáticas aplicadas.',      color:'#FACC15', emoji:'📚' },
  { id:'banos',           nombre:'Baños',                          actividad:'Servicios Sanitarios',              horario:'Siempre abierto', responsable:'Personal de Intendencia',        descripcion:'¡Estuvo cerca la cosa, casi me gana!.',                                                             color:'#38BDF8', emoji:'🚽' },
  { id:'laboratorios',    nombre:'Laboratorios',                   actividad:'Experimentos de Ciencias',          horario:'09:00 - 13:00', responsable:'Academia de Ciencias Naturales', descripcion:'Experimentos interactivos de química, biología y física. ¡Ven a descubrir la ciencia!',               color:'#FACC15', emoji:'🔬' },
  { id:'audiovisual',     nombre:'Audiovisual Segundos Dirección', actividad:'Cine y Producciones Escolares',     horario:'10:00 - 13:00', responsable:'Academia de Español y Arte',     descripcion:'Proyección de cortometrajes y documentales producidos por alumnos de segundo grado y dirección.',    color:'#6B7280', emoji:'🎬' },
  { id:'domo1',           nombre:'Domo I',                         actividad:'Acto Cívico y Bienvenida',          horario:'09:00 - 09:30', responsable:'Dirección General',              descripcion:'Espacio principal para la inauguración. Presentaciones artísticas y discursos de bienvenida.',        color:'#94A3B8', emoji:'🎪' },
  { id:'computacion',     nombre:'Computación',                    actividad:'IA y Robótica',                     horario:'10:00 - 12:00', responsable:'Academia de Tecnología',         descripcion:'Demostración de proyectos de inteligencia artificial y robótica desarrollados por los alumnos.',      color:'#8B5CF6', emoji:'🤖' },
  { id:'domo2',           nombre:'Domo II',                        actividad:'Deportes y Activación Física',      horario:'10:00 - 14:00', responsable:'Academia de Educación Física',   descripcion:'Demostraciones deportivas, clases de zumba y torneos rápidos de basquetbol.',                         color:'#94A3B8', emoji:'🏀' },
  { id:'taller_costura',  nombre:'Taller de Costura',              actividad:'Moda Sustentable',                  horario:'10:00 - 13:00', responsable:'Academia Tecnológica',           descripcion:'Exposición de prendas con materiales reciclados. Demostración en vivo de técnicas de costura.',       color:'#EC4899', emoji:'🪡' },
  { id:'bodega',          nombre:'Bodega',                         actividad:'Exposición de Materiales',          horario:'10:00 - 12:00', responsable:'Personal Administrativo',        descripcion:'Muestra de materiales didácticos y recursos educativos del ciclo escolar.',                            color:'#F97316', emoji:'📦' },
  { id:'tienda',          nombre:'Tienda Escolar',                 actividad:'Feria Gastronómica Estudiantil',    horario:'09:00 - 14:00', responsable:'Comité de Padres',               descripcion:'Venta de alimentos preparados por alumnos como proyecto emprendedor. ¡Antojitos y postres!',          color:'#F97316', emoji:'🍕' },
  { id:'banos_contr',     nombre:'Contraloría Baños',              actividad:'Servicios Sanitarios',              horario:'Siempre abierto', responsable:'Personal de Intendencia',      descripcion:'Mi estómago pidió refuerzos.',                                                                        color:'#38BDF8', emoji:'🚻' }
];

/* ═══════════════════════════════════════════════════
   EDIFICIOS — coordenadas del mapa SVG 900×560
   ORDEN IMPORTANTE: los que van "debajo" se definen
   primero; árboles y entradas se dibujan AL FINAL.
═══════════════════════════════════════════════════ */
const BUILDINGS = [
  // ── Fila norte ──
  // (Estacionamiento eliminado)
  { id:'futbol',          x:295, y:15,  w:295, h:148, rx:18, color:'#4ADE80', label:'FÚTBOL',                        labelY:90  },
  { id:'snte',            x:610, y:38,  w:90,  h:75,  rx:14, color:'#EC4899', label:'SNTE',                          labelY:78  },
  { id:'taller_costura',  x:610, y:125, w:90,  h:80,  rx:14, color:'#EC4899', label:'TALLER\nCOSTURA',               labelY:167, multiline:true },
  { id:'bodega',          x:715, y:125, w:80,  h:80,  rx:14, color:'#F97316', label:'BODEGA',                        labelY:167 },

  // ── Fila media ──
  { id:'terceros_primeros',x:55, y:190, w:135, h:170, rx:18, color:'#FACC15', label:'TERCEROS\nPRIMEROS',            labelY:278, multiline:true },
  { id:'banos',            x:213,y:190, w:68,  h:68,  rx:12, color:'#38BDF8', label:'BAÑOS',                        labelY:227 },
  { id:'laboratorios',     x:284,y:185, w:115, h:78,  rx:14, color:'#FACC15', label:'LABORATORIOS',                 labelY:227 },
  { id:'domo1',            x:263,y:270, w:110, h:95,  rx:16, color:'#94A3B8', label:'DOMO I',                       labelY:320 },
  { id:'domo2',            x:500,y:258, w:105, h:90,  rx:14, color:'#94A3B8', label:'DOMO II',                      labelY:306 },

  // ── Audiovisual — al sur del estacionamiento, columna derecha ──
  { id:'audiovisual',      x:406,y:185, w:88,  h:165, rx:14, color:'#6B7280',
    label:'AUDIOVISUAL\nSEGUNDOS\nDIRECCIÓN',  labelY:260, multiline3:true },

  // ── Fila sur ──
  { id:'computacion',      x:230,y:380, w:125, h:62,  rx:14, color:'#8B5CF6', label:'COMPUTACIÓN',                  labelY:414 },
  { id:'banos_contr',      x:370,y:380, w:118, h:62,  rx:14, color:'#38BDF8', label:'CONTR.\nBAÑOS',                labelY:414, multiline:true },
  { id:'tienda',           x:498,y:380, w:130, h:62,  rx:14, color:'#F97316', label:'TIENDA\nESCOLAR',              labelY:414, multiline:true },
];

/* ═══════════════════════════════════════════════════
   ÁRBOLES — posiciones claras, sin edificios encima
   Se dibujan DESPUÉS de los edificios en buildSVGMap
═══════════════════════════════════════════════════ */
const TREES = [
  // Originales — sin los 3 que caían sobre Terceros/Primeros
  {x:200, y:365},
  {x:310, y:145}, {x:355, y:145},
  {x:470, y:145},
  {x:395, y:295}, {x:540, y:345},
  {x:610, y:295},
  {x:165, y:170},
];

/* ═══════════════════════════════════════════════════
   ENTRADAS — se dibujan al final (siempre visibles)
═══════════════════════════════════════════════════ */
const ENTRIES = [
  {x:38,  y:395, label:'ENTRADA'},
  {x:325, y:472, label:'ENTRADA'},
];

/* ═══════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadActivities();
  buildSVGMap();
  buildExplorerList();
  setupFrog();
  setupMapPan();
  setupZoom();
  centerMap();
  updateHUD();

  // Quitar pantalla de carga
  setTimeout(() => {
    const ls = document.getElementById('loading-screen');
    if (ls) { ls.classList.add('fade-out'); setTimeout(() => ls.remove(), 700); }
  }, 1800);

  // Ocultar instrucciones
  setTimeout(() => {
    const ins = document.getElementById('instructions');
    if (ins) ins.classList.add('hidden');
  }, 6000);

  // Pedir nombre del estudiante
  setTimeout(() => showNameModal(), 2000);
});

function showNameModal() {
  const card = document.createElement('div');
  card.id = 'name-card';
  card.style.cssText = `
    position:fixed;bottom:24px;left:50%;
    transform:translateX(-50%) translateY(120%);
    width:min(340px,calc(100vw - 40px));
    background:rgba(0,0,0,0.92);
    border:2px solid #BFFF00;border-radius:16px;
    padding:18px;z-index:500;
    box-shadow:0 0 40px rgba(191,255,0,0.3);
    font-family:'Fira Code',monospace;
    transition:transform 0.4s cubic-bezier(.34,1.56,.64,1);
  `;
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <span style="font-size:26px;">🐸</span>
      <div>
        <div style="font-size:14px;font-weight:700;color:#BFFF00;">¡Ponle nombre a tu rana!</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px;">ExpoEduca 2026 · Dr. Gabino Barreda</div>
      </div>
    </div>
    <input id="name-input" type="text" maxlength="20" placeholder="Escribe tu nombre..."
      style="
        width:100%;background:rgba(255,255,255,0.05);
        border:2px solid rgba(191,255,0,0.35);border-radius:8px;
        padding:10px 12px;color:#BFFF00;font-family:'Fira Code',monospace;
        font-size:14px;outline:none;margin-bottom:10px;
      ">
    <button id="name-btn" style="
      width:100%;background:#BFFF00;border:none;border-radius:8px;
      padding:10px;color:#000;font-family:'Fira Code',monospace;
      font-size:13px;font-weight:700;cursor:pointer;
    ">¡A explorar! 🗺️</button>
  `;
  document.body.appendChild(card);
  requestAnimationFrame(() => {
    setTimeout(() => card.style.transform = 'translateX(-50%) translateY(0)', 50);
  });

  const input = document.getElementById('name-input');
  const btn   = document.getElementById('name-btn');
  input.focus();

  function confirm() {
    const name = input.value.trim() || 'Explorador';
    STATE.frogName = name;
    card.style.transform = 'translateX(-50%) translateY(120%)';
    setTimeout(() => card.remove(), 400);
    const hud = document.getElementById('progress-hud');
    const tag = document.createElement('span');
    tag.style.cssText = 'font-size:11px;color:#BFFF00;white-space:nowrap;font-family:"Fira Code",monospace;font-weight:600;';
    tag.textContent = '🐸 ' + name;
    hud.prepend(tag);
  }

  btn.addEventListener('click', confirm);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); });
}

/* ═══════════════════════════════════════════════════
   CARGA DE ACTIVIDADES
   Primero intenta fetch (GitHub Pages / servidor).
   Si falla (file://, CORS, error) usa los datos
   embebidos ACTIVIDADES_DEFAULT.
═══════════════════════════════════════════════════ */
async function loadActivities() {
  try {
    const res = await fetch('data/actividades.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    STATE.activities = await res.json();
  } catch (e) {
    // Fallback: datos embebidos — funciona en móvil con file://
    STATE.activities = ACTIVIDADES_DEFAULT;
  }
}

function getActivity(id) {
  return STATE.activities.find(a => a.id === id) || null;
}

/* ═══════════════════════════════════════════════════
   CONSTRUCCIÓN DEL MAPA SVG
   Orden de capas:
   1. defs + fondo + grid
   2. Carretera
   3. Edificios (z-base)
   4. Bandera y bancas
   5. Árboles   ← SIEMPRE encima de edificios
   6. Entradas  ← SIEMPRE encima de todo
═══════════════════════════════════════════════════ */
function buildSVGMap() {
  const svg = document.getElementById('map-svg');
  const W = 900, H = 560;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width',  W);
  svg.setAttribute('height', H);

  svg.appendChild(createSVGDefs());
  svg.appendChild(svgEl('rect', {x:0,y:0,width:W,height:H,fill:'url(#bgGrad)'}));
  svg.appendChild(buildGrid(W, H));
  svg.appendChild(buildRoad());

  // Edificios primero
  BUILDINGS.forEach(b => svg.appendChild(buildBuilding(b)));

  // Decoraciones sobre edificios
  svg.appendChild(buildFlag(317, 278));
  [[270,380],[275,392],[280,380]].forEach(([x,y]) => svg.appendChild(buildBench(x,y)));

  // Árboles encima de edificios
  TREES.forEach(t => svg.appendChild(buildTree(t.x, t.y)));

  // Entradas siempre visibles (capa más alta)
   ENTRIES.forEach(e => svg.appendChild(buildEntry(e)));

  // Mascota — esquina superior derecha
  svg.appendChild(buildMascota(720, 10, 115, 115));
}

/* ─── Mascota ── */
function buildMascota(x, y, w, h) {
  const g = svgEl('g', {});
  const img = svgEl('image', {
    href: 'assets/mascota.png',
    x: x, y: y, width: w, height: h,
    preserveAspectRatio: 'xMidYMid meet',
    'image-rendering': 'optimizeQuality'
  });
  g.appendChild(img);
  return g;
}

/* ─── SVG Defs ─────────────────────────────────── */
function createSVGDefs() {
  const defs = svgEl('defs', {});

  // Fondo radial
  const grad = svgEl('radialGradient', {id:'bgGrad', cx:'40%', cy:'40%', r:'70%'});
  const s1 = svgEl('stop', {offset:'0%'});   s1.style.stopColor = '#0d0d0d';
  const s2 = svgEl('stop', {offset:'100%'}); s2.style.stopColor = '#000000';
  grad.appendChild(s1); grad.appendChild(s2);
  defs.appendChild(grad);

  // Filtro glow
  const glow = svgEl('filter', {id:'glow', x:'-30%', y:'-30%', width:'160%', height:'160%'});
  glow.appendChild(svgEl('feGaussianBlur', {stdDeviation:'3', result:'blur'}));
  glow.appendChild(svgEl('feComposite',    {in:'SourceGraphic', in2:'blur', operator:'over'}));
  defs.appendChild(glow);

  return defs;
}

function buildGrid(W, H) {
  const g = svgEl('g', {opacity:'0.05'});
  for (let x = 0; x < W; x += 40)
    g.appendChild(svgEl('line', {x1:x,y1:0,x2:x,y2:H,stroke:'#BFFF00','stroke-width':0.5}));
  for (let y = 0; y < H; y += 40)
    g.appendChild(svgEl('line', {x1:0,y1:y,x2:W,y2:y,stroke:'#BFFF00','stroke-width':0.5}));
  return g;
}

/* ─── Carretera ────────────────────────────────── */
function buildRoad() {
  const g = svgEl('g', {});
  // La carretera pasa por el lado izquierdo y gira hacia el sur
  // pasando al COSTADO de la tienda escolar (no entra al campus)
  const d = 'M 0,220 Q 20,300 14,370 Q 8,440 30,500 Q 55,545 80,555 Q 200,570 370,560 Q 500,552 640,558';
  g.appendChild(svgEl('path', {d, stroke:'#444', 'stroke-width':40, fill:'none', 'stroke-linecap':'round'}));
  g.appendChild(svgEl('path', {d, stroke:'#2a2a2a', 'stroke-width':32, fill:'none', 'stroke-linecap':'round'}));
  g.appendChild(svgEl('path', {d, stroke:'#555', 'stroke-width':2,  fill:'none', 'stroke-linecap':'round', 'stroke-dasharray':'16,14'}));
  return g;
}

/* ─── Entrada ──────────────────────────────────── */
function buildEntry(e) {
  const g = svgEl('g', {class:'entry-point'});
  const ellipse = svgEl('ellipse', {cx:e.x+22, cy:e.y+8, rx:19, ry:14, fill:'#2563EB', opacity:'0.9'});
  g.appendChild(ellipse);
  const t = svgEl('text', {
    x:e.x+22, y:e.y+32,
    'font-family':"'Fira Code',monospace",
    'font-size':'9', 'font-weight':'700',
    fill:'#BFFF00', 'text-anchor':'middle'
  });
  t.textContent = e.label;
  g.appendChild(t);

  // Al hacer clic en la entrada lanza la pregunta
  g.style.cursor = 'pointer';
  g.addEventListener('click',    () => showEntryQuestion(e.x+22, e.y+8));
  g.addEventListener('touchend', (ev) => { ev.preventDefault(); showEntryQuestion(e.x+22, e.y+8); }, {passive:false});

  return g;
}

function showEntryQuestion(ex, ey) {
  if (STATE.entryUnlocked) {
    jumpFrogTo(ex, ey);
    return;
  }

  // Cerrar si ya hay una abierta
  const old = document.getElementById('entry-card');
  if (old) old.remove();

  const card = document.createElement('div');
  card.id = 'entry-card';
  card.style.cssText = `
    position:fixed;bottom:24px;left:50%;
    transform:translateX(-50%) translateY(120%);
    width:min(340px,calc(100vw - 40px));
    background:rgba(0,0,0,0.92);
    border:2px solid #BFFF00;border-radius:16px;
    padding:18px;z-index:500;
    box-shadow:0 0 40px rgba(191,255,0,0.3);
    font-family:'Fira Code',monospace;
    transition:transform 0.4s cubic-bezier(.34,1.56,.64,1);
  `;
  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;">
      <span style="font-size:22px;flex-shrink:0;">🧠</span>
      <div style="font-size:11px;color:rgba(255,255,255,0.75);line-height:1.7;">
        De forma individual, y sin olvidar que eres parte de una comunidad
        emancipada que será guiada hacia la liberación por una vanguardia
        revolucionaria y humanista, responde:
      </div>
    </div>
    <div style="font-size:18px;font-weight:700;color:#FACC15;text-align:center;
                margin-bottom:14px;text-shadow:0 0 8px rgba(250,204,21,0.4);">
      ¿Cuánto es 2 + 2?
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input id="entry-input" type="number" min="0" max="99" placeholder="?"
        style="
          flex:1;background:rgba(255,255,255,0.05);
          border:2px solid rgba(191,255,0,0.35);border-radius:8px;
          padding:10px;color:#BFFF00;font-family:'Fira Code',monospace;
          font-size:18px;font-weight:700;text-align:center;outline:none;
        ">
      <button id="entry-btn" style="
        background:#BFFF00;border:none;border-radius:8px;
        padding:10px 16px;color:#000;font-family:'Fira Code',monospace;
        font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;
      ">Entrar</button>
    </div>
    <div id="entry-feedback" style="
      min-height:16px;font-size:11px;text-align:center;
      color:#ef4444;margin-top:8px;
    "></div>
  `;
  document.body.appendChild(card);
  requestAnimationFrame(() => {
    setTimeout(() => card.style.transform = 'translateX(-50%) translateY(0)', 50);
  });

  const input    = document.getElementById('entry-input');
  const btn      = document.getElementById('entry-btn');
  const feedback = document.getElementById('entry-feedback');
  input.focus();

  function tryEnter() {
    const val = parseInt(input.value.trim());
    if (val === 4) {
      STATE.entryUnlocked = true;
      card.style.transform = 'translateX(-50%) translateY(120%)';
      setTimeout(() => card.remove(), 400);
      jumpFrogTo(ex, ey);
      setTimeout(() => showWelcome(), 700);
    } else {
      feedback.textContent = '❌ Respuesta incorrecta. ¡Piénsalo bien!';
      input.style.borderColor = '#ef4444';
      setTimeout(() => {
        input.style.borderColor = 'rgba(191,255,0,0.35)';
        feedback.textContent = '';
      }, 1200);
    }
  }

  btn.addEventListener('click', tryEnter);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') tryEnter(); });
}

function showWelcome() {
  const name = STATE.frogName || 'Explorador';
  const card = document.createElement('div');
  card.id = 'welcome-overlay';
  card.style.cssText = `
    position:fixed;bottom:24px;left:50%;
    transform:translateX(-50%) translateY(120%);
    width:min(340px,calc(100vw - 40px));
    background:rgba(0,0,0,0.92);
    border:2px solid #BFFF00;border-radius:16px;
    padding:18px;z-index:500;
    box-shadow:0 0 40px rgba(191,255,0,0.4);
    font-family:'Fira Code',monospace;
    transition:transform 0.4s cubic-bezier(.34,1.56,.64,1);
  `;
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
      <span style="font-size:32px;">🐸</span>
      <div>
        <div style="font-size:15px;font-weight:700;color:#BFFF00;
                    text-shadow:0 0 10px rgba(191,255,0,0.4);">
          ¡Bienvenido, ${name}!
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px;">
          Tu rana ya está dentro de la escuela
        </div>
      </div>
    </div>
    <div style="font-size:11px;color:rgba(255,255,255,0.65);line-height:1.7;margin-bottom:14px;">
      Explora todos los espacios de ExpoEduca 2026.<br>
      Acércate a los edificios para descubrirlos. 🗺️
    </div>
    <button onclick="document.getElementById('welcome-overlay').remove()"
      style="
        width:100%;background:#BFFF00;border:none;border-radius:8px;
        padding:10px;color:#000;font-family:'Fira Code',monospace;
        font-size:13px;font-weight:700;cursor:pointer;
      ">¡A explorar!</button>
  `;
  document.body.appendChild(card);
  requestAnimationFrame(() => {
    setTimeout(() => card.style.transform = 'translateX(-50%) translateY(0)', 50);
  });
}

/* ─── Edificio ─────────────────────────────────── */
function buildBuilding(b) {
  const g = svgEl('g', {class:'building', 'data-id':b.id});

  // Sombra
  g.appendChild(svgEl('rect', {x:b.x+4, y:b.y+4, width:b.w, height:b.h, rx:b.rx, fill:'rgba(0,0,0,0.45)'}));
  // Cuerpo
  g.appendChild(svgEl('rect', {x:b.x, y:b.y, width:b.w, height:b.h, rx:b.rx, fill:b.color}));
  // Brillo
  g.appendChild(svgEl('rect', {
    x:b.x+b.w*0.1, y:b.y+b.h*0.08,
    width:b.w*0.5,  height:b.h*0.2, rx:4,
    fill:'rgba(255,255,255,0.18)'
  }));
  // Borde
  g.appendChild(svgEl('rect', {x:b.x, y:b.y, width:b.w, height:b.h, rx:b.rx, fill:'none', stroke:'rgba(0,0,0,0.2)', 'stroke-width':2}));

  // Cancha de fútbol — líneas internas
  if (b.id === 'futbol') {
    const mx = b.x + b.w/2;
    g.appendChild(svgEl('line',    {x1:mx, y1:b.y+10, x2:mx, y2:b.y+b.h-10, stroke:'rgba(255,255,255,0.4)', 'stroke-width':1.5, 'stroke-dasharray':'6,5'}));
    g.appendChild(svgEl('circle',  {cx:mx, cy:b.y+b.h/2, r:18, fill:'none', stroke:'rgba(255,255,255,0.35)', 'stroke-width':1.5}));
    g.appendChild(svgEl('rect',    {x:b.x+10, y:b.y+b.h/2-14, width:24, height:28, rx:2, fill:'none', stroke:'rgba(255,255,255,0.3)', 'stroke-width':1.2}));
    g.appendChild(svgEl('rect',    {x:b.x+b.w-34, y:b.y+b.h/2-14, width:24, height:28, rx:2, fill:'none', stroke:'rgba(255,255,255,0.3)', 'stroke-width':1.2}));
  }

  // Cancha Domo II — portería
  if (b.id === 'domo2') {
    g.appendChild(svgEl('rect', {x:b.x+10, y:b.y+10, width:b.w-20, height:b.h-20, rx:4, fill:'none', stroke:'rgba(255,255,255,0.3)', 'stroke-width':1.2}));
  }

  // Etiquetas
  if (b.small) {
    // etiqueta pequeña (estacionamiento)
    const t = svgEl('text', {
      x:b.x+b.w/2, y:b.y+15,
      'font-family':"'Fira Code',monospace",
      'font-size':'7.5', 'font-weight':'700',
      fill:'#fff', 'text-anchor':'middle', 'dominant-baseline':'middle'
    });
    t.textContent = b.label;
    g.appendChild(t);
  } else if (b.multiline3) {
    // 3 líneas (Audiovisual)
    const lines = b.label.split('\n');
    const totalH = lines.length * 13;
    const startY = b.y + b.h/2 - totalH/2 + 6;
    lines.forEach((line, i) => {
      const t = svgEl('text', {
        x:b.x+b.w/2, y:startY + i*13,
        'font-family':"'Fira Code',monospace",
        'font-size':'8.5', 'font-weight':'700',
        fill:'#fff', 'text-anchor':'middle', 'dominant-baseline':'middle'
      });
      t.textContent = line;
      g.appendChild(t);
    });
  } else if (b.multiline) {
    const lines = b.label.split('\n');
    const baseY  = b.labelY - (lines.length - 1) * 7;
    lines.forEach((line, i) => {
      const t = svgEl('text', {
        x:b.x+b.w/2, y:baseY + i*14,
        'font-family':"'Fira Code',monospace",
        'font-size':'9.5', 'font-weight':'700',
        fill:'#000', 'text-anchor':'middle', 'dominant-baseline':'middle'
      });
      t.textContent = line;
      g.appendChild(t);
    });
  } else {
    const t = svgEl('text', {
      x:b.x+b.w/2, y:b.labelY,
      'font-family':"'Fira Code',monospace",
      'font-size':b.w < 82 ? '9' : '10.5', 'font-weight':'700',
      fill:'#000', 'text-anchor':'middle', 'dominant-baseline':'middle'
    });
    t.textContent = b.label;
    g.appendChild(t);
  }

  // Palomita de descubierto
  const check = svgEl('text', {
    x:b.x+b.w-10, y:b.y+16,
    'font-size':'13', 'text-anchor':'middle',
    class:'building-check', style:'display:none;fill:#BFFF00'
  });
  check.textContent = '✓';
  g.appendChild(check);

  // Eventos
  g.addEventListener('click',    () => handleBuildingClick(b.id));
  g.addEventListener('touchend', (e) => { e.preventDefault(); handleBuildingClick(b.id); }, {passive:false});

  return g;
}

/* ─── Bandera ──────────────────────────────────── */
function buildFlag(x, y) {
  const g = svgEl('g', {});
  g.appendChild(svgEl('line', {x1:x, y1:y, x2:x, y2:y-26, stroke:'#888', 'stroke-width':2}));
  g.appendChild(svgEl('rect', {x:x, y:y-26, width:8,  height:17, fill:'#006847'}));
  g.appendChild(svgEl('rect', {x:x+8,  y:y-26, width:8, height:17, fill:'#FFFFFF'}));
  g.appendChild(svgEl('rect', {x:x+16, y:y-26, width:8, height:17, fill:'#CE1126'}));
  g.appendChild(svgEl('circle', {cx:x+12, cy:y-17, r:3, fill:'#8B4513', opacity:0.8}));
  return g;
}

/* ─── Banca ────────────────────────────────────── */
function buildBench(x, y) {
  const g = svgEl('g', {opacity:0.7});
  g.appendChild(svgEl('rect', {x:x-8, y:y-2, width:16, height:4, rx:2, fill:'#5D4037'}));
  g.appendChild(svgEl('rect', {x:x-6, y:y+2, width:3,  height:6, rx:1, fill:'#4E342E'}));
  g.appendChild(svgEl('rect', {x:x+3, y:y+2, width:3,  height:6, rx:1, fill:'#4E342E'}));
  return g;
}

/* ─── Mascota ── */
function buildMascota(x, y, w, h) {
  const g = svgEl('g', {});
  const img = svgEl('image', {
    href: 'assets/mascota.png',
    x: x, y: y, width: w, height: h,
    preserveAspectRatio: 'xMidYMid meet',
    'image-rendering': 'optimizeQuality'
  });
  g.appendChild(img);
  return g;
}

/* ═══════════════════════════════════════════════════
   RANA — SVG + animaciones + arrastre
═══════════════════════════════════════════════════ */
function buildFrogSVG() {
  return `<svg id="frog-svg" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg" overflow="visible">
  <g id="frog-body">
    <ellipse cx="26" cy="50" rx="14" ry="4" fill="rgba(0,0,0,0.4)"/>
    <ellipse cx="12" cy="40" rx="8" ry="5" fill="#2E7D32" transform="rotate(-20,12,40)"/>
    <ellipse cx="40" cy="40" rx="8" ry="5" fill="#2E7D32" transform="rotate(20,40,40)"/>
    <ellipse cx="8"  cy="44" rx="7" ry="3.5" fill="#388E3C" transform="rotate(-10,8,44)"/>
    <ellipse cx="44" cy="44" rx="7" ry="3.5" fill="#388E3C" transform="rotate(10,44,44)"/>
    <ellipse cx="26" cy="32" rx="17" ry="14" fill="#43A047"/>
    <ellipse cx="26" cy="35" rx="11" ry="9"  fill="#A5D6A7" opacity="0.7"/>
    <circle cx="17" cy="22" r="6" fill="#C8E6C9"/>
    <circle cx="35" cy="22" r="6" fill="#C8E6C9"/>
    <circle cx="17" cy="22" r="3.5" fill="#1A1A1A"/>
    <circle cx="35" cy="22" r="3.5" fill="#1A1A1A"/>
    <circle cx="18.5" cy="20.5" r="1.2" fill="white"/>
    <circle cx="36.5" cy="20.5" r="1.2" fill="white"/>
    <path d="M 20 38 Q 26 43 32 38" stroke="#1B5E20" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <circle cx="23" cy="31" r="1.2" fill="#2E7D32"/>
    <circle cx="29" cy="31" r="1.2" fill="#2E7D32"/>
    <ellipse cx="11" cy="33" rx="5" ry="3.5" fill="#43A047" transform="rotate(-30,11,33)"/>
    <ellipse cx="41" cy="33" rx="5" ry="3.5" fill="#43A047" transform="rotate(30,41,33)"/>
    <rect x="18" y="12" width="16" height="10" rx="3" fill="#BFFF00"/>
    <rect x="14" y="16" width="24" height="4"  rx="2" fill="#BFFF00"/>
    <text x="26" y="20" font-family="'Fira Code',monospace" font-size="4.5" font-weight="700" fill="#000" text-anchor="middle">EE</text>
  </g>
</svg>`;
}

function setupFrog() {
  const wrapper = document.getElementById('frog-wrapper');
  wrapper.innerHTML = buildFrogSVG();
  moveFrogTo(STATE.frogX, STATE.frogY);

  wrapper.addEventListener('mousedown',  onFrogDragStart);
  document.addEventListener('mousemove', onFrogDragMove);
  document.addEventListener('mouseup',   onFrogDragEnd);

  wrapper.addEventListener('touchstart', onFrogTouchStart, {passive:false});
  document.addEventListener('touchmove',  onFrogTouchMove,  {passive:false});
  document.addEventListener('touchend',   onFrogTouchEnd);
}

let frogOffX = 0, frogOffY = 0;

function onFrogDragStart(e) {
  e.stopPropagation();
  STATE.draggingFrog = true;
  initAudio();
  const r = document.getElementById('frog-wrapper').getBoundingClientRect();
  frogOffX = e.clientX - r.left - r.width/2;
  frogOffY = e.clientY - r.top  - r.height/2;
  document.getElementById('frog-wrapper').style.transition = 'none';
}
function onFrogDragMove(e) {
  if (!STATE.draggingFrog) return;
  const r = document.getElementById('app').getBoundingClientRect();
  STATE.frogX = (e.clientX - r.left - frogOffX - STATE.panX) / STATE.zoom;
  STATE.frogY = (e.clientY - r.top  - frogOffY - STATE.panY) / STATE.zoom;
  moveFrogTo(STATE.frogX, STATE.frogY);
  checkFrogProximity();
}
function onFrogDragEnd() {
  if (!STATE.draggingFrog) return;
  STATE.draggingFrog = false;
  document.getElementById('frog-wrapper').style.transition = '';
  setFrogAnimation('idle');
}

function onFrogTouchStart(e) {
  e.preventDefault(); e.stopPropagation();
  STATE.draggingFrog = true;
  initAudio();
  const t = e.touches[0];
  const r = document.getElementById('frog-wrapper').getBoundingClientRect();
  frogOffX = t.clientX - r.left - r.width/2;
  frogOffY = t.clientY - r.top  - r.height/2;
  document.getElementById('frog-wrapper').style.transition = 'none';
}
function onFrogTouchMove(e) {
  if (!STATE.draggingFrog) return;
  e.preventDefault();
  const t = e.touches[0];
  const r = document.getElementById('app').getBoundingClientRect();
  STATE.frogX = (t.clientX - r.left - frogOffX - STATE.panX) / STATE.zoom;
  STATE.frogY = (t.clientY - r.top  - frogOffY - STATE.panY) / STATE.zoom;
  moveFrogTo(STATE.frogX, STATE.frogY);
  checkFrogProximity();
}
function onFrogTouchEnd() {
  STATE.draggingFrog = false;
  document.getElementById('frog-wrapper').style.transition = '';
  setFrogAnimation('idle');
}

// Click en el mapa → la rana salta
document.getElementById('app').addEventListener('click', (e) => {
  if (STATE.draggingFrog) return;
  if (e.target.closest('.building') || e.target.closest('#frog-wrapper')) return;
  const r = document.getElementById('app').getBoundingClientRect();
  const svgX = (e.clientX - r.left - STATE.panX) / STATE.zoom;
  const svgY = (e.clientY - r.top  - STATE.panY) / STATE.zoom;
  spawnRipple(e.clientX - r.left, e.clientY - r.top);
  jumpFrogTo(svgX, svgY);
});

function jumpFrogTo(tx, ty) {
  const sx = STATE.frogX, sy = STATE.frogY;
  const dist = Math.hypot(tx-sx, ty-sy);
  const dur  = Math.min(Math.max(dist/400, 0.25), 1.0);

  STATE.frogFaceLeft = tx < sx;
  setFrogAnimation('jump');
  playBip();                // ← sonido bip

  const t0 = performance.now();
  (function step(now) {
    const t = Math.min((now - t0) / (dur * 1000), 1);
    const e = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    STATE.frogX = sx + (tx-sx)*e;
    STATE.frogY = sy + (ty-sy)*e;
    moveFrogTo(STATE.frogX, STATE.frogY);
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      STATE.frogX = tx; STATE.frogY = ty;
      moveFrogTo(STATE.frogX, STATE.frogY);
      setFrogAnimation('idle');
      checkFrogProximity();
    }
  })(t0);
}

function moveFrogTo(x, y) {
  const px = x * STATE.zoom + STATE.panX - 26;
  const py = y * STATE.zoom + STATE.panY - 26;
  const sx  = STATE.frogFaceLeft ? -1 : 1;
  document.getElementById('frog-wrapper').style.transform =
    `translate(${px}px,${py}px) scaleX(${sx})`;
}

function setFrogAnimation(type) {
  const w = document.getElementById('frog-wrapper');
  w.classList.remove('frog-walking','frog-jumping');
  if (type === 'walk') w.classList.add('frog-walking');
  if (type === 'jump') w.classList.add('frog-jumping');
}

/* ═══════════════════════════════════════════════════
   SONIDO BIP — Web Audio API (sin archivos externos)
   Funciona en móvil y escritorio. Requiere un gesto
   previo del usuario (click/touch) para activarse.
═══════════════════════════════════════════════════ */
function initAudio() {
  if (STATE.audioCtx) return;
  try {
    STATE.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e) { /* silencioso */ }
}

function playBip() {
  if (!STATE.audioCtx) {
    // Primer intento de crear el contexto si aún no existe
    try { STATE.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) { return; }
  }
  try {
    const ctx  = STATE.audioCtx;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Bip suave tipo videojuego retro
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(760, ctx.currentTime + 0.06);
    osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(1.0, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
  } catch(e) { /* silencioso */ }
}

/* ═══════════════════════════════════════════════════
   PROXIMIDAD DE LA RANA A EDIFICIOS
═══════════════════════════════════════════════════ */
const PROXIMITY = 72;

function checkFrogProximity() {
  let nearest = null, nearestDist = Infinity;
  BUILDINGS.forEach(b => {
    const cx   = b.x + b.w/2;
    const cy   = b.y + b.h/2;
    const dist = Math.hypot(STATE.frogX - cx, STATE.frogY - cy);
    if (dist < PROXIMITY && dist < nearestDist) { nearestDist = dist; nearest = b.id; }
  });

  if (nearest && nearest !== STATE.activeBuilding) {
    STATE.activeBuilding = nearest;
    highlightBuilding(nearest);
    showInfoCard(nearest);
    discoverBuilding(nearest);
  } else if (!nearest && STATE.activeBuilding) {
    STATE.activeBuilding = null;
    clearHighlights();
    hideInfoCard();
  }
}

function highlightBuilding(id) {
  document.querySelectorAll('.building').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-id') === id);
  });
}
function clearHighlights() {
  document.querySelectorAll('.building').forEach(el => el.classList.remove('active'));
}

/* ═══════════════════════════════════════════════════
   SISTEMA DE DESCUBRIMIENTO
═══════════════════════════════════════════════════ */
function discoverBuilding(id) {
  if (STATE.discovered.has(id)) return;
  STATE.discovered.add(id);

  // Palomita en el SVG
  const chk = document.querySelector(`.building[data-id="${id}"] .building-check`);
  if (chk) chk.style.display = 'block';

  // Clase discovered
  const bEl = document.querySelector(`.building[data-id="${id}"]`);
  if (bEl) bEl.classList.add('discovered');

  // Lista del explorador
  const item = document.querySelector(`.explorer-item[data-id="${id}"]`);
  if (item) {
    item.classList.add('found');
    const c = item.querySelector('.explorer-item-check');
    if (c) c.textContent = '✓';
  }

  updateHUD();
  checkAchievements();
}

function updateHUD() {
  const found = STATE.discovered.size;
  const total = BUILDINGS.length;
  const pct   = Math.round((found / total) * 100);
  document.getElementById('progress-text').textContent = `${found}/${total} lugares`;
  document.getElementById('progress-bar-fill').style.width = pct + '%';
}

function checkAchievements() {
  STATE.achievements.forEach(ach => {
    if (!STATE.unlockedAchievements.has(ach.id) && STATE.discovered.size >= ach.threshold) {
      STATE.unlockedAchievements.add(ach.id);
      showAchievement(ach);
    }
  });
}

function showAchievement(ach) {
  const panel = document.getElementById('achievements-panel');
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <span class="achievement-toast-icon">${ach.icon}</span>
    <div class="achievement-toast-text">
      <span class="achievement-toast-title">🏅 ${ach.title}</span>
      <span class="achievement-toast-sub">${ach.desc}</span>
    </div>`;
  panel.appendChild(toast);
  requestAnimationFrame(() => setTimeout(() => toast.classList.add('show'), 50));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 600);
  }, 4000);
}

/* ═══════════════════════════════════════════════════
   TARJETA DE INFORMACIÓN
═══════════════════════════════════════════════════ */
function showInfoCard(id) {
  const act  = getActivity(id);
  const bld  = BUILDINGS.find(b => b.id === id);
  if (!act && !bld) return;

  const nombre = act?.nombre     || bld?.label?.replace(/\n/g,' ') || id;
  const emoji  = act?.emoji      || '🏫';
  const activ  = act?.actividad  || '—';
  const hora   = act?.horario    || '—';
  const resp   = act?.responsable|| '—';
  const desc   = act?.descripcion|| 'Espacio educativo de la escuela.';
  const isNew  = !STATE.discovered.has(id);

  document.getElementById('info-card-emoji').textContent    = emoji;
  document.getElementById('info-card-name').textContent     = nombre;
  document.getElementById('info-card-activity').textContent = activ;

  document.getElementById('info-card-body').innerHTML = `
    <div class="info-row">
      <span class="info-row-label">⏰ Horario:</span>
      <span class="info-row-value">${hora}</span>
    </div>
    <div class="info-row">
      <span class="info-row-label">👤 Responsable:</span>
      <span class="info-row-value">${resp}</span>
    </div>
    <p id="info-card-desc">${desc}</p>
    ${isNew ? `<div id="info-card-badge">🌟 ¡Nuevo espacio descubierto!</div>` : ''}
  `;
  document.getElementById('info-card').classList.add('visible');
}

function hideInfoCard() {
  document.getElementById('info-card').classList.remove('visible');
}

function handleBuildingClick(id) {
  initAudio();
  discoverBuilding(id);
  highlightBuilding(id);
  STATE.activeBuilding = id;

  // SNTE abre su propia página interactiva
  if (id === 'snte') {
    showInfoCard(id);            // muestra tarjeta normal también
    setTimeout(() => {
      window.open('snte.html', '_blank');
    }, 400);
    return;
  }

  showInfoCard(id);
}

document.getElementById('info-card-close').addEventListener('click', hideInfoCard);

/* ═══════════════════════════════════════════════════
   PANEL EXPLORADOR
═══════════════════════════════════════════════════ */
function buildExplorerList() {
  const list = document.getElementById('explorer-list');
  list.innerHTML = '';
  BUILDINGS.forEach(b => {
    const act   = getActivity(b.id);
    const name  = act?.nombre || b.label?.replace(/\n/g,' ') || b.id;
    const emoji = act?.emoji  || '🏫';
    const item  = document.createElement('div');
    item.className = 'explorer-item';
    item.setAttribute('data-id', b.id);
    item.innerHTML = `
      <div class="explorer-item-dot"></div>
      <span class="explorer-item-name">${emoji} ${name}</span>
      <span class="explorer-item-check">○</span>`;
    item.addEventListener('click', () => {
      handleBuildingClick(b.id);
      const cx = b.x + b.w/2, cy = b.y + b.h/2;
      jumpFrogTo(cx, cy);
    });
    list.appendChild(item);
  });
}

document.getElementById('explorer-toggle').addEventListener('click', () => {
  STATE.explorerOpen = !STATE.explorerOpen;
  document.getElementById('explorer-panel').classList.toggle('open', STATE.explorerOpen);
  document.getElementById('explorer-toggle').classList.toggle('panel-open', STATE.explorerOpen);
  document.getElementById('explorer-toggle').textContent = STATE.explorerOpen ? '◀' : '▶';
});

/* ═══════════════════════════════════════════════════
   PAN DEL MAPA
═══════════════════════════════════════════════════ */
function setupMapPan() {
  const app = document.getElementById('app');
  let panStart = null;

  app.addEventListener('mousedown', (e) => {
    if (e.target.closest('#frog-wrapper') || e.target.closest('.building')) return;
    STATE.draggingMap = true;
    panStart = {x: e.clientX - STATE.panX, y: e.clientY - STATE.panY};
    app.style.cursor = 'grabbing';
  });
  document.addEventListener('mousemove', (e) => {
    if (!STATE.draggingMap || !panStart) return;
    STATE.panX = e.clientX - panStart.x;
    STATE.panY = e.clientY - panStart.y;
    applyTransform(); moveFrogTo(STATE.frogX, STATE.frogY);
  });
  document.addEventListener('mouseup', () => {
    STATE.draggingMap = false;
    app.style.cursor = 'grab';
  });

  // Touch pan + pinch zoom
  app.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1 && !STATE.draggingFrog) {
      if (e.touches[0].target.closest('#frog-wrapper')) return;
      panStart = {x: e.touches[0].clientX - STATE.panX, y: e.touches[0].clientY - STATE.panY};
      STATE.draggingMap = true;
    }
  }, {passive:true});

  app.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0], t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX-t1.clientX, t2.clientY-t1.clientY);
      if (STATE.lastTouchDist > 0) {
        const midX = (t1.clientX+t2.clientX)/2;
        const midY = (t1.clientY+t2.clientY)/2;
        doZoom(dist/STATE.lastTouchDist, midX, midY - 60);
      }
      STATE.lastTouchDist = dist;
      STATE.draggingMap = false;
      return;
    }
    if (!STATE.draggingMap || !panStart) return;
    STATE.panX = e.touches[0].clientX - panStart.x;
    STATE.panY = e.touches[0].clientY - panStart.y;
    applyTransform(); moveFrogTo(STATE.frogX, STATE.frogY);
  }, {passive:false});

  app.addEventListener('touchend', () => {
    STATE.draggingMap = false;
    STATE.lastTouchDist = 0;
  });
}

/* ═══════════════════════════════════════════════════
   ZOOM
═══════════════════════════════════════════════════ */
function setupZoom() {
  document.getElementById('app').addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = document.getElementById('app').getBoundingClientRect();
    doZoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top);
  }, {passive:false});
}

function doZoom(factor, cx, cy) {
  const nz    = Math.min(Math.max(STATE.zoom * factor, 0.3), 3.5);
  const ratio = nz / STATE.zoom;
  STATE.panX  = cx - ratio * (cx - STATE.panX);
  STATE.panY  = cy - ratio * (cy - STATE.panY);
  STATE.zoom  = nz;
  applyTransform();
  moveFrogTo(STATE.frogX, STATE.frogY);
}

function applyTransform() {
  document.getElementById('map-container').style.transform =
    `translate(${STATE.panX}px,${STATE.panY}px) scale(${STATE.zoom})`;
}

function centerMap() {
  const app  = document.getElementById('app');
  const W    = app.clientWidth, H = app.clientHeight;
  const svgW = 900, svgH = 560;
  STATE.zoom = Math.min(W/svgW, H/svgH) * 0.88;
  STATE.panX = (W - svgW * STATE.zoom) / 2;
  STATE.panY = (H - svgH * STATE.zoom) / 2;
  applyTransform();
  moveFrogTo(STATE.frogX, STATE.frogY);
}

document.getElementById('btn-zoom-in').addEventListener('click', () => {
  const a = document.getElementById('app');
  initAudio(); doZoom(1.2, a.clientWidth/2, a.clientHeight/2);
});
document.getElementById('btn-zoom-out').addEventListener('click', () => {
  const a = document.getElementById('app');
  doZoom(0.8, a.clientWidth/2, a.clientHeight/2);
});
document.getElementById('btn-reset').addEventListener('click', () => {
  STATE.frogX = 420; STATE.frogY = 310;
  centerMap();
  moveFrogTo(STATE.frogX, STATE.frogY);
});

window.addEventListener('resize', () => {
  centerMap();
  moveFrogTo(STATE.frogX, STATE.frogY);
});

/* ═══════════════════════════════════════════════════
   EFECTO RIPPLE AL HACER CLIC
═══════════════════════════════════════════════════ */
function spawnRipple(x, y) {
  const rip = document.createElement('div');
  rip.className = 'click-ripple';
  rip.style.left = x + 'px';
  rip.style.top  = y + 'px';
  document.getElementById('app').appendChild(rip);
  setTimeout(() => rip.remove(), 500);
}

/* ═══════════════════════════════════════════════════
   HELPER SVG
═══════════════════════════════════════════════════ */
function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}
