// Golf Spanish catalog (pbe-locale/1.0.0 proof: home + All Access). Neutral international Spanish, "tú" as on
// PropBetEdge Soccer (LHBUSA/soccer src/i18n/catalog/es.js, live since 2026-10-09) so the network reads as one voice.
// msgid = the rendered English string. NEVER translated: player, tournament, course and place names; tour names
// (PGA TOUR, LPGA); PropBetEdge, PBEcast, All Access, Platinum, PropSports; licence names and photo credits; the
// price amount (written US$29 so it never reads as pesos); links. Data stays identical; only the words around it change.
import { datePatterns, regionNames } from './shared.js';

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const offer = n => `${n} deportes + Predicciones + Comparar + Mercados`;
const ago = (w, v) => (v === 'just now' ? 'ahora mismo' : v.replace(/^(\d+) min ago$/, 'hace $1 min').replace(/^(\d+) hr ago$/, 'hace $1 h'));

export default {
  exact: {
    ...regionNames('es'),
    // ---- document
    'Golf Intelligence | PropBetEdge': 'Inteligencia de golf | PropBetEdge',
    'Golf leaderboards, round scores, Player DNA, Course DNA and championship history across the PGA TOUR, LPGA and every major.':
      'Clasificaciones de golf, resultados por ronda, ADN del jugador, ADN del campo e historia de los campeonatos del PGA TOUR, el LPGA y todos los majors.',
    'PropBetEdge All Access on Golf | PropBetEdge Golf': 'PropBetEdge All Access en Golf | PropBetEdge Golf',
    'Golf intelligence is one desk in the PropBetEdge network. All Access includes 10 sports plus Command Center, Compare, Markets and Predictions for $29/month.':
      'La inteligencia de golf es una sección de la red PropBetEdge. All Access incluye 10 deportes, además de Centro de mando, Comparar, Mercados y Predicciones, por US$29/mes.',
    // ---- header, navigation
    'Skip to content': 'Saltar al contenido',
    'PropBetEdge Golf home': 'Inicio de PropBetEdge Golf',
    PROP: 'PROP', BET: 'BET', EDGE: 'EDGE', PROPBETEDGE: 'PROPBETEDGE', PropBetEdge: 'PropBetEdge', '@PROPBETEDGE': '@PROPBETEDGE',
    'GOLF INTELLIGENCE': 'INTELIGENCIA DE GOLF',
    'PGA TOUR': 'PGA TOUR', LPGA: 'LPGA', 'LPGA Tour': 'LPGA Tour', 'LPGA TOUR': 'LPGA TOUR',
    'PropBetEdge account and All Access status': 'Estado de tu cuenta PropBetEdge y de All Access',
    ACCOUNT: 'CUENTA', 'CHECKING ACCESS': 'VERIFICANDO ACCESO', 'SIGN IN / LEARN': 'INICIAR SESIÓN / INFO', 'SIGNED IN': 'SESIÓN INICIADA',
    'ALL ACCESS AVAILABLE': 'ALL ACCESS DISPONIBLE', '◆ PLATINUM': '◆ PLATINUM', 'ALL ACCESS ACTIVE': 'ALL ACCESS ACTIVO', OWNER: 'PROPIETARIO',
    'VERIFIED ACCESS': 'ACCESO VERIFICADO', 'ACCESS CHECK': 'VERIFICACIÓN DE ACCESO', 'RETRY ON ALL ACCESS': 'REINTENTAR EN ALL ACCESS',
    'PropBetEdge Platinum member — All Access active': 'Miembro Platinum de PropBetEdge: All Access activo',
    'PropBetEdge verified owner access': 'Acceso de propietario verificado en PropBetEdge',
    'Signed in to PropBetEdge — All Access not active': 'Sesión iniciada en PropBetEdge: All Access no activo',
    'PropBetEdge All Access — sign in or learn more': 'PropBetEdge All Access: inicia sesión o infórmate',
    'PropBetEdge account access check': 'Verificación de acceso a la cuenta PropBetEdge',
    Menu: 'Menú', Primary: 'Principal',
    Today: 'Hoy', Live: 'En vivo', Tournaments: 'Torneos', Players: 'Jugadores', Matchups: 'Enfrentamientos', Courses: 'Campos',
    Majors: 'Majors', PBEcast: 'PBEcast', 'Picks & Record': 'Picks e historial', News: 'Noticias', Intelligence: 'Inteligencia', Search: 'Buscar',
    'THIS WEEK': 'ESTA SEMANA', 'NEXT EVENT': 'PRÓXIMO TORNEO',
    // ---- footer
    'Independent golf intelligence. No affiliation with any tour or championship.': 'Inteligencia de golf independiente. Sin afiliación con ningún circuito ni campeonato.',
    Newsroom: 'Redacción', Methodology: 'Metodología', 'About PropBetEdge': 'Acerca de PropBetEdge', Terms: 'Términos', Legal: 'Aviso legal', Support: 'Soporte',
    'PropBetEdge network': 'Red PropBetEdge', Sports: 'Deportes', Network: 'Red', Learn: 'Aprende',
    MLB: 'MLB', NFL: 'NFL', NBA: 'NBA', WNBA: 'WNBA', NHL: 'NHL', UFC: 'UFC', Tennis: 'Tenis', Soccer: 'Fútbol', Golf: 'Golf', 'F1 Intelligence': 'F1 Intelligence',
    'All Access': 'All Access', 'Command Center': 'Centro de mando', Compare: 'Comparar', Markets: 'Mercados', Predictions: 'Predicciones',
    DATA: 'DATOS', PropSports: 'PropSports', 'Poly Haven': 'Poly Haven', CC0: 'CC0',
    '. Results adapted in part from Wikipedia contributors (CC BY-SA 4.0). Forecasts: NOAA National Weather Service. Player and course photographs credited individually (Wikimedia Commons). Home background: Golf Course Sunrise · Dimitrios Savva / Jarod Guest /':
      '. Resultados adaptados en parte de colaboradores de Wikipedia (CC BY-SA 4.0). Pronósticos: NOAA National Weather Service. Fotografías de jugadores y campos acreditadas individualmente (Wikimedia Commons). Fondo de la portada: Golf Course Sunrise · Dimitrios Savva / Jarod Guest /',
    ', not a tournament venue.': ', no es una sede de torneo.',
    'DATA · PropSports. Results, fields and course setups adapted in part from Wikipedia articles (CC BY-SA 4.0; the redistributed results dataset is available under the same licence). Photographs from Wikimedia Commons with per-image credit.':
      'DATOS · PropSports. Resultados, participantes y configuraciones de campo adaptados en parte de artículos de Wikipedia (CC BY-SA 4.0; el conjunto de datos de resultados redistribuido está disponible bajo la misma licencia). Fotografías de Wikimedia Commons con crédito por imagen.',
    'Sources & methodology': 'Fuentes y metodología',
    // ---- consent banner (public/pbe-consent-v1.js; renders on *.propbetedge.ai only). Same copy as PropBetEdge Soccer.
    'Privacy choices': 'Opciones de privacidad', 'Your privacy choices': 'Tus opciones de privacidad',
    'Necessary cookies keep sign-in, security and paid access working. With your permission, we also use analytics to understand how PropBetEdge is used. You can decline analytics without losing site access.':
      'Las cookies necesarias mantienen el inicio de sesión, la seguridad y el acceso de pago. Con tu permiso, también usamos analítica para entender cómo se usa PropBetEdge. Puedes rechazar la analítica sin perder el acceso al sitio.',
    'Privacy Policy': 'Política de privacidad (en inglés)', 'Decline analytics': 'Rechazar analítica', 'Accept analytics': 'Aceptar analítica',
    // ---- home: hero, schedule, freshness
    'LATEST RESULT': 'ÚLTIMO RESULTADO', Champion: 'Victoria', 'Tournament page': 'Página del torneo', Leaderboard: 'Clasificación', 'Open in PBEcast': 'Abrir en PBEcast',
    'BACKGROUND: EDITORIAL PHOTOGRAPH · CC0 · NOT THE VENUE': 'FONDO: FOTOGRAFÍA EDITORIAL · CC0 · NO ES LA SEDE',
    'Golf this week': 'El golf esta semana', 'schedule dates only, no live scoring': 'solo fechas del calendario, sin puntuación en vivo',
    'THIS WEEK · TOURNAMENT WINDOW': 'ESTA SEMANA · TORNEO EN CURSO', 'THIS WEEK · STARTS SOON': 'ESTA SEMANA · EMPIEZA PRONTO', COMPLETED: 'FINALIZADO',
    'UP NEXT': 'A CONTINUACIÓN', CANCELLED: 'CANCELADO', 'DATE UNCONFIRMED': 'FECHA SIN CONFIRMAR',
    Purse: 'Bolsa', Par: 'Par', Yards: 'Yardas', Field: 'Participantes', 'Defending champion': 'Defiende el título',
    'to start': 'para el inicio', 'to final round': 'para la ronda final',
    'Live scoring not connected': 'Puntuación en vivo no conectada', 'Archive + schedule data': 'Archivo + datos del calendario',
    'Saved snapshot · API unavailable': 'Instantánea guardada · API no disponible', 'Updated from live projection': 'Actualizado desde la proyección en vivo',
    'Current projection': 'Proyección actual', 'Newer data available on next refresh': 'Hay datos más recientes en la próxima actualización',
    // ---- home: live (browser-rendered from /api/v1/live)
    FINAL: 'FINAL', 'SCORING BEGINS WHEN PLAY STARTS': 'LA PUNTUACIÓN EMPIEZA CON EL JUEGO', CHAMPION: 'VICTORIA', 'CO-LEADERS': 'COLÍDERES', LEADER: 'LÍDER',
    'AT LAST UPDATE': 'EN LA ÚLTIMA ACTUALIZACIÓN', 'Live leaderboard': 'Clasificación en vivo', 'Open PBEcast': 'Abrir PBEcast', 'Live now': 'En vivo ahora', 'LIVE NOW': 'EN VIVO AHORA',
    // ---- home: sections
    'TODAY IN GOLF': 'HOY EN EL GOLF', 'The week across every tour.': 'La semana en todos los circuitos.', 'NEXT ON THE SCHEDULE': 'PRÓXIMO EN EL CALENDARIO',
    'LATEST CHAMPION': 'ÚLTIMA VICTORIA', 'Full schedule and results': 'Calendario y resultados completos',
    'RECENT RESULTS': 'RESULTADOS RECIENTES', 'Champions, week by week.': 'Los ganadores, semana a semana.',
    'Men’s major': 'Major masculino', 'Women’s major': 'Major femenino', Final: 'Final', Scheduled: 'Programado',
    'This week · tournament in progress': 'Esta semana · torneo en curso', 'THIS WEEK · TOURNAMENT IN PROGRESS': 'ESTA SEMANA · TORNEO EN CURSO', Cancelled: 'Cancelado', 'Status unconfirmed': 'Estado sin confirmar',
    'Full field · every round': 'Campo completo · todas las rondas', 'Partial field': 'Campo parcial', 'Players who made the cut': 'Jugadores que pasaron el corte',
    'Top finishers only': 'Solo los primeros puestos', 'Champion only': 'Solo la victoria', 'Schedule entry': 'Entrada del calendario', 'No leaderboard': 'Sin clasificación',
    'Women’s golf': 'Golf femenino', 'Men’s golf': 'Golf masculino', 'All tournaments': 'Todos los torneos',
    'PLAYER INTELLIGENCE': 'INTELIGENCIA DE JUGADORES', 'Who is outscoring the field.': 'Quién supera al resto del campo.',
    'Highest scoring-vs-field percentile over the last 24 months, ranked within the strongest available confidence tier. Men and women are separate cohorts.':
      'Percentil más alto de anotación frente al campo en los últimos 24 meses, ordenado dentro del nivel de confianza más alto disponible. Hombres y mujeres forman cohortes separadas.',
    Men: 'Hombres', Women: 'Mujeres', Wins: 'Victorias', Events: 'Torneos', 'Scoring vs field percentile': 'Percentil de anotación frente al campo',
    'th pct scoring': ' pct. anotación', 'Latest:': 'Último:', 'Player directory': 'Directorio de jugadores',
    MAJORS: 'MAJORS', 'The championships that define careers.': 'Los campeonatos que definen carreras.', 'Men’s majors': 'Majors masculinos', 'Women’s majors': 'Majors femeninos',
    'Major championship history': 'Historia de los majors',
    'COURSE INTELLIGENCE': 'INTELIGENCIA DE CAMPOS', 'Where championships are decided.': 'Donde se deciden los campeonatos.', 'Location unavailable': 'Ubicación no disponible',
    'Course directory': 'Directorio de campos',
    MATCHUPS: 'ENFRENTAMIENTOS', 'Compare any two golfers.': 'Compara a dos golfistas cualesquiera.', vs: 'vs.', 'Matchup finder': 'Buscador de enfrentamientos',
    'All Access opens the full DNA.': 'All Access abre el ADN completo.',
    'Raw values, cohort detail, Course Fit components and field intelligence are included with PropBetEdge All Access.':
      'Los valores brutos, el detalle de cohortes, los componentes de afinidad con el campo y la inteligencia del torneo están incluidos en PropBetEdge All Access.',
    'Membership details': 'Detalles de la membresía',
    // ---- All Access page
    'Photo:': 'Foto:',
    'PROPBETEDGE NETWORK · ALL ACCESS': 'RED PROPBETEDGE · ALL ACCESS',
    'Golf is one desk.': 'El golf es una sección.', 'Your edge is the network.': 'Tu ventaja es la red.',
    'Player DNA, Course DNA, Course Fit and field intelligence live here. All Access opens the full Golf intelligence layer plus every PropBetEdge sport and the network products you use between them.':
      'Aquí están el ADN del jugador, el ADN del campo, la afinidad con el campo y la inteligencia del torneo. All Access abre la capa completa de inteligencia de golf, además de todos los deportes de PropBetEdge y los productos de la red que usas entre ellos.',
    'ALL ACCESS': 'ALL ACCESS', '/month': '/mes', 'one membership': 'una sola membresía',
    'CHECKING MEMBERSHIP': 'VERIFICANDO MEMBRESÍA', 'Verifying your PropBetEdge membership…': 'Verificando tu membresía de PropBetEdge…',
    'Membership check temporarily unavailable.': 'La verificación de membresía no está disponible temporalmente.',
    'Nothing about your membership has changed. Premium golf modules stay locked until verification answers, and every public golf page keeps working.':
      'Nada ha cambiado en tu membresía. Los módulos premium de golf permanecen bloqueados hasta que responda la verificación, y todas las páginas públicas de golf siguen funcionando.',
    'Retry verified access': 'Reintentar la verificación de acceso',
    'PLATINUM ACCESS ACTIVE': 'ACCESO PLATINUM ACTIVO', 'PROPBETEDGE ALL ACCESS': 'PROPBETEDGE ALL ACCESS', 'PLATINUM MEMBER': 'MIEMBRO PLATINUM',
    'Your network is unlocked.': 'Tu red está desbloqueada.', 'PropBetEdge All Access': 'PropBetEdge All Access',
    'Your network, unlocked': 'Tu red, desbloqueada', 'The full network, unlocked': 'Toda la red, desbloqueada',
    'VERIFIED OWNER': 'PROPIETARIO VERIFICADO', 'Owner access is active.': 'El acceso de propietario está activo.',
    'The whole PropBetEdge network is open on this account. No subscription required.': 'Toda la red PropBetEdge está abierta en esta cuenta. No se requiere suscripción.',
    'Your PropBetEdge account doesn’t include All Access.': 'Tu cuenta de PropBetEdge no incluye All Access.',
    'Golf intelligence is included with PropBetEdge All Access: 10 sports + Predictions + Compare + Markets, $29/month. There is no Golf-only plan.':
      'La inteligencia de golf está incluida en PropBetEdge All Access: 10 deportes + Predicciones + Comparar + Mercados, US$29/mes. No existe un plan solo de golf.',
    'See PropBetEdge All Access': 'Ver PropBetEdge All Access',
    'Signed in to All Access on another PropBetEdge site? Your membership is recognized here automatically.':
      '¿Iniciaste sesión en All Access en otro sitio de PropBetEdge? Tu membresía se reconoce aquí automáticamente.',
    'THE PROPBETEDGE NETWORK': 'LA RED PROPBETEDGE',
    'Every sport keeps its own product identity. Command Center, Compare, Markets and Predictions connect the network without being counted as sports.':
      'Cada deporte mantiene su propia identidad de producto. Centro de mando, Comparar, Mercados y Predicciones conectan la red sin contarse como deportes.',
    'All Access overview →': 'Resumen de All Access →', 'OPEN SPORT →': 'ABRIR DEPORTE →', 'YOU ARE HERE': 'ESTÁS AQUÍ', 'OPEN →': 'ABRIR →',
    'ALL ACCESS PRODUCT': 'PRODUCTO ALL ACCESS',
    '◆ Command Center': '◆ Centro de mando', '◆ Compare': '◆ Comparar', '◆ Markets': '◆ Mercados', '◆ Predictions': '◆ Predicciones',
    'Your membership command center across the network.': 'El centro de mando de tu membresía en toda la red.',
    'Cross-market comparison and contract intelligence.': 'Comparación entre mercados e inteligencia de contratos.',
    'Live stocks, crypto, macro and AI market intelligence in one desk.': 'Inteligencia de mercado en vivo sobre acciones, cripto, macroeconomía e IA en una sola sección.',
    'Independent model probabilities, market comparison and a scored record.': 'Probabilidades de modelos independientes, comparación de mercados y un historial evaluado.',
    'PropBetEdge network product.': 'Producto de la red PropBetEdge.',
    'GOLF · PUBLIC LAYER': 'GOLF · CAPA PÚBLICA', 'Keep the sport useful before the paywall.': 'El deporte, útil antes del muro de pago.',
    'Scores, records, majors, player pages, course history and public DNA fingerprints remain open discovery surfaces.':
      'Resultados, récords, majors, páginas de jugadores, historia de los campos y huellas públicas de ADN siguen abiertos para explorar.',
    'GOLF · ALL ACCESS LAYER': 'GOLF · CAPA ALL ACCESS', 'Unlock the underlying intelligence.': 'Desbloquea la inteligencia de fondo.',
    'Raw DNA values, cohort sizes, both analysis windows, Course Fit components, field intelligence and matchup DNA detail stay behind verified All Access.':
      'Los valores brutos de ADN, el tamaño de las cohortes, ambas ventanas de análisis, los componentes de afinidad con el campo, la inteligencia del torneo y el detalle de ADN de los enfrentamientos quedan reservados a All Access verificado.',
    'Golf Picks': 'Picks de golf', 'Track Record': 'Historial', ': locked full-field forecasts, graded in public.': ': pronósticos de todo el campo fijados de antemano y evaluados en público.',
    'NO GOLF-ONLY PLAN': 'SIN PLAN SOLO DE GOLF', 'ONE NETWORK MEMBERSHIP': 'UNA MEMBRESÍA PARA TODA LA RED', 'SERVER-VERIFIED ACCESS': 'ACCESO VERIFICADO EN EL SERVIDOR',
  },
  patterns: [
    // Dotted patterns (spell out ·) run before the segment pass.
    [/^(\d+) sports \+ Predictions \+ Compare \+ Markets · one membership$/, n => `${offer(n)} · una sola membresía`],
    // Plain patterns.
    [/^(THIS WEEK|LATEST RESULT) \/ (.+)$/, (k, tour) => `${k === 'THIS WEEK' ? 'ESTA SEMANA' : 'ÚLTIMO RESULTADO'} / ${tour}`],
    [/^(\d+) sports \+ Predictions \+ Compare \+ Markets$/, n => offer(n)],
    [/^(\d+) SPORTS \+ PREDICTIONS \+ COMPARE \+ MARKETS$/, n => offer(n).toUpperCase()],
    [/^(\d+) sports \+ Predictions \+ Compare \+ Markets\. One membership\.$/, n => `${offer(n)}. Una sola membresía.`],
    [/^(\d+) sport desks\. Four network products\. One membership\.$/, n => `${n} secciones deportivas. Cuatro productos de red. Una sola membresía.`],
    [/^Final round (.+)$/, (d, tr) => `Ronda final: ${tr(d)}`],
    [/^Projection (.+) UTC$/, t => `Proyección ${t} UTC`],
    [/^([\d,]+) FULL-FIELD LEADERBOARDS$/, n => `${n} CLASIFICACIONES COMPLETAS`],
    [/^([\d,]+) MAJOR EDITIONS$/, n => `${n} EDICIONES DE MAJORS`],
    [/^([\d,]+) leaderboards?$/, n => `${n} ${n === '1' ? 'clasificación' : 'clasificaciones'}`],
    [/^([\d,]+) rounds?$/, n => `${n} ${n === '1' ? 'ronda' : 'rondas'}`],
    [/^([\d,]+) players?$/, n => `${n} ${n === '1' ? 'jugador' : 'jugadores'}`],
    [/^(\d+) days?$/, n => `${n} ${n === '1' ? 'día' : 'días'}`],
    [/^(\d+) championship editions?$/, n => `${n} ${n === '1' ? 'edición' : 'ediciones'} de campeonato`],
    [/^(\d+) majors?$/, n => `${n} ${n === '1' ? 'major' : 'majors'}`],
    [/^© (\d{4}) PROPBETEDGE$/, y => `© ${y} PROPBETEDGE`],
    // live (browser): ROUND n badges, leaders, ages
    [/^ROUND (\d+) · LIVE$/, n => `RONDA ${n} · EN VIVO`],
    [/^ROUND (\d+) · SCORING UPDATE DELAYED$/, n => `RONDA ${n} · ACTUALIZACIÓN RETRASADA`],
    [/^ROUND (\d+) · PLAY SUSPENDED$/, n => `RONDA ${n} · JUEGO SUSPENDIDO`],
    [/^ROUND (\d+) COMPLETE$/, n => `RONDA ${n} COMPLETADA`],
    [/^FIRST TEE (.+)$/, t => `PRIMERA SALIDA ${t}`],
    [/^thru (\d+)$/, n => `tras ${n} hoyos`],
    [/^\+(\d+) more tied$/, n => `+${n} más empatados`],
    [/^(\d+) players within two$/, n => `${n} jugadores a dos golpes o menos`],
    [/^(\d+) tied at (\S+)$/, (n, s) => `${n} empatados en ${s}`],
    [/^Updated (just now|\d+ min ago|\d+ hr ago)$/, v => `Actualizado ${ago('u', v)}`],
    [/^Last update (just now|\d+ min ago|\d+ hr ago)$/, v => `Última actualización ${ago('l', v)}`],
    ...datePatterns({
      day: (d, m) => `${d} ${MES[m - 1]}`,
      full: (d, m, y) => `${d} ${MES[m - 1]} ${y}`,
      range: (d1, m1, d2, m2, y) => `${d1} ${MES[m1 - 1]} – ${d2} ${MES[m2 - 1]} ${y}`,
    }),
  ],
  // Strings without Latin letters are outside translateText's reach; the prerender swaps these whole text nodes.
  literal: { '$29': 'US$29' },
};
