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

/* ── Estilos para botones de sub-actividad (inyectados aquí para no tocar style.css) ── */
(function injectSubActivityStyles() {
  const style = document.createElement('style');
  style.textContent = `
    #sub-activity-list {
      display: flex; flex-direction: column; gap: 8px; margin-top: 12px;
    }
    .sub-activity-btn {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; text-align: left;
      background: rgba(255,255,255,0.05);
      border: 1.5px solid rgba(191,255,0,0.3);
      border-radius: 8px; padding: 10px 12px;
      color: #BFFF00; font-family: 'Fira Code', monospace;
      font-size: 12px; font-weight: 600; cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }
    .sub-activity-btn:hover { background: rgba(191,255,0,0.1); }
    .sub-activity-btn.found {
      border-color: rgba(191,255,0,0.6);
      background: rgba(191,255,0,0.08);
    }
    .sub-activity-check { font-size: 13px; }
  `;
  document.head.appendChild(style);
})();

/* ═══════════════════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════════════════ */
const STATE = {
  activities: [],
  discovered: new Set(),
  zoom: 1,
  panX: 0,
  panY: 0,
  frogX: 4,
  frogY: 240,
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
    { id:'first',    threshold:1,  icon:'🐸', title:'¡Primera Actividad!', desc:'Realizaste tu primera actividad.' },
    { id:'explorer', threshold:3,  icon:'🗺️', title:'Explorador',           desc:'3 actividades realizadas.' },
    { id:'half',     threshold:5,  icon:'⭐', title:'Mitad del Camino',     desc:'Más de la mitad completado.' },
    { id:'expert',   threshold:7,  icon:'🏆', title:'Casi Experto',         desc:'7 actividades realizadas.' },
    { id:'master',   threshold:9,  icon:'🎓', title:'¡Maestro ExpoEduca!',  desc:'¡Todas las actividades completadas!' }
  ],
  unlockedAchievements: new Set()
};

/* ═══════════════════════════════════════════════════
   DATOS DE ACTIVIDADES (fallback si no carga el JSON)
   Modifica actividades.json para cambiar estos textos.
═══════════════════════════════════════════════════ */
const ACTIVIDADES_DEFAULT = [
  { id:'futbol',          nombre:'Cancha de Fútbol',              actividad:'Sin actividad programada',          horario:'—',              responsable:'—',                              descripcion:'Aquí se formó Messi y Cristiano. (Probablemente.)',                                                  color:'#22C55E', emoji:'⚽' },
  { id:'snte',            nombre:'SNTE',                           actividad:'Estimysterios',                     horario:'16:00 - 16:30', responsable:'Academia de Matemáticas',        descripcion:'Retos de estimación.',                                                                               color:'#FF4C37', emoji:'📋' },
  { id:'terceros_primeros',nombre:'Salones Terceros / Primeros',   actividad:'Proyectos Integradores',            horario:'14:00 - 14:30', responsable:'Academia Interdisciplinaria',    descripcion:'Exposición de proyectos integradores: medio ambiente, historia local y matemáticas aplicadas.',      color:'#FACC15', emoji:'📚' },
  { id:'banos',           nombre:'Baños',                          actividad:'Servicios Sanitarios',              horario:'Siempre abierto', responsable:'Personal de Intendencia',      descripcion:'¡Estuvo cerca la cosa, casi me gana!.',                                                             color:'#3B82F6', emoji:'🚽' },
  { id:'laboratorios',    nombre:'Laboratorios',                   actividad:'Experimentos de Ciencias',          horario:'15:00 - 16:00', responsable:'Academia de Ciencias Naturales', descripcion:'Experimentos interactivos de química, biología y física. ¡Ven a descubrir la ciencia!',               color:'#06B6D4', emoji:'🔬' },
  { id:'audiovisual',     nombre:'Edificio Segundos', actividad:'Varias actividades',     horario:'16:00 - 18:00', responsable:'Varios responsables',     descripcion:'Audiovisual, Sala de Maestros y Biblioteca. Elige un espacio para ver su actividad.',    color:'#DC2626', emoji:'🎬' },
  { id:'domo1',           nombre:'Plaza Cívica',                   actividad:'Acto Cívico y Bienvenida',          horario:'17:00 - 17:30', responsable:'Dirección General',              descripcion:'Espacio principal para la inauguración. Presentaciones artísticas y discursos de bienvenida.',        color:'#94A3B8', emoji:'🎪' },
  { id:'computacion',     nombre:'Aula de Medios',                actividad:'Destellos, Ondas y Conexiones',     horario:'16:00 - 18:00', responsable:'Academia de Tecnología',         descripcion:'Destellos, ondas y conexiones.',      color:'#8B5CF6', emoji:'💻' },
  { id:'domo2',           nombre:'Básquetbol',                     actividad:'Deportes y Activación Física',      horario:'18:30 - 19:00', responsable:'Academia de Educación Física',   descripcion:'Demostraciones deportivas, clases de zumba y torneos rápidos de basquetbol.',                         color:'#F97316', emoji:'🏀' },
  { id:'taller_costura',  nombre:'Taller de Costura',              actividad:'Moda Sustentable',                  horario:'19:00 - 20:00', responsable:'Academia Tecnológica',           descripcion:'Exposición de prendas con materiales reciclados. Demostración en vivo de técnicas de costura.',       color:'#933601', emoji:'🪡' },
  { id:'bodega',          nombre:'Bodega',                         actividad:'Exposición de Materiales',          horario:'13:30 - 14:30', responsable:'Personal Administrativo',        descripcion:'Aquí se aparece el muerto y llora la llorona.',                                                       color:'#FF0571', emoji:'📦' },
  { id:'tienda',          nombre:'Tienda Escolar',                 actividad:'Feria Gastronómica Estudiantil',    horario:'14:30 - 15:30', responsable:'Comité de Padres',               descripcion:'Venta de alimentos preparados por alumnos como proyecto emprendedor. ¡Antojitos y postres!',          color:'#84CC16', emoji:'🍕' },
  { id:'banos_contr',     nombre:'Contraloría Baños',              actividad:'Servicios Sanitarios',              horario:'Siempre abierto', responsable:'Personal de Intendencia',      descripcion:'Mi estómago pidió refuerzos.',                                                                        color:'#3B82F6', emoji:'🚻' }
];

/* ═══════════════════════════════════════════════════
   EDIFICIOS — coordenadas del mapa SVG 900×560
   ORDEN IMPORTANTE: los que van "debajo" se definen
   primero; árboles y entradas se dibujan AL FINAL.
═══════════════════════════════════════════════════ */
const BUILDINGS = [
  // ── Fila norte ──
  // (Estacionamiento eliminado)
  { id:'futbol',          x:295, y:15,  w:295, h:148, rx:18, color:'#22C55E', label:'FÚTBOL',                        labelY:90  },
  { id:'snte',            x:610, y:38,  w:90,  h:75,  rx:14, color:'#FF4C37', label:'SNTE',                          labelY:78  },
  { id:'taller_costura',  x:610, y:125, w:90,  h:80,  rx:14, color:'#933601', label:'TALLER\nCOSTURA',               labelY:167, multiline:true },
  { id:'bodega',          x:715, y:125, w:80,  h:80,  rx:14, color:'#FF0571', label:'BODEGA',                        labelY:167 },

  // ── Fila media ──
  { id:'terceros_primeros',x:55, y:190, w:135, h:170, rx:18, color:'#FACC15', label:'TERCEROS\nPRIMEROS',            labelY:278, multiline:true },
  { id:'banos',            x:213,y:190, w:68,  h:68,  rx:12, color:'#3B82F6', label:'BAÑOS',                        labelY:227 },
  { id:'laboratorios',     x:284,y:185, w:115, h:78,  rx:14, color:'#06B6D4', label:'LABORATORIOS',                 labelY:227 },
  { id:'domo1',            x:263,y:270, w:110, h:95,  rx:16, color:'#94A3B8', label:'PLAZA\nCÍVICA',                 labelY:320, multiline:true },
  { id:'domo2',            x:500,y:258, w:105, h:90,  rx:14, color:'#F97316', label:'BÁSQUETBOL',                   labelY:280 },

  // ── Edificio Medios/Segundos — al sur del estacionamiento, columna derecha ──
  { id:'audiovisual',      x:406,y:185, w:88,  h:165, rx:14, color:'#DC2626',
    label:'AUDIOVISUAL\nSEGUNDOS\nSALA DE\nMAESTROS\nBIBLIOTECA',  labelY:260, multiline4:true },

  // ── Fila sur ──
  { id:'computacion',      x:198,y:360, w:60,  h:95,  rx:14, color:'#8B5CF6', label:'AULA\nDE\nMEDIOS',              labelY:407, multiline:true },
  { id:'banos_contr',      x:370,y:380, w:118, h:62,  rx:14, color:'#3B82F6', label:'CONTR.\nBAÑOS',                labelY:414, multiline:true },
  { id:'tienda',           x:498,y:380, w:130, h:62,  rx:14, color:'#84CC16', label:'TIENDA\nESCOLAR',              labelY:414, multiline:true },
];

/* ═══════════════════════════════════════════════════
   SUB-ACTIVIDADES — edificios con múltiples actividades
   Cada entrada referencia un id de actividad del JSON
   que tiene "parentId" apuntando a un edificio físico.
═══════════════════════════════════════════════════ */
const PARENT_BUILDINGS = ['terceros_primeros', 'audiovisual', 'laboratorios'];

/* Lista explícita de IDs que SÍ cuentan como "actividad real" para el contador.
   Agrega aquí el id cuando crees una nueva actividad — el contador se
   actualiza solo, sin tocar ninguna otra parte del código. */
const REAL_ACTIVITY_IDS = [
  'terceros_primeros_1eE',
  'terceros_primeros_3eE',
  'laboratorios_pasillo',
  'laboratorios_ciencias',
  'audiovisual_maestros',
  'audiovisual_biblioteca',
  'computacion',    // Aula de Medios
  'domo2',          // Cancha de Básquetbol
  'domo1',          // Plaza Cívica
];

// Total de actividades reales = solo lo que está en REAL_ACTIVITY_IDS
function getTotalActivities() {
  return REAL_ACTIVITY_IDS.length;
}

// ¿Este id (edificio directo o sub-actividad) cuenta como actividad real?
function isRealActivity(id) {
  return REAL_ACTIVITY_IDS.includes(id);
}

/* ═══════════════════════════════════════════════════
   ÁRBOLES — posiciones claras, sin edificios encima
   Se dibujan DESPUÉS de los edificios en buildSVGMap
═══════════════════════════════════════════════════ */
const TREES = [
  // Originales — sin los 3 que caían sobre Terceros/Primeros
  {x:226, y:309},
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
  buildMinimap();
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
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(191,255,0,0.15);
                font-size:11px;color:rgba(191,255,0,0.75);line-height:1.5;text-align:center;">
      🛣️ Tu rana está en la carretera...<br>
      <strong>¡Dirígete a la entrada para comenzar! ⬆️</strong>
    </div>
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
  svg.appendChild(buildFlag(290, 325));

  // Árboles encima de edificios
  TREES.forEach(t => svg.appendChild(buildTree(t.x, t.y)));

  // Entradas siempre visibles (capa más alta)
   ENTRIES.forEach(e => svg.appendChild(buildEntry(e)));

  // Mascota — esquina superior derecha
  svg.appendChild(buildMascota(720, 10, 115, 115));

  // Bigotes
  svg.appendChild(buildCat(170, 430));

  // Cartón de leche — junto a la tienda escolar (x:498+140=638, y:385)
  svg.appendChild(buildMilk(650, 455));

  // Perro hambriento — esquina superior izquierda
  svg.appendChild(buildDog(50, 50));

  // Chilaquil — perro pachón, no muy cerca del primero
  svg.appendChild(buildFluffyDog(130, 95));

  // Cheems — con capucha de rana, debajo de la Bodega
  svg.appendChild(buildCheems(750, 350));
}

function buildMinimap() {
  const svg = document.getElementById('minimap-svg');
  svg.innerHTML = '';
  svg.appendChild(svgEl('rect', {x:0, y:0, width:900, height:560, fill:'#0a0a0a'}));
  BUILDINGS.forEach(b => {
    svg.appendChild(svgEl('rect', {
      x:b.x, y:b.y, width:b.w, height:b.h, rx:b.rx*0.6,
      fill:b.color, opacity:'0.85'
    }));
  });
}

function updateMinimapDot() {
  const wrap = document.getElementById('minimap-wrap');
  if (!wrap) return;
  const scaleX = wrap.clientWidth  / 900;
  const scaleY = wrap.clientHeight / 560;
  const dot = document.getElementById('minimap-dot');
  dot.style.left = (STATE.frogX * scaleX) + 'px';
  dot.style.top  = (STATE.frogY * scaleY) + 'px';
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
  const g = svgEl('g', {style:'cursor:pointer'});
  const d = 'M 0,220 Q 20,300 14,370 Q 8,440 30,500 Q 55,545 80,555 Q 200,570 370,560 Q 500,552 640,558';
  g.appendChild(svgEl('path', {d, stroke:'#444', 'stroke-width':40, fill:'none', 'stroke-linecap':'round'}));
  g.appendChild(svgEl('path', {d, stroke:'#2a2a2a', 'stroke-width':32, fill:'none', 'stroke-linecap':'round'}));
  g.appendChild(svgEl('path', {d, stroke:'#555', 'stroke-width':2,  fill:'none', 'stroke-linecap':'round', 'stroke-dasharray':'16,14'}));
  // Área invisible más ancha para que sea fácil tocarla
  const hitbox = svgEl('path', {d, stroke:'transparent', 'stroke-width':45, fill:'none'});
  g.appendChild(hitbox);

  g.addEventListener('click',    () => showRoadMessage());
  g.addEventListener('touchend', (e) => { e.preventDefault(); showRoadMessage(); }, {passive:false});

  return g;
}

function showRoadMessage() {
  const old = document.getElementById('road-card');
  if (old) { old.remove(); return; }

  const card = document.createElement('div');
  card.id = 'road-card';
  card.style.cssText = `
    position:fixed;bottom:24px;left:50%;
    transform:translateX(-50%) translateY(120%);
    width:min(340px,calc(100vw - 40px));
    background:rgba(0,0,0,0.92);
    border:2px solid #6B7280;border-radius:16px;
    padding:18px;z-index:500;
    box-shadow:0 0 30px rgba(107,114,128,0.3);
    font-family:'Fira Code',monospace;
    transition:transform 0.4s cubic-bezier(.34,1.56,.64,1);
  `;
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <span style="font-size:28px;">🛣️</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#9CA3AF;">
          La Carretera
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px;">
          Testigo silenciosa de todo
        </div>
      </div>
      <button onclick="document.getElementById('road-card').remove()"
        style="margin-left:auto;background:none;border:1px solid #9CA3AF;
               color:#9CA3AF;width:26px;height:26px;border-radius:6px;
               cursor:pointer;font-size:13px;font-family:'Fira Code',monospace;">
        ✕
      </button>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,0.8);line-height:1.8;
                border-left:3px solid #9CA3AF;padding-left:12px;
                font-style:italic;">
      "He visto a más estudiantes llegando tarde que
      autos pasar por aquí."
    </div>
  `;
  document.body.appendChild(card);
  requestAnimationFrame(() => {
    setTimeout(() => card.style.transform = 'translateX(-50%) translateY(0)', 50);
  });
}

/* ─── Entrada ──────────────────────────────────── */
function buildEntry(e) {
  const g = svgEl('g', {class:'entry-point'});

  // Placa con borde verde lima
  g.appendChild(svgEl('rect', {
    x:e.x, y:e.y-20, width:44, height:40, rx:10,
    fill:'rgba(0,0,0,0.85)', stroke:'#BFFF00', 'stroke-width':2
  }));

  // Flecha doble apuntando hacia arriba
  g.appendChild(svgEl('path', {
    d:`M ${e.x+13},${e.y+2} L ${e.x+22},${e.y-8} L ${e.x+31},${e.y+2}`,
    stroke:'#BFFF00', 'stroke-width':3, fill:'none', 'stroke-linecap':'round', 'stroke-linejoin':'round'
  }));
  g.appendChild(svgEl('path', {
    d:`M ${e.x+13},${e.y+8} L ${e.x+22},${e.y-2} L ${e.x+31},${e.y+8}`,
    stroke:'#BFFF00', 'stroke-width':2, fill:'none', 'stroke-linecap':'round', 'stroke-linejoin':'round', opacity:'0.4'
  }));

  // Texto
  const t = svgEl('text', {
    x:e.x+22, y:e.y+34,
    'font-family':"'Fira Code',monospace",
    'font-size':'9', 'font-weight':'700',
    fill:'#BFFF00', 'text-anchor':'middle'
  });
  t.textContent = e.label;
  g.appendChild(t);

  // Al hacer clic lanza la pregunta
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
          ¡Bienvenid@, ${name}!
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

  // Cancha de Básquetbol — marco naranja sólido, diseño limpio
  if (b.id === 'domo2') {
    const mx = b.x + b.w/2;
    const my = b.y + b.h/2;
    const pad = 9;
    // Cancha verde interior con margen uniforme (el marco naranja es el color base del edificio)
    g.appendChild(svgEl('rect', {x:b.x+pad, y:b.y+pad, width:b.w-pad*2, height:b.h-pad*2, fill:'#15803D', stroke:'white', 'stroke-width':1.6}));
    // Línea central + círculo
    g.appendChild(svgEl('line', {x1:mx, y1:b.y+pad, x2:mx, y2:b.y+b.h-pad, stroke:'white', 'stroke-width':1.4}));
    g.appendChild(svgEl('circle', {cx:mx, cy:my, r:12, fill:'none', stroke:'white', 'stroke-width':1.4}));
    g.appendChild(svgEl('circle', {cx:mx, cy:my, r:1.4, fill:'white'}));
    // Áreas restrictivas — rectángulos rectos, sin formas de gota
    g.appendChild(svgEl('rect', {x:b.x+pad, y:my-15, width:24, height:30, fill:'none', stroke:'white', 'stroke-width':1.2}));
    g.appendChild(svgEl('rect', {x:b.x+b.w-pad-24, y:my-15, width:24, height:30, fill:'none', stroke:'white', 'stroke-width':1.2}));
    // Semicírculos de tiro libre
    g.appendChild(svgEl('path', {d:`M ${b.x+pad+24},${my-15} A 15,15 0 0 1 ${b.x+pad+24},${my+15}`, fill:'none', stroke:'white', 'stroke-width':1}));
    g.appendChild(svgEl('path', {d:`M ${b.x+b.w-pad-24},${my-15} A 15,15 0 0 0 ${b.x+b.w-pad-24},${my+15}`, fill:'none', stroke:'white', 'stroke-width':1}));
    // Tableros y aros
    g.appendChild(svgEl('rect', {x:b.x+pad-2, y:my-8, width:3, height:16, fill:'#5C3A1E'}));
    g.appendChild(svgEl('rect', {x:b.x+b.w-pad-1, y:my-8, width:3, height:16, fill:'#5C3A1E'}));
    g.appendChild(svgEl('circle', {cx:b.x+pad+22, cy:my, r:2.8, fill:'none', stroke:'white', 'stroke-width':1.2}));
    g.appendChild(svgEl('circle', {cx:b.x+b.w-pad-22, cy:my, r:2.8, fill:'none', stroke:'white', 'stroke-width':1.2}));
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
    const darkBgIds = ['taller_costura', 'banos_contr', 'computacion'];
    lines.forEach((line, i) => {
      const t = svgEl('text', {
        x:b.x+b.w/2, y:baseY + i*14,
        'font-family':"'Fira Code',monospace",
        'font-size':'9.5', 'font-weight':'700',
        fill:darkBgIds.includes(b.id) ? '#fff' : '#000', 'text-anchor':'middle', 'dominant-baseline':'middle'
      });
      t.textContent = line;
      g.appendChild(t);
    });
  } else if (b.multiline4) {
    // Texto compacto para varias líneas (edificios con múltiples espacios)
    const lines = b.label.split('\n');
    const lineHeight = 13.5;
    const totalH = lines.length * lineHeight;
    const startY = b.y + b.h/2 - totalH/2 + lineHeight/2;
    lines.forEach((line, i) => {
      const t = svgEl('text', {
        x:b.x+b.w/2, y:startY + i*lineHeight,
        'font-family':"'Fira Code',monospace",
        'font-size':'9', 'font-weight':'700',
        fill:'#fff', 'text-anchor':'middle', 'dominant-baseline':'middle'
      });
      t.textContent = line;
      g.appendChild(t);
    });
  } else {
    const darkBgIds = ['snte', 'bodega', 'domo2'];
    const t = svgEl('text', {
      x:b.x+b.w/2, y:b.labelY,
      'font-family':"'Fira Code',monospace",
      'font-size':b.w < 82 ? '9' : '10.5', 'font-weight':'700',
      fill: darkBgIds.includes(b.id) ? '#fff' : '#000',
      'text-anchor':'middle', 'dominant-baseline':'middle'
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
  // Asta más alta
  g.appendChild(svgEl('line', {x1:x, y1:y, x2:x, y2:y-50, stroke:'#777', 'stroke-width':3}));
  g.appendChild(svgEl('circle', {cx:x, cy:y-50, r:2.5, fill:'#D4A017'}));

  // Bandera ondeando con curvas (forma de tela en movimiento)
  g.appendChild(svgEl('path', {
    d:`M ${x},${y-44} Q ${x+10},${y-48} ${x+11.5},${y-43} Q ${x+13},${y-38} ${x+23},${y-41}
       Q ${x+33},${y-44} ${x+36},${y-38} L ${x+36},${y-22}
       Q ${x+33},${y-26} ${x+23},${y-23} Q ${x+13},${y-20} ${x+11.5},${y-25.5}
       Q ${x+10},${y-30.5} ${x},${y-27} Z`,
    fill:'#006847'
  }));
  g.appendChild(svgEl('path', {
    d:`M ${x+11.5},${y-43} Q ${x+13},${y-38} ${x+23},${y-41} Q ${x+23.6},${y-32.6} ${x+23},${y-23} Q ${x+13},${y-20} ${x+11.5},${y-25.5} Z`,
    fill:'#FFFFFF'
  }));
  g.appendChild(svgEl('path', {
    d:`M ${x+23},${y-41} Q ${x+33},${y-44} ${x+36},${y-38} L ${x+36},${y-22} Q ${x+33},${y-26} ${x+23},${y-23} Z`,
    fill:'#CE1126'
  }));
  g.appendChild(svgEl('ellipse', {cx:x+17.5, cy:y-32, rx:3.2, ry:4.3, fill:'#8B4513', opacity:0.75}));
  return g;
}


/* ─── Árbol ────────────────────────────────────── */
function buildTree(x, y) {
  const g = svgEl('g', {transform:`translate(${x},${y})`});
  g.appendChild(svgEl('ellipse', {cx:0, cy:17, rx:13, ry:5, fill:'rgba(0,0,0,0.45)'}));
  g.appendChild(svgEl('rect',    {x:-3, y:8, width:6, height:10, rx:2, fill:'#5D4037'}));
  const leafColors = ['#2E7D32','#388E3C','#4CAF50','#66BB6A'];
  [[0,-10,12],[0,-17,9]].forEach(([dx,dy,r],i) => {
    g.appendChild(svgEl('circle', {cx:dx, cy:dy, r, fill:leafColors[i+2], opacity:'0.9'}));
  });
  g.appendChild(svgEl('circle', {cx:0, cy:-2, r:15, fill:leafColors[0], opacity:'0.9'}));
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
  const g = svgEl('g', {style:'cursor:pointer'});
  const img = svgEl('image', {
    href: 'assets/mascota.png',
    x: x, y: y, width: w, height: h,
    preserveAspectRatio: 'xMidYMid meet',
    'image-rendering': 'optimizeQuality'
  });
  g.appendChild(img);

  g.addEventListener('click', () => showMascotaMessage());
  g.addEventListener('touchend', (e) => {
    e.preventDefault(); showMascotaMessage();
  }, {passive:false});

  return g;
}

function showMascotaMessage() {
  const old = document.getElementById('mascota-card');
  if (old) { old.remove(); return; }

  const card = document.createElement('div');
  card.id = 'mascota-card';
  card.style.cssText = `
    position:fixed;bottom:24px;left:50%;
    transform:translateX(-50%) translateY(120%);
    width:min(340px,calc(100vw - 40px));
    background:rgba(0,0,0,0.92);
    border:2px solid #BFFF00;border-radius:16px;
    padding:18px;z-index:500;
    box-shadow:0 0 30px rgba(191,255,0,0.3);
    font-family:'Fira Code',monospace;
    transition:transform 0.4s cubic-bezier(.34,1.56,.64,1);
  `;
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <span style="font-size:28px;">🐸</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#BFFF00;">
          Mascota Oficial
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px;">
          Turno Vespertino · Dr. Gabino Barreda
        </div>
      </div>
      <button onclick="document.getElementById('mascota-card').remove()"
        style="margin-left:auto;background:none;border:1px solid #BFFF00;
               color:#BFFF00;width:26px;height:26px;border-radius:6px;
               cursor:pointer;font-size:13px;font-family:'Fira Code',monospace;">
        ✕
      </button>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,0.85);line-height:1.8;
                border-left:3px solid #BFFF00;padding-left:12px;
                font-style:italic;">
      "El turno matutino llega primero a la escuela; el VESPERTINO llega primero a la META. 🏆"
    </div>
  `;
  document.body.appendChild(card);
  requestAnimationFrame(() => {
    setTimeout(() => card.style.transform = 'translateX(-50%) translateY(0)', 50);
  });
}

/* ─── Gato Bigotes ── */
function buildCat(x, y) {
  const outer = svgEl('g', {transform:`translate(${x},${y})`});
  const g = svgEl('g', {class:'wise-cat', 'data-id':'cat',
    style:'cursor:pointer'});
  outer.appendChild(g);

  // Sombra
  g.appendChild(svgEl('ellipse', {cx:0, cy:22, rx:16, ry:5,
    fill:'rgba(0,0,0,0.4)'}));

  // Cuerpo negro
  g.appendChild(svgEl('ellipse', {cx:0, cy:8, rx:14, ry:16,
    fill:'#4A4A5A'}));

  // Cabeza
  g.appendChild(svgEl('circle', {cx:0, cy:-12, r:13,
    fill:'#4A4A5A'}));

  // Orejas puntiagudas
  g.appendChild(svgEl('polygon', {
    points:'-13,-22 -7,-8 -3,-22', fill:'#4A4A5A'}));
  g.appendChild(svgEl('polygon', {
    points:'13,-22 7,-8 3,-22', fill:'#4A4A5A'}));
  g.appendChild(svgEl('polygon', {
    points:'-11,-20 -7,-10 -4,-20', fill:'#EC4899', opacity:'0.7'}));
  g.appendChild(svgEl('polygon', {
    points:'11,-20 7,-10 4,-20', fill:'#EC4899', opacity:'0.7'}));

  // Ojos amarillos
  g.appendChild(svgEl('ellipse', {cx:-5, cy:-13, rx:3, ry:4, fill:'#FACC15'}));
  g.appendChild(svgEl('ellipse', {cx:5,  cy:-13, rx:3, ry:4, fill:'#FACC15'}));
  // Pupilas
  g.appendChild(svgEl('ellipse', {cx:-5, cy:-13, rx:1.2, ry:3.5, fill:'#000'}));
  g.appendChild(svgEl('ellipse', {cx:5,  cy:-13, rx:1.2, ry:3.5, fill:'#000'}));
  // Brillo
  g.appendChild(svgEl('circle', {cx:-4, cy:-14, r:0.8, fill:'#fff'}));
  g.appendChild(svgEl('circle', {cx:6,  cy:-14, r:0.8, fill:'#fff'}));

  // Nariz
  g.appendChild(svgEl('polygon', {
    points:'0,-8 -2,-6 2,-6', fill:'#EC4899'}));

  // Bigotes
  [[-14,-7,-4,-7],[-14,-5,-4,-6],[4,-7,14,-7],[4,-6,14,-5]].forEach(
    ([x1,y1,x2,y2]) => g.appendChild(svgEl('line', {
      x1,y1,x2,y2, stroke:'rgba(255,255,255,0.6)', 'stroke-width':0.8
    }))
  );

  // Cola
  g.appendChild(svgEl('path', {
    d:'M 10,18 Q 28,10 24,0 Q 20,-8 14,-4',
    stroke:'#4A4A5A', 'stroke-width':5,
    fill:'none', 'stroke-linecap':'round'
  }));

  g.style.animation = 'catIdle 2.5s ease-in-out infinite';

  outer.addEventListener('click', () => showCatMessage());
  outer.addEventListener('touchend', (e) => {
    e.preventDefault(); showCatMessage();
  }, {passive:false});
  return outer;
}

function showCatMessage() {
  const old = document.getElementById('cat-card');
  if (old) { old.remove(); return; }

  const card = document.createElement('div');
  card.id = 'cat-card';
  card.style.cssText = `
    position:fixed;bottom:24px;left:50%;
    transform:translateX(-50%) translateY(120%);
    width:min(340px,calc(100vw - 40px));
    background:rgba(0,0,0,0.92);
    border:2px solid #EC4899;border-radius:16px;
    padding:18px;z-index:500;
    box-shadow:0 0 30px rgba(236,72,153,0.3);
    font-family:'Fira Code',monospace;
    transition:transform 0.4s cubic-bezier(.34,1.56,.64,1);
  `;
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <span style="font-size:30px;">🐱</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#EC4899;">
          Bigotes
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px;">
          Habitante permanente
        </div>
      </div>
      <button onclick="document.getElementById('cat-card').remove()"
        style="margin-left:auto;background:none;border:1px solid #EC4899;
               color:#EC4899;width:26px;height:26px;border-radius:6px;
               cursor:pointer;font-size:13px;font-family:'Fira Code',monospace;">
        ✕
      </button>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,0.8);line-height:1.8;
                border-left:3px solid #EC4899;padding-left:12px;
                font-style:italic;">
      "Este gato antes era un estudiante, luego fue maestro, ahora es un gato. ¡Cuidado el siguiente podrías ser tú!"
    </div>
  `;
  document.body.appendChild(card);
  requestAnimationFrame(() => {
    setTimeout(() => card.style.transform = 'translateX(-50%) translateY(0)', 50);
  });
}

/* ─── Cartón de Leche ── */
function buildMilk(x, y) {
  const outer = svgEl('g', {transform:`translate(${x},${y})`});
  const g = svgEl('g', {style:'cursor:pointer'});
  outer.appendChild(g);

  // Sombra
  g.appendChild(svgEl('ellipse', {cx:0, cy:28, rx:12, ry:4,
    fill:'rgba(0,0,0,0.4)'}));

  // Cuerpo
  g.appendChild(svgEl('rect', {x:-11, y:-5, width:22, height:32,
    rx:2, fill:'#F0F4FF'}));

  // Techo izquierdo
  g.appendChild(svgEl('polygon', {
    points:'-11,-5 0,-22 0,-5', fill:'#E2E8FF'}));

  // Techo derecho
  g.appendChild(svgEl('polygon', {
    points:'11,-5 0,-22 0,-5', fill:'#CBD5FF'}));

  // Franja roja
  g.appendChild(svgEl('rect', {x:-11, y:4, width:22, height:5,
    fill:'#EF4444', opacity:'0.85'}));

  // Texto LECHE
  const txt = svgEl('text', {
    x:0, y:16,
    'font-family':"'Fira Code',monospace",
    'font-size':'5.5', 'font-weight':'700',
    fill:'#1E3A8A', 'text-anchor':'middle'
  });
  txt.textContent = 'LECHE';
  g.appendChild(txt);

  // Ojos (conciencia)
  g.appendChild(svgEl('circle', {cx:-4, cy:9, r:2.5, fill:'#1E3A8A'}));
  g.appendChild(svgEl('circle', {cx:4,  cy:9, r:2.5, fill:'#1E3A8A'}));
  g.appendChild(svgEl('circle', {cx:-3, cy:8, r:0.9, fill:'#fff'}));
  g.appendChild(svgEl('circle', {cx:5,  cy:8, r:0.9, fill:'#fff'}));

  // Boca seria
  g.appendChild(svgEl('path', {
    d:'M -3,21 Q 0,19 3,21',
    stroke:'#1E3A8A', 'stroke-width':1,
    fill:'none', 'stroke-linecap':'round'
  }));

  // Animación
  g.style.animation = 'catIdle 3.8s ease-in-out infinite';

  outer.addEventListener('click',    () => showMilkMessage());
  outer.addEventListener('touchend', (e) => {
    e.preventDefault(); showMilkMessage();
  }, {passive:false});
  return outer;
}

function showMilkMessage() {
  const old = document.getElementById('milk-card');
  if (old) { old.remove(); return; }

  const card = document.createElement('div');
  card.id = 'milk-card';
  card.style.cssText = `
    position:fixed;bottom:24px;left:50%;
    transform:translateX(-50%) translateY(120%);
    width:min(340px,calc(100vw - 40px));
    background:rgba(0,0,0,0.92);
    border:2px solid #60A5FA;border-radius:16px;
    padding:18px;z-index:500;
    box-shadow:0 0 30px rgba(96,165,250,0.3);
    font-family:'Fira Code',monospace;
    transition:transform 0.4s cubic-bezier(.34,1.56,.64,1);
  `;
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <span style="font-size:28px;">🥛</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#60A5FA;">
          Jugo de Vaca
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px;">
          Entidad biológica autoconsciente
        </div>
      </div>
      <button onclick="document.getElementById('milk-card').remove()"
        style="margin-left:auto;background:none;border:1px solid #60A5FA;
               color:#60A5FA;width:26px;height:26px;border-radius:6px;
               cursor:pointer;font-size:13px;font-family:'Fira Code',monospace;">
        ✕
      </button>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,0.8);line-height:1.8;
                border-left:3px solid #60A5FA;padding-left:12px;
                font-style:italic;">
      "Abandonado en la escuela hace 16 años.
      Ha desarrollado conciencia. Ahora observa a los estudiantes
      y juzga sus decisiones."
    </div>
  `;
  document.body.appendChild(card);
  requestAnimationFrame(() => {
    setTimeout(() => card.style.transform = 'translateX(-50%) translateY(0)', 50);
  });
}

/* ─── Perro Hambriento ── */
function buildDog(x, y) {
  const outer = svgEl('g', {transform:`translate(${x},${y})`});
  const g = svgEl('g', {style:'cursor:pointer'});
  outer.appendChild(g);

  // Sombra
  g.appendChild(svgEl('ellipse', {cx:0, cy:30, rx:22, ry:5, fill:'rgba(0,0,0,0.4)'}));

  // Cuerpo
  g.appendChild(svgEl('ellipse', {cx:0, cy:14, rx:18, ry:15, fill:'#C68642'}));
  g.appendChild(svgEl('ellipse', {cx:0, cy:17, rx:11, ry:10, fill:'#E8C39E'}));

  // Patas delanteras
  g.appendChild(svgEl('ellipse', {cx:-12, cy:26, rx:4, ry:6, fill:'#C68642'}));
  g.appendChild(svgEl('ellipse', {cx:12,  cy:26, rx:4, ry:6, fill:'#C68642'}));

  // Cabeza
  g.appendChild(svgEl('circle', {cx:0, cy:-8, r:16, fill:'#C68642'}));

  // Hocico
  g.appendChild(svgEl('ellipse', {cx:0, cy:-1, rx:8, ry:6, fill:'#E8C39E'}));
  g.appendChild(svgEl('ellipse', {cx:0, cy:-4, rx:3, ry:2.2, fill:'#3E2723'}));

  // Orejas caídas
  g.appendChild(svgEl('path', {d:'M -13,-16 Q -22,-8 -16,2 Q -12,4 -10,-4 Z', fill:'#8D5524'}));
  g.appendChild(svgEl('path', {d:'M 13,-16 Q 22,-8 16,2 Q 12,4 10,-4 Z', fill:'#8D5524'}));

  // Ojos suplicantes
  g.appendChild(svgEl('ellipse', {cx:-7, cy:-11, rx:4.5, ry:5, fill:'white'}));
  g.appendChild(svgEl('ellipse', {cx:7,  cy:-11, rx:4.5, ry:5, fill:'white'}));
  g.appendChild(svgEl('circle', {cx:-6.5, cy:-10, r:3, fill:'#3E2723'}));
  g.appendChild(svgEl('circle', {cx:7.5,  cy:-10, r:3, fill:'#3E2723'}));
  g.appendChild(svgEl('circle', {cx:-5.5, cy:-11.5, r:1, fill:'white'}));
  g.appendChild(svgEl('circle', {cx:8.5,  cy:-11.5, r:1, fill:'white'}));

  // Cejas tristes
  g.appendChild(svgEl('path', {d:'M -11,-17 Q -7,-19 -3,-17', stroke:'#3E2723', 'stroke-width':1, fill:'none', 'stroke-linecap':'round'}));
  g.appendChild(svgEl('path', {d:'M 3,-17 Q 7,-19 11,-17', stroke:'#3E2723', 'stroke-width':1, fill:'none', 'stroke-linecap':'round'}));

  // Boca con lengua
  g.appendChild(svgEl('path', {d:'M -6,2 Q 0,7 6,2 Q 5,5 0,6 Q -5,5 -6,2 Z', fill:'#3E2723'}));
  g.appendChild(svgEl('path', {d:'M -3,2 Q 0,8 3,2 Q 2,5 0,6 Q -2,5 -3,2 Z', fill:'#E0707A'}));

  // Cola
  g.appendChild(svgEl('path', {d:'M 16,16 Q 26,10 24,0', stroke:'#C68642', 'stroke-width':5, fill:'none', 'stroke-linecap':'round'}));

  // Animación flotante
  g.style.animation = 'catIdle 2.2s ease-in-out infinite';

  outer.addEventListener('click', () => showDogMessage());
  outer.addEventListener('touchend', (e) => {
    e.preventDefault(); showDogMessage();
  }, {passive:false});

  return outer;
}

function showDogMessage() {
  const old = document.getElementById('dog-card');
  if (old) { old.remove(); return; }

  const card = document.createElement('div');
  card.id = 'dog-card';
  card.style.cssText = `
    position:fixed;bottom:24px;left:50%;
    transform:translateX(-50%) translateY(120%);
    width:min(340px,calc(100vw - 40px));
    background:rgba(0,0,0,0.92);
    border:2px solid #C68642;border-radius:16px;
    padding:18px;z-index:500;
    box-shadow:0 0 30px rgba(198,134,66,0.3);
    font-family:'Fira Code',monospace;
    transition:transform 0.4s cubic-bezier(.34,1.56,.64,1);
  `;
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <span style="font-size:28px;">🐕</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#D9A066;">
          Pulgas
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px;">
          Perro Alfa I
        </div>
      </div>
      <button onclick="document.getElementById('dog-card').remove()"
        style="margin-left:auto;background:none;border:1px solid #D9A066;
               color:#D9A066;width:26px;height:26px;border-radius:6px;
               cursor:pointer;font-size:13px;font-family:'Fira Code',monospace;">
        ✕
      </button>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,0.8);line-height:1.8;
                border-left:3px solid #D9A066;padding-left:12px;
                font-style:italic;">
      "Alto ahí. Dame tu torta de milanesa o le cuento a todos
      que te gusta Lupita TikTok."
    </div>
  `;
  document.body.appendChild(card);
  requestAnimationFrame(() => {
    setTimeout(() => card.style.transform = 'translateX(-50%) translateY(0)', 50);
  });
}

/* ─── Chilaquil — Perro Pachón ── */
function buildFluffyDog(x, y) {
  const outer = svgEl('g', {transform:`translate(${x},${y})`});
  const g = svgEl('g', {style:'cursor:pointer'});
  outer.appendChild(g);

  // Sombra
  g.appendChild(svgEl('ellipse', {cx:0, cy:32, rx:24, ry:5, fill:'rgba(0,0,0,0.4)'}));

  // Cuerpo esponjoso
  g.appendChild(svgEl('ellipse', {cx:0, cy:16, rx:20, ry:17, fill:'#9C9C9C'}));
  g.appendChild(svgEl('ellipse', {cx:-13, cy:20, rx:6, ry:8, fill:'#B5B5B5'}));
  g.appendChild(svgEl('ellipse', {cx:13,  cy:20, rx:6, ry:8, fill:'#B5B5B5'}));
  g.appendChild(svgEl('ellipse', {cx:0,   cy:26, rx:10, ry:7, fill:'#B5B5B5'}));

  // Patas peludas
  g.appendChild(svgEl('ellipse', {cx:-13, cy:30, rx:5, ry:6, fill:'#A8A8A8'}));
  g.appendChild(svgEl('ellipse', {cx:13,  cy:30, rx:5, ry:6, fill:'#A8A8A8'}));

  // Cabeza muy peluda
  g.appendChild(svgEl('circle', {cx:0, cy:-6, r:17, fill:'#9C9C9C'}));

  // Mechones de pelo
  g.appendChild(svgEl('ellipse', {cx:-15, cy:-10, rx:6, ry:9, fill:'#B5B5B5', transform:'rotate(-20,-15,-10)'}));
  g.appendChild(svgEl('ellipse', {cx:15,  cy:-10, rx:6, ry:9, fill:'#B5B5B5', transform:'rotate(20,15,-10)'}));
  g.appendChild(svgEl('ellipse', {cx:-10, cy:-18, rx:5, ry:7, fill:'#B5B5B5', transform:'rotate(-30,-10,-18)'}));
  g.appendChild(svgEl('ellipse', {cx:10,  cy:-18, rx:5, ry:7, fill:'#B5B5B5', transform:'rotate(30,10,-18)'}));
  g.appendChild(svgEl('ellipse', {cx:0,   cy:-20, rx:6, ry:6, fill:'#B5B5B5'}));

  // Hocico
  g.appendChild(svgEl('ellipse', {cx:0, cy:0,  rx:7, ry:5, fill:'#C9C9C9'}));
  g.appendChild(svgEl('ellipse', {cx:0, cy:-2, rx:2.8, ry:2, fill:'#2A2A2A'}));

  // Ojos casi tapados
  g.appendChild(svgEl('ellipse', {cx:-7, cy:-9, rx:2.5, ry:3, fill:'#2A2A2A'}));
  g.appendChild(svgEl('ellipse', {cx:7,  cy:-9, rx:2.5, ry:3, fill:'#2A2A2A'}));
  g.appendChild(svgEl('circle', {cx:-6.3, cy:-10, r:0.7, fill:'white'}));
  g.appendChild(svgEl('circle', {cx:7.7,  cy:-10, r:0.7, fill:'white'}))

  // Boca
  g.appendChild(svgEl('path', {d:'M -4,3 Q 0,6 4,3', stroke:'#2A2A2A', 'stroke-width':1, fill:'none', 'stroke-linecap':'round'}));

  // Orejas peludas y caídas
  g.appendChild(svgEl('ellipse', {cx:-16, cy:-2, rx:5, ry:9, fill:'#8A8A8A', transform:'rotate(-15,-16,-2)'}));
  g.appendChild(svgEl('ellipse', {cx:16,  cy:-2, rx:5, ry:9, fill:'#8A8A8A', transform:'rotate(15,16,-2)'}));

  // Cola esponjosa
  g.appendChild(svgEl('ellipse', {cx:20, cy:14, rx:6, ry:10, fill:'#9C9C9C', transform:'rotate(25,20,14)'}));

  // Animación flotante
  g.style.animation = 'catIdle 2.6s ease-in-out infinite';

  outer.addEventListener('click', () => showFluffyDogMessage());
  outer.addEventListener('touchend', (e) => {
    e.preventDefault(); showFluffyDogMessage();
  }, {passive:false});

  return outer;
}

function showFluffyDogMessage() {
  const old = document.getElementById('fluffydog-card');
  if (old) { old.remove(); return; }

  const card = document.createElement('div');
  card.id = 'fluffydog-card';
  card.style.cssText = `
    position:fixed;bottom:24px;left:50%;
    transform:translateX(-50%) translateY(120%);
    width:min(340px,calc(100vw - 40px));
    background:rgba(0,0,0,0.92);
    border:2px solid #9C9C9C;border-radius:16px;
    padding:18px;z-index:500;
    box-shadow:0 0 30px rgba(156,156,156,0.3);
    font-family:'Fira Code',monospace;
    transition:transform 0.4s cubic-bezier(.34,1.56,.64,1);
  `;
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <span style="font-size:28px;">🐩</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#C0C0C0;">
          Chilaquil
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px;">
          Perro Alfa II
        </div>
      </div>
      <button onclick="document.getElementById('fluffydog-card').remove()"
        style="margin-left:auto;background:none;border:1px solid #C0C0C0;
               color:#C0C0C0;width:26px;height:26px;border-radius:6px;
               cursor:pointer;font-size:13px;font-family:'Fira Code',monospace;">
        ✕
      </button>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,0.8);line-height:1.8;
                border-left:3px solid #C0C0C0;padding-left:12px;
                font-style:italic;">
      "Sobreviví a tres generaciones de prefectos. Ustedes no
      durarán tanto. Digo Guau Guau."
    </div>
  `;
  document.body.appendChild(card);
  requestAnimationFrame(() => {
    setTimeout(() => card.style.transform = 'translateX(-50%) translateY(0)', 50);
  });
}

/* ─── Cheems — con capucha de rana ── */
function buildCheems(x, y) {
  const outer = svgEl('g', {transform:`translate(${x},${y})`, id:'cheems-character'});
  const g = svgEl('g', {style:'cursor:pointer'});
  outer.appendChild(g);

  // Sombra
  g.appendChild(svgEl('ellipse', {cx:0, cy:44, rx:24, ry:5, fill:'rgba(0,0,0,0.4)'}));

  // Patas traseras
  g.appendChild(svgEl('ellipse', {cx:-15, cy:38, rx:6, ry:6, fill:'#D2A24C'}));
  g.appendChild(svgEl('ellipse', {cx:15,  cy:38, rx:6, ry:6, fill:'#D2A24C'}));
  g.appendChild(svgEl('ellipse', {cx:-18, cy:43, rx:3.5, ry:2.5, fill:'#E8C97A'}));
  g.appendChild(svgEl('ellipse', {cx:18,  cy:43, rx:3.5, ry:2.5, fill:'#E8C97A'}));

  // Cuerpo estilizado
  g.appendChild(svgEl('ellipse', {cx:0, cy:20, rx:15, ry:22, fill:'#D2A24C'}));
  g.appendChild(svgEl('ellipse', {cx:0, cy:24, rx:9,  ry:17, fill:'#F0DDA8'}));

  // Patas delanteras delgadas
  g.appendChild(svgEl('ellipse', {cx:-12, cy:36, rx:3.5, ry:9, fill:'#D2A24C', transform:'rotate(10,-12,36)'}));
  g.appendChild(svgEl('ellipse', {cx:12,  cy:36, rx:3.5, ry:9, fill:'#D2A24C', transform:'rotate(-10,12,36)'}));
  g.appendChild(svgEl('ellipse', {cx:-14, cy:43, rx:2.5, ry:2, fill:'#E8C97A'}));
  g.appendChild(svgEl('ellipse', {cx:14,  cy:43, rx:2.5, ry:2, fill:'#E8C97A'}));

  // Orejas reales del perro, redondeadas
  g.appendChild(svgEl('path', {d:'M -11,-9 Q -16,-15 -13,-19 Q -9,-17 -7,-12 Z', fill:'#C08F3E'}));
  g.appendChild(svgEl('path', {d:'M 11,-9 Q 16,-15 13,-19 Q 9,-17 7,-12 Z', fill:'#C08F3E'}));

  // Cuello con capucha de rana
  g.appendChild(svgEl('path', {d:'M -14,-8 Q -17,2 -12,8 L 12,8 Q 17,2 14,-8 Q 14,-18 0,-20 Q -14,-18 -14,-8 Z', fill:'#4CD437'}));

  // Orejas de la capucha
  g.appendChild(svgEl('ellipse', {cx:-8, cy:-24, rx:6, ry:9, fill:'#4CD437'}));
  g.appendChild(svgEl('ellipse', {cx:8,  cy:-24, rx:6, ry:9, fill:'#4CD437'}));
  g.appendChild(svgEl('ellipse', {cx:-8, cy:-25, rx:3.4, ry:5.5, fill:'white'}));
  g.appendChild(svgEl('ellipse', {cx:8,  cy:-25, rx:3.4, ry:5.5, fill:'white'}));
  g.appendChild(svgEl('circle', {cx:-8, cy:-24, r:1.8, fill:'#1A1A1A'}));
  g.appendChild(svgEl('circle', {cx:8,  cy:-24, r:1.8, fill:'#1A1A1A'}));

  // Cabeza
  g.appendChild(svgEl('ellipse', {cx:0, cy:-3, rx:10, ry:9, fill:'#D2A24C'}));

  // Hocico largo
  g.appendChild(svgEl('path', {d:'M -7,2 Q -9,12 -4,15 L 4,15 Q 9,12 7,2 Q 6,8 0,9 Q -6,8 -7,2 Z', fill:'#D2A24C'}));
  g.appendChild(svgEl('ellipse', {cx:0, cy:6, rx:6, ry:9, fill:'#F0DDA8'}));

  // Nariz
  g.appendChild(svgEl('ellipse', {cx:0, cy:13, rx:3.5, ry:2.6, fill:'#F5E8C8'}));
  g.appendChild(svgEl('ellipse', {cx:0, cy:12, rx:1.6, ry:1.3, fill:'#2A2A2A'}));

  // Ojos entrecerrados
  g.appendChild(svgEl('path', {d:'M -6,-3 Q -3.5,-1.3 -0.8,-2.3', stroke:'#2A2A2A', 'stroke-width':1.4, fill:'none', 'stroke-linecap':'round'}));
  g.appendChild(svgEl('path', {d:'M 0.8,-2.3 Q 3.5,-1.3 6,-3', stroke:'#2A2A2A', 'stroke-width':1.4, fill:'none', 'stroke-linecap':'round'}));

  // Boca
  g.appendChild(svgEl('path', {d:'M -3,15.5 Q 0,17 3,15.5', stroke:'#8A6D3B', 'stroke-width':0.8, fill:'none', 'stroke-linecap':'round'}));

  // Cola
  g.appendChild(svgEl('path', {d:'M 13,28 Q 22,20 19,8', stroke:'#D2A24C', 'stroke-width':5, fill:'none', 'stroke-linecap':'round'}));

  // Animación flotante
  g.style.animation = 'catIdle 2.4s ease-in-out infinite';

  outer.addEventListener('click', () => showCheemsMessage());
  outer.addEventListener('touchend', (e) => {
    e.preventDefault(); showCheemsMessage();
  }, {passive:false});

  return outer;
}

function showCheemsMessage() {
  const old = document.getElementById('cheems-card');
  if (old) { old.remove(); return; }

  // El texto cambia según si ya se completó el mapa
  const isComplete = STATE.discovered.size >= BUILDINGS.length;
  const mensaje = isComplete
    ? 'Ya no tengo ansiedad.'
    : 'Tengo ansiedad porque aún no terminas el recorrido.';
  const emoji = isComplete ? '🐕' : '🐕';

  const card = document.createElement('div');
  card.id = 'cheems-card';
  card.style.cssText = `
    position:fixed;bottom:24px;left:50%;
    transform:translateX(-50%) translateY(120%);
    width:min(340px,calc(100vw - 40px));
    background:rgba(0,0,0,0.92);
    border:2px solid #4CD437;border-radius:16px;
    padding:18px;z-index:500;
    box-shadow:0 0 30px rgba(76,212,55,0.3);
    font-family:'Fira Code',monospace;
    transition:transform 0.4s cubic-bezier(.34,1.56,.64,1);
  `;
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <span style="font-size:28px;">${emoji}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#7FE070;">
          Cheems
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:2px;">
          ¡No puede ser!
        </div>
      </div>
      <button onclick="document.getElementById('cheems-card').remove()"
        style="margin-left:auto;background:none;border:1px solid #7FE070;
               color:#7FE070;width:26px;height:26px;border-radius:6px;
               cursor:pointer;font-size:13px;font-family:'Fira Code',monospace;">
        ✕
      </button>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,0.8);line-height:1.8;
                border-left:3px solid #4CD437;padding-left:12px;
                font-style:italic;">
      "${mensaje}"
    </div>
  `;
  document.body.appendChild(card);
  requestAnimationFrame(() => {
    setTimeout(() => card.style.transform = 'translateX(-50%) translateY(0)', 50);
  });
}

/* ─── Tarjeta de felicitación al completar todos los lugares ── */
function showCompleteCard() {
  const old = document.getElementById('complete-card');
  if (old) return;

  const totalActivities = getTotalActivities();

  const card = document.createElement('div');
  card.id = 'complete-card';
  card.style.cssText = `
    position:fixed;bottom:24px;left:50%;
    transform:translateX(-50%) translateY(120%);
    width:min(340px,calc(100vw - 40px));
    background:rgba(0,0,0,0.95);
    border:2px solid #BFFF00;border-radius:16px;
    padding:20px;z-index:500;
    box-shadow:0 0 40px rgba(191,255,0,0.4);
    font-family:'Fira Code',monospace;
    transition:transform 0.4s cubic-bezier(.34,1.56,.64,1);
    text-align:center;
  `;
  card.innerHTML = `
    <div style="font-size:36px;margin-bottom:10px;">🎉</div>
    <div style="font-size:15px;font-weight:700;color:#BFFF00;
                text-shadow:0 0 12px rgba(191,255,0,0.5);margin-bottom:6px;">
      ¡Mapa Completo!
    </div>
    <div style="font-size:13px;font-weight:700;color:#FACC15;margin-bottom:12px;">
      Bienvenid@ al Turno Vespertino
    </div>
    <div style="font-size:11px;color:rgba(255,255,255,0.7);
                line-height:1.8;margin-bottom:16px;
                border-top:1px solid rgba(191,255,0,0.15);
                padding-top:12px;">
      Has completado las <strong style="color:#BFFF00;">${totalActivities} actividades</strong>
      de la Escuela Secundaria<br>
      <strong style="color:#FACC15;">Dr. Gabino Barreda</strong><br>
      Turno Vespertino · ExpoEduca 2026 🐸
    </div>
    <button onclick="document.getElementById('complete-card').remove()"
      style="width:100%;background:#BFFF00;border:none;border-radius:8px;
             padding:10px;color:#000;font-family:'Fira Code',monospace;
             font-size:13px;font-weight:700;cursor:pointer;">
      ¡Gracias por explorar! 🗺️
    </button>
  `;
  document.body.appendChild(card);
  requestAnimationFrame(() => {
    setTimeout(() => card.style.transform = 'translateX(-50%) translateY(0)', 50);
  });
}

/* ═══════════════════════════════════════════════════
   RANA — SVG + animaciones + arrastre
═══════════════════════════════════════════════════ */
function buildFrogSVG() {
  return `<svg id="frog-svg" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" overflow="visible">
  <g id="frog-body">
    <ellipse cx="30" cy="56" rx="17" ry="4" fill="rgba(0,0,0,0.4)"/>

    <path d="M 10,38 Q 3,42 3,50 Q 3,56 10,55 Q 14,52 14,42 Z" fill="#43A047"/>
    <path d="M 50,38 Q 57,42 57,50 Q 57,56 50,55 Q 46,52 46,42 Z" fill="#43A047"/>
    <ellipse cx="8" cy="52" rx="6" ry="4" fill="#5DB85C"/>
    <ellipse cx="52" cy="52" rx="6" ry="4" fill="#5DB85C"/>

    <ellipse cx="30" cy="36" rx="19" ry="17" fill="#4CAF50"/>
    <ellipse cx="30" cy="38" rx="13" ry="14" fill="#F5F0B8"/>

    <ellipse cx="30" cy="18" rx="22" ry="15" fill="#4CAF50"/>

    <ellipse cx="20" cy="8" rx="9.5" ry="10.5" fill="white" stroke="#1A1A1A" stroke-width="1"/>
    <circle cx="19" cy="9" r="6" fill="#2B2118"/>
    <circle cx="21" cy="6.5" r="1.8" fill="white"/>
    <circle cx="17" cy="11" r="0.9" fill="white" opacity="0.7"/>

    <ellipse cx="40" cy="6" rx="8.5" ry="9.5" fill="white" stroke="#1A1A1A" stroke-width="1"/>
    <circle cx="40" cy="7" r="5.5" fill="#2B2118"/>
    <circle cx="42" cy="4.5" r="1.6" fill="white"/>
    <circle cx="38" cy="9" r="0.8" fill="white" opacity="0.7"/>

    <circle cx="26" cy="22" r="0.9" fill="#2E7D32"/>
    <circle cx="34" cy="22" r="0.9" fill="#2E7D32"/>

    <path d="M 12,24 Q 30,33 48,24" stroke="#1A1A1A" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M 24,27 Q 30,33 36,27 Q 34,32 30,33 Q 26,32 24,27 Z" fill="#D9534F"/>
    <ellipse cx="30" cy="29" rx="3" ry="2" fill="#C9302C" opacity="0.5"/>

    <ellipse cx="8" cy="30" rx="6" ry="4" fill="#4CAF50" transform="rotate(-35,8,30)"/>
    <ellipse cx="52" cy="30" rx="6" ry="4" fill="#4CAF50" transform="rotate(35,52,30)"/>
    <ellipse cx="4" cy="36" rx="3.5" ry="2.5" fill="#5DB85C" transform="rotate(-35,4,36)"/>
    <ellipse cx="56" cy="36" rx="3.5" ry="2.5" fill="#5DB85C" transform="rotate(35,56,36)"/>
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
  const px = x * STATE.zoom + STATE.panX - 30;
  const py = y * STATE.zoom + STATE.panY - 30;
  const sx  = STATE.frogFaceLeft ? -1 : 1;
  document.getElementById('frog-wrapper').style.transform =
    `translate(${px}px,${py}px) scaleX(${sx})`;
  updateMinimapDot();
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
   MÚSICA AMBIENTAL RETRO — generada con Web Audio API
   Melodía de 8 notas en loop, estilo videojuego clásico
═══════════════════════════════════════════════════ */
STATE.musicPlaying = false;
STATE.musicTimeouts = [];

// Notas en Hz — escala pentatónica
const MELODY = [
  // Golpe de apertura, fuerte y directo
  {note: 220.00, dur: 0.35}, // A3 — golpe
  {note: 0,      dur: 0.05},
  {note: 261.63, dur: 0.35}, // C4 — golpe
  {note: 0,      dur: 0.05},

  // Subida dramática
  {note: 329.63, dur: 0.18}, // E4
  {note: 392.00, dur: 0.18}, // G4
  {note: 440.00, dur: 0.5},  // A4 — clímax sostenido
  {note: 0,      dur: 0.15},

  // Segunda ola, más alta
  {note: 440.00, dur: 0.18}, // A4
  {note: 523.25, dur: 0.18}, // C5
  {note: 587.33, dur: 0.6},  // D5 — clímax más alto, sostenido
  {note: 0,      dur: 0.2},

  // Resolución poderosa
  {note: 523.25, dur: 0.18}, // C5
  {note: 440.00, dur: 0.18}, // A4
  {note: 329.63, dur: 0.18}, // E4
  {note: 220.00, dur: 0.7},  // A3 — cierre grave y largo
  {note: 0,      dur: 0.5},
];

function playMusicNote(freq, duration, startTime) {
  if (freq === 0) return;
  const ctx = STATE.audioCtx;

  // Voz principal (melodía)
  const osc1  = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(freq, startTime);
  gain1.gain.setValueAtTime(0.15, startTime);
  gain1.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.9);
  osc1.start(startTime);
  osc1.stop(startTime + duration);

  // Voz de refuerzo (una octava abajo, da grosor "épico")
  const osc2  = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(freq / 2, startTime);
  gain2.gain.setValueAtTime(0.1, startTime);
  gain2.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.9);
  osc2.start(startTime);
  osc2.stop(startTime + duration);
}

function playMelodyLoop() {
  if (!STATE.musicPlaying) return;
  const ctx = STATE.audioCtx;
  let time = ctx.currentTime;

  MELODY.forEach(({note, dur}) => {
    playMusicNote(note, dur, time);
    time += dur;
  });

  const totalDuration = MELODY.reduce((sum, n) => sum + n.dur, 0);
  const timeoutId = setTimeout(() => playMelodyLoop(), totalDuration * 1000);
  STATE.musicTimeouts.push(timeoutId);
}

function toggleMusic() {
  initAudio();
  STATE.musicPlaying = !STATE.musicPlaying;

  const btn = document.getElementById('music-toggle');
  if (btn) btn.textContent = STATE.musicPlaying ? '🔊' : '🔇';

  if (STATE.musicPlaying) {
    playMelodyLoop();
  } else {
    STATE.musicTimeouts.forEach(id => clearTimeout(id));
    STATE.musicTimeouts = [];
  }
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
  // Los edificios "padre" no se marcan solos — se descubren por sub-actividad
  if (PARENT_BUILDINGS.includes(id)) return;

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

  if (isRealActivity(id)) {
    spawnFullScreenConfetti();
    updateHUD();
    checkAchievements();
  } else {
    showFrogSpeechBubble();
  }
}

function discoverSubActivity(subId) {
  if (STATE.discovered.has(subId)) return;
  STATE.discovered.add(subId);

  // Lista del explorador (si existe esa fila)
  const item = document.querySelector(`.explorer-item[data-id="${subId}"]`);
  if (item) {
    item.classList.add('found');
    const c = item.querySelector('.explorer-item-check');
    if (c) c.textContent = '✓';
  }

  // Si todas las sub-actividades del padre ya se descubrieron, marcar el edificio visualmente
  const sub = getActivity(subId);
  if (sub?.parentId) {
    const siblings = STATE.activities.filter(a => a.parentId === sub.parentId);
    const allFound = siblings.every(s => STATE.discovered.has(s.id));
    if (allFound) {
      const chk = document.querySelector(`.building[data-id="${sub.parentId}"] .building-check`);
      if (chk) chk.style.display = 'block';
      const bEl = document.querySelector(`.building[data-id="${sub.parentId}"]`);
      if (bEl) bEl.classList.add('discovered');
    }
  }

  // Las sub-actividades siempre son actividades reales
  if (isRealActivity(subId)) {
    spawnFullScreenConfetti();
  }

  updateHUD();
  checkAchievements();
}

function updateHUD() {
  // Solo contar lo que sea una actividad real (no edificios sin actividad)
  const found = [...STATE.discovered].filter(id => isRealActivity(id)).length;
  const total = getTotalActivities();
  const pct   = Math.round((found / total) * 100);
  document.getElementById('progress-text').textContent = `${found}/${total} actividades`;
  document.getElementById('progress-bar-fill').style.width = pct + '%';
}

function checkAchievements() {
  const realFoundCount = [...STATE.discovered].filter(id => isRealActivity(id)).length;
  const total = getTotalActivities();

  STATE.achievements.forEach(ach => {
    // El logro "master" siempre exige el 100% actual, sin importar cuántas haya
    const effectiveThreshold = ach.id === 'master' ? total : ach.threshold;
    if (!STATE.unlockedAchievements.has(ach.id) && realFoundCount >= effectiveThreshold) {
      STATE.unlockedAchievements.add(ach.id);
      showAchievement(ach);
    }
  });

  // Tarjeta especial al completar todas las actividades
  if (realFoundCount >= total &&
      !STATE.unlockedAchievements.has('complete_card')) {
    STATE.unlockedAchievements.add('complete_card');
    setTimeout(() => showCompleteCard(), 1200);
  }
}

function showAchievement(ach) {
  spawnConfetti();
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

/* ─── Confeti al desbloquear logro ── */
function spawnConfetti() {
  const colors = ['#BFFF00', '#FACC15', '#EC4899', '#60A5FA', '#4ADE80'];
  const count = 28;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size  = 5 + Math.random() * 5;
    const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
    const driftX = (Math.random() - 0.5) * 300;
    const duration = 1.4 + Math.random() * 0.8;
    const rotation  = Math.random() * 720 - 360;

    piece.style.cssText = `
      position:fixed; left:${startX}px; top:35%;
      width:${size}px; height:${size}px;
      background:${color};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      z-index:600; pointer-events:none;
      transform:translate(0,0) rotate(0deg);
      transition:transform ${duration}s cubic-bezier(.25,.46,.45,.94), opacity ${duration}s ease;
    `;
    document.body.appendChild(piece);

    requestAnimationFrame(() => {
      piece.style.transform = `translate(${driftX}px, ${300 + Math.random()*150}px) rotate(${rotation}deg)`;
      piece.style.opacity = '0';
    });

    setTimeout(() => piece.remove(), duration * 1000 + 100);
  }
}

/* ─── Confeti a pantalla completa — al completar una ACTIVIDAD real ──
   Distinto del confeti de logros: cae desde toda la parte superior
   de la pantalla, no solo desde el centro. ── */
function spawnFullScreenConfetti() {
  const colors = ['#BFFF00', '#FACC15', '#EC4899', '#60A5FA', '#4ADE80', '#A855F7', '#FF4C37'];
  const count = 70;
  const W = window.innerWidth;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size  = 6 + Math.random() * 7;
    const startX = Math.random() * W;
    const driftX = (Math.random() - 0.5) * 160;
    const duration = 2.2 + Math.random() * 1.4;
    const delay = Math.random() * 0.4;
    const rotation = Math.random() * 1080 - 540;
    const shape = Math.random();
    let borderRadius = '2px';
    if (shape > 0.66) borderRadius = '50%';
    else if (shape > 0.33) borderRadius = '0';

    piece.style.cssText = `
      position:fixed; left:${startX}px; top:-20px;
      width:${size}px; height:${size * (shape > 0.66 ? 1 : 1.6)}px;
      background:${color};
      border-radius:${borderRadius};
      z-index:700; pointer-events:none;
      opacity:1;
      transform:translateY(0) rotate(0deg);
      transition:transform ${duration}s cubic-bezier(.4,0,.2,1) ${delay}s, opacity 0.5s ease ${duration + delay - 0.5}s;
    `;
    document.body.appendChild(piece);

    requestAnimationFrame(() => {
      piece.style.transform = `translate(${driftX}px, ${window.innerHeight + 40}px) rotate(${rotation}deg)`;
      piece.style.opacity = '0';
    });

    setTimeout(() => piece.remove(), (duration + delay) * 1000 + 200);
  }

  // Mensaje breve centrado en pantalla
  const msg = document.createElement('div');
  msg.style.cssText = `
    position:fixed; top:40%; left:50%;
    transform:translate(-50%,-50%) scale(0.7);
    background:rgba(0,0,0,0.9);
    border:2px solid #BFFF00; border-radius:16px;
    padding:16px 24px; z-index:701;
    font-family:'Fira Code',monospace;
    font-size:14px; font-weight:700; color:#BFFF00;
    text-align:center; pointer-events:none;
    box-shadow:0 0 40px rgba(191,255,0,0.5);
    transition:transform 0.4s cubic-bezier(.34,1.56,.64,1), opacity 0.4s ease;
    opacity:0;
  `;
  msg.innerHTML = `🎉 Bienvenido a la actividad`;
  document.body.appendChild(msg);
  requestAnimationFrame(() => {
    setTimeout(() => {
      msg.style.transform = 'translate(-50%,-50%) scale(1)';
      msg.style.opacity = '1';
    }, 30);
  });
  setTimeout(() => {
    msg.style.opacity = '0';
    msg.style.transform = 'translate(-50%,-50%) scale(0.8)';
    setTimeout(() => msg.remove(), 400);
  }, 1800);
}

/* ─── Globo de diálogo de la rana — al visitar un edificio SIN actividad ── */
const FROG_NOTHING_PHRASES = [
  'Aquí no hay nada que hacer, pero está bonito.',
  'Lindo lugar. Cero actividades. Bonito de todos modos.',
  'Nada que marcar aquí, pero la vista vale la pasada.',
  'Espacio sin actividad. Aun así, que estilo.',
];

function showFrogSpeechBubble() {
  const old = document.getElementById('frog-speech-bubble');
  if (old) old.remove();

  const wrapper = document.getElementById('frog-wrapper');
  if (!wrapper) return;
  const rect = wrapper.getBoundingClientRect();

  const phrase = FROG_NOTHING_PHRASES[Math.floor(Math.random() * FROG_NOTHING_PHRASES.length)];

  const bubble = document.createElement('div');
  bubble.id = 'frog-speech-bubble';
  bubble.style.cssText = `
    position:fixed;
    left:${rect.left + rect.width/2}px;
    top:${rect.top - 14}px;
    transform:translate(-50%,-100%) scale(0.6);
    background:rgba(0,0,0,0.92);
    border:2px solid #BFFF00; border-radius:14px;
    padding:10px 14px; z-index:550;
    font-family:'Fira Code',monospace;
    font-size:11px; color:#BFFF00; font-weight:600;
    max-width:200px; text-align:center;
    box-shadow:0 0 20px rgba(191,255,0,0.3);
    transition:transform 0.3s cubic-bezier(.34,1.56,.64,1), opacity 0.3s ease;
    opacity:0; pointer-events:none;
  `;
  bubble.innerHTML = `🐸 "${phrase}"`;
  document.body.appendChild(bubble);

  requestAnimationFrame(() => {
    setTimeout(() => {
      bubble.style.transform = 'translate(-50%,-100%) scale(1)';
      bubble.style.opacity = '1';
    }, 30);
  });

  setTimeout(() => {
    bubble.style.opacity = '0';
    bubble.style.transform = 'translate(-50%,-100%) scale(0.85)';
    setTimeout(() => bubble.remove(), 350);
  }, 2600);
}

/* ═══════════════════════════════════════════════════
   TARJETA DE INFORMACIÓN
═══════════════════════════════════════════════════ */
function showInfoCard(id) {
  // Si es un edificio "padre" con sub-actividades, mostrar selector de botones
  if (PARENT_BUILDINGS.includes(id)) {
    showParentInfoCard(id);
    return;
  }

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
    <p id="info-card-desc" style="white-space:pre-line;">${desc}</p>
    ${isNew ? `<div id="info-card-badge">🌟 ¡Nuevo espacio descubierto!</div>` : ''}
    ${id === 'audiovisual_biblioteca' ? `
    <button onclick="window.open('snte.html','_blank')" style="
      margin-top:12px;width:100%;
      background:#6B7280;border:none;border-radius:8px;
      padding:10px;color:#fff;font-family:'Fira Code',monospace;
      font-size:12px;font-weight:700;cursor:pointer;
    ">🔢 Abrir Misión Matemáticas</button>` : ''}
  `;
  document.getElementById('info-card').classList.add('visible');
}

/* ─── Tarjeta para edificios con sub-actividades (botones) ── */
function showParentInfoCard(parentId) {
  const parentAct = getActivity(parentId);
  const subs = STATE.activities.filter(a => a.parentId === parentId);

  const nombre = parentAct?.nombre || parentId;
  const emoji  = parentAct?.emoji  || '🏫';

  document.getElementById('info-card-emoji').textContent    = emoji;
  document.getElementById('info-card-name').textContent     = nombre;
  document.getElementById('info-card-activity').textContent = 'Elige un espacio';

  const buttonsHTML = subs.map(sub => {
    const isFound = STATE.discovered.has(sub.id);
    return `
      <button class="sub-activity-btn ${isFound ? 'found' : ''}" onclick="selectSubActivity('${sub.id}')">
        <span>${sub.emoji} ${sub.nombre}</span>
        <span class="sub-activity-check">${isFound ? '✓' : '○'}</span>
      </button>`;
  }).join('');

  document.getElementById('info-card-body').innerHTML = `
    <p id="info-card-desc">${parentAct?.descripcion || 'Selecciona un espacio para ver su actividad.'}</p>
    <div id="sub-activity-list">${buttonsHTML}</div>
  `;
  document.getElementById('info-card').classList.add('visible');
}

function selectSubActivity(subId) {
  const sub = getActivity(subId);
  if (!sub) return;

  // Marcar como descubierta
  discoverSubActivity(subId);

  const isNew = false; // ya se marcó arriba, evitamos doble badge confuso
  document.getElementById('info-card-emoji').textContent    = sub.emoji || '🏫';
  document.getElementById('info-card-name').textContent     = sub.nombre;
  document.getElementById('info-card-activity').textContent = sub.actividad || '—';

  document.getElementById('info-card-body').innerHTML = `
    <div class="info-row">
      <span class="info-row-label">⏰ Horario:</span>
      <span class="info-row-value">${sub.horario || '—'}</span>
    </div>
    <div class="info-row">
      <span class="info-row-label">👤 Responsable:</span>
      <span class="info-row-value">${sub.responsable || '—'}</span>
    </div>
    <p id="info-card-desc" style="white-space:pre-line;">${sub.descripcion || ''}</p>
    ${sub.id === 'audiovisual_biblioteca' ? `
    <button onclick="window.open('snte.html','_blank')" style="
      margin-top:12px;width:100%;
      background:#6B7280;border:none;border-radius:8px;
      padding:10px;color:#fff;font-family:'Fira Code',monospace;
      font-size:12px;font-weight:700;cursor:pointer;
    ">🔢 Abrir Misión Matemáticas</button>` : ''}
    <button onclick="showParentInfoCard('${sub.parentId}')" style="
      margin-top:8px;width:100%;
      background:none;border:1px solid rgba(191,255,0,0.4);border-radius:8px;
      padding:8px;color:#BFFF00;font-family:'Fira Code',monospace;
      font-size:11px;cursor:pointer;
    ">← Volver a la lista</button>
  `;
}

function hideInfoCard() {
  document.getElementById('info-card').classList.remove('visible');
}

function handleBuildingClick(id) {
  initAudio();
  discoverBuilding(id);
  highlightBuilding(id);
  STATE.activeBuilding = id;

  // SNTE solo muestra la tarjeta — el botón abre la misión
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
    // Si es edificio padre, listar sus sub-actividades en lugar del edificio
    if (PARENT_BUILDINGS.includes(b.id)) {
      const subs = STATE.activities.filter(a => a.parentId === b.id);
      subs.forEach(sub => {
        const item = document.createElement('div');
        item.className = 'explorer-item';
        item.setAttribute('data-id', sub.id);
        item.innerHTML = `
          <div class="explorer-item-dot"></div>
          <span class="explorer-item-name">${sub.emoji || '🏫'} ${sub.nombre}</span>
          <span class="explorer-item-check">○</span>`;
        item.addEventListener('click', () => {
          const cx = b.x + b.w/2, cy = b.y + b.h/2;
          jumpFrogTo(cx, cy);
          setTimeout(() => selectSubActivity(sub.id), 500);
        });
        list.appendChild(item);
      });
      return;
    }

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
