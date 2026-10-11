(function(){
/* ---------- Données de référence (fournies par le serveur : voir README) ---------- */
var BOOT=window.PLANNER_BOOT;
var SUBJECTS=[],DEVOIRS=[],EXAMS=[],EVENTS=[];
var BASE={s:[],d:[],x:[],e:[]};
function cp(o){return JSON.parse(JSON.stringify(o));}
function fillArr(arr,from){arr.length=0;(from||[]).forEach(function(o){arr.push(cp(o));});}
function setBase(b){
  BASE=cp({s:b.s||[],d:b.d||[],x:b.x||[],e:b.e||[]});
  fillArr(SUBJECTS,BASE.s);fillArr(DEVOIRS,BASE.d);fillArr(EXAMS,BASE.x);fillArr(EVENTS,BASE.e);
}

/* ---------- Stockage : serveur (voir sync.js), copie de sécurité dans le navigateur ---------- */
var data=BOOT.data;
function persist(){return PlannerSync.changed();}
/* Valeurs par défaut des données. Idempotent : appelée au démarrage et à chaque rechargement depuis le serveur. */
function normalize(){
  data.notes=data.notes||{}; data.edits=data.edits||{}; data.hidden=data.hidden||{};
  data.done=data.done||{}; data.rendu=data.rendu||{}; data.custom=data.custom||[];
  data.prefs=data.prefs||{};
  (function(){
    var P=data.prefs,old={bleu:'#3B7BE8',rose:'#E0407A',orange:'#E8782A'},oldp={bleu:'#2F6BC9',rose:'#CF3F78',orange:'#D86A1A'};
    var pal=P.pal;
    if(pal!=='perso'){P.custom=old[pal]||'#3B7BE8';P.pal='perso';}
    if(P.ppal==='sobre'){if(!/^#[0-9a-f]{6}$/i.test(P.pcustom||''))P.pcustom=P.custom;}
    else if(P.ppal!=='perso'){P.pcustom=oldp[P.ppal]||(oldp[pal]||'#2F6BC9');P.ppal='perso';}
  })();
  data.favs=(Array.isArray(data.favs)?data.favs:[]).filter(function(c){return /^#[0-9a-f]{6}$/i.test(c||'');}).slice(0,30);
  if(['auto','light','dark'].indexOf(data.prefs.mode)<0)data.prefs.mode='auto';
  if(['sobre','perso'].indexOf(data.prefs.ppal)<0)data.prefs.ppal='perso';
  if(['fr','en','es'].indexOf(data.prefs.lang)<0)data.prefs.lang='fr';
  if(!/^#[0-9a-f]{6}$/i.test(data.prefs.custom||''))data.prefs.custom='#7b4fe0';
  if(!/^#[0-9a-f]{6}$/i.test(data.prefs.pcustom||''))data.prefs.pcustom='#7b4fe0';
  data.stickers=data.stickers||{};
  data.bg=bgClean(data.bg,data.bgv!==2);data.bgv=2;
  data.bgAt=+data.bgAt||0;
  data.printOff=data.printOff||{};
}
setBase(BOOT.base);
var EDG={s:['s',SUBJECTS],d:['d',DEVOIRS],x:['x',EXAMS],e:['e',EVENTS]};
function baseOf(key){var p=key.split(':'),g=BASE[p[0]];if(!g)return {};var id=key.slice(p[0].length+1);return g.filter(function(o){return o.id===id;})[0]||{};}
function applyEdits(){
  Object.keys(EDG).forEach(function(g){
    EDG[g][1].forEach(function(o){
      var b=baseOf(g+':'+o.id),ed=data.edits[g+':'+o.id]||{};
      Object.keys(o).forEach(function(k){delete o[k];});
      Object.assign(o,b,ed);
      if(g==='s')o.short=o.name;
    });
  });
  if(typeof applySubjColors==='function')applySubjColors();
}
normalize();
applyEdits();
function appTitle(){return (data.edits.app&&data.edits.app.title)||t('Planning');}
function appEyebrow(){return (data.edits.app&&data.edits.app.eyebrow)||'';}

/* ---------- Thèmes ---------- */
var PALS=[{id:'bleu',name:'Bleu',sw:'#3B7BE8'},{id:'rose',name:'Rose',sw:'#E0407A'},{id:'orange',name:'Orange',sw:'#E8782A'}];
function bgClean(list,old){
  var w=window.innerWidth||1,h=window.innerHeight||1;
  return (Array.isArray(list)?list:[]).filter(function(b){return b&&typeof b.id==='string'&&typeof b.t==='string'&&isFinite(b.x)&&isFinite(b.y);}).map(function(b){
    var y=+b.y,sz=+b.s||9;
    if(old){y=y*h/w;sz=sz*Math.min(w,h)/w;}
    return {id:b.id,t:b.t,c:b.c||'#d6457f',x:Math.min(1,Math.max(0,+b.x)),y:Math.min(30,Math.max(0,y)),s:Math.min(50,Math.max(2,sz)),r:+b.r||0};
  });
}

/* ---------- Langues (la clé est le texte français) ---------- */
var I18N={"en": {"Planning": "Schedule", "Devoirs": "Assignments", "Imprimer": "Print", "Date simulée : ": "Simulated date: ", "Revenir à aujourd'hui": "Back to today", "Tester avec une autre date": "Try another date", "Date simulée": "Simulated date", "Prochain devoir": "Next assignment", "Aucun": "None", "Tout est rendu": "Everything is handed in", "À rattraper": "To catch up", "lives et webconférences à revoir": "lives and webinars to watch again", "Devoirs rendus": "Assignments handed in", "{a} devoirs × {b} matières": "{a} assignments × {b} subjects", "En retard : ": "Late: ", "Tout est rendu, bravo !": "Everything is handed in, well done!", "Aujourd'hui": "Today", "jours": "days", "jour": "day", "Prochain devoir à rendre dans": "Next assignment due in", "Prochain devoir à rendre": "Next assignment due", "Reste à rendre : ": "Still to hand in: ", "C'est aujourd'hui": "It's today", "Demain": "Tomorrow", "Dans {n} jours": "In {n} days", "Devoir à rendre": "Assignment due", "À déposer avant le ": "Hand in before ", "Compris, je m'en occupe": "Got it, I'm on it", "Vue": "View", "Liste": "List", "Mois": "Month", "Fermer": "Close", "+ Ajouter une séance": "+ Add a session", "Toutes les matières": "All subjects", "Titre": "Title", "Ex. Relire le chapitre 3": "E.g. Re-read chapter 3", "Matière": "Subject", "Aucune": "None", "Date": "Date", "Heure (facultatif)": "Time (optional)", "Ajouter au planning": "Add to schedule", "Affichage": "Display", "À faire": "To do", "Tout": "All", "{n} en attente": "{n} pending", "Rien à afficher avec ces filtres.": "Nothing to show with these filters.", "Mois précédent": "Previous month", "Mois suivant": "Next month", "Examen": "Exam", "Sujet : ": "Paper: ", "Live du soir": "Evening live", "Webconf": "Webinar", "{d}, {n} élément(s)": "{d}, {n} item(s)", "Devoir": "Assignment", "Rien de prévu ce jour-là.": "Nothing planned that day.", " · rendu": " · handed in", " · à rendre": " · to hand in", "Fait": "Done", "En retard": "Late", "Marquer « {t} » comme fait": "Mark “{t}” as done", "Supprimer": "Delete", "Tout rendu": "All handed in", "Date dépassée": "Past due", "À RENDRE": "DUE", "Date limite {r} · {a}/{b} matières rendues": "Due {r} · {a}/{b} subjects handed in", "Sujet disponible": "Paper available", "Séance perso": "Personal session", "Webconférence": "Webinar", "À rendre": "Due", "Révisions": "Revision", "Révision et méthode examen": "Revision and exam method", "Devoir 1": "Assignment 1", "Devoir 2": "Assignment 2", "Devoir 3": "Assignment 3", "Devoir 4": "Assignment 4", "Devoir de synthèse": "Summary assignment", "Synthèse": "Summary", "Examens écrits": "Written exams", "Rendu": "Handed in", "Sujet disponible dès le ": "Paper available from ", "Date de mise à disposition non renseignée": "Availability date not provided", "Mes matières": "My subjects", "Quoi imprimer": "What to print", "Un mois": "One month", "Plusieurs mois": "Several months", "Mois à imprimer": "Months to print", "Mois à imprimer : {n} sur {m}": "Months to print: {n} of {m}", "Tous": "All", "Aucun mois sélectionné.": "No month selected.", "Couleurs d'impression": "Print colors", "Sobre": "Plain", "Bleu": "Blue", "Rose": "Pink", "Orange": "Orange", "Perso": "Custom", "Mascottes": "Mascots", "Ours et chat": "Bear and cat", "Ours": "Bear", "Chat": "Cat", "Pour placer ou changer des stickers, repasse en « Un mois ».": "To place or change stickers, switch back to “One month”.", "Aperçu de la feuille A4 paysage, une page par mois. Pour imprimer, utilise la fonction Imprimer du navigateur (Ctrl ou Cmd + P), échelle 100 %. Le fond reste blanc : seules quelques touches de couleur sont imprimées.": "Preview of the A4 landscape sheet, one page per month. To print, use your browser's Print function (Ctrl or Cmd + P) at 100% scale. The background stays white: only a few touches of color are printed.", "Stickers : touche pour ajouter, glisse sur la feuille pour placer": "Stickers: tap to add, drag on the sheet to place", "Décoration": "Decoration", "Portée de la décoration": "Decoration scope", "Ce mois seulement": "This month only", "Même déco pour tous les mois": "Same decoration for all months", "Confirmer : remplace la déco des autres mois": "Confirm: replaces the other months' decoration", "Copier cette déco sur tous les mois": "Copy this decoration to all months", "Ajouter : ": "Add: ", "Cœur": "Heart", "Étoile": "Star", "Livre": "Book", "Café": "Coffee", "Fleur": "Flower", "Nuage": "Cloud", "Idée": "Idea", "Crayon": "Pencil", "Couleur du sticker sélectionné ({n})": "Selected sticker color ({n})", "Couleur des prochains stickers": "Color of next stickers", "Taille et angle": "Size and angle", "Plus petit": "Smaller", "Plus grand": "Larger", "Tourner à gauche": "Rotate left", "Tourner à droite": "Rotate right", "Touche un sticker sur la feuille pour changer sa couleur, sa taille ou le supprimer.": "Tap a sticker on the sheet to change its color or size, or delete it.", "Retirer tous les stickers (tous les mois)": "Remove all stickers (all months)", "Retirer tous les stickers de ce mois": "Remove all stickers from this month", "Code couleur": "Color code", "EXAMEN": "EXAM", "Sujet dispo : ": "Paper avail.: ", "Échéances du mois": "Deadlines this month", "À rendre : ": "Due: ", "Examen : ": "Exam: ", "Sujet disponible : ": "Paper available: ", "□ à faire · ✓ fait ou rendu": "□ to do · ✓ done or handed in", "Apparence": "Appearance", "Auto": "Auto", "Clair": "Light", "Sombre": "Dark", "Langue": "Language", "Couleur personnalisée": "Custom color", "{n} page(s)": "{n} page(s)", "{n} page(s) A4 paysage": "{n} A4 landscape page(s)", "Ordinateur : ": "Computer: ", "Téléphone ou tablette : menu du navigateur, puis « Imprimer ».": "Phone or tablet: browser menu, then “Print”.", "Réglages conseillés : A4, paysage, échelle 100 %, marges par défaut.": "Recommended settings: A4, landscape, 100% scale, default margins.", "Le fond reste blanc : seules quelques touches de couleur sont imprimées.": "The background stays white: only a few touches of color are printed.", "Compris": "Got it", "dans {n} mois": "in {n} months", "dans {n} j": "in {n} d", "il y a {n} mois": "{n} months ago", "il y a {n} j": "{n} d ago", "aujourd'hui": "today", "demain": "tomorrow", "hier": "yesterday", "Édition": "Edit", "Stickers": "Stickers", "Choisis un sticker": "Pick a sticker", "Choisis un sticker dans la liste": "Pick one from the list", "Animaux": "Animals", "Nature": "Nature", "Études": "Studies", "Gourmandises": "Treats", "Divers": "Misc", "Lune": "Moon", "Soleil": "Sun", "Arc-en-ciel": "Rainbow", "Papillon": "Butterfly", "Lapin": "Bunny", "Poussin": "Chick", "Grenouille": "Frog", "Panda": "Panda", "Renard": "Fox", "Cupcake": "Cupcake", "Cerises": "Cherries", "Théière": "Teapot", "Ordinateur": "Laptop", "Réveil": "Alarm clock", "Trophée": "Trophy", "Cactus": "Cactus", "Parapluie": "Umbrella", "Fusée": "Rocket", "Diplôme": "Diploma", "Musique": "Music", "Titre de l'application": "App title", "Matières": "Subjects", "Examens": "Exams", "Séances": "Sessions", "Séances perso": "Personal sessions", "Code": "Code", "Nom complet": "Full name", "Abréviation": "Abbreviation", "Date limite de rendu": "Due date", "Début": "Start", "Fin": "End", "Type": "Type", "Heure": "Time", "Précision (facultatif)": "Note (optional)", "Masquer cette séance": "Hide this session", "Rétablir cette séance": "Restore this session", "masquée": "hidden", "masquée(s)": "hidden", "Effacer cette date": "Clear this date", "Modifié": "Edited", "Rétablir les valeurs d'origine": "Restore original values", "Tout réinitialiser": "Reset everything", "Confirmer : efface toutes tes modifications": "Confirm: erases all your changes", "Mode édition : tu peux changer tous les noms, codes et dates. Les modifications sont enregistrées tout de suite. Pour les dates, touche le champ pour ouvrir le calendrier.": "Edit mode: you can change all names, codes and dates. Changes are saved right away. For dates, tap the field to open the calendar.", "Aucune séance perso. Ajoute-en depuis l'onglet Planning.": "No personal sessions. Add some from the Schedule tab.", "Notes": "Notes", "Note": "Note", "Notes et pièces jointes": "Notes and attachments", "Ajouter une note": "Add a note", "Écris une note…": "Write a note…", "Ajouter le texte": "Add text", "Ajouter un lien": "Add a link", "Nom du lien (facultatif)": "Link name (optional)", "Ajouter le lien": "Add link", "Ajouter des images ou des fichiers": "Add images or files", "Aucune note pour le moment.": "No notes yet.", "Lien invalide": "Invalid link", "Fichier trop gros (max 1,2 Mo) : ": "File too large (max 1.2 MB): ", "Espace de stockage plein : supprime des pièces jointes.": "Storage full: delete some attachments.", "Début (facultatif)": "Start (optional)", "Fin (facultatif)": "End (optional)", "Ce type de fichier ne peut pas être téléchargé depuis cette page.": "This file type can't be downloaded from this page.", "Téléchargement indisponible ici.": "Download not available here.", "Couleur": "Color", "Mes couleurs": "My colors", "Utiliser la couleur": "Use color", "Retirer cette couleur": "Remove this color", "Enregistrer cette couleur": "Save this color", "Aucune couleur enregistrée pour le moment.": "No saved colors yet.", "Emojis": "Emojis", "Stickers et emojis": "Stickers and emojis", "Choisis un emoji": "Pick an emoji", "Smileys et émotions": "Smileys & emotion", "Personnes": "People", "Animaux et nature": "Animals & nature", "Nourriture et boissons": "Food & drink", "Voyages et lieux": "Travel & places", "Activités": "Activities", "Objets": "Objects", "Symboles": "Symbols", "Drapeaux": "Flags", "Hibou": "Owl", "Tortue": "Turtle", "Poisson": "Fish", "Abeille": "Bee", "Coccinelle": "Ladybug", "Escargot": "Snail", "Pingouin": "Penguin", "Éléphant": "Elephant", "Chien": "Dog", "Arbre": "Tree", "Champignon": "Mushroom", "Loupe": "Magnifier", "Calculatrice": "Calculator", "Sac à dos": "Backpack", "Post-it": "Sticky note", "Glace": "Ice cream", "Donut": "Donut", "Fraise": "Strawberry", "Pomme": "Apple", "Cadeau": "Gift", "Aperçu": "Preview", "Couleur de la matière": "Subject color", "Changer la couleur": "Change color", "Couleur d'origine": "Original color", "Décorer": "Decorate", "Décor de l'application": "App decoration", "Ajouter un sticker": "Add a sticker", "Terminé": "Done", "Tout retirer": "Remove all", "Confirmer : tout retirer": "Confirm: remove all", "Ajoute un sticker, puis touche-le et glisse-le où tu veux. Il reste en arrière-plan sur toutes les pages.": "Add a sticker, then tap it and drag it anywhere. It stays in the background on every page."}, "es": {"Planning": "Calendario", "Devoirs": "Tareas", "Imprimer": "Imprimir", "Date simulée : ": "Fecha simulada: ", "Revenir à aujourd'hui": "Volver a hoy", "Tester avec une autre date": "Probar con otra fecha", "Date simulée": "Fecha simulada", "Prochain devoir": "Próxima tarea", "Aucun": "Ninguno", "Tout est rendu": "Todo entregado", "À rattraper": "Para recuperar", "lives et webconférences à revoir": "clases en directo y webconferencias por ver", "Devoirs rendus": "Tareas entregadas", "{a} devoirs × {b} matières": "{a} tareas × {b} asignaturas", "En retard : ": "Con retraso: ", "Tout est rendu, bravo !": "¡Todo entregado, enhorabuena!", "Aujourd'hui": "Hoy", "jours": "días", "jour": "día", "Prochain devoir à rendre dans": "Próxima entrega en", "Prochain devoir à rendre": "Próxima entrega", "Reste à rendre : ": "Pendiente de entregar: ", "C'est aujourd'hui": "Es hoy", "Demain": "Mañana", "Dans {n} jours": "En {n} días", "Devoir à rendre": "Tarea por entregar", "À déposer avant le ": "Entregar antes del ", "Compris, je m'en occupe": "Entendido, me ocupo", "Vue": "Vista", "Liste": "Lista", "Mois": "Mes", "Fermer": "Cerrar", "+ Ajouter une séance": "+ Añadir una sesión", "Toutes les matières": "Todas las asignaturas", "Titre": "Título", "Ex. Relire le chapitre 3": "Ej. Repasar el capítulo 3", "Matière": "Asignatura", "Aucune": "Ninguna", "Date": "Fecha", "Heure (facultatif)": "Hora (opcional)", "Ajouter au planning": "Añadir al calendario", "Affichage": "Mostrar", "À faire": "Por hacer", "Tout": "Todo", "{n} en attente": "{n} pendientes", "Rien à afficher avec ces filtres.": "Nada que mostrar con estos filtros.", "Mois précédent": "Mes anterior", "Mois suivant": "Mes siguiente", "Examen": "Examen", "Sujet : ": "Enunciado: ", "Live du soir": "Directo de tarde", "Webconf": "Webconferencia", "{d}, {n} élément(s)": "{d}, {n} elemento(s)", "Devoir": "Tarea", "Rien de prévu ce jour-là.": "Nada previsto ese día.", " · rendu": " · entregada", " · à rendre": " · por entregar", "Fait": "Hecho", "En retard": "Con retraso", "Marquer « {t} » comme fait": "Marcar «{t}» como hecho", "Supprimer": "Eliminar", "Tout rendu": "Todo entregado", "Date dépassée": "Fecha superada", "À RENDRE": "ENTREGAR", "Date limite {r} · {a}/{b} matières rendues": "Fecha límite {r} · {a}/{b} asignaturas entregadas", "Sujet disponible": "Enunciado disponible", "Séance perso": "Sesión personal", "Webconférence": "Webconferencia", "À rendre": "Por entregar", "Révisions": "Repaso", "Révision et méthode examen": "Repaso y método de examen", "Devoir 1": "Tarea 1", "Devoir 2": "Tarea 2", "Devoir 3": "Tarea 3", "Devoir 4": "Tarea 4", "Devoir de synthèse": "Trabajo de síntesis", "Synthèse": "Síntesis", "Examens écrits": "Exámenes escritos", "Rendu": "Entregado", "Sujet disponible dès le ": "Enunciado disponible desde el ", "Date de mise à disposition non renseignée": "Fecha de disponibilidad no indicada", "Mes matières": "Mis asignaturas", "Quoi imprimer": "Qué imprimir", "Un mois": "Un mes", "Plusieurs mois": "Varios meses", "Mois à imprimer": "Meses a imprimir", "Mois à imprimer : {n} sur {m}": "Meses a imprimir: {n} de {m}", "Tous": "Todos", "Aucun mois sélectionné.": "Ningún mes seleccionado.", "Couleurs d'impression": "Colores de impresión", "Sobre": "Sobrio", "Bleu": "Azul", "Rose": "Rosa", "Orange": "Naranja", "Perso": "Personalizado", "Mascottes": "Mascotas", "Ours et chat": "Oso y gato", "Ours": "Oso", "Chat": "Gato", "Pour placer ou changer des stickers, repasse en « Un mois ».": "Para colocar o cambiar pegatinas, vuelve a «Un mes».", "Aperçu de la feuille A4 paysage, une page par mois. Pour imprimer, utilise la fonction Imprimer du navigateur (Ctrl ou Cmd + P), échelle 100 %. Le fond reste blanc : seules quelques touches de couleur sont imprimées.": "Vista previa de la hoja A4 apaisada, una página por mes. Para imprimir, usa la función Imprimir del navegador (Ctrl o Cmd + P) a escala 100 %. El fondo sigue blanco: solo se imprimen algunos toques de color.", "Stickers : touche pour ajouter, glisse sur la feuille pour placer": "Pegatinas: toca para añadir, arrastra sobre la hoja para colocar", "Décoration": "Decoración", "Portée de la décoration": "Alcance de la decoración", "Ce mois seulement": "Solo este mes", "Même déco pour tous les mois": "La misma decoración para todos los meses", "Confirmer : remplace la déco des autres mois": "Confirmar: sustituye la decoración de los otros meses", "Copier cette déco sur tous les mois": "Copiar esta decoración a todos los meses", "Ajouter : ": "Añadir: ", "Cœur": "Corazón", "Étoile": "Estrella", "Livre": "Libro", "Café": "Café", "Fleur": "Flor", "Nuage": "Nube", "Idée": "Idea", "Crayon": "Lápiz", "Couleur du sticker sélectionné ({n})": "Color de la pegatina seleccionada ({n})", "Couleur des prochains stickers": "Color de las próximas pegatinas", "Taille et angle": "Tamaño y ángulo", "Plus petit": "Más pequeña", "Plus grand": "Más grande", "Tourner à gauche": "Girar a la izquierda", "Tourner à droite": "Girar a la derecha", "Touche un sticker sur la feuille pour changer sa couleur, sa taille ou le supprimer.": "Toca una pegatina en la hoja para cambiar su color o su tamaño, o eliminarla.", "Retirer tous les stickers (tous les mois)": "Quitar todas las pegatinas (todos los meses)", "Retirer tous les stickers de ce mois": "Quitar todas las pegatinas de este mes", "Code couleur": "Código de color", "EXAMEN": "EXAMEN", "Sujet dispo : ": "Enunciado disp.: ", "Échéances du mois": "Fechas del mes", "À rendre : ": "Entrega: ", "Examen : ": "Examen: ", "Sujet disponible : ": "Enunciado disponible: ", "□ à faire · ✓ fait ou rendu": "□ por hacer · ✓ hecho o entregado", "Apparence": "Apariencia", "Auto": "Auto", "Clair": "Claro", "Sombre": "Oscuro", "Langue": "Idioma", "Couleur personnalisée": "Color personalizado", "{n} page(s)": "{n} página(s)", "{n} page(s) A4 paysage": "{n} página(s) A4 apaisada(s)", "Ordinateur : ": "Ordenador: ", "Téléphone ou tablette : menu du navigateur, puis « Imprimer ».": "Móvil o tableta: menú del navegador y luego «Imprimir».", "Réglages conseillés : A4, paysage, échelle 100 %, marges par défaut.": "Ajustes recomendados: A4, apaisado, escala 100 %, márgenes por defecto.", "Le fond reste blanc : seules quelques touches de couleur sont imprimées.": "El fondo sigue blanco: solo se imprimen algunos toques de color.", "Compris": "Entendido", "dans {n} mois": "en {n} meses", "dans {n} j": "en {n} d", "il y a {n} mois": "hace {n} meses", "il y a {n} j": "hace {n} d", "aujourd'hui": "hoy", "demain": "mañana", "hier": "ayer", "Édition": "Edición", "Stickers": "Pegatinas", "Choisis un sticker": "Elige una pegatina", "Choisis un sticker dans la liste": "Elige una de la lista", "Animaux": "Animales", "Nature": "Naturaleza", "Études": "Estudios", "Gourmandises": "Golosinas", "Divers": "Varios", "Lune": "Luna", "Soleil": "Sol", "Arc-en-ciel": "Arcoíris", "Papillon": "Mariposa", "Lapin": "Conejo", "Poussin": "Pollito", "Grenouille": "Rana", "Panda": "Panda", "Renard": "Zorro", "Cupcake": "Cupcake", "Cerises": "Cerezas", "Théière": "Tetera", "Ordinateur": "Portátil", "Réveil": "Despertador", "Trophée": "Trofeo", "Cactus": "Cactus", "Parapluie": "Paraguas", "Fusée": "Cohete", "Diplôme": "Diploma", "Musique": "Música", "Titre de l'application": "Título de la aplicación", "Matières": "Asignaturas", "Examens": "Exámenes", "Séances": "Sesiones", "Séances perso": "Sesiones personales", "Code": "Código", "Nom complet": "Nombre completo", "Abréviation": "Abreviatura", "Date limite de rendu": "Fecha límite de entrega", "Début": "Inicio", "Fin": "Fin", "Type": "Tipo", "Heure": "Hora", "Précision (facultatif)": "Nota (opcional)", "Masquer cette séance": "Ocultar esta sesión", "Rétablir cette séance": "Restaurar esta sesión", "masquée": "oculta", "masquée(s)": "ocultas", "Effacer cette date": "Borrar esta fecha", "Modifié": "Modificado", "Rétablir les valeurs d'origine": "Restaurar valores originales", "Tout réinitialiser": "Restablecer todo", "Confirmer : efface toutes tes modifications": "Confirmar: borra todos tus cambios", "Mode édition : tu peux changer tous les noms, codes et dates. Les modifications sont enregistrées tout de suite. Pour les dates, touche le champ pour ouvrir le calendrier.": "Modo edición: puedes cambiar todos los nombres, códigos y fechas. Los cambios se guardan al instante. Para las fechas, toca el campo para abrir el calendario.", "Aucune séance perso. Ajoute-en depuis l'onglet Planning.": "No hay sesiones personales. Añádelas desde la pestaña Calendario.", "Notes": "Notas", "Note": "Nota", "Notes et pièces jointes": "Notas y archivos adjuntos", "Ajouter une note": "Añadir una nota", "Écris une note…": "Escribe una nota…", "Ajouter le texte": "Añadir texto", "Ajouter un lien": "Añadir un enlace", "Nom du lien (facultatif)": "Nombre del enlace (opcional)", "Ajouter le lien": "Añadir enlace", "Ajouter des images ou des fichiers": "Añadir imágenes o archivos", "Aucune note pour le moment.": "Aún no hay notas.", "Lien invalide": "Enlace no válido", "Fichier trop gros (max 1,2 Mo) : ": "Archivo demasiado grande (máx. 1,2 MB): ", "Espace de stockage plein : supprime des pièces jointes.": "Almacenamiento lleno: elimina algunos adjuntos.", "Début (facultatif)": "Inicio (opcional)", "Fin (facultatif)": "Fin (opcional)", "Ce type de fichier ne peut pas être téléchargé depuis cette page.": "Este tipo de archivo no se puede descargar desde esta página.", "Téléchargement indisponible ici.": "Descarga no disponible aquí.", "Couleur": "Color", "Mes couleurs": "Mis colores", "Utiliser la couleur": "Usar el color", "Retirer cette couleur": "Quitar este color", "Enregistrer cette couleur": "Guardar este color", "Aucune couleur enregistrée pour le moment.": "Aún no hay colores guardados.", "Emojis": "Emojis", "Stickers et emojis": "Pegatinas y emojis", "Choisis un emoji": "Elige un emoji", "Smileys et émotions": "Emoticonos y emociones", "Personnes": "Personas", "Animaux et nature": "Animales y naturaleza", "Nourriture et boissons": "Comida y bebida", "Voyages et lieux": "Viajes y lugares", "Activités": "Actividades", "Objets": "Objetos", "Symboles": "Símbolos", "Drapeaux": "Banderas", "Hibou": "Búho", "Tortue": "Tortuga", "Poisson": "Pez", "Abeille": "Abeja", "Coccinelle": "Mariquita", "Escargot": "Caracol", "Pingouin": "Pingüino", "Éléphant": "Elefante", "Chien": "Perro", "Arbre": "Árbol", "Champignon": "Seta", "Loupe": "Lupa", "Calculatrice": "Calculadora", "Sac à dos": "Mochila", "Post-it": "Nota adhesiva", "Glace": "Helado", "Donut": "Dónut", "Fraise": "Fresa", "Pomme": "Manzana", "Cadeau": "Regalo", "Aperçu": "Vista previa", "Couleur de la matière": "Color de la asignatura", "Changer la couleur": "Cambiar el color", "Couleur d'origine": "Color original", "Décorer": "Decorar", "Décor de l'application": "Decoración de la aplicación", "Ajouter un sticker": "Añadir una pegatina", "Terminé": "Listo", "Tout retirer": "Quitar todo", "Confirmer : tout retirer": "Confirmar: quitar todo", "Ajoute un sticker, puis touche-le et glisse-le où tu veux. Il reste en arrière-plan sur toutes les pages.": "Añade una pegatina, tócala y arrástrala donde quieras. Se queda de fondo en todas las páginas."}};
var I18N_X={
 en:{'Planning':'Schedule','Sous-titre (facultatif)':'Subtitle (optional)','✓ Enregistré':'✓ Saved','… Enregistrement':'… Saving','⚠ Hors ligne : modifications gardées sur cet appareil':'⚠ Offline: changes are kept on this device','⚠ Copie locale pleine : reste connecté au serveur':'⚠ Local copy full: stay connected to the server','Sauvegardes et export':'Backups and export',"Chaque modification est enregistrée sur le serveur, avec des sauvegardes automatiques régulières. Rien n'est supprimé sans retour possible.":'Every change is saved on the server, with regular automatic backups. Nothing is removed without a way back.','Exporter (JSON)':'Export (JSON)','Importer un fichier…':'Import a file…','Restaurer':'Restore','Aucune sauvegarde pour le moment.':'No backup yet.','Fichier invalide.':'Invalid file.',"Importer ce fichier ? Il est fusionné avec tes données actuelles : rien n'est supprimé, et une sauvegarde est faite automatiquement.":'Import this file? It is merged with your current data: nothing is removed, and a backup is made automatically.','Import terminé.':'Import complete.',"L'import a échoué (données modifiées ailleurs ?). Réessaie.":'Import failed (data changed elsewhere?). Try again.','Restaurer cette sauvegarde ? Tes données actuelles sont sauvegardées avant, tu pourras y revenir.':'Restore this backup? Your current data is backed up first, so you can come back to it.','Sauvegarde restaurée.':'Backup restored.','Restauration impossible.':'Restore failed.','Serveur injoignable.':'Server unreachable.','avant une forte réduction':'before a large reduction','avant une restauration':'before a restore','avant migration':'before migration','Fichier trop gros (max 25 Mo) : ':'File too large (max 25 MB): '},
 es:{'Planning':'Calendario','Sous-titre (facultatif)':'Subtítulo (opcional)','✓ Enregistré':'✓ Guardado','… Enregistrement':'… Guardando','⚠ Hors ligne : modifications gardées sur cet appareil':'⚠ Sin conexión: los cambios se guardan en este dispositivo','⚠ Copie locale pleine : reste connecté au serveur':'⚠ Copia local llena: sigue conectado al servidor','Sauvegardes et export':'Copias de seguridad y exportación',"Chaque modification est enregistrée sur le serveur, avec des sauvegardes automatiques régulières. Rien n'est supprimé sans retour possible.":'Cada cambio se guarda en el servidor, con copias de seguridad automáticas. Nada se elimina sin posibilidad de volver atrás.','Exporter (JSON)':'Exportar (JSON)','Importer un fichier…':'Importar un archivo…','Restaurer':'Restaurar','Aucune sauvegarde pour le moment.':'Aún no hay copias de seguridad.','Fichier invalide.':'Archivo no válido.',"Importer ce fichier ? Il est fusionné avec tes données actuelles : rien n'est supprimé, et une sauvegarde est faite automatiquement.":'¿Importar este archivo? Se fusiona con tus datos actuales: no se elimina nada y se hace una copia de seguridad automáticamente.','Import terminé.':'Importación terminada.',"L'import a échoué (données modifiées ailleurs ?). Réessaie.":'La importación falló (¿datos modificados en otro sitio?). Inténtalo de nuevo.','Restaurer cette sauvegarde ? Tes données actuelles sont sauvegardées avant, tu pourras y revenir.':'¿Restaurar esta copia? Tus datos actuales se guardan antes, podrás volver a ellos.','Sauvegarde restaurée.':'Copia restaurada.','Restauration impossible.':'No se pudo restaurar.','Serveur injoignable.':'Servidor inaccesible.','avant une forte réduction':'antes de una gran reducción','avant une restauration':'antes de una restauración','avant migration':'antes de la migración','Fichier trop gros (max 25 Mo) : ':'Archivo demasiado grande (máx. 25 MB): '}
};
Object.keys(I18N_X).forEach(function(l){I18N[l]=Object.assign(I18N[l]||{},I18N_X[l]);});
function t(s){var d=I18N[data.prefs.lang];return (d&&d[s])||s;}
function tf(s,o){return t(s).replace(/\{(\w+)\}/g,function(m,k){return o[k]!==undefined?o[k]:m;});}
var LANGN={fr:'Français',en:'English',es:'Español'};
var FLAGS={
  fr:'<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="10" height="20" fill="#0055A4"/><rect x="10" width="10" height="20" fill="#FFFFFF"/><rect x="20" width="10" height="20" fill="#EF4135"/></svg>',
  en:'<svg viewBox="0 0 60 30" aria-hidden="true"><rect width="60" height="30" fill="#012169"/><path d="M0 0L60 30M60 0L0 30" stroke="#FFFFFF" stroke-width="6"/><path d="M0 0L60 30M60 0L0 30" stroke="#C8102E" stroke-width="2.5"/><path d="M30 0V30M0 15H60" stroke="#FFFFFF" stroke-width="10"/><path d="M30 0V30M0 15H60" stroke="#C8102E" stroke-width="6"/></svg>',
  es:'<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/></svg>'
};

/* ---------- Couleur personnalisée de l'interface ---------- */
var CUSTOM_VARS=['--bg','--surface','--surface2','--fg','--muted','--line','--accent','--accent-ink'];
function hex2hsl(hex){
  var r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  var mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0,l=(mx+mn)/2;
  if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}
  return {h:h,s:d?d/(1-Math.abs(2*l-1)):0,l:l};
}
function hslHex(h,s,l){
  s/=100;l/=100;
  var c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2,r=0,g=0,b=0;
  if(h<60){r=c;g=x;}else if(h<120){r=x;g=c;}else if(h<180){g=c;b=x;}else if(h<240){g=x;b=c;}else if(h<300){r=x;b=c;}else{r=c;b=x;}
  return '#'+[r,g,b].map(function(u){return Math.round((u+m)*255).toString(16).padStart(2,'0');}).join('');
}
function lum(hex){
  var a=[1,3,5].map(function(i){var c=parseInt(hex.slice(i,i+2),16)/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);});
  return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2];
}
function customTokens(hex,dark){
  var o=hex2hsl(hex),h=Math.round(o.h)%360,sat=Math.max(25,Math.round(o.s*100)),k=o.s<0.08?0:1,acc=hex;
  if(!dark){if(lum(hex)>0.45)acc=hslHex(h,Math.min(100,sat),38);}
  else if(lum(hex)<0.2)acc=hslHex(h,Math.min(100,sat),66);
  var tk=dark
    ?{'--bg':hslHex(h,30*k,8),'--surface':hslHex(h,26*k,12),'--surface2':hslHex(h,24*k,16),'--fg':hslHex(h,25*k,93),'--muted':hslHex(h,14*k,66),'--line':hslHex(h,20*k,23)}
    :{'--bg':hslHex(h,40*k,94),'--surface':'#FFFFFF','--surface2':hslHex(h,40*k,97),'--fg':hslHex(h,40*k,11),'--muted':hslHex(h,16*k,37),'--line':hslHex(h,28*k,83)};
  tk['--accent']=acc;tk['--accent-ink']=lum(acc)>0.4?'#10151b':'#FFFFFF';
  return tk;
}
function applyTheme(){
  var r=document.documentElement,vt=r.getAttribute('data-theme'),mode=data.prefs.mode;
  var sys=!!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  var dark=mode==='dark'||(mode==='auto'&&(vt==='dark'||(vt!=='light'&&sys)));
  r.setAttribute('data-pal',data.prefs.pal);
  r.setAttribute('data-scheme',dark?'dark':'light');
  CUSTOM_VARS.forEach(function(v){r.style.removeProperty(v);});
  if(data.prefs.pal==='perso'){var tk=customTokens(data.prefs.custom,dark);Object.keys(tk).forEach(function(k){r.style.setProperty(k,tk[k]);});}
  applySubjColors();
}
applyTheme();

function isDark(){return document.documentElement.getAttribute('data-scheme')==='dark';}
function subjCol(sj){
  var c=sj.color;if(!/^#[0-9a-f]{6}$/i.test(c||''))return '';
  if(isDark()){var h=hex2hsl(c);if(h.l<.62)c=hslHex(h.h,Math.round(h.s*100),68);}
  return c;
}
function applySubjColors(){
  var r=document.documentElement;
  SUBJECTS.forEach(function(sj){var c=subjCol(sj);if(c)r.style.setProperty('--s'+sj.c,c);else r.style.removeProperty('--s'+sj.c);});
}
function cssHex(v){
  try{var c=document.createElement('canvas').getContext('2d');c.fillStyle='#888888';c.fillStyle=v;var o=c.fillStyle;if(/^#/.test(o))return o;var m=o.match(/\d+/g);return '#'+m.slice(0,3).map(function(n){return (+n).toString(16).padStart(2,'0');}).join('');}catch(e){return '#888888';}
}
function subjHex(id){
  var sj=subj(id);if(!sj)return '#888888';
  if(/^#[0-9a-f]{6}$/i.test(sj.color||''))return sj.color.toLowerCase();
  var r=document.documentElement,keep=r.style.getPropertyValue('--s'+sj.c);r.style.removeProperty('--s'+sj.c);
  var v=getComputedStyle(r).getPropertyValue('--s'+sj.c).trim();
  if(keep)r.style.setProperty('--s'+sj.c,keep);
  return cssHex(v);
}
/* ---------- Utilitaires de date ---------- */
function pad(n){return String(n).padStart(2,'0');}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function parse(s){var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function diff(a,b){return Math.round((parse(a)-parse(b))/864e5);}
var state={tab:'planning',pmonth:null,pall:false,sel:null,newc:'#d6457f',bnewc:'#d6457f',stkTarget:'print',hsv:null,pickHex:null,view:'list',scope:'todo',filter:'all',month:null,sel:null,sim:null,alertOpen:false,formOpen:false,form:{title:'',subject:'',date:'',time:'',tend:''}};
function today(){return state.sim||iso(new Date());}
var fWd,fLong,fMonth,fMon,fMonShort,fWdLong,fWdNarrow;
function initFmt(){
  var L={fr:'fr-FR',en:'en-GB',es:'es-ES'}[data.prefs.lang]||'fr-FR';
  fWd=new Intl.DateTimeFormat(L,{weekday:'short'});
  fLong=new Intl.DateTimeFormat(L,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  fMonth=new Intl.DateTimeFormat(L,{month:'long',year:'numeric'});
  fMon=new Intl.DateTimeFormat(L,{month:'long'});
  fMonShort=new Intl.DateTimeFormat(L,{month:'short',year:'2-digit'});
  fWdLong=new Intl.DateTimeFormat(L,{weekday:'long'});
  fWdNarrow=new Intl.DateTimeFormat(L,{weekday:'narrow'});
  document.documentElement.setAttribute('lang',data.prefs.lang);
}
initFmt();
function wdList(f){var o=[];for(var i=0;i<7;i++)o.push(f.format(new Date(2024,0,1+i)));return o;}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function rel(dd){
  if(dd===0)return t("aujourd'hui");if(dd===1)return t('demain');if(dd===-1)return t('hier');
  var a=Math.abs(dd),big=a>=60,u=big?Math.round(a/30):a;
  return dd>0?tf(big?'dans {n} mois':'dans {n} j',{n:u}):tf(big?'il y a {n} mois':'il y a {n} j',{n:u});
}
function range(e){
  if(!e.end)return fLong.format(parse(e.date));
  var a=parse(e.date),b=parse(e.end);
  if(a.getMonth()===b.getMonth())return a.getDate()+'–'+b.getDate()+' '+fMon.format(a)+' '+a.getFullYear();
  return a.getDate()+' '+fMon.format(a)+' – '+b.getDate()+' '+fMon.format(b)+' '+b.getFullYear();
}
function subj(id){return SUBJECTS.filter(function(s){return s.id===id;})[0];}
function K(k){return t({live:'Live du soir',webconf:'Webconférence',perso:'Séance perso',devoir:'À rendre',exam:'Examen',dispo:'Sujet disponible'}[k]);}
function evTitle(e){return e.kind==='perso'?e.title:K(e.kind)+(e.tag?' · '+t(e.tag):'');}

/* ---------- Événements ---------- */
function buildEvents(){
  var ev=EVENTS.filter(function(e){return !data.hidden[e.id];}).map(function(e){return Object.assign({check:true},e);});
  data.custom.forEach(function(c){var o=Object.assign({check:true,kind:'perso'},c);o.time=c.tend?(c.time?c.time+' – '+c.tend:'– '+c.tend):(c.time||'');ev.push(o);});
  DEVOIRS.forEach(function(d){
    ev.push({id:'dev:'+d.id,kind:'devoir',date:d.date,title:d.title,devoir:d});
    if(d.avail)ev.push({id:'av:'+d.id,kind:'dispo',date:d.avail,title:d.title});
  });
  EXAMS.forEach(function(x){ev.push({id:x.id,kind:'exam',date:x.date,end:x.end,title:x.title});});
  ev.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:(a.time||'')<(b.time||'')?-1:1;});
  return ev;
}
function renduCount(d){return SUBJECTS.filter(function(s){return data.rendu[d.id+':'+s.id];}).length;}
function devoirDone(d){return renduCount(d)===SUBJECTS.length;}
function lastDay(e){return e.end||e.date;}
function visible(e){
  if(state.filter!=='all'&&e.subject&&e.subject!==state.filter)return false;
  return true;
}
function inScope(e){
  if(state.scope==='all')return true;
  var t=today();
  if(e.check&&data.done[e.id])return false;
  if(e.kind==='devoir'&&devoirDone(e.devoir))return false;
  if(!e.check&&e.kind!=='devoir'&&lastDay(e)<t)return false;
  return true;
}
function isLate(e){return e.check&&!data.done[e.id]&&e.date<today();}
function dueSoon(){
  var t=today();
  return DEVOIRS.filter(function(d){var n=diff(d.date,t);return n>=0&&n<=7&&!devoirDone(d);});
}

/* ---------- Rendu : lignes ---------- */
function toggles(d,big){
  return '<div class="rend">'+SUBJECTS.map(function(s){
    var on=!!data.rendu[d.id+':'+s.id];
    return '<button type="button" class="tog s'+s.c+(big?' big':'')+'" data-act="rendu" data-dev="'+d.id+'" data-sub="'+s.id+'" aria-pressed="'+on+'">'+esc(s.short)+esc(on?t(' · rendu'):t(' · à rendre'))+'</button>';
  }).join('')+'</div>';
}
function noteCount(k){return (data.notes[k]||[]).length;}
function noteBtn(k,title){var n=noteCount(k);return '<button type="button" class="nbtn'+(n?' has':'')+'" data-act="notes" data-key="'+esc(k)+'" data-title="'+esc(title)+'" aria-label="'+esc(t('Notes et pièces jointes')+' : '+title)+'">📎 '+(n?n:t('Notes'))+'</button>';}
function fmtSize(n){return n>1048576?(n/1048576).toFixed(1)+' Mo':Math.max(1,Math.round(n/1024))+' Ko';}
function noteHtml(){
  var nf=state.noteFor,L=data.notes[nf.key]||[];
  var h='<div class="ov" role="dialog" aria-modal="true" aria-labelledby="nt-t"><div class="modal wide"><div class="mtop acc"><div class="eyebrow" id="nt-t">'+t('Notes et pièces jointes')+'</div><div class="big sm">'+esc(nf.title)+'</div></div><div class="mbody">';
  if(state.noteMsg)h+='<p class="warn" role="alert">'+esc(state.noteMsg)+'</p>';
  h+=L.length?'<div class="nlist">'+L.map(function(n){
    var inner;
    if(n.k==='text')inner='<textarea data-nt="'+n.id+'" rows="3" aria-label="'+esc(t('Note'))+'">'+esc(n.v)+'</textarea>';
    else if(n.k==='link')inner='<a href="'+esc(n.u)+'" target="_blank" rel="noopener noreferrer">🔗 '+esc(n.l||n.u)+'</a>';
    else if(n.k==='img')inner='<img src="'+esc(noteSrc(n))+'" alt="'+esc(n.n||'')+'" loading="lazy">';
    else inner='<a class="fl" href="'+esc(noteSrc(n,true))+'" download="'+esc(n.n||'file')+'">📄 '+esc(n.n)+' <small>('+fmtSize(n.z||0)+')</small></a>';
    return '<div class="nitem">'+inner+'<button type="button" class="lnk" data-act="note-del" data-id="'+n.id+'">'+t('Supprimer')+'</button></div>';
  }).join('')+'</div>':'<p class="hint">'+t('Aucune note pour le moment.')+'</p>';
  h+='<div class="nadd"><label for="nt-text">'+t('Ajouter une note')+'</label><textarea id="nt-text" rows="3" placeholder="'+esc(t('Écris une note…'))+'"></textarea><button type="button" class="btn ghost" data-act="note-addtext">'+t('Ajouter le texte')+'</button></div>';
  h+='<div class="nadd"><label for="nt-url">'+t('Ajouter un lien')+'</label><input id="nt-url" type="url" inputmode="url" placeholder="https://…"><input id="nt-label" type="text" maxlength="80" placeholder="'+esc(t('Nom du lien (facultatif)'))+'"><button type="button" class="btn ghost" data-act="note-addlink">'+t('Ajouter le lien')+'</button></div>';
  h+='<div class="nadd"><label for="nt-file">'+t('Ajouter des images ou des fichiers')+'</label><input id="nt-file" type="file" multiple></div>';
  return h+'<button class="btn" data-act="noteclose" id="nt-close">'+t('Fermer')+'</button></div></div></div>';
}
var MAX_UP=25*1048576;
function noteSrc(n,dl){return n.f?'api/files/'+n.f+(dl?'?name='+encodeURIComponent(n.n||'file'):''):(n.d||'');}
function nid(){return 'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);}
function uploadBlob(blob,type){
  return fetch('api/files',{method:'POST',credentials:'same-origin',headers:{'Content-Type':type||'application/octet-stream','X-Planner-Client':'1'},body:blob}).then(function(r){
    if(!r.ok)throw new Error('HTTP '+r.status);return r.json();
  });
}
function blobToDataUrl(b){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result);};r.onerror=rej;r.readAsDataURL(b);});}
function dataUrlToBlob(u){
  var i=u.indexOf(','),meta=u.slice(5,i),raw=u.slice(i+1),type=meta.split(';')[0]||'application/octet-stream';
  if(/;base64$/.test(meta)){var s=atob(raw),a=new Uint8Array(s.length);for(var k=0;k<s.length;k++)a[k]=s.charCodeAt(k);return new Blob([a],{type:type});}
  return new Blob([decodeURIComponent(raw)],{type:type});
}
function addNote(key,item){
  var L=data.notes[key]=data.notes[key]||[];
  L.push(item);
  persist();
  state.noteMsg='';
}
function flushNoteDraft(){
  var tx=document.getElementById('nt-text');
  if(state.noteFor&&tx&&tx.value.trim()){addNote(state.noteFor.key,{id:nid(),k:'text',v:tx.value.trim()});tx.value='';}
}
function closeNotes(){flushNoteDraft();state.noteFor=null;state.noteMsg='';}
/* Les anciennes pièces jointes stockées dans le JSON (data:...) sont envoyées au serveur dès qu'il est joignable. */
var migrating=false;
function migrateInline(){
  if(migrating)return;
  var todo=[];
  Object.keys(data.notes).forEach(function(k){(data.notes[k]||[]).forEach(function(n){if(!n.f&&typeof n.d==='string'&&n.d.indexOf('data:')===0)todo.push([k,n.id,n.d]);});});
  if(!todo.length)return;
  migrating=true;
  var chain=Promise.resolve();
  todo.forEach(function(it){chain=chain.then(function(){
    var b;try{b=dataUrlToBlob(it[2]);}catch(e){return;}
    return uploadBlob(b,b.type).then(function(j){
      var n=(data.notes[it[0]]||[]).filter(function(x){return x.id===it[1];})[0];
      if(n&&!n.f){n.f=j.id;delete n.d;persist();}
    }).catch(function(){});
  });});
  chain.then(function(){migrating=false;if(state.noteFor)renderAlert();});
}
function prepFile(f){
  return new Promise(function(res){
    var img=/^image\//.test(f.type)&&f.type!=='image/svg+xml';
    var raw=function(){
      if(f.size>MAX_UP){state.noteMsg=t('Fichier trop gros (max 25 Mo) : ')+f.name;res(null);return;}
      res({blob:f,type:f.type||'application/octet-stream',name:f.name,kind:img?'img':'file'});
    };
    if(!img||f.type==='image/gif'){raw();return;}
    var u=URL.createObjectURL(f),im=new Image();
    im.onerror=function(){URL.revokeObjectURL(u);img=false;raw();};
    im.onload=function(){
      var m=1600,k=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas');
      c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);
      var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
      URL.revokeObjectURL(u);
      c.toBlob(function(b){if(b)res({blob:b,type:'image/jpeg',name:f.name,kind:'img'});else raw();},'image/jpeg',.85);
    };
    im.src=u;
  });
}
function addFiles(files){
  var key=state.noteFor.key;
  var jobs=Array.prototype.map.call(files,function(f){return prepFile(f).then(function(p){
    if(!p)return;
    return uploadBlob(p.blob,p.type).then(function(j){
      addNote(key,{id:nid(),k:p.kind,n:p.name,z:p.blob.size,f:j.id});
    },function(){      // serveur injoignable : on garde la pièce jointe dans les données, elle sera envoyée plus tard
      return blobToDataUrl(p.blob).then(function(u){addNote(key,{id:nid(),k:p.kind,n:p.name,z:p.blob.size,d:u});},function(){});
    });
  });});
  Promise.all(jobs).then(render);
}
function row(e){
  var td=today(),dd=diff(e.date,td),dt=parse(e.date),done=e.check&&!!data.done[e.id];
  var sb=e.subject?subj(e.subject):null,tags='',title,meta='',tail='',extra='';
  if(sb)tags+='<span class="chip s'+sb.c+'">'+esc(sb.code+' · '+sb.short)+'</span>';
  if(e.check){
    var st;
    if(done)st='<span class="st ok">'+t('Fait')+'</span>';
    else if(dd<0)st='<span class="st late">'+(e.kind==='perso'?t('En retard'):t('À rattraper'))+'</span>';
    else if(dd===0)st='<span class="st now">'+t("Aujourd'hui")+'</span>';
    else st='';
    tags+=st;
    title=evTitle(e);
    meta=(e.time?e.time+' · ':'')+rel(dd);
    tail='<input type="checkbox" class="chk" data-act="done" data-id="'+esc(e.id)+'" '+(done?'checked':'')+' aria-label="'+esc(tf('Marquer « {t} » comme fait',{t:title}))+'">';
    if(e.kind==='perso')tail='<span style="display:flex;gap:4px;align-items:center"><button class="del" data-act="del" data-id="'+esc(e.id)+'" aria-label="'+t('Supprimer')+'">×</button>'+tail+'</span>';
  }else if(e.kind==='devoir'){
    var left=SUBJECTS.length-renduCount(e.devoir);
    if(left===0)tags+='<span class="st ok">'+t('Tout rendu')+'</span>';
    else if(dd<0)tags+='<span class="st urgent">'+t('Date dépassée')+'</span>';
    else if(dd<=7)tags+='<span class="st urgent">'+rel(dd)+'</span>';
    tags+='<span class="chip solid">'+t('À RENDRE')+'</span>';
    title=t(e.title);
    meta=tf('Date limite {r} · {a}/{b} matières rendues',{r:rel(dd),a:renduCount(e.devoir),b:SUBJECTS.length});
    extra=toggles(e.devoir,false);
  }else if(e.kind==='exam'){
    tags+='<span class="chip" style="--c:var(--fg)">'+t('Examen')+'</span>';
    title=t(e.title);meta=range(e)+' · '+rel(dd);
  }else{
    tags+='<span class="chip">'+t('Sujet disponible')+'</span>';
    title=t(e.title);meta=rel(dd);
  }
  return '<li class="row kind-'+e.kind+(done?' done':'')+'"><div class="dt"><span class="wd">'+fWd.format(dt)+'</span><span class="dn">'+dt.getDate()+'</span></div>'+
    '<div class="bd"><div class="tags">'+tags+'</div><div class="tt">'+esc(title)+'</div><div class="mt">'+esc(meta)+'</div>'+extra+'<div class="nrow">'+noteBtn(e.id,(sb?sb.ab+' · ':'')+title+' · '+fLong.format(dt))+'</div></div>'+(tail?tail:'<span></span>')+'</li>';
}

/* ---------- Rendu : planning ---------- */
function listView(evs){
  var late=[],byMonth={},order=[];
  evs.forEach(function(e){
    if(state.scope==='todo'&&isLate(e)){late.push(e);return;}
    var k=e.date.slice(0,7);
    if(!byMonth[k]){byMonth[k]=[];order.push(k);}
    byMonth[k].push(e);
  });
  var out='';
  if(late.length)out+='<section class="group late"><h2>'+t('À rattraper')+' <span>'+tf('{n} en attente',{n:late.length})+'</span></h2><ul class="list">'+late.map(row).join('')+'</ul></section>';
  order.forEach(function(k){
    var d=parse(k+'-01');
    out+='<section class="group"><h2 style="text-transform:capitalize">'+fMonth.format(d)+'</h2><ul class="list">'+byMonth[k].map(row).join('')+'</ul></section>';
  });
  return out||'<div class="empty">'+t('Rien à afficher avec ces filtres.')+'</div>';
}
function eventsOn(evs,day){
  return evs.filter(function(e){return e.date<=day&&lastDay(e)>=day;});
}
function monthView(evs){
  var p=state.month.split('-').map(Number),y=p[0],m=p[1];
  var first=new Date(y,m-1,1),off=(first.getDay()+6)%7,n=new Date(y,m,0).getDate(),td=today();
  var h='<div class="mhead"><button class="btn ghost" data-act="mprev" aria-label="'+t('Mois précédent')+'">←</button><h2>'+fMonth.format(first)+'</h2><button class="btn ghost" data-act="mnext" aria-label="'+t('Mois suivant')+'">→</button></div>';
  h+='<div class="cal">'+wdList(fWdNarrow).map(function(x){return '<div class="wh">'+x+'</div>';}).join('');
  for(var i=0;i<off;i++)h+='<div class="cell out"></div>';
  for(var d=1;d<=n;d++){
    var day=y+'-'+pad(m)+'-'+pad(d),es=eventsOn(evs,day);
    var dots=es.slice(0,6).map(function(e){
      if(e.kind==='devoir')return '<span class="dot sq"></span>';
      if(e.kind==='exam')return '<span class="dot ex"></span>';
      var s=e.subject?subj(e.subject):null;
      return '<span class="dot" style="--c:'+(s?'var(--s'+s.c+')':'var(--muted)')+(e.kind==='dispo'?';opacity:.45':'')+'"></span>';
    }).join('');
    var dv=es.filter(function(e){return e.kind==='devoir';});
    var dvt=dv.map(function(e){return '<span class="dvtag"><span class="dvs">'+esc(t(e.devoir.ab))+'</span><span class="dvl">'+esc(t(e.title))+'</span></span>';}).join('');
    var oth=es.filter(function(e){return e.kind!=='devoir';});
    var lines=oth.slice(0,3).map(function(e){
      if(e.kind==='exam')return '<span class="cl cx">'+t('Examen')+'</span>';
      if(e.kind==='dispo')return '<span class="cl cx">'+t('Sujet : ')+esc(t(e.title))+'</span>';
      var s2=e.subject?subj(e.subject):null,lab=e.kind==='live'?t('Live du soir'):e.kind==='webconf'?t('Webconf')+(e.tag?' · '+t(e.tag):''):e.title;
      return '<span class="cl'+(s2?' s'+s2.c:'')+(data.done[e.id]?' dn':'')+'">'+(s2?esc(s2.ab)+' · ':'')+esc(lab)+'</span>';
    }).join('')+(oth.length>3?'<span class="cl cx">+'+(oth.length-3)+'</span>':'');
    h+='<button type="button" class="cell'+(day===td?' today':'')+(day===state.sel?' sel':'')+(dv.length?' hasdv':'')+'" data-act="day" data-day="'+day+'" aria-label="'+esc(tf('{d}, {n} élément(s)',{d:fLong.format(parse(day)),n:es.length}))+'"><span class="cd">'+d+'</span>'+dvt+'<span class="dots">'+dots+'</span><span class="clines">'+lines+'</span></button>';
  }
  h+='</div>';
  h+='<div class="legend">'+SUBJECTS.map(function(s){return '<span><i class="dot" style="--c:var(--s'+s.c+')"></i>'+esc(s.short)+'</span>';}).join('')+'<span><i class="dot sq"></i>'+t('Devoir')+'</span><span><i class="dot ex"></i>'+t('Examen')+'</span></div>';
  if(state.sel){
    var es2=eventsOn(evs,state.sel);
    h+='<section class="group"><h2 style="text-transform:capitalize">'+fLong.format(parse(state.sel))+'</h2>'+(es2.length?'<ul class="list">'+es2.map(row).join('')+'</ul>':'<div class="empty">'+t('Rien de prévu ce jour-là.')+'</div>')+'</section>';
  }
  return h;
}
function subjChips(){
  return '<div class="chips"><button class="fchip" data-act="filter" data-v="all" aria-pressed="'+(state.filter==='all')+'">'+t('Toutes les matières')+'</button>'+SUBJECTS.map(function(s){return '<button class="fchip s'+s.c+'" style="--c:var(--s'+s.c+')" data-act="filter" data-v="'+s.id+'" aria-pressed="'+(state.filter===s.id)+'">'+esc(s.short)+'</button>';}).join('')+'</div>';
}
function planning(){
  var evs=buildEvents().filter(visible);
  var h='<div class="controls"><div class="seg only-narrow" role="group" aria-label="'+t('Vue')+'"><button data-act="view" data-v="list" aria-pressed="'+(state.view==='list')+'">'+t('Liste')+'</button><button data-act="view" data-v="month" aria-pressed="'+(state.view==='month')+'">'+t('Mois')+'</button></div><span class="spacer"></span><button class="btn" data-act="addtoggle">'+(state.formOpen?t('Fermer'):t('+ Ajouter une séance'))+'</button></div>';
  h+=subjChips();
  if(state.formOpen){
    var f=state.form;
    h+='<form class="form" id="addform"><label class="wide" for="f-title">'+t('Titre')+'<input id="f-title" name="title" required maxlength="80" placeholder="'+esc(t('Ex. Relire le chapitre 3'))+'" value="'+esc(f.title)+'"></label>'+
      '<label for="f-subject">'+t('Matière')+'<select id="f-subject" name="subject"><option value="">'+t('Aucune')+'</option>'+SUBJECTS.map(function(s){return '<option value="'+s.id+'"'+(f.subject===s.id?' selected':'')+'>'+esc(s.name)+'</option>';}).join('')+'</select></label>'+
      '<label for="f-date">'+t('Date')+'<input id="f-date" name="date" type="date" required value="'+esc(f.date||today())+'"></label>'+
      '<label for="f-time">'+t('Début (facultatif)')+'<input id="f-time" name="time" type="time" value="'+esc(f.time)+'"></label>'+
      '<label for="f-tend">'+t('Fin (facultatif)')+'<input id="f-tend" name="tend" type="time" value="'+esc(f.tend)+'"></label>'+
      '<button class="btn" type="submit">'+t('Ajouter au planning')+'</button></form>';
  }
  h+='<div class="split"><div class="pane pane-month'+(state.view==='month'?'':' hide-narrow')+'">'+monthView(evs)+'</div><div class="pane pane-list'+(state.view==='list'?'':' hide-narrow')+'"><div class="seg" role="group" aria-label="'+t('Affichage')+'"><button data-act="scope" data-v="todo" aria-pressed="'+(state.scope==='todo')+'">'+t('À faire')+'</button><button data-act="scope" data-v="all" aria-pressed="'+(state.scope==='all')+'">'+t('Tout')+'</button></div>'+listView(evs.filter(inScope))+'</div></div>';
  return h;
}

/* ---------- Rendu : devoirs ---------- */
function devoirsTab(){
  var td=today();
  var h='<div class="dgrid">'+DEVOIRS.map(function(d){
    var dd=diff(d.date,td),left=SUBJECTS.length-renduCount(d),urgent=dd>=0&&dd<=7&&left>0;
    var st=left===0?'<span class="st ok">'+t('Tout rendu')+'</span>':dd<0?'<span class="st urgent">'+t('Date dépassée')+'</span>':urgent?'<span class="st urgent">'+rel(dd)+'</span>':'<span class="st">'+rel(dd)+'</span>';
    return '<article class="dcard'+(urgent?' urgent':'')+'"><div class="tags">'+st+'</div><div class="dbig">'+(left===0?t('Rendu'):(dd>=0?dd+' '+t(dd>1?'jours':'jour'):t('En retard')))+'</div><h3>'+esc(t(d.title))+'</h3><div class="when">'+t('À déposer avant le ')+fLong.format(parse(d.date))+'</div>'+
      '<div class="meta">'+(d.avail?t('Sujet disponible dès le ')+fLong.format(parse(d.avail)):t('Date de mise à disposition non renseignée'))+'</div>'+toggles(d,false)+'<div class="nrow">'+noteBtn('dev:'+d.id,d.title)+'</div></article>';
  }).join('')+'</div>';
  h+='<div class="cols2">';
  h+='<section class="group"><h2>'+t('Examens écrits')+'</h2><ul class="list">'+buildEvents().filter(function(e){return e.kind==='exam';}).map(row).join('')+'</ul></section>';
  h+='<section class="group"><h2>'+t('Mes matières')+'</h2><ul class="list">'+SUBJECTS.map(function(s){return '<li class="row" style="grid-template-columns:auto minmax(0,1fr)"><span class="chip s'+s.c+'">'+esc(s.code)+'</span><div class="tt">'+esc(s.name)+'<div class="nrow">'+noteBtn('s:'+s.id,s.code+' · '+s.name)+'</div></div></li>';}).join('')+'</ul></section>';
  h+='</div>';
  return h;
}

/* ---------- Rendu : en-tête et page ---------- */
var edOpen={};
function edIsOpen(id,def){return edOpen[id]===undefined?def:edOpen[id];}
function edInput(key,f,label,type,val,opt){
  var mod=(data.edits[key]&&data.edits[key][f]!==undefined)||(key.slice(0,2)==='c:'&&false);
  var h='<label class="'+(opt&&opt.wide?'wide ':'')+(mod?'mod':'')+'">'+t(label);
  if(opt&&opt.options){
    h+='<select data-ed="'+esc(key)+'|'+f+'">'+opt.options.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(val)===o[0]?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select>';
  }else{
    h+='<input data-ed="'+esc(key)+'|'+f+'" type="'+type+'" value="'+esc(val||'')+'"'+(opt&&opt.max?' maxlength="'+opt.max+'"':'')+'>';
  }
  if(opt&&opt.clear&&val)h+='<button type="button" class="lnk" data-act="ed-clear" data-key="'+esc(key)+'" data-f="'+f+'">'+t('Effacer cette date')+'</button>';
  return h+'</label>';
}
function edHead(id,title,count,def){
  var o=edIsOpen(id,def);
  return '<button type="button" class="edsec" data-act="ed-sec" data-v="'+id+'" data-def="'+(def?1:0)+'" aria-expanded="'+o+'"><span>'+title+'</span>'+(count?'<small>'+count+'</small>':'')+'<i aria-hidden="true">'+(o?'−':'+')+'</i></button>';
}
function pvInner(key){
  var p=key.split(':'),id=key.slice(p[0].length+1),h='';
  try{
    if(key==='app')return '<div class="pvh">'+esc(appTitle())+'</div>';
    if(p[0]==='s'){var sj=subj(id);return '<span class="chip s'+sj.c+'">'+esc(sj.code+' · '+sj.short)+'</span> <span class="cl s'+sj.c+'">'+esc(sj.ab)+' · '+esc(K('live'))+'</span> <span class="legend"><span><i class="dot" style="--c:var(--s'+sj.c+')"></i>'+esc(sj.short)+'</span></span>';}
    if(p[0]==='d'){var d=DEVOIRS.filter(function(x){return x.id===id;})[0];h='<ul class="list">'+row({id:'dev:'+d.id,kind:'devoir',date:d.date,title:d.title,devoir:d});if(d.avail)h+=row({id:'av:'+d.id,kind:'dispo',date:d.avail,title:d.title});return h+'</ul>';}
    if(p[0]==='x'){var x=EXAMS.filter(function(q){return q.id===id;})[0];return '<ul class="list">'+row({id:x.id,kind:'exam',date:x.date,end:x.end,title:x.title})+'</ul>';}
    if(p[0]==='e'){var e=EVENTS.filter(function(q){return q.id===id;})[0];return '<ul class="list">'+row(Object.assign({check:true},e))+'</ul>';}
    if(p[0]==='c'){var c=data.custom.filter(function(q){return q.id===id;})[0],o=Object.assign({check:true,kind:'perso'},c);o.time=c.tend?(c.time?c.time+' – '+c.tend:'– '+c.tend):(c.time||'');return '<ul class="list">'+row(o)+'</ul>';}
  }catch(err){}
  return '';
}
function pvBox(key){return '<div class="pvbox"><span class="lbl">'+t('Aperçu')+'</span><div class="pv" data-pv="'+esc(key)+'" inert>'+pvInner(key)+'</div></div>';}
function refreshPv(){var n=document.querySelectorAll('[data-pv]');for(var i=0;i<n.length;i++)n[i].innerHTML=pvInner(n[i].dataset.pv);}
function edCard(key,title,inner){
  var mod=!!(data.edits[key]&&Object.keys(data.edits[key]).length);
  return '<div class="edcard'+(mod?' modded':'')+'"><div class="edtop"><strong>'+esc(title)+'</strong>'+(mod?'<span class="tag">'+t('Modifié')+'</span><button type="button" class="lnk" data-act="ed-reset" data-key="'+esc(key)+'">'+t("Rétablir les valeurs d'origine")+'</button>':'')+'</div><div class="form">'+inner+'</div>'+pvBox(key)+'</div>';
}
function editTab(){
  var h='<p class="hint">'+t("Mode édition : tu peux changer tous les noms, codes et dates. Les modifications sont enregistrées tout de suite. Pour les dates, touche le champ pour ouvrir le calendrier.")+'</p>';
  h+='<div class="opt"><button type="button" class="btn ghost" data-act="ed-resetall">'+(state.rsArm?t('Confirmer : efface toutes tes modifications'):t('Tout réinitialiser'))+'</button></div>';
  // titre
  h+=edHead('app',t("Titre de l'application"),'',true);
  if(edIsOpen('app',true))h+='<div class="edbody"><div class="form">'+edInput('app','title',"Titre de l'application",'text',(data.edits.app&&data.edits.app.title)||t('Planning'),{wide:true,max:60})+edInput('app','eyebrow','Sous-titre (facultatif)','text',appEyebrow(),{wide:true,max:60})+'</div>'+pvBox('app')+'</div>';
  // matières
  h+=edHead('subj',t('Matières'),SUBJECTS.length,true);
  if(edIsOpen('subj',true))h+='<div class="edbody">'+SUBJECTS.map(function(x){var k='s:'+x.id;return edCard(k,x.code+' · '+x.name,edInput(k,'code','Code','text',x.code,{max:12})+edInput(k,'name','Nom complet','text',x.name,{wide:true,max:80})+edInput(k,'ab','Abréviation','text',x.ab,{max:12})+'<div class="wide colrow"><span class="lbl">'+t('Couleur de la matière')+'</span><button type="button" class="colbtn" data-act="ed-color" data-v="'+x.id+'" style="background:var(--s'+x.c+')" aria-expanded="'+(state.edPick===x.id)+'" aria-label="'+esc(t('Changer la couleur'))+'"></button>'+(x.color?'<button type="button" class="lnk" data-act="ed-colreset" data-key="'+k+'">'+t("Couleur d'origine")+'</button>':'')+'</div>'+(state.edPick===x.id?'<div class="wide">'+picker('subj:'+x.id)+'</div>':'')+noteBtn(k,x.code+' · '+x.name));}).join('')+'</div>';
  // devoirs
  h+=edHead('dev',t('Devoirs'),DEVOIRS.length,true);
  if(edIsOpen('dev',true))h+='<div class="edbody">'+DEVOIRS.map(function(x){var k='d:'+x.id;return edCard(k,x.title,edInput(k,'title','Titre','text',x.title,{wide:true,max:60})+edInput(k,'ab','Abréviation','text',x.ab,{max:12})+edInput(k,'date','Date limite de rendu','date',x.date)+edInput(k,'avail','Sujet disponible dès le','date',x.avail||'',{clear:true}));}).join('')+'</div>';
  // examens
  h+=edHead('exam',t('Examens'),EXAMS.length,true);
  if(edIsOpen('exam',true))h+='<div class="edbody">'+EXAMS.map(function(x){var k='x:'+x.id;return edCard(k,x.title+' · '+fLong.format(parse(x.date)),edInput(k,'title','Titre','text',x.title,{wide:true,max:60})+edInput(k,'date','Début','date',x.date)+edInput(k,'end','Fin','date',x.end||'',{clear:true}));}).join('')+'</div>';
  // séances par matière
  SUBJECTS.forEach(function(sj){
    var L=EVENTS.filter(function(e){return e.subject===sj.id;}).sort(function(a,b){return a.date<b.date?-1:1;}),id='ev-'+sj.id;
    var hid=L.filter(function(e){return data.hidden[e.id];}).length;
    h+=edHead(id,t('Séances')+' · '+esc(sj.ab),L.length+(hid?' ('+hid+' '+t('masquée(s)')+')':''),false);
    if(edIsOpen(id,false))h+='<div class="edbody">'+L.map(function(e){
      var k='e:'+e.id,off=!!data.hidden[e.id];
      var inner=edInput(k,'date','Date','date',e.date)+
        edInput(k,'kind','Type','',e.kind,{options:[['live',t('Live du soir')],['webconf',t('Webconférence')]]})+
        edInput(k,'time','Heure','text',e.time||'',{max:20})+
        edInput(k,'tag','Précision (facultatif)','text',e.tag||'',{max:60})+
        '<button type="button" class="btn ghost" data-act="ed-hide" data-id="'+esc(e.id)+'">'+(off?t('Rétablir cette séance'):t('Masquer cette séance'))+'</button>';
      return edCard(k,K(e.kind)+' · '+fLong.format(parse(e.date))+(off?' ('+t('masquée')+')':''),inner).replace('class="edcard','class="edcard'+(off?' off':''));
    }).join('')+'</div>';
  });
  // séances perso
  h+=edHead('perso',t('Séances perso'),data.custom.length,true);
  if(edIsOpen('perso',true))h+='<div class="edbody">'+(data.custom.length?data.custom.map(function(c){
    var k='c:'+c.id;
    return edCard(k,c.title+' · '+fLong.format(parse(c.date)),edInput(k,'title','Titre','text',c.title,{wide:true,max:80})+
      edInput(k,'subject','Matière','',c.subject||'',{options:[['',t('Aucune')]].concat(SUBJECTS.map(function(x){return [x.id,x.name];}))})+
      edInput(k,'date','Date','date',c.date)+edInput(k,'time','Début (facultatif)','time',c.time||'')+edInput(k,'tend','Fin (facultatif)','time',c.tend||'')+
      '<button type="button" class="btn ghost" data-act="del" data-id="'+esc(c.id)+'">'+t('Supprimer')+'</button>');
  }).join(''):'<p class="hint">'+t("Aucune séance perso. Ajoute-en depuis l'onglet Planning.")+'</p>')+'</div>';
  h+=backupSection();
  return '<div class="editor">'+h+'</div>';
}
function setEd(key,f,v){
  v=String(v);
  if(key==='app'){data.edits.app=data.edits.app||{};if(!v.trim())delete data.edits.app[f];else data.edits.app[f]=v;persist();return;}
  var req={'s:name':1,'s:code':1,'s:ab':1,'d:title':1,'d:date':1,'x:date':1,'e:date':1,'c:date':1,'c:title':1,'d:ab':1};
  var g=key.split(':')[0];
  if(req[g+':'+f]&&!v.trim())return false;
  if(g==='c'){var c=data.custom.filter(function(x){return 'c:'+x.id===key;})[0];if(c)c[f]=v;persist();return true;}
  var b=baseOf(key);
  if((b[f]===undefined?'':String(b[f]))===v){if(data.edits[key]){delete data.edits[key][f];if(!Object.keys(data.edits[key]).length)delete data.edits[key];}}
  else{(data.edits[key]=data.edits[key]||{})[f]=v;}
  applyEdits();persist();return true;
}
function summary(){
  var td=today(),next=DEVOIRS.filter(function(d){return diff(d.date,td)>=0&&!devoirDone(d);})[0];
  var backlog=buildEvents().filter(function(e){return isLate(e)&&(e.kind==='live'||e.kind==='webconf');}).length;
  var rendus=0;DEVOIRS.forEach(function(d){rendus+=renduCount(d);});
  var total=DEVOIRS.length*SUBJECTS.length;
  var nd=next?diff(next.date,td):null;
  return '<div class="sum noprint"><div><div class="eyebrow">'+t('Prochain devoir')+'</div><div class="v'+(next&&nd<=7?' red':'')+'">'+(next?esc(t(next.title)):t('Aucun'))+'</div><small>'+(next?rel(nd)+' · '+fLong.format(parse(next.date)):t('Tout est rendu'))+'</small></div>'+
    '<div><div class="eyebrow">'+t('À rattraper')+'</div><div class="v">'+backlog+'</div><small>'+t('lives et webconférences à revoir')+'</small></div>'+
    '<div><div class="eyebrow">'+t('Devoirs rendus')+'</div><div class="v">'+rendus+' / '+total+'</div><small>'+tf('{a} devoirs × {b} matières',{a:DEVOIRS.length,b:SUBJECTS.length})+'</small></div></div>';
}
function nextBanner(){
  var td=today();
  var next=DEVOIRS.filter(function(d){return diff(d.date,td)>=0&&!devoirDone(d);})[0];
  var late=DEVOIRS.filter(function(d){return diff(d.date,td)<0&&!devoirDone(d);});
  var lateH=late.length?'<div class="nb-late">'+t('En retard : ')+late.map(function(d){return esc(t(d.title))+' ('+SUBJECTS.filter(function(s){return !data.rendu[d.id+':'+s.id];}).map(function(s){return esc(s.ab);}).join(', ')+')';}).join(' · ')+'</div>':'';
  if(!next)return '<div class="nb noprint" role="status"><div class="nb-l"><div class="nb-k">'+t('Devoirs')+'</div><div class="nb-t">'+t('Tout est rendu, bravo !')+'</div></div>'+lateH+'</div>';
  var n=diff(next.date,td),rest=SUBJECTS.filter(function(s){return !data.rendu[next.id+':'+s.id];}).map(function(s){return esc(s.ab);}).join(', ');
  var num=n===0?'<span class="txt">'+t("Aujourd'hui")+'</span>':'<span>'+n+'</span><small>'+t(n>1?'jours':'jour')+'</small>';
  return '<div class="nb noprint" role="status"><div class="nb-l"><div class="nb-k">'+t(n===0?'Prochain devoir à rendre':'Prochain devoir à rendre dans')+'</div><div class="nb-n">'+num+'</div></div><div class="nb-r"><div class="nb-t">'+esc(t(next.title))+'</div><div class="nb-d">'+fLong.format(parse(next.date))+'</div><div class="nb-d">'+t('Reste à rendre : ')+rest+'</div></div>'+lateH+'</div>';
}
function focusKey(){
  var a=document.activeElement;if(!a||!a.getAttribute||!a.getAttribute('data-act'))return null;
  var sel='[data-act="'+a.getAttribute('data-act')+'"]';
  ['data-v','data-id','data-t','data-key','data-k','data-dev','data-sub','data-day'].forEach(function(n){var v=a.getAttribute(n);if(v!==null)sel+='['+n+'="'+String(v).replace(/"/g,'\\"')+'"]';});
  return sel;
}
function bgGet(id){return data.bg.filter(function(b){return b.id===id;})[0];}
function bgTouch(){data.bgAt=Date.now();persist();}
function bgStyle(b){return 'left:'+(b.x*100).toFixed(3)+'%;top:calc(var(--w,1000px)*'+b.y.toFixed(4)+');width:'+b.s.toFixed(2)+'%;transform:translate(-50%,-50%) rotate('+b.r+'deg)';}
function bgWidth(){var el=document.getElementById('bg');if(el)el.style.setProperty('--w',el.getBoundingClientRect().width+'px');}
window.addEventListener('resize',bgWidth);
function renderBg(){
  var el=document.getElementById('bg');if(!el)return;
  bgWidth();
  el.innerHTML=data.bg.map(function(b){return '<div class="bgs'+(state.deco&&state.bsel===b.id?' sel':'')+'" data-id="'+esc(b.id)+'" style="'+bgStyle(b)+'">'+stkSvg(b.t,b.c)+'</div>';}).join('');
}
function renderDecoBar(){
  var box=document.getElementById('decobar');if(!box)return;
  document.body.classList.toggle('decorating',!!state.deco);
  if(!state.deco){box.innerHTML='';return;}
  var sel=state.bsel&&bgGet(state.bsel);
  var h='<div class="dbar" role="toolbar" aria-label="'+esc(t("Décor de l'application"))+'"><div class="drow"><button type="button" class="btn" data-act="bg-add">＋ '+t('Ajouter un sticker')+'</button>';
  if(sel)h+='<div class="seg"><button type="button" data-act="bg-size" data-v="-2" aria-label="'+t('Plus petit')+'">−</button><button type="button" data-act="bg-size" data-v="2" aria-label="'+t('Plus grand')+'">+</button></div><div class="seg"><button type="button" data-act="bg-rot" data-v="-15" aria-label="'+t('Tourner à gauche')+'">↺</button><button type="button" data-act="bg-rot" data-v="15" aria-label="'+t('Tourner à droite')+'">↻</button></div><button type="button" class="fchip" data-act="bg-color" aria-pressed="'+(!!state.bgColor)+'"><i class="sd" style="background:'+colOf(sel.c).m+'"></i>'+t('Couleur')+'</button><button type="button" class="btn ghost" data-act="bg-del">'+t('Supprimer')+'</button>';
  h+='<span class="spacer"></span>';
  if(data.bg.length)h+='<button type="button" class="btn ghost" data-act="bg-clear">'+(state.bgArm?t('Confirmer : tout retirer'):t('Tout retirer'))+'</button>';
  h+='<button type="button" class="btn" data-act="bg-done">✓ '+t('Terminé')+'</button></div>';
  if(!sel)h+='<span class="hint">'+t("Ajoute un sticker, puis touche-le et glisse-le où tu veux. Il reste en arrière-plan sur toutes les pages.")+'</span>';
  if(sel&&state.bgColor)h+=picker('bg');
  box.innerHTML=h+'</div>';
}
var SYNC_TXT={saved:'✓ Enregistré',saving:'… Enregistrement',pending:'… Enregistrement',offline:'⚠ Hors ligne : modifications gardées sur cet appareil',cachefull:'⚠ Copie locale pleine : reste connecté au serveur'};
function showSync(s){
  var el=document.getElementById('syncstat');if(!el)return;
  var txt=t(SYNC_TXT[s]||'');
  el.className='sync noprint '+s;if(el.textContent!==txt)el.textContent=txt;
  if(s==='saved')migrateInline();
}
function typing(a){return !!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.closest&&a.closest('#app,#alert,#decobar'));}
/* Remplace les données par une version fusionnée / plus récente du serveur, sans casser ce que l'utilisateur est en train de faire. */
function adopt(nd,nbase,quiet){
  if(quiet&&(typing(document.activeElement)||pdrag||bdrag||drag))return false;
  Object.keys(data).forEach(function(k){delete data[k];});
  Object.keys(nd).forEach(function(k){data[k]=nd[k];});
  if(nbase)setBase(nbase);
  normalize();applyEdits();initFmt();applyTheme();
  if(typing(document.activeElement))state.pendingRender=true;else render();
  return true;
}
document.addEventListener('focusout',function(){if(state.pendingRender){state.pendingRender=false;setTimeout(render,600);}});

/* ---------- Sauvegardes, export, import ---------- */
function bakLabel(b){
  var tg={shrink:'avant une forte réduction','pre-restore':'avant une restauration','pre-migration':'avant migration'}[b.tag];
  return new Date(b.time).toLocaleString({fr:'fr-FR',en:'en-GB',es:'es-ES'}[data.prefs.lang]||'fr-FR')+(tg?' · '+t(tg):'');
}
function loadBackups(){
  PlannerSync.api('api/backups').then(function(r){return r.json();}).then(function(j){state.backups=j.backups||[];state.bakMsg=state.bakMsg||'';render();},function(){state.bakMsg=t('Serveur injoignable.');render();});
}
function backupSection(){
  var h=edHead('bak',t('Sauvegardes et export'),'',false);
  if(!edIsOpen('bak',false))return h;
  var L=state.backups||[];
  h+='<div class="edbody"><div class="edcard"><div class="form"><p class="hint wide">'+t("Chaque modification est enregistrée sur le serveur, avec des sauvegardes automatiques régulières. Rien n'est supprimé sans retour possible.")+'</p>'+
    '<div class="wide opt"><a class="btn ghost" href="api/export" download>'+t('Exporter (JSON)')+'</a><label class="btn ghost" for="imp-file">'+t('Importer un fichier…')+'</label><input id="imp-file" type="file" accept="application/json,.json" hidden></div>'+
    (state.bakMsg?'<p class="warn wide" role="status">'+esc(state.bakMsg)+'</p>':'')+
    '<div class="wide">'+(L.length?'<ul class="list">'+L.slice(0,40).map(function(b){return '<li class="row" style="grid-template-columns:minmax(0,1fr) auto"><div class="bd"><div class="tt">'+esc(bakLabel(b))+'</div><div class="mt">'+fmtSize(b.size)+'</div></div><button type="button" class="btn ghost" data-act="bak-restore" data-name="'+esc(b.name)+'">'+t('Restaurer')+'</button></li>';}).join('')+'</ul>':'<p class="hint">'+t('Aucune sauvegarde pour le moment.')+'</p>')+'</div></div></div></div>';
  return h;
}
function importData(txt){
  var obj;try{obj=JSON.parse(txt);}catch(e){obj=null;}
  var nd=obj&&obj.data&&typeof obj.data==='object'&&!Array.isArray(obj.data)?obj.data:obj;
  var nb=obj&&obj.base&&Array.isArray(obj.base.s)&&Array.isArray(obj.base.d)&&Array.isArray(obj.base.x)&&Array.isArray(obj.base.e)?obj.base:null;
  if(!nd||typeof nd!=='object'||Array.isArray(nd)){state.bakMsg=t('Fichier invalide.');render();return;}
  if(!window.confirm(t("Importer ce fichier ? Il est fusionné avec tes données actuelles : rien n'est supprimé, et une sauvegarde est faite automatiquement.")))return;
  var merged=Merge.merge3({},nd,cp(data));
  if(nb){
    PlannerSync.pushBase(nb,merged).then(function(){adopt(merged,nb);state.bakMsg=t('Import terminé.');loadBackups();},function(){state.bakMsg=t("L'import a échoué (données modifiées ailleurs ?). Réessaie.");render();});
  }else{
    adopt(merged);persist();state.bakMsg=t('Import terminé.');render();
  }
}
document.addEventListener('change',function(ev){
  var el=ev.target;
  if(el.id==='imp-file'&&el.files&&el.files[0]){
    var f=el.files[0],r=new FileReader();r.onload=function(){importData(String(r.result));};r.readAsText(f);el.value='';
  }
});
function render(){
  var sx=window.scrollX,sy=window.scrollY,appEl=document.getElementById('app');
  var pl=document.querySelector('.pane-list'),pls=pl?pl.scrollTop:0,fk=focusKey();
  appEl.style.minHeight=appEl.offsetHeight+'px';
  var h=nextBanner()+'<header class="top noprint"><div><div class="eyebrow">'+esc(appEyebrow())+'</div><h1>'+esc(appTitle())+'</h1><p>'+fLong.format(parse(today()))+'</p></div>'+themebar()+'</header>';
  if(data.prefs.pal==='perso'&&state.themePick)h+='<div class="panel noprint"><div class="opt"><span class="lbl">'+t('Couleur personnalisée')+'</span></div>'+picker('theme')+'</div>';
  if(state.sim)h+='<div class="simbar noprint">'+t('Date simulée : ')+fLong.format(parse(state.sim))+' <button data-act="simreset">'+t("Revenir à aujourd'hui")+'</button></div>';
  h+=summary();
  h+='<div class="tabs noprint" role="tablist"><button role="tab" data-act="tab" data-v="planning" aria-selected="'+(state.tab==='planning')+'">'+t('Planning')+'</button><button role="tab" data-act="tab" data-v="devoirs" aria-selected="'+(state.tab==='devoirs')+'">'+t('Devoirs')+'</button><button role="tab" data-act="tab" data-v="print" aria-selected="'+(state.tab==='print')+'">'+t('Imprimer')+'</button><button role="tab" data-act="tab" data-v="edit" aria-selected="'+(state.tab==='edit')+'">✎ '+t('Édition')+'</button></div>';
  h+=state.tab==='planning'?'<div class="noprint tabbody">'+planning()+'</div>':state.tab==='devoirs'?'<div class="noprint tabbody">'+devoirsTab()+'</div>':state.tab==='edit'?'<div class="noprint tabbody">'+editTab()+'</div>':printTab();
  h+='<details class="tools noprint"><summary>'+t('Tester avec une autre date')+'</summary><div><label for="simdate">'+t('Date simulée')+'</label><input type="date" id="simdate" value="'+esc(state.sim||'')+'"></div></details>';
  appEl.innerHTML=h;
  document.title=appTitle();
  showSync(PlannerSync.status());
  fit();
  renderAlert();
  renderBg();renderDecoBar();
  window.scrollTo(sx,sy);
  pl=document.querySelector('.pane-list');if(pl)pl.scrollTop=pls;
  if(fk){try{var fe=document.querySelector(fk);if(fe)fe.focus({preventScroll:true});}catch(e){}}
  appEl.style.minHeight='';
  window.scrollTo(sx,sy);
}
function helpHtml(){
  var n=state.pall?monthsList().filter(function(k){return !data.printOff[k];}).length:1;
  return '<div class="ov" role="dialog" aria-modal="true" aria-labelledby="ph-t"><div class="modal"><div class="mtop acc"><div class="eyebrow" id="ph-t">'+t('Imprimer')+'</div><div class="big sm">'+tf('{n} page(s) A4 paysage',{n:n})+'</div></div><div class="mbody"><ol class="steps"><li>'+t('Ordinateur : ')+'<span class="kbd">Ctrl</span> + <span class="kbd">P</span> (Windows) · <span class="kbd">Cmd</span> + <span class="kbd">P</span> (Mac)</li><li>'+t('Téléphone ou tablette : menu du navigateur, puis « Imprimer ».')+'</li><li>'+t('Réglages conseillés : A4, paysage, échelle 100 %, marges par défaut.')+'</li><li>'+t('Le fond reste blanc : seules quelques touches de couleur sont imprimées.')+'</li></ol><button class="btn" data-act="phclose" id="ph-close">'+t('Compris')+'</button></div></div></div>';
}
function stkPopHtml(){
  var emo=state.stkTab==='emo',pcol=state.stkTarget==='bg'?state.bnewc:state.newc;
  var h='<div class="ov" role="dialog" aria-modal="true" aria-labelledby="sp-t"><div class="modal wide"><div class="mtop acc"><div class="eyebrow" id="sp-t">'+t('Stickers')+'</div><div class="big sm">'+t(emo?'Choisis un emoji':'Choisis un sticker')+'</div></div><div class="mbody">';
  h+='<div class="seg" role="group"><button type="button" data-act="stktab" data-v="stk" aria-pressed="'+(!emo)+'">'+t('Stickers')+'</button><button type="button" data-act="stktab" data-v="emo" aria-pressed="'+emo+'">'+t('Emojis')+'</button></div>';
  if(emo){
    var ci=Math.min(state.emoCat||0,EMO.length-1);
    h+='<div class="chips">'+EMO.map(function(g,i){return '<button type="button" class="fchip" data-act="emocat" data-v="'+i+'" aria-pressed="'+(i===ci)+'">'+EMO_ICON[i]+' '+t(g[0])+'</button>';}).join('')+'</div>';
    h+='<div class="egrid">'+EMO[ci][1].split(' ').map(function(e){return '<button type="button" class="ebtn" data-act="sk-add" data-t="emoji:'+e+'" aria-label="'+esc(t('Ajouter : ')+e)+'">'+e+'</button>';}).join('')+'</div>';
  }else STK_GROUPS.forEach(function(g){
    h+='<section><h3 class="gh">'+t(g.n)+'</h3><div class="sgrid">'+g.ids.map(function(id){
      return '<button type="button" class="sbtn" data-act="sk-add" data-t="'+id+'" aria-label="'+esc(t('Ajouter : ')+t(stkName(id)))+'">'+stkSvg(id,pcol)+'<span>'+esc(t(stkName(id)))+'</span></button>';
    }).join('')+'</div></section>';
  });
  return h+'<button class="btn" data-act="stkclose" id="sp-close">'+t('Fermer')+'</button></div></div></div>';
}
var EMO_ICON=['😀','🧑','🐻','🍎','✈️','⚽','💡','❤️','🏁'];
function renderAlert(){
  var ov=document.querySelector('#alert .ov'),st=ov?ov.scrollTop:0,wy=window.scrollY;
  renderAlert0();
  var nv=document.querySelector('#alert .ov');if(nv&&ov)nv.scrollTop=st;
  if(window.scrollY!==wy)window.scrollTo(window.scrollX,wy);
}
function renderAlert0(){
  var box=document.getElementById('alert'),due=dueSoon();
  if(state.noteFor){
    var keep=document.getElementById('nt-text'),kv=keep?keep.value:'';
    box.innerHTML=noteHtml();
    var nt=document.getElementById('nt-text');if(nt&&kv)nt.value=kv;
    return;
  }
  if(state.stkPop){
    box.innerHTML=stkPopHtml();
    var sb=document.getElementById('sp-close');if(sb)sb.focus({preventScroll:true});
    return;
  }
  if(state.printHelp){
    box.innerHTML=helpHtml();
    var hb=document.getElementById('ph-close');if(hb)hb.focus({preventScroll:true});
    return;
  }
  if(!state.alertOpen||!due.length){state.alertOpen=state.alertOpen&&due.length>0;box.innerHTML='';return;}
  var td=today(),first=diff(due[0].date,td);
  var big=first===0?t("C'est aujourd'hui"):first===1?t('Demain'):tf('Dans {n} jours',{n:first});
  var h='<div class="ov" role="alertdialog" aria-modal="true" aria-labelledby="al-t"><div class="modal"><div class="mtop"><div class="eyebrow" id="al-t">'+t('Devoir à rendre')+'</div><div class="big">'+big+'</div></div><div class="mbody">';
  due.forEach(function(d){
    var n=diff(d.date,td);
    h+='<div class="mdev"><h3>'+esc(t(d.title))+'</h3><p>'+t('À déposer avant le ')+fLong.format(parse(d.date))+(n>first?' ('+rel(n)+')':'')+'</p>'+toggles(d,true)+'</div>';
  });
  h+='<button class="btn" data-act="alertclose" id="al-close">'+t("Compris, je m'en occupe")+'</button></div></div></div>';
  box.innerHTML=h;
  var b=document.getElementById('al-close');if(b&&!box.dataset.focused){b.focus({preventScroll:true});}
}

/* ---------- Apparence et impression ---------- */
function themebar(){
  return '<div class="themebar" role="group" aria-label="'+t('Apparence')+'"><div class="chips"><button type="button" class="fchip" data-act="pal" data-v="perso" aria-pressed="'+(!!state.themePick)+'"><i class="sd" style="background:'+data.prefs.custom+'"></i>'+t('Couleur')+'</button><button type="button" class="fchip" data-act="bgmode" aria-pressed="'+(!!state.deco)+'">🎀 '+t('Décorer')+'</button></div><div class="seg">'+[['auto','Auto'],['light','Clair'],['dark','Sombre']].map(function(m){
    return '<button type="button" data-act="mode" data-v="'+m[0]+'" aria-pressed="'+(data.prefs.mode===m[0])+'">'+t(m[1])+'</button>';
  }).join('')+'</div><div class="langs" role="group" aria-label="'+t('Langue')+'">'+['fr','en','es'].map(function(l){
    return '<button type="button" class="flag" data-act="lang" data-v="'+l+'" aria-pressed="'+(data.prefs.lang===l)+'" aria-label="'+LANGN[l]+'" title="'+LANGN[l]+'">'+FLAGS[l]+'</button>';
  }).join('')+'</div></div>';
}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function monthsList(){
  var min='9999-99',max='0000-00';
  buildEvents().forEach(function(e){var a=e.date.slice(0,7),b=lastDay(e).slice(0,7);if(a<min)min=a;if(b>max)max=b;});
  var p=min.split('-').map(Number),y=p[0],m=p[1],out=[];
  while((y+'-'+pad(m))<=max){out.push(y+'-'+pad(m));m++;if(m>12){m=1;y++;}}
  return out;
}
function pline(e){
  var sb=e.subject?subj(e.subject):null;
  if(e.kind==='devoir')return '<div class="pl dv"><b>'+t('À RENDRE')+'</b> '+esc(t(e.title))+'<div class="sb">'+SUBJECTS.map(function(s){return '<span><i class="pb">'+(data.rendu[e.devoir.id+':'+s.id]?'✓':'')+'</i>'+esc(s.ab)+'</span>';}).join('')+'</div></div>';
  if(e.kind==='exam')return '<div class="pl ex"><b>'+t('EXAMEN')+'</b> '+esc(t(e.title))+'</div>';
  if(e.kind==='dispo')return '<div class="pl av">'+t('Sujet dispo : ')+esc(t(e.title))+'</div>';
  return '<div class="pl"><i class="pb">'+(data.done[e.id]?'✓':'')+'</i><b>'+(sb?esc(sb.ab):'')+'</b> '+esc(evTitle(e))+(e.time?' '+e.time:'')+'</div>';
}
var PRINT_PALS={
  sobre:{n:'Sobre',m:'#555555',s:'#EEEEEE'},
  bleu:{n:'Bleu',m:'#2F6BC9',s:'#E3ECFA'},
  rose:{n:'Rose',m:'#CF3F78',s:'#FCE3EC'},
  orange:{n:'Orange',m:'#D86A1A',s:'#FDE9D9'}
};
var STK_COLORS={
  rose:{n:'Rose',m:'#D6457F',s:'#FBD9E6'},
  bleu:{n:'Bleu',m:'#3B73D1',s:'#D8E5FA'},
  orange:{n:'Orange',m:'#E0701F',s:'#FDE0C8'}
};
/* STICKERS-START */
var STICKERS=[
{id:'ours',n:'Ours',v:'<circle class="fs" cx="17" cy="20" r="7"/><circle class="fs" cx="47" cy="20" r="7"/><circle class="fm op" cx="17" cy="20" r="3"/><circle class="fm op" cx="47" cy="20" r="3"/><circle class="fs" cx="32" cy="36" r="18"/><ellipse class="w" cx="32" cy="42" rx="7.5" ry="5.5"/><ellipse class="k" cx="32" cy="39.6" rx="2.6" ry="1.8"/><circle class="k" cx="25" cy="32" r="1.9"/><circle class="k" cx="39" cy="32" r="1.9"/><path class="l thin" d="M32 41.4v2.2M32 43.6q-2.6 2.6-5 0M32 43.6q2.6 2.6 5 0"/><circle class="fm op" cx="20.5" cy="39" r="3"/><circle class="fm op" cx="43.5" cy="39" r="3"/>'},
{id:'chat',n:'Chat',v:'<path class="fs" d="M15 31L15 11L28 21Z"/><path class="fs" d="M49 31L49 11L36 21Z"/><path class="fm op" d="M18 25L18 17L24 21.5Z"/><path class="fm op" d="M46 25L46 17L40 21.5Z"/><ellipse class="fs" cx="32" cy="37" rx="19" ry="15.5"/><circle class="k" cx="25" cy="35" r="1.9"/><circle class="k" cx="39" cy="35" r="1.9"/><path class="fm" d="M30 40.5h4l-2 2.4z"/><path class="l thin" d="M32 42.9q-2.4 2.6-5 .2M32 42.9q2.4 2.6 5 .2"/><path class="l thin" d="M10 38h9M10 43l9-2M54 38h-9M54 43l-9-2"/><circle class="fm op" cx="20" cy="40" r="2.8"/><circle class="fm op" cx="44" cy="40" r="2.8"/>'},
{id:'coeur',n:'Cœur',v:'<path class="fs" d="M32 54C10 38 8 22 20 16c7-3 12 2 12 6 0-4 5-9 12-6 12 6 10 22-12 38z"/><circle class="k" cx="26" cy="28" r="1.7"/><circle class="k" cx="38" cy="28" r="1.7"/><path class="l thin" d="M29 33q3 3 6 0"/>'},
{id:'etoile',n:'Étoile',v:'<polygon class="fs" points="32,7 39,24 57,25 43,37 48,56 32,46 16,56 21,37 7,25 25,24"/><circle class="k" cx="27.5" cy="32" r="1.7"/><circle class="k" cx="36.5" cy="32" r="1.7"/><path class="l thin" d="M29 37q3 3 6 0"/>'},
{id:'livre',n:'Livre',v:'<path class="fs" d="M8 16Q20 11 32 17Q44 11 56 16V50Q44 45 32 51Q20 45 8 50Z"/><path class="l" d="M32 17V51"/><path class="l thin" d="M14 24q7-2 14 1M14 31q7-2 14 1M14 38q7-2 14 1M50 24q-7-2-14 1M50 31q-7-2-14 1"/>'},
{id:'cafe',n:'Café',v:'<path class="l thin" d="M22 20q-3-4 0-8M30 20q-3-4 0-8M38 20q-3-4 0-8"/><path class="fs" d="M14 26H44V40Q44 52 29 52Q14 52 14 40Z"/><path class="l" d="M44 30H49Q55 30 55 36Q55 42 48 42H44"/><path class="l" d="M10 56H48"/><circle class="k" cx="24" cy="38" r="1.6"/><circle class="k" cx="34" cy="38" r="1.6"/><path class="l thin" d="M26 42q3 2.5 6 0"/>'},
{id:'fleur',n:'Fleur',v:'<path class="l" d="M32 36V59"/><path class="fs" d="M32 52Q43 45 49 49Q42 58 32 52Z"/><circle class="fs" cx="32" cy="15" r="8"/><circle class="fs" cx="44.4" cy="24" r="8"/><circle class="fs" cx="39.7" cy="38.8" r="8"/><circle class="fs" cx="24.3" cy="38.8" r="8"/><circle class="fs" cx="19.6" cy="24" r="8"/><circle class="fm" cx="32" cy="28" r="6.5"/>'},
{id:'nuage',n:'Nuage',v:'<path class="fs" d="M18 46Q8 46 8 37Q8 29 17 28Q19 16 31 16Q42 16 44 26Q56 26 56 37Q56 46 46 46Z"/><circle class="k" cx="26" cy="35" r="1.7"/><circle class="k" cx="38" cy="35" r="1.7"/><path class="l thin" d="M29 39q3 3 6 0"/><circle class="fm op" cx="21" cy="39" r="2.8"/><circle class="fm op" cx="43" cy="39" r="2.8"/>'},
{id:'idee',n:'Idée',v:'<path class="l thin" d="M32 5V9M13 13l3 3M51 13l-3 3M5 30h4M59 30h-4"/><circle class="fs" cx="32" cy="28" r="14"/><path class="w" d="M26 42h12v8a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3z"/><path class="l thin" d="M27 28q2.5 4 5 0t5 0"/><path class="l thin" d="M28 46h8"/>'},
{id:'crayon',n:'Crayon',v:'<g transform="rotate(45 32 32)"><rect class="fs" x="25" y="7" width="14" height="34" rx="2"/><rect class="fm op" x="25" y="7" width="14" height="6" rx="2"/><path class="l thin" d="M25 15h14"/><path class="w" d="M25 41h14l-7 14z"/><path class="fm" d="M29.5 50.5h5L32 55z"/></g>'},
{id:'lune',n:'Lune',v:'<path class="fs" d="M38 7A26 26 0 1 0 57 44A21 21 0 0 1 38 7Z"/><path class="l thin" d="M22 33q2.5 2.5 5 0M22 43q2.5 2.5 5 0"/><path class="l thin" d="M24 49q3 3 6 0"/><circle class="fm op" cx="20" cy="40" r="2.6"/><path class="fm" d="M48 12l1.6 3.6 3.6 1.6-3.6 1.6L48 22.4l-1.6-3.6-3.6-1.6 3.6-1.6z"/>'},
{id:'soleil',n:'Soleil',v:'<path class="l" d="M32 5v7M32 52v7M5 32h7M52 32h7M13 13l5 5M46 46l5 5M51 13l-5 5M18 46l-5 5"/><circle class="fs" cx="32" cy="32" r="14"/><circle class="k" cx="27" cy="30" r="1.8"/><circle class="k" cx="37" cy="30" r="1.8"/><path class="l thin" d="M28 36q4 3.5 8 0"/><circle class="fm op" cx="23.5" cy="35" r="2.6"/><circle class="fm op" cx="40.5" cy="35" r="2.6"/>'},
{id:'arc',n:'Arc-en-ciel',v:'<path class="fs" d="M6 46A26 26 0 0 1 58 46H48A16 16 0 0 0 16 46Z"/><path class="l thin" d="M11 46A21 21 0 0 1 53 46"/><circle class="w" cx="11" cy="47" r="6"/><circle class="w" cx="53" cy="47" r="6"/><circle class="w" cx="17" cy="50" r="5"/><circle class="w" cx="47" cy="50" r="5"/>'},
{id:'papillon',n:'Papillon',v:'<path class="fs" d="M32 30C24 8 5 11 8 26C9 34 22 36 32 32Z"/><path class="fs" d="M32 30C40 8 59 11 56 26C55 34 42 36 32 32Z"/><path class="fs" d="M32 34C22 36 11 41 16 51C20 57 30 49 32 40Z"/><path class="fs" d="M32 34C42 36 53 41 48 51C44 57 34 49 32 40Z"/><circle class="fm op" cx="17" cy="23" r="4"/><circle class="fm op" cx="47" cy="23" r="4"/><ellipse class="fm" cx="32" cy="35" rx="2.4" ry="12"/><path class="l thin" d="M32 24Q29 15 24 12M32 24Q35 15 40 12"/>'},
{id:'lapin',n:'Lapin',v:'<ellipse class="fs" cx="23" cy="17" rx="6" ry="14"/><ellipse class="fs" cx="41" cy="17" rx="6" ry="14"/><ellipse class="fm op" cx="23" cy="18" rx="2.6" ry="9"/><ellipse class="fm op" cx="41" cy="18" rx="2.6" ry="9"/><circle class="fs" cx="32" cy="42" r="17"/><circle class="k" cx="25.5" cy="40" r="1.9"/><circle class="k" cx="38.5" cy="40" r="1.9"/><path class="fm" d="M30 45h4l-2 2.4z"/><path class="l thin" d="M32 47.4q-2.4 2.6-5 .2M32 47.4q2.4 2.6 5 .2"/><circle class="fm op" cx="21" cy="46" r="2.8"/><circle class="fm op" cx="43" cy="46" r="2.8"/>'},
{id:'poussin',n:'Poussin',v:'<path class="l" d="M32 17Q31 9 25 7M32 17Q34 9 40 8"/><circle class="fs" cx="32" cy="36" r="20"/><path class="l thin" d="M12 38q-5 6 0 12M52 38q5 6 0 12"/><path class="l" d="M26 56v5M38 56v5"/><circle class="k" cx="25" cy="32" r="1.9"/><circle class="k" cx="39" cy="32" r="1.9"/><path class="fm" d="M27 37h10l-5 7z"/><circle class="fm op" cx="19" cy="40" r="3"/><circle class="fm op" cx="45" cy="40" r="3"/>'},
{id:'grenouille',n:'Grenouille',v:'<circle class="fs" cx="19" cy="23" r="9"/><circle class="fs" cx="45" cy="23" r="9"/><ellipse class="fs" cx="32" cy="41" rx="25" ry="17"/><circle class="w" cx="19" cy="23" r="5"/><circle class="w" cx="45" cy="23" r="5"/><circle class="k" cx="20" cy="24" r="2.4"/><circle class="k" cx="44" cy="24" r="2.4"/><path class="l thin" d="M17 44Q32 56 47 44"/><circle class="fm op" cx="14" cy="42" r="3"/><circle class="fm op" cx="50" cy="42" r="3"/><circle class="fm" cx="29" cy="36" r="1"/><circle class="fm" cx="35" cy="36" r="1"/>'},
{id:'panda',n:'Panda',v:'<circle class="fm" cx="15" cy="18" r="8"/><circle class="fm" cx="49" cy="18" r="8"/><circle class="fs" cx="32" cy="37" r="21"/><ellipse class="fm" cx="23" cy="34" rx="5.5" ry="7" transform="rotate(20 23 34)"/><ellipse class="fm" cx="41" cy="34" rx="5.5" ry="7" transform="rotate(-20 41 34)"/><circle class="w" cx="24" cy="33" r="1.8"/><circle class="w" cx="40" cy="33" r="1.8"/><ellipse class="k" cx="32" cy="43" rx="3" ry="2.2"/><path class="l thin" d="M32 45v2M32 47q-3 3-6 0M32 47q3 3 6 0"/>'},
{id:'renard',n:'Renard',v:'<path class="fs" d="M8 8L25 22H39L56 8L60 36Q60 54 32 59Q4 54 4 36Z"/><path class="fm op" d="M12 15L21 22L14 27Z"/><path class="fm op" d="M52 15L43 22L50 27Z"/><path class="w" d="M13 40Q32 35 51 40Q45 57 32 58Q19 57 13 40Z"/><circle class="k" cx="22" cy="34" r="1.9"/><circle class="k" cx="42" cy="34" r="1.9"/><ellipse class="k" cx="32" cy="50" rx="3.4" ry="2.4"/><path class="l thin" d="M32 52.4v2M32 54.4q-3 2.4-6 0M32 54.4q3 2.4 6 0"/>'},
{id:'cupcake',n:'Cupcake',v:'<path class="w" d="M15 34L19 57H45L49 34Z"/><path class="l thin" d="M25 37L26.500 55M32 37V55M39 37L37.500 55"/><path class="fs" d="M11 35Q8 24 19 22Q19 11 32 11Q45 11 45 22Q56 24 53 35Z"/><circle class="fm" cx="32" cy="7" r="4"/><circle class="k" cx="26" cy="27" r="1.7"/><circle class="k" cx="38" cy="27" r="1.7"/><path class="l thin" d="M29 31q3 3 6 0"/>'},
{id:'cerises',n:'Cerises',v:'<path class="l" d="M19 38Q20 20 34 9M43 38Q41 22 34 9"/><path class="fs" d="M34 9Q46 3 55 11Q44 18 34 9Z"/><circle class="fs" cx="19" cy="47" r="10"/><circle class="fs" cx="43" cy="47" r="10"/><circle class="k" cx="16" cy="46" r="1.6"/><circle class="k" cx="22" cy="46" r="1.6"/><path class="l thin" d="M17 50q2 2 4 0"/><circle class="k" cx="40" cy="46" r="1.6"/><circle class="k" cx="46" cy="46" r="1.6"/><path class="l thin" d="M41 50q2 2 4 0"/>'},
{id:'theiere',n:'Théière',v:'<path class="l thin" d="M24 12q-3-4 0-7M32 12q-3-4 0-7"/><path class="l" d="M13 32Q2 33 6 44Q9 49 15 46"/><path class="fs" d="M46 33Q57 32 59 20Q52 24 46 27Z"/><ellipse class="fs" cx="30" cy="40" rx="19" ry="15"/><path class="fs" d="M20 26Q30 16 40 26Z"/><circle class="fm" cx="30" cy="17" r="3"/><circle class="k" cx="24" cy="39" r="1.8"/><circle class="k" cx="36" cy="39" r="1.8"/><path class="l thin" d="M26 44q4 3 8 0"/><path class="l" d="M16 57H44"/>'},
{id:'ordi',n:'Ordinateur',v:'<rect class="fs" x="10" y="8" width="44" height="33" rx="4"/><rect class="w" x="15" y="13" width="34" height="23" rx="2"/><path class="fs" d="M4 43H60L56 53Q55 56 52 56H12Q9 56 8 53Z"/><path class="l thin" d="M26 49H38"/><circle class="k" cx="27" cy="22" r="1.8"/><circle class="k" cx="37" cy="22" r="1.8"/><path class="l thin" d="M28 28q4 3.500 8 0"/>'},
{id:'reveil',n:'Réveil',v:'<circle class="fm" cx="14" cy="15" r="7"/><circle class="fm" cx="50" cy="15" r="7"/><path class="l" d="M18 54L13 60M46 54L51 60"/><circle class="fs" cx="32" cy="35" r="21"/><circle class="w" cx="32" cy="35" r="15.500"/><path class="l" d="M32 35V24M32 35L40 39"/><circle class="fm" cx="32" cy="35" r="1.800"/><path class="l thin" d="M32 21.500v2M32 46.500v2M18.500 35h2M43.500 35h2"/>'},
{id:'trophee',n:'Trophée',v:'<path class="l" d="M17 14H9Q8 29 20 31M47 14H55Q56 29 44 31"/><path class="fs" d="M17 8H47V26Q47 41 32 41Q17 41 17 26Z"/><path class="fs" d="M28 41H36V49H28Z"/><rect class="fs" x="19" y="49" width="26" height="9" rx="2.500"/><circle class="k" cx="27" cy="22" r="1.800"/><circle class="k" cx="37" cy="22" r="1.800"/><path class="l thin" d="M28 28q4 3.500 8 0"/>'},
{id:'cactus',n:'Cactus',v:'<path class="fs" d="M21 47H43L40 61H24Z"/><path class="fs" d="M25 36H19Q15 36 15 32V25Q15 22 18 22Q21 22 21 25V30H25Z"/><path class="fs" d="M39 31H45Q49 31 49 27V19Q49 16 46 16Q43 16 43 19V25H39Z"/><rect class="fs" x="24" y="12" width="16" height="38" rx="8"/><circle class="fm" cx="32" cy="10" r="3.500"/><circle class="k" cx="29" cy="30" r="1.700"/><circle class="k" cx="35" cy="30" r="1.700"/><path class="l thin" d="M29.500 35q2.500 2.500 5 0"/><path class="l thin" d="M32 18v3M28 40v2M36 40v2"/>'},
{id:'parapluie',n:'Parapluie',v:'<path class="l" d="M32 10V5"/><path class="fs" d="M5 35Q5 10 32 10Q59 10 59 35Q52 29 45.500 35Q39 29 32 35Q25 29 18.500 35Q12 29 5 35Z"/><path class="l" d="M32 35V53Q32 59 26 59"/><path class="l thin" d="M32 10Q20 18 18.500 35M32 10Q44 18 45.500 35"/>'},
{id:'fusee',n:'Fusée',v:'<path class="fm op" d="M25 46Q32 64 39 46Z"/><path class="fm" d="M20 30L9 46L20 42ZM44 30L55 46L44 42Z"/><path class="fs" d="M32 5Q47 18 45 46H19Q17 18 32 5Z"/><circle class="w" cx="32" cy="26" r="6"/><path class="l thin" d="M20 38H44"/><circle class="k" cx="32" cy="26" r="1.800"/>'},
{id:'diplome',n:'Diplôme',v:'<rect class="fs" x="12" y="14" width="40" height="28" rx="2"/><ellipse class="fs" cx="12" cy="28" rx="5" ry="14.500"/><ellipse class="fs" cx="52" cy="28" rx="5" ry="14.500"/><path class="l thin" d="M20 22H44M20 28H44M24 34H40"/><path class="fm" d="M29 46L26 59L32 55L38 59L35 46Z"/><circle class="fm" cx="32" cy="43" r="6"/><circle class="w" cx="32" cy="43" r="2.200"/>'},
{id:'musique',n:'Musique',v:'<path class="fs" d="M22 14L50 8V20L22 26Z"/><path class="l" d="M22 14V48M50 8V44"/><ellipse class="fm" cx="16" cy="49" rx="7.500" ry="5.500" transform="rotate(-20 16 49)"/><ellipse class="fm" cx="44" cy="45" rx="7.500" ry="5.500" transform="rotate(-20 44 45)"/>'},
{id:'hibou',n:'Hibou',v:'<path class="fs" d="M13 22L11 7L25 15Z"/><path class="fs" d="M51 22L53 7L39 15Z"/><ellipse class="fs" cx="32" cy="37" rx="20" ry="22"/><ellipse class="fm op" cx="32" cy="48" rx="10" ry="8"/><circle class="w" cx="23" cy="30" r="8"/><circle class="w" cx="41" cy="30" r="8"/><circle class="k" cx="24" cy="31" r="3"/><circle class="k" cx="40" cy="31" r="3"/><path class="fm" d="M29 37h6l-3 6z"/><path class="l thin" d="M14 42q-3 7 1 13M50 42q3 7-1 13"/>'},
{id:'tortue',n:'Tortue',v:'<rect class="fs" x="13" y="44" width="9" height="10" rx="4"/><rect class="fs" x="34" y="44" width="9" height="10" rx="4"/><path class="l" d="M7 42L2 45"/><circle class="fs" cx="54" cy="38" r="7"/><path class="fs" d="M6 46Q6 17 28 17Q50 17 50 46Z"/><path class="l thin" d="M28 18V45M16 27L19 45M40 27L37 45M9 36H47"/><circle class="k" cx="56" cy="36" r="1.7"/><path class="l thin" d="M52 42q3 2 6 0"/>'},
{id:'poisson',n:'Poisson',v:'<path class="fs" d="M46 32L60 19V45Z"/><ellipse class="fs" cx="28" cy="32" rx="21" ry="14"/><path class="fm op" d="M24 19Q31 10 38 20Z"/><path class="l thin" d="M27 25q4 7 0 14M35 25q4 7 0 14"/><circle class="k" cx="16" cy="29" r="2"/><path class="l thin" d="M8 35q3 2.500 6 0"/><circle class="w" cx="7" cy="19" r="3"/><circle class="w" cx="13" cy="11" r="2"/>'},
{id:'abeille',n:'Abeille',v:'<ellipse class="w" cx="17" cy="25" rx="6.500" ry="10" transform="rotate(-30 17 25)"/><ellipse class="w" cx="47" cy="25" rx="6.500" ry="10" transform="rotate(30 47 25)"/><circle class="fs" cx="32" cy="38" r="18"/><path class="l" style="stroke-width:5" d="M17 42H47M22 51H42"/><path class="l thin" d="M26 22Q24 14 19 12M38 22Q40 14 45 12"/><circle class="k" cx="26" cy="32" r="1.900"/><circle class="k" cx="38" cy="32" r="1.900"/><path class="l thin" d="M29 36q3 3 6 0"/>'},
{id:'coccinelle',n:'Coccinelle',v:'<path class="l thin" d="M27 13Q24 6 19 6M37 13Q40 6 45 6"/><ellipse class="fm" cx="32" cy="18" rx="11" ry="8"/><circle class="fs" cx="32" cy="38" r="20"/><path class="l" d="M32 20V58"/><circle class="fm" cx="21" cy="34" r="4.500"/><circle class="fm" cx="43" cy="34" r="4.500"/><circle class="fm" cx="23" cy="47" r="3.500"/><circle class="fm" cx="41" cy="47" r="3.500"/><circle class="w" cx="28" cy="17" r="2.200"/><circle class="w" cx="36" cy="17" r="2.200"/>'},
{id:'escargot',n:'Escargot',v:'<rect class="fs" x="46" y="22" width="11" height="32" rx="5.500"/><rect class="fs" x="5" y="44" width="52" height="12" rx="6"/><path class="l" d="M49 23L47 13M55 23L57 13"/><circle class="fm" cx="47" cy="12" r="2.600"/><circle class="fm" cx="57" cy="12" r="2.600"/><circle class="fs" cx="26" cy="35" r="18"/><path class="l thin" d="M26 35a4 4 0 1 1 4 4a8 8 0 1 1-8-8a12 12 0 0 1 12 12"/><circle class="k" cx="52" cy="31" r="1.600"/><path class="l thin" d="M49 38q2.500 2.500 5 0"/>'},
{id:'pingouin',n:'Pingouin',v:'<ellipse class="fm" cx="32" cy="36" rx="19" ry="24"/><ellipse class="fm" cx="12" cy="40" rx="4.500" ry="11" transform="rotate(15 12 40)"/><ellipse class="fm" cx="52" cy="40" rx="4.500" ry="11" transform="rotate(-15 52 40)"/><ellipse class="w" cx="32" cy="42" rx="12.500" ry="17"/><circle class="w" cx="26" cy="25" r="3.600"/><circle class="w" cx="38" cy="25" r="3.600"/><circle class="k" cx="26" cy="25.500" r="1.600"/><circle class="k" cx="38" cy="25.500" r="1.600"/><path class="fs" d="M28 30h8l-4 6z"/><ellipse class="fs" cx="25" cy="60" rx="6.500" ry="2.600"/><ellipse class="fs" cx="39" cy="60" rx="6.500" ry="2.600"/>'},
{id:'elephant',n:'Éléphant',v:'<circle class="fs" cx="11" cy="30" r="11"/><circle class="fs" cx="53" cy="30" r="11"/><circle class="fm op" cx="11" cy="30" r="6"/><circle class="fm op" cx="53" cy="30" r="6"/><circle class="fs" cx="32" cy="30" r="18"/><path class="fs" d="M27 38V53Q27 60 34 60Q40 60 40 54V50Q40 47 37.500 47Q35 47 35 50V52Q35 54 33.500 54Q32 54 32 52V38Z"/><circle class="k" cx="25" cy="27" r="1.900"/><circle class="k" cx="39" cy="27" r="1.900"/>'},
{id:'chien',n:'Chien',v:'<circle class="fs" cx="32" cy="34" r="18"/><ellipse class="fm" cx="13" cy="31" rx="7" ry="13" transform="rotate(15 13 31)"/><ellipse class="fm" cx="51" cy="31" rx="7" ry="13" transform="rotate(-15 51 31)"/><ellipse class="w" cx="32" cy="43" rx="10" ry="8"/><ellipse class="k" cx="32" cy="39.500" rx="3.600" ry="2.600"/><circle class="k" cx="24" cy="30" r="2"/><circle class="k" cx="40" cy="30" r="2"/><path class="l thin" d="M32 42v3M32 45q-3 3-6 0M32 45q3 3 6 0"/><path class="fm" d="M30 47h4v4q-2 2-4 0z"/>'},
{id:'arbre',n:'Arbre',v:'<rect class="fs" x="28" y="40" width="8" height="20" rx="2"/><path class="fs" d="M32 5Q46 5 46 19Q58 21 56 36Q54 49 40 47H24Q8 49 8 34Q8 21 18 19Q18 5 32 5Z"/><circle class="k" cx="26" cy="30" r="1.800"/><circle class="k" cx="38" cy="30" r="1.800"/><path class="l thin" d="M28 36q4 3.500 8 0"/>'},
{id:'champignon',n:'Champignon',v:'<path class="w" d="M23 36H41V52Q41 59 32 59Q23 59 23 52Z"/><path class="fs" d="M5 37Q5 9 32 9Q59 9 59 37Z"/><circle class="w" cx="19" cy="26" r="5"/><circle class="w" cx="36" cy="19" r="4"/><circle class="w" cx="48" cy="30" r="4"/><circle class="k" cx="28" cy="46" r="1.700"/><circle class="k" cx="36" cy="46" r="1.700"/><path class="l thin" d="M29 51q3 2.500 6 0"/>'},
{id:'loupe',n:'Loupe',v:'<path class="l" style="stroke-width:6" d="M41 41L57 57"/><circle class="fs" cx="27" cy="27" r="19"/><circle class="w" cx="27" cy="27" r="13"/><path class="l thin" d="M19 22q2-5 8-6"/><circle class="k" cx="23" cy="28" r="1.800"/><circle class="k" cx="31" cy="28" r="1.800"/><path class="l thin" d="M24 33q3 2.500 6 0"/>'},
{id:'calculette',n:'Calculatrice',v:'<rect class="fs" x="12" y="5" width="40" height="54" rx="5"/><rect class="w" x="17" y="10" width="30" height="13" rx="2"/><path class="l thin" d="M26 17h15"/><circle class="fm" cx="22" cy="33" r="3.200"/><circle class="fm" cx="32" cy="33" r="3.200"/><circle class="fm" cx="42" cy="33" r="3.200"/><circle class="fm" cx="22" cy="43" r="3.200"/><circle class="fm" cx="32" cy="43" r="3.200"/><circle class="fm" cx="42" cy="43" r="3.200"/><circle class="fm" cx="22" cy="53" r="3.200"/><circle class="fm" cx="32" cy="53" r="3.200"/><circle class="fm" cx="42" cy="53" r="3.200"/>'},
{id:'sac',n:'Sac à dos',v:'<path class="l" d="M25 13Q25 5 32 5Q39 5 39 13"/><path class="fs" d="M13 24Q13 12 32 12Q51 12 51 24V54Q51 59 46 59H18Q13 59 13 54Z"/><path class="l thin" d="M13 31Q32 38 51 31"/><rect class="w" x="19" y="40" width="26" height="14" rx="3"/><path class="l thin" d="M32 40V54"/><circle class="k" cx="26" cy="23" r="1.700"/><circle class="k" cx="38" cy="23" r="1.700"/><path class="l thin" d="M29 27q3 2.500 6 0"/>'},
{id:'postit',n:'Post-it',v:'<path class="fs" d="M9 9H55V41L41 55H9Z"/><path class="w" d="M41 55V41H55Z"/><path class="l" d="M19 29L28 38L44 20"/>'},
{id:'glace',n:'Glace',v:'<path class="w" d="M17 31L32 61L47 31Z"/><path class="l thin" d="M23 37L33 52M41 37L31 52M28 33L35 47"/><path class="fs" d="M14 33Q8 18 22 14Q26 5 38 9Q52 11 50 33Z"/><circle class="fm" cx="38" cy="7" r="3.500"/><circle class="k" cx="26" cy="24" r="1.800"/><circle class="k" cx="38" cy="24" r="1.800"/><path class="l thin" d="M29 28q3 3 6 0"/>'},
{id:'donut',n:'Donut',v:'<circle class="fs" cx="32" cy="32" r="25"/><circle class="w" cx="32" cy="32" r="8"/><path class="l thin" d="M20 20l4 2M42 18l-3 4M15 35l4-2M46 41l-4-3M30 12l1 4M34 51l3-4M48 28l-4 1M22 46l3-3"/>'},
{id:'fraise',n:'Fraise',v:'<path class="fs" d="M32 59Q8 45 10 25Q12 15 32 17Q52 15 54 25Q56 45 32 59Z"/><path class="fm" d="M19 19Q26 8 32 14Q38 8 45 19Q32 23 19 19Z"/><path class="l" d="M32 14V6"/><ellipse class="fm" cx="22" cy="30" rx="1.500" ry="2.200"/><ellipse class="fm" cx="42" cy="30" rx="1.500" ry="2.200"/><ellipse class="fm" cx="32" cy="27" rx="1.500" ry="2.200"/><ellipse class="fm" cx="26" cy="41" rx="1.500" ry="2.200"/><ellipse class="fm" cx="38" cy="41" rx="1.500" ry="2.200"/><ellipse class="fm" cx="32" cy="50" rx="1.500" ry="2.200"/>'},
{id:'pomme',n:'Pomme',v:'<path class="fs" d="M32 19Q50 8 54 28Q56 52 40 58Q35 60 32 58Q29 60 24 58Q8 52 10 28Q14 8 32 19Z"/><path class="l" d="M32 19Q32 11 36 6"/><path class="fm" d="M37 13Q45 4 53 10Q45 18 37 13Z"/><circle class="k" cx="25" cy="37" r="1.800"/><circle class="k" cx="39" cy="37" r="1.800"/><path class="l thin" d="M28 43q4 3 8 0"/><circle class="fm op" cx="20" cy="42" r="3"/><circle class="fm op" cx="44" cy="42" r="3"/>'},
{id:'cadeau',n:'Cadeau',v:'<path class="fs" d="M32 22Q18 6 14 14Q11 23 32 22ZM32 22Q46 6 50 14Q53 23 32 22Z"/><rect class="fs" x="10" y="30" width="44" height="28" rx="3"/><rect class="fs" x="7" y="22" width="50" height="11" rx="3"/><rect class="fm" x="28" y="22" width="8" height="36"/>'}
];
/* STICKERS-END */
var EMO=[["Smileys et émotions","😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 🫠 😉 😊 😇 🥰 😍 🤩 😘 😗 ☺️ 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🫣 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 🫥 😶‍🌫️ 😏 😒 🙄 😬 😮‍💨 🤥 🫨 🙂‍↔️ 🙂‍↕️ 😌 😔 😪 🤤 😴 🫩 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 😵‍💫 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 🫤 😟 🙁 ☹️ 😮 😯 😲 😳 🫪 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 👾 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊 💌 💘 💝 💖 💗 💓 💞 💕 💟 ❣️ 💔 ❤️‍🔥 ❤️‍🩹 ❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🤎 🖤 🩶 🤍 💋 💯 💢 🫯 💥 💫 💦 💨 🕳️ 💬 👁️‍🗨️ 🗨️ 🗯️ 💭 💤"],["Personnes","👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 🫷 🫸 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 🫵 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦 👶 🧒 👦 👧 🧑 👱 👨 🧔 🧔‍♂️ 🧔‍♀️ 👨‍🦰 👨‍🦱 👨‍🦳 👨‍🦲 👩 👩‍🦰 🧑‍🦰 👩‍🦱 🧑‍🦱 👩‍🦳 🧑‍🦳 👩‍🦲 🧑‍🦲 👱‍♀️ 👱‍♂️ 🧓 👴 👵 🙍 🙍‍♂️ 🙍‍♀️ 🙎 🙎‍♂️ 🙎‍♀️ 🙅 🙅‍♂️ 🙅‍♀️ 🙆 🙆‍♂️ 🙆‍♀️ 💁 💁‍♂️ 💁‍♀️ 🙋 🙋‍♂️ 🙋‍♀️ 🧏 🧏‍♂️ 🧏‍♀️ 🙇 🙇‍♂️ 🙇‍♀️ 🤦 🤦‍♂️ 🤦‍♀️ 🤷 🤷‍♂️ 🤷‍♀️ 🧑‍⚕️ 👨‍⚕️ 👩‍⚕️ 🧑‍🎓 👨‍🎓 👩‍🎓 🧑‍🏫 👨‍🏫 👩‍🏫 🧑‍⚖️ 👨‍⚖️ 👩‍⚖️ 🧑‍🌾 👨‍🌾 👩‍🌾 🧑‍🍳 👨‍🍳 👩‍🍳 🧑‍🔧 👨‍🔧 👩‍🔧 🧑‍🏭 👨‍🏭 👩‍🏭 🧑‍💼 👨‍💼 👩‍💼 🧑‍🔬 👨‍🔬 👩‍🔬 🧑‍💻 👨‍💻 👩‍💻 🧑‍🎤 👨‍🎤 👩‍🎤 🧑‍🎨 👨‍🎨 👩‍🎨 🧑‍✈️ 👨‍✈️ 👩‍✈️ 🧑‍🚀 👨‍🚀 👩‍🚀 🧑‍🚒 👨‍🚒 👩‍🚒 👮 👮‍♂️ 👮‍♀️ 🕵️ 🕵️‍♂️ 🕵️‍♀️ 💂 💂‍♂️ 💂‍♀️ 🥷 👷 👷‍♂️ 👷‍♀️ 🫅 🤴 👸 👳 👳‍♂️ 👳‍♀️ 👲 🧕 🤵 🤵‍♂️ 🤵‍♀️ 👰 👰‍♂️ 👰‍♀️ 🤰 🫃 🫄 🤱 👩‍🍼 👨‍🍼 🧑‍🍼 👼 🎅 🤶 🧑‍🎄 🦸 🦸‍♂️ 🦸‍♀️ 🦹 🦹‍♂️ 🦹‍♀️ 🧙 🧙‍♂️ 🧙‍♀️ 🧚 🧚‍♂️ 🧚‍♀️ 🧛 🧛‍♂️ 🧛‍♀️ 🧜 🧜‍♂️ 🧜‍♀️ 🧝 🧝‍♂️ 🧝‍♀️ 🧞 🧞‍♂️ 🧞‍♀️ 🧟 🧟‍♂️ 🧟‍♀️ 🧌 🫈 💆 💆‍♂️ 💆‍♀️ 💇 💇‍♂️ 💇‍♀️ 🚶 🚶‍♂️ 🚶‍♀️ 🚶‍➡️ 🚶‍♀️‍➡️ 🚶‍♂️‍➡️ 🧍 🧍‍♂️ 🧍‍♀️ 🧎 🧎‍♂️ 🧎‍♀️ 🧎‍➡️ 🧎‍♀️‍➡️ 🧎‍♂️‍➡️ 🧑‍🦯 🧑‍🦯‍➡️ 👨‍🦯 👨‍🦯‍➡️ 👩‍🦯 👩‍🦯‍➡️ 🧑‍🦼 🧑‍🦼‍➡️ 👨‍🦼 👨‍🦼‍➡️ 👩‍🦼 👩‍🦼‍➡️ 🧑‍🦽 🧑‍🦽‍➡️ 👨‍🦽 👨‍🦽‍➡️ 👩‍🦽 👩‍🦽‍➡️ 🏃 🏃‍♂️ 🏃‍♀️ 🏃‍➡️ 🏃‍♀️‍➡️ 🏃‍♂️‍➡️ 🧑‍🩰 💃 🕺 🕴️ 👯 👯‍♂️ 👯‍♀️ 🧖 🧖‍♂️ 🧖‍♀️ 🧗 🧗‍♂️ 🧗‍♀️ 🤺 🏇 ⛷️ 🏂 🏌️ 🏌️‍♂️ 🏌️‍♀️ 🏄 🏄‍♂️ 🏄‍♀️ 🚣 🚣‍♂️ 🚣‍♀️ 🏊 🏊‍♂️ 🏊‍♀️ ⛹️ ⛹️‍♂️ ⛹️‍♀️ 🏋️ 🏋️‍♂️ 🏋️‍♀️ 🚴 🚴‍♂️ 🚴‍♀️ 🚵 🚵‍♂️ 🚵‍♀️ 🤸 🤸‍♂️ 🤸‍♀️ 🤼 🤼‍♂️ 🤼‍♀️ 🤽 🤽‍♂️ 🤽‍♀️ 🤾 🤾‍♂️ 🤾‍♀️ 🤹 🤹‍♂️ 🤹‍♀️ 🧘 🧘‍♂️ 🧘‍♀️ 🛀 🛌 🧑‍🤝‍🧑 👭 👫 👬 💏 👩‍❤️‍💋‍👨 👨‍❤️‍💋‍👨 👩‍❤️‍💋‍👩 💑 👩‍❤️‍👨 👨‍❤️‍👨 👩‍❤️‍👩 👨‍👩‍👦 👨‍👩‍👧 👨‍👩‍👧‍👦 👨‍👩‍👦‍👦 👨‍👩‍👧‍👧 👨‍👨‍👦 👨‍👨‍👧 👨‍👨‍👧‍👦 👨‍👨‍👦‍👦 👨‍👨‍👧‍👧 👩‍👩‍👦 👩‍👩‍👧 👩‍👩‍👧‍👦 👩‍👩‍👦‍👦 👩‍👩‍👧‍👧 👨‍👦 👨‍👦‍👦 👨‍👧 👨‍👧‍👦 👨‍👧‍👧 👩‍👦 👩‍👦‍👦 👩‍👧 👩‍👧‍👦 👩‍👧‍👧 🗣️ 👤 👥 🫂 👪 🧑‍🧑‍🧒 🧑‍🧑‍🧒‍🧒 🧑‍🧒 🧑‍🧒‍🧒 👣 🫆"],["Animaux et nature","🐵 🐒 🦍 🦧 🐶 🐕 🦮 🐕‍🦺 🐩 🐺 🦊 🦝 🐱 🐈 🐈‍⬛ 🦁 🐯 🐅 🐆 🐴 🫎 🫏 🐎 🦄 🦓 🦌 🦬 🐮 🐂 🐃 🐄 🐷 🐖 🐗 🐽 🐏 🐑 🐐 🐪 🐫 🦙 🦒 🐘 🦣 🦏 🦛 🐭 🐁 🐀 🐹 🐰 🐇 🐿️ 🦫 🦔 🦇 🐻 🐻‍❄️ 🐨 🐼 🦥 🦦 🦨 🦘 🦡 🐾 🦃 🐔 🐓 🐣 🐤 🐥 🐦 🐧 🕊️ 🦅 🦆 🦢 🦉 🦤 🪶 🦩 🦚 🦜 🪽 🐦‍⬛ 🪿 🐦‍🔥 🐸 🐊 🐢 🦎 🐍 🐲 🐉 🦕 🦖 🐳 🐋 🐬 🫍 🦭 🐟 🐠 🐡 🦈 🐙 🐚 🪸 🪼 🦀 🦞 🦐 🦑 🦪 🐌 🦋 🐛 🐜 🐝 🪲 🐞 🦗 🪳 🕷️ 🕸️ 🦂 🦟 🪰 🪱 🦠 💐 🌸 💮 🪷 🏵️ 🌹 🥀 🌺 🌻 🌼 🌷 🪻 🌱 🪴 🌲 🌳 🌴 🌵 🌾 🌿 ☘️ 🍀 🍁 🍂 🍃 🪹 🪺 🍄 🪾"],["Nourriture et boissons","🍇 🍈 🍉 🍊 🍋 🍋‍🟩 🍌 🍍 🥭 🍎 🍏 🍐 🍑 🍒 🍓 🫐 🥝 🍅 🫒 🥥 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🧄 🧅 🥜 🫘 🌰 🫚 🫛 🍄‍🟫 🫜 🍞 🥐 🥖 🫓 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🫔 🥙 🧆 🥚 🍳 🥘 🍲 🫕 🥣 🥗 🍿 🧈 🧂 🥫 🍱 🍘 🍙 🍚 🍛 🍜 🍝 🍠 🍢 🍣 🍤 🍥 🥮 🍡 🥟 🥠 🥡 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫 🍬 🍭 🍮 🍯 🍼 🥛 ☕ 🫖 🍵 🍶 🍾 🍷 🍸 🍹 🍺 🍻 🥂 🥃 🫗 🥤 🧋 🧃 🧉 🧊 🥢 🍽️ 🍴 🥄 🔪 🫙 🏺"],["Voyages et lieux","🌍 🌎 🌏 🌐 🗺️ 🗾 🧭 🏔️ ⛰️ 🛘 🌋 🗻 🏕️ 🏖️ 🏜️ 🏝️ 🏞️ 🏟️ 🏛️ 🏗️ 🧱 🪨 🪵 🛖 🏘️ 🏚️ 🏠 🏡 🏢 🏣 🏤 🏥 🏦 🏨 🏩 🏪 🏫 🏬 🏭 🏯 🏰 💒 🗼 🗽 ⛪ 🕌 🛕 🕍 ⛩️ 🕋 ⛲ ⛺ 🌁 🌃 🏙️ 🌄 🌅 🌆 🌇 🌉 ♨️ 🎠 🛝 🎡 🎢 💈 🎪 🚂 🚃 🚄 🚅 🚆 🚇 🚈 🚉 🚊 🚝 🚞 🚋 🚌 🚍 🚎 🚐 🚑 🚒 🚓 🚔 🚕 🚖 🚗 🚘 🚙 🛻 🚚 🚛 🚜 🏎️ 🏍️ 🛵 🦽 🦼 🛺 🚲 🛴 🛹 🛼 🚏 🛣️ 🛤️ 🛢️ ⛽ 🛞 🚨 🚥 🚦 🛑 🚧 ⚓ 🛟 ⛵ 🛶 🚤 🛳️ ⛴️ 🛥️ 🚢 ✈️ 🛩️ 🛫 🛬 🪂 💺 🚁 🚟 🚠 🚡 🛰️ 🚀 🛸 🛎️ 🧳 ⌛ ⏳ ⌚ ⏰ ⏱️ ⏲️ 🕰️ 🕛 🕧 🕐 🕜 🕑 🕝 🕒 🕞 🕓 🕟 🕔 🕠 🕕 🕡 🕖 🕢 🕗 🕣 🕘 🕤 🕙 🕥 🕚 🕦 🌑 🌒 🌓 🌔 🌕 🌖 🌗 🌘 🌙 🌚 🌛 🌜 🌡️ ☀️ 🌝 🌞 🪐 ⭐ 🌟 🌠 🌌 ☁️ ⛅ ⛈️ 🌤️ 🌥️ 🌦️ 🌧️ 🌨️ 🌩️ 🌪️ 🌫️ 🌬️ 🌀 🌈 🌂 ☂️ ☔ ⛱️ ⚡ ❄️ ☃️ ⛄ ☄️ 🔥 💧 🌊"],["Activités","🎃 🎄 🎆 🎇 🧨 ✨ 🎈 🎉 🎊 🎋 🎍 🎎 🎏 🎐 🎑 🧧 🎀 🎁 🎗️ 🎟️ 🎫 🎖️ 🏆 🏅 🥇 🥈 🥉 ⚽ ⚾ 🥎 🏀 🏐 🏈 🏉 🎾 🥏 🎳 🏏 🏑 🏒 🥍 🏓 🏸 🥊 🥋 🥅 ⛳ ⛸️ 🎣 🤿 🎽 🎿 🛷 🥌 🎯 🪀 🪁 🔫 🎱 🔮 🪄 🎮 🕹️ 🎰 🎲 🧩 🧸 🪅 🪩 🪆 ♠️ ♥️ ♦️ ♣️ ♟️ 🃏 🀄 🎴 🎭 🖼️ 🎨 🧵 🪡 🧶 🪢"],["Objets","👓 🕶️ 🥽 🥼 🦺 👔 👕 👖 🧣 🧤 🧥 🧦 👗 👘 🥻 🩱 🩲 🩳 👙 👚 🪭 👛 👜 👝 🛍️ 🎒 🩴 👞 👟 🥾 🥿 👠 👡 🩰 👢 🪮 👑 👒 🎩 🎓 🧢 🪖 ⛑️ 📿 💄 💍 💎 🔇 🔈 🔉 🔊 📢 📣 📯 🔔 🔕 🎼 🎵 🎶 🎙️ 🎚️ 🎛️ 🎤 🎧 📻 🎷 🎺 🪊 🪗 🎸 🎹 🎻 🪕 🥁 🪘 🪇 🪈 🪉 📱 📲 ☎️ 📞 📟 📠 🔋 🪫 🔌 💻 🖥️ 🖨️ ⌨️ 🖱️ 🖲️ 💽 💾 💿 📀 🧮 🎥 🎞️ 📽️ 🎬 📺 📷 📸 📹 📼 🔍 🔎 🕯️ 💡 🔦 🏮 🪔 📔 📕 📖 📗 📘 📙 📚 📓 📒 📃 📜 📄 📰 🗞️ 📑 🔖 🏷️ 🪙 💰 🪎 💴 💵 💶 💷 💸 💳 🧾 💹 ✉️ 📧 📨 📩 📤 📥 📦 📫 📪 📬 📭 📮 🗳️ ✏️ ✒️ 🖋️ 🖊️ 🖌️ 🖍️ 📝 💼 📁 📂 🗂️ 📅 📆 🗒️ 🗓️ 📇 📈 📉 📊 📋 📌 📍 📎 🖇️ 📏 📐 ✂️ 🗃️ 🗄️ 🗑️ 🔒 🔓 🔏 🔐 🔑 🗝️ 🔨 🪓 ⛏️ ⚒️ 🛠️ 🗡️ ⚔️ 💣 🪃 🏹 🛡️ 🪚 🔧 🪛 🔩 ⚙️ 🗜️ ⚖️ 🦯 🔗 ⛓️‍💥 ⛓️ 🪝 🧰 🧲 🪜 🪏 ⚗️ 🧪 🧫 🧬 🔬 🔭 📡 💉 🩸 💊 🩹 🩼 🩺 🩻 🚪 🛗 🪞 🪟 🛏️ 🛋️ 🪑 🚽 🪠 🚿 🛁 🪤 🪒 🧴 🧷 🧹 🧺 🧻 🪣 🧼 🫧 🪥 🧽 🧯 🛒 🚬 ⚰️ 🪦 ⚱️ 🧿 🪬 🗿 🪧 🪪"],["Symboles","🏧 🚮 🚰 ♿ 🚹 🚺 🚻 🚼 🚾 🛂 🛃 🛄 🛅 ⚠️ 🚸 ⛔ 🚫 🚳 🚭 🚯 🚱 🚷 📵 🔞 ☢️ ☣️ ⬆️ ↗️ ➡️ ↘️ ⬇️ ↙️ ⬅️ ↖️ ↕️ ↔️ ↩️ ↪️ ⤴️ ⤵️ 🔃 🔄 🔙 🔚 🔛 🔜 🔝 🛐 ⚛️ 🕉️ ✡️ ☸️ ☯️ ✝️ ☦️ ☪️ ☮️ 🕎 🔯 🪯 ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⛎ 🔀 🔁 🔂 ▶️ ⏩ ⏭️ ⏯️ ◀️ ⏪ ⏮️ 🔼 ⏫ 🔽 ⏬ ⏸️ ⏹️ ⏺️ ⏏️ 🎦 🔅 🔆 📶 🛜 📳 📴 ♀️ ♂️ ⚧️ ✖️ ➕ ➖ ➗ 🟰 ♾️ ‼️ ⁉️ ❓ ❔ ❕ ❗ 〰️ 💱 💲 ⚕️ ♻️ ⚜️ 🔱 📛 🔰 ⭕ ✅ ☑️ ✔️ ❌ ❎ ➰ ➿ 〽️ ✳️ ✴️ ❇️ ©️ ®️ ™️ 🫟 #️⃣ *️⃣ 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔠 🔡 🔢 🔣 🔤 🅰️ 🆎 🅱️ 🆑 🆒 🆓 ℹ️ 🆔 Ⓜ️ 🆕 🆖 🅾️ 🆗 🅿️ 🆘 🆙 🆚 🈁 🈂️ 🈷️ 🈶 🈯 🉐 🈹 🈚 🈲 🉑 🈸 🈴 🈳 ㊗️ ㊙️ 🈺 🈵 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 🟫 ⬛ ⬜ ◼️ ◻️ ◾ ◽ ▪️ ▫️ 🔶 🔷 🔸 🔹 🔺 🔻 💠 🔘 🔳 🔲"],["Drapeaux","🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏳️‍⚧️ 🏴‍☠️ 🇦🇨 🇦🇩 🇦🇪 🇦🇫 🇦🇬 🇦🇮 🇦🇱 🇦🇲 🇦🇴 🇦🇶 🇦🇷 🇦🇸 🇦🇹 🇦🇺 🇦🇼 🇦🇽 🇦🇿 🇧🇦 🇧🇧 🇧🇩 🇧🇪 🇧🇫 🇧🇬 🇧🇭 🇧🇮 🇧🇯 🇧🇱 🇧🇲 🇧🇳 🇧🇴 🇧🇶 🇧🇷 🇧🇸 🇧🇹 🇧🇻 🇧🇼 🇧🇾 🇧🇿 🇨🇦 🇨🇨 🇨🇩 🇨🇫 🇨🇬 🇨🇭 🇨🇮 🇨🇰 🇨🇱 🇨🇲 🇨🇳 🇨🇴 🇨🇵 🇨🇶 🇨🇷 🇨🇺 🇨🇻 🇨🇼 🇨🇽 🇨🇾 🇨🇿 🇩🇪 🇩🇬 🇩🇯 🇩🇰 🇩🇲 🇩🇴 🇩🇿 🇪🇦 🇪🇨 🇪🇪 🇪🇬 🇪🇭 🇪🇷 🇪🇸 🇪🇹 🇪🇺 🇫🇮 🇫🇯 🇫🇰 🇫🇲 🇫🇴 🇫🇷 🇬🇦 🇬🇧 🇬🇩 🇬🇪 🇬🇫 🇬🇬 🇬🇭 🇬🇮 🇬🇱 🇬🇲 🇬🇳 🇬🇵 🇬🇶 🇬🇷 🇬🇸 🇬🇹 🇬🇺 🇬🇼 🇬🇾 🇭🇰 🇭🇲 🇭🇳 🇭🇷 🇭🇹 🇭🇺 🇮🇨 🇮🇩 🇮🇪 🇮🇱 🇮🇲 🇮🇳 🇮🇴 🇮🇶 🇮🇷 🇮🇸 🇮🇹 🇯🇪 🇯🇲 🇯🇴 🇯🇵 🇰🇪 🇰🇬 🇰🇭 🇰🇮 🇰🇲 🇰🇳 🇰🇵 🇰🇷 🇰🇼 🇰🇾 🇰🇿 🇱🇦 🇱🇧 🇱🇨 🇱🇮 🇱🇰 🇱🇷 🇱🇸 🇱🇹 🇱🇺 🇱🇻 🇱🇾 🇲🇦 🇲🇨 🇲🇩 🇲🇪 🇲🇫 🇲🇬 🇲🇭 🇲🇰 🇲🇱 🇲🇲 🇲🇳 🇲🇴 🇲🇵 🇲🇶 🇲🇷 🇲🇸 🇲🇹 🇲🇺 🇲🇻 🇲🇼 🇲🇽 🇲🇾 🇲🇿 🇳🇦 🇳🇨 🇳🇪 🇳🇫 🇳🇬 🇳🇮 🇳🇱 🇳🇴 🇳🇵 🇳🇷 🇳🇺 🇳🇿 🇴🇲 🇵🇦 🇵🇪 🇵🇫 🇵🇬 🇵🇭 🇵🇰 🇵🇱 🇵🇲 🇵🇳 🇵🇷 🇵🇸 🇵🇹 🇵🇼 🇵🇾 🇶🇦 🇷🇪 🇷🇴 🇷🇸 🇷🇺 🇷🇼 🇸🇦 🇸🇧 🇸🇨 🇸🇩 🇸🇪 🇸🇬 🇸🇭 🇸🇮 🇸🇯 🇸🇰 🇸🇱 🇸🇲 🇸🇳 🇸🇴 🇸🇷 🇸🇸 🇸🇹 🇸🇻 🇸🇽 🇸🇾 🇸🇿 🇹🇦 🇹🇨 🇹🇩 🇹🇫 🇹🇬 🇹🇭 🇹🇯 🇹🇰 🇹🇱 🇹🇲 🇹🇳 🇹🇴 🇹🇷 🇹🇹 🇹🇻 🇹🇼 🇹🇿 🇺🇦 🇺🇬 🇺🇲 🇺🇳 🇺🇸 🇺🇾 🇺🇿 🇻🇦 🇻🇨 🇻🇪 🇻🇬 🇻🇮 🇻🇳 🇻🇺 🇼🇫 🇼🇸 🇽🇰 🇾🇪 🇾🇹 🇿🇦 🇿🇲 🇿🇼 🏴󠁧󠁢󠁥󠁮󠁧󠁿 🏴󠁧󠁢󠁳󠁣󠁴󠁿 🏴󠁧󠁢󠁷󠁬󠁳󠁿"]];
var STK_GROUPS=[
 {n:'Animaux',ids:['ours','chat','chien','lapin','poussin','grenouille','panda','renard','papillon','hibou','tortue','poisson','abeille','coccinelle','escargot','pingouin','elephant']},
 {n:'Nature',ids:['fleur','nuage','lune','soleil','arc','cactus','arbre','champignon']},
 {n:'Études',ids:['livre','crayon','idee','ordi','reveil','trophee','diplome','loupe','calculette','sac','postit']},
 {n:'Gourmandises',ids:['cafe','cupcake','cerises','theiere','glace','donut','fraise','pomme']},
 {n:'Divers',ids:['coeur','etoile','parapluie','fusee','musique','cadeau']}
];
function svgFor(t,col){
  if(t.indexOf('emoji:')===0)return '<svg class="sv" viewBox="0 0 64 64" aria-hidden="true"><text x="32" y="34" text-anchor="middle" dominant-baseline="central" font-size="50" font-family="\'Apple Color Emoji\',\'Segoe UI Emoji\',\'Noto Color Emoji\',sans-serif">'+esc(t.slice(6))+'</text></svg>';
  var st=STICKERS.filter(function(x){return x.id===t;})[0];
  if(!st)return '';
  return '<svg class="sv" viewBox="0 0 64 64" style="--m:'+col.m+';--s:'+col.s+'" aria-hidden="true">'+st.v+'</svg>';
}
function pad2(n){return n.toString(16).padStart(2,'0');}
function softOf(hex){
  return '#'+[1,3,5].map(function(i){var c=parseInt(hex.slice(i,i+2),16);return pad2(Math.round(c+(255-c)*0.8));}).join('');
}
function colOf(c){
  if(STK_COLORS[c])return STK_COLORS[c];
  if(/^#[0-9a-f]{6}$/i.test(c||''))return {m:c,s:softOf(c)};
  return STK_COLORS.rose;
}
function stkSvg(t,c){return svgFor(t,colOf(c));}
function hex2hsv(hex){
  var r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  var mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0;
  if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}
  return {h:h,s:mx?d/mx:0,v:mx};
}
function hsv2hex(o){
  var h=o.h/60,c=o.v*o.s,x=c*(1-Math.abs(h%2-1)),m=o.v-c,r=0,g=0,b=0;
  if(h<1){r=c;g=x;}else if(h<2){r=x;g=c;}else if(h<3){g=c;b=x;}else if(h<4){g=x;b=c;}else if(h<5){r=x;b=c;}else{r=c;b=x;}
  return '#'+[r,g,b].map(function(u){return pad2(Math.round((u+m)*255));}).join('');
}
function targetColor(){var cur=curSticker();return cur?cur.c:state.newc;}
function stkName(t){var s=STICKERS.filter(function(x){return x.id===t;})[0];return s?s.n:'';}
function stkKey(k){return data.prefs.sync?'*':k;}
function curSticker(){
  var L=data.stickers[stkKey(state.pmonth)]||[];
  for(var i=0;i<L.length;i++)if(L[i].id===state.sel)return L[i];
  return null;
}
function stickersLayer(key,edit){
  return (data.stickers[stkKey(key)]||[]).map(function(s){
    return '<div class="stk'+(edit?' ed':'')+(edit&&state.sel===s.id?' sel':'')+'" data-id="'+esc(s.id)+'" data-month="'+stkKey(key)+'" style="left:'+(s.x*100).toFixed(2)+'%;top:'+(s.y*100).toFixed(2)+'%;width:'+s.s+'%;transform:translate(-50%,-50%) rotate('+s.r+'deg)">'+stkSvg(s.t,s.c)+'</div>';
  }).join('');
}
function printPal(){
  if(data.prefs.ppal==='perso')return {m:data.prefs.pcustom,s:softOf(data.prefs.pcustom)};
  return PRINT_PALS[data.prefs.ppal]||PRINT_PALS.sobre;
}
function sheet(key,edit){
  var p=key.split('-').map(Number),y=p[0],m=p[1],first=new Date(y,m-1,1),off=(first.getDay()+6)%7,n=new Date(y,m,0).getDate();
  var rows=Math.ceil((off+n)/7),pp=printPal();
  var evs=buildEvents().filter(visible);
  var h='<div class="swrap"><section class="sheet" data-month="'+key+'" style="--pt:'+pp.m+';--pts:'+pp.s+'">';
  h+='<div class="sh-head"><div><h2>'+cap(fMonth.format(first))+'</h2><span>'+esc(appTitle()+(appEyebrow()?' · '+appEyebrow():''))+'</span></div></div>';
  h+='<div class="pgrid" style="grid-template-rows:auto repeat('+rows+',minmax(0,1fr))">';
  wdList(fWdLong).forEach(function(d){h+='<div class="ph">'+esc(d)+'</div>';});
  var i;
  for(i=0;i<off;i++)h+='<div class="pc"></div>';
  for(var d=1;d<=n;d++){
    var day=y+'-'+pad(m)+'-'+pad(d),wk=(off+d-1)%7>=5;
    var esd=eventsOn(evs,day),hd=esd.some(function(e){return e.kind==='devoir';});
    h+='<div class="pc'+(wk?' wk':'')+(hd?' hasdv':'')+'"><div class="pd">'+d+'</div>'+esd.map(pline).join('')+'</div>';
  }
  var rem=(7-(off+n)%7)%7;
  for(i=0;i<rem;i++)h+='<div class="pc"></div>';
  h+='</div>';
  var due=evs.filter(function(e){return (e.kind==='devoir'||e.kind==='exam'||e.kind==='dispo')&&e.date.slice(0,7)===key;});
  if(due.length)h+='<div class="pdue"><b>'+t('Échéances du mois')+'</b><ul>'+due.map(function(e){
    var lead=e.kind==='devoir'?t('À rendre : '):e.kind==='exam'?t('Examen : '):t('Sujet disponible : ');
    return '<li'+(e.kind==='devoir'?' class="dvli"':'')+'>'+lead+esc(t(e.title))+' — '+(e.kind==='exam'?range(e):fLong.format(parse(e.date)))+'</li>';
  }).join('')+'</ul></div>';
  h+='<div class="plegend">'+t('□ à faire · ✓ fait ou rendu')+' — '+SUBJECTS.map(function(s){return esc(s.ab)+' = '+esc(s.code)+' '+esc(s.name);}).join(' · ')+'</div>';
  h+=stickersLayer(key,edit);
  h+='</section></div>';
  return h;
}
function pkHex(kind){if(kind==='bg'){var bs=state.bsel&&bgGet(state.bsel);return colOf(bs?bs.c:state.bnewc).m;}
  if(kind.indexOf('subj:')===0)return subjHex(kind.slice(5));return kind==='stk'?colOf(targetColor()).m:kind==='theme'?data.prefs.custom:data.prefs.pcustom;}
function pkSet(kind,hex){
  if(kind==='bg'){var b2=state.bsel&&bgGet(state.bsel);if(b2){b2.c=hex;bgTouch();}else state.bnewc=hex;return;}
  if(kind.indexOf('subj:')===0){setEd('s:'+kind.slice(5),'color',hex);return;}
  if(kind==='stk'){var cs=curSticker();if(cs)cs.c=hex;else state.newc=hex;}
  else if(kind==='theme'){data.prefs.custom=hex;data.prefs.pal='perso';}
  else{data.prefs.pcustom=hex;data.prefs.ppal='perso';}
}
function favRow(kind){
  var h='<div class="favs"><span class="lbl">'+t('Mes couleurs')+'</span><div class="chips">';
  h+=data.favs.map(function(c){
    return '<span class="fav"><button type="button" class="favsw" data-act="fav-use" data-k="'+kind+'" data-v="'+c+'" style="background:'+c+'" aria-label="'+esc(t('Utiliser la couleur')+' '+c.toUpperCase())+'" title="'+c.toUpperCase()+'"></button><button type="button" class="favx" data-act="fav-del" data-v="'+c+'" aria-label="'+esc(t('Retirer cette couleur')+' '+c.toUpperCase())+'">×</button></span>';
  }).join('');
  h+='<button type="button" class="fchip" data-act="fav-add" data-k="'+kind+'">★ '+t('Enregistrer cette couleur')+'</button></div>';
  if(!data.favs.length)h+='<span class="hint">'+t('Aucune couleur enregistrée pour le moment.')+'</span>';
  return h+'</div>';
}
function picker(kind){
  var hex=pkHex(kind),key='hsv_'+kind,v=state[key];
  if(!v||hsv2hex(v)!==hex.toLowerCase())v=state[key]=hex2hsv(hex);
  return '<div class="picker"><div class="svbox" data-pk="'+kind+'" data-part="sv" id="svbox-'+kind+'" style="background-color:hsl('+Math.round(v.h)+',100%,50%)"><i class="svth" id="svth-'+kind+'" style="left:'+(v.s*100).toFixed(1)+'%;top:'+((1-v.v)*100).toFixed(1)+'%"></i></div>'+
    '<div class="huebar" data-pk="'+kind+'" data-part="hue" id="huebar-'+kind+'"><i class="hueth" id="hueth-'+kind+'" style="left:'+(v.h/360*100).toFixed(1)+'%"></i></div>'+
    '<div class="hexrow"><i class="hexchip" id="hexchip-'+kind+'" style="background:'+hex+'"></i><input id="hexin-'+kind+'" data-pk="'+kind+'" aria-label="'+t('Code couleur')+'" value="'+hex.toUpperCase()+'" maxlength="7" spellcheck="false" autocomplete="off"></div>'+favRow(kind)+'</div>';
}
function stickerPanel(){
  var cur=curSticker(),L=data.stickers[stkKey(state.pmonth)]||[],tc=targetColor();
  var h='<div class="panel noprint"><div class="opt"><span class="lbl">'+t('Stickers : touche pour ajouter, glisse sur la feuille pour placer')+'</span></div>';
  h+='<div class="opt"><span class="lbl">'+t('Décoration')+'</span><div class="seg" role="group" aria-label="'+t('Portée de la décoration')+'"><button type="button" data-act="deco" data-v="month" aria-pressed="'+(!data.prefs.sync)+'">'+t('Ce mois seulement')+'</button><button type="button" data-act="deco" data-v="all" aria-pressed="'+(!!data.prefs.sync)+'">'+t('Même déco pour tous les mois')+'</button></div></div>';
  if(!data.prefs.sync&&L.length)h+='<div class="opt"><button type="button" class="btn ghost" data-act="deco-copy">'+(state.cpArm?t('Confirmer : remplace la déco des autres mois'):t('Copier cette déco sur tous les mois'))+'</button></div>';
  h+='<div class="opt"><button type="button" class="btn" data-act="stkopen">'+t('Stickers et emojis')+'</button><span class="hint">'+t('Choisis un sticker dans la liste')+'</span></div>';
  h+='<div class="opt selbar"><span class="lbl">'+(cur?esc(tf('Couleur du sticker sélectionné ({n})',{n:t(stkName(cur.t))})):t('Couleur des prochains stickers'))+'</span></div>'+picker('stk');
  if(cur){
    h+='<div class="opt selbar"><span class="lbl">'+t('Taille et angle')+'</span><div class="seg"><button type="button" data-act="sk-size" data-v="-1" aria-label="'+t('Plus petit')+'">−</button><button type="button" data-act="sk-size" data-v="1" aria-label="'+t('Plus grand')+'">+</button></div><div class="seg"><button type="button" data-act="sk-rot" data-v="-15" aria-label="'+t('Tourner à gauche')+'">↺</button><button type="button" data-act="sk-rot" data-v="15" aria-label="'+t('Tourner à droite')+'">↻</button></div><button type="button" class="btn ghost" data-act="sk-del">'+t('Supprimer')+'</button></div>';
  }else{
    h+='<div class="opt"><span class="hint">'+t('Touche un sticker sur la feuille pour changer sa couleur, sa taille ou le supprimer.')+'</span></div>';
  }
  if(L.length)h+='<div class="opt"><button type="button" class="btn ghost" data-act="sk-clear">'+(data.prefs.sync?t('Retirer tous les stickers (tous les mois)'):t('Retirer tous les stickers de ce mois'))+'</button></div>';
  return h+'</div>';
}
function monthPicker(ms){
  var n=ms.filter(function(k){return !data.printOff[k];}).length;
  return '<div class="panel noprint"><div class="opt"><span class="lbl">'+tf('Mois à imprimer : {n} sur {m}',{n:n,m:ms.length})+'</span><button type="button" class="btn ghost" data-act="pm-all">'+t('Tous')+'</button><button type="button" class="btn ghost" data-act="pm-none">'+t('Aucun')+'</button></div><div class="chips">'+ms.map(function(k){
    var on=!data.printOff[k];
    return '<button type="button" class="fchip" data-act="pm-toggle" data-v="'+k+'" aria-pressed="'+on+'">'+(on?'✓ ':'')+fMonShort.format(parse(k+'-01'))+'</button>';
  }).join('')+'</div></div>';
}
var PRINTER_SVG='<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M6 14h12v7H6z"/></svg>';
function printTab(){
  var ms=monthsList(),tm=today().slice(0,7);
  if(!state.pmonth||ms.indexOf(state.pmonth)<0)state.pmonth=ms.indexOf(tm)>=0?tm:ms[0];
  var i=ms.indexOf(state.pmonth),npages=state.pall?ms.filter(function(k){return !data.printOff[k];}).length:1;
  var h='<div class="ptwo"><div class="pside noprint"><button type="button" class="btn bigbtn" data-act="printhelp">'+PRINTER_SVG+'<span>'+t('Imprimer')+'</span><small>'+tf('{n} page(s)',{n:npages})+'</small></button><div class="controls noprint"><div class="seg" role="group" aria-label="'+t('Quoi imprimer')+'"><button data-act="pall" data-v="one" aria-pressed="'+(!state.pall)+'">'+t('Un mois')+'</button><button data-act="pall" data-v="all" aria-pressed="'+state.pall+'">'+t('Plusieurs mois')+'</button></div>';
  if(!state.pall){
    h+='<button class="btn ghost" data-act="pprev"'+(i<=0?' disabled':'')+' aria-label="'+t('Mois précédent')+'">←</button><select id="pmonth" aria-label="'+t('Mois à imprimer')+'">'+ms.map(function(k){return '<option value="'+k+'"'+(k===state.pmonth?' selected':'')+'>'+cap(fMonth.format(parse(k+'-01')))+'</option>';}).join('')+'</select><button class="btn ghost" data-act="pnext"'+(i>=ms.length-1?' disabled':'')+' aria-label="'+t('Mois suivant')+'">→</button>';
  }
  h+='</div>';
  h+=subjChips().replace('class="chips"','class="chips noprint"');
  if(state.pall)h+=monthPicker(ms);
  h+='<div class="panel noprint"><div class="opt"><span class="lbl">'+t("Couleurs d'impression")+'</span><div class="chips">'+['sobre'].map(function(k){
    return '<button type="button" class="fchip" data-act="ppal" data-v="'+k+'" aria-pressed="'+(data.prefs.ppal===k)+'"><i class="sd" style="background:'+PRINT_PALS[k].m+'"></i>'+t(PRINT_PALS[k].n)+'</button>';
  }).join('')+'<button type="button" class="fchip" data-act="ppal" data-v="perso" aria-pressed="'+(data.prefs.ppal==='perso')+'"><i class="sd" style="background:'+data.prefs.pcustom+'"></i>'+t('Couleur')+'</button></div></div>'+(data.prefs.ppal==='perso'?picker('print'):'')+'</div>';
  if(!state.pall)h+=stickerPanel();
  else h+='<p class="hint noprint">'+t('Pour placer ou changer des stickers, repasse en « Un mois ».')+'</p>';
  h+='<p class="hint noprint">'+t("Aperçu de la feuille A4 paysage, une page par mois. Pour imprimer, utilise la fonction Imprimer du navigateur (Ctrl ou Cmd + P), échelle 100 %. Le fond reste blanc : seules quelques touches de couleur sont imprimées.")+'</p>';
  h+='</div><div class="pmain"><div class="paper printzone">'+(state.pall?(ms.filter(function(k){return !data.printOff[k];}).map(function(k){return sheet(k,false);}).join('')||'<div class="empty noprint">'+t('Aucun mois sélectionné.')+'</div>'):sheet(state.pmonth,true))+'</div></div></div>';
  return h;
}
function fit(){
  var pa=document.querySelector('.paper');if(!pa)return;
  var k=Math.min(1.4,pa.clientWidth/1060);
  pa.style.setProperty('--k',k.toFixed(4));
}
window.addEventListener('resize',fit);

/* ---------- Interactions ---------- */
document.addEventListener('click',function(ev){
  var tg=ev.target;
  if(state.sel&&tg.closest&&!tg.closest('.stk')&&tg.closest('.sheet')){state.sel=null;render();return;}
  var el=ev.target.closest('[data-act]');if(!el)return;
  var a=el.dataset.act;
  if(a!=='deco-copy')state.cpArm=false;
  if(a!=='ed-resetall')state.rsArm=false;
  if(a!=='bg-clear')state.bgArm=false;
  if(a==='tab'){state.tab=el.dataset.v;}
  else if(a==='view'){state.view=el.dataset.v;if(!state.month)state.month=today().slice(0,7);}
  else if(a==='scope'){state.scope=el.dataset.v;}
  else if(a==='filter'){state.filter=el.dataset.v;}
  else if(a==='addtoggle'){state.formOpen=!state.formOpen;}
  else if(a==='done'){return;}
  else if(a==='del'){data.custom=data.custom.filter(function(c){return c.id!==el.dataset.id;});delete data.done[el.dataset.id];persist();}
  else if(a==='rendu'){var k=el.dataset.dev+':'+el.dataset.sub;if(data.rendu[k])delete data.rendu[k];else data.rendu[k]=true;persist();}
  else if(a==='mprev'||a==='mnext'){var p=state.month.split('-').map(Number),d=new Date(p[0],p[1]-1+(a==='mnext'?1:-1),1);state.month=d.getFullYear()+'-'+pad(d.getMonth()+1);state.sel=null;}
  else if(a==='day'){state.sel=state.sel===el.dataset.day?null:el.dataset.day;}
  else if(a==='fav-add'){var fc=pkHex(el.dataset.k).toLowerCase();if(data.favs.indexOf(fc)<0){data.favs.push(fc);if(data.favs.length>30)data.favs.shift();}persist();}
  else if(a==='fav-del'){data.favs=data.favs.filter(function(c){return c!==el.dataset.v;});persist();}
  else if(a==='fav-use'){applyHex(el.dataset.k,el.dataset.v);return;}
  else if(a==='pal'){state.themePick=!state.themePick;}
  else if(a==='lang'){data.prefs.lang=el.dataset.v;persist();initFmt();}
  else if(a==='printhelp'){state.printHelp=true;}
  else if(a==='phclose'){state.printHelp=false;}
  else if(a==='ed-sec'){var eid=el.dataset.v;edOpen[eid]=!edIsOpen(eid,el.dataset.def==='1');if(eid==='bak'&&edOpen[eid]){state.bakMsg='';loadBackups();}}
  else if(a==='bak-restore'){
    if(window.confirm(t('Restaurer cette sauvegarde ? Tes données actuelles sont sauvegardées avant, tu pourras y revenir.'))){
      PlannerSync.api('api/backups/restore',{method:'POST',headers:PlannerSync.HDR,body:JSON.stringify({name:el.dataset.name})}).then(function(r){if(!r.ok)throw new Error();return PlannerSync.reloadFromServer();}).then(function(){state.bakMsg=t('Sauvegarde restaurée.');loadBackups();},function(){state.bakMsg=t('Restauration impossible.');render();});
    }
  }
  else if(a==='ed-color'){state.edPick=state.edPick===el.dataset.v?null:el.dataset.v;}
  else if(a==='ed-colreset'){var ck=el.dataset.key;if(data.edits[ck]){delete data.edits[ck].color;if(!Object.keys(data.edits[ck]).length)delete data.edits[ck];}applyEdits();persist();state['hsv_subj:'+ck.slice(2)]=null;}
  else if(a==='ed-clear'){setEd(el.dataset.key,el.dataset.f,'');}
  else if(a==='ed-reset'){delete data.edits[el.dataset.key];applyEdits();persist();}
  else if(a==='ed-hide'){if(data.hidden[el.dataset.id])delete data.hidden[el.dataset.id];else data.hidden[el.dataset.id]=true;persist();}
  else if(a==='ed-resetall'){if(!state.rsArm){state.rsArm=true;}else{var keepApp=data.edits.app;data.edits={};if(keepApp)data.edits.app=keepApp;data.hidden={};applyEdits();persist();state.rsArm=false;}}
  else if(a==='notes'){state.noteFor={key:el.dataset.key,title:el.dataset.title};state.noteMsg='';}
  else if(a==='noteclose'){closeNotes();}
  else if(a==='note-del'){var nk=state.noteFor.key;data.notes[nk]=(data.notes[nk]||[]).filter(function(n){return n.id!==el.dataset.id;});if(!data.notes[nk].length)delete data.notes[nk];persist();}
  else if(a==='note-addtext'){var tv=document.getElementById('nt-text').value.trim();if(tv){addNote(state.noteFor.key,{id:nid(),k:'text',v:tv});document.getElementById('nt-text').value='';}}
  else if(a==='note-addlink'){
    var u=document.getElementById('nt-url').value.trim(),lb=document.getElementById('nt-label').value.trim();
    if(u){if(!/^[a-z][a-z0-9+.-]*:/i.test(u))u='https://'+u;
      if(/^(https?:|mailto:)/i.test(u)){addNote(state.noteFor.key,{id:nid(),k:'link',u:u,l:lb});document.getElementById('nt-url').value='';document.getElementById('nt-label').value='';}
      else state.noteMsg=t('Lien invalide');}
  }
  else if(a==='stkopen'){state.stkTarget='print';state.stkPop=true;}
  else if(a==='bgmode'){state.deco=!state.deco;if(!state.deco){state.bsel=null;state.bgColor=false;}}
  else if(a==='bg-done'){state.deco=false;state.bsel=null;state.bgColor=false;state.bgArm=false;}
  else if(a==='bg-add'){state.stkTarget='bg';state.stkPop=true;}
  else if(a==='bg-color'){state.bgColor=!state.bgColor;}
  else if(a==='bg-size'||a==='bg-rot'||a==='bg-del'){
    var bb=state.bsel&&bgGet(state.bsel);
    if(bb){
      if(a==='bg-size')bb.s=Math.max(2,Math.min(50,bb.s+Number(el.dataset.v)/2));
      else if(a==='bg-rot')bb.r=(bb.r+Number(el.dataset.v))%360;
      else{data.bg=data.bg.filter(function(x){return x.id!==bb.id;});state.bsel=null;state.bgColor=false;}
      bgTouch();
    }
  }
  else if(a==='bg-clear'){if(!state.bgArm){state.bgArm=true;}else{data.bg=[];state.bsel=null;state.bgColor=false;state.bgArm=false;bgTouch();}}
  else if(a==='stkclose'){state.stkPop=false;}
  else if(a==='stktab'){state.stkTab=el.dataset.v;}
  else if(a==='emocat'){state.emoCat=Number(el.dataset.v);}
  else if(a==='mode'){data.prefs.mode=el.dataset.v;persist();applyTheme();}
  else if(a==='pall'){state.pall=el.dataset.v==='all';state.sel=null;}
  else if(a==='ppal'){data.prefs.ppal=el.dataset.v;persist();}
  else if(a==='deco'){
    var on=el.dataset.v==='all';
    if(on!==!!data.prefs.sync){
      if(on){if(!(data.stickers['*']&&data.stickers['*'].length))data.stickers['*']=JSON.parse(JSON.stringify(data.stickers[state.pmonth]||[]));}
      else{var sh=data.stickers['*']||[];monthsList().forEach(function(k){if(data.stickers[k]===undefined)data.stickers[k]=JSON.parse(JSON.stringify(sh));});}
      data.prefs.sync=on;state.sel=null;persist();
    }
  }
  else if(a==='deco-copy'){
    if(!state.cpArm){state.cpArm=true;}
    else{var src=JSON.stringify(data.stickers[state.pmonth]||[]);monthsList().forEach(function(k){data.stickers[k]=JSON.parse(src);});state.cpArm=false;persist();}
  }
  else if(a==='pm-toggle'){data.printOff[el.dataset.v]=!data.printOff[el.dataset.v];persist();}
  else if(a==='pm-all'){data.printOff={};persist();}
  else if(a==='pm-none'){monthsList().forEach(function(k){data.printOff[k]=true;});persist();}
  else if(a==='sk-newc'){state.newc=el.dataset.v;}
  else if(a==='sk-preset'){var pc=curSticker();if(pc){pc.c=el.dataset.v;persist();}else state.newc=el.dataset.v;state.hsv_stk=null;}
  else if(a==='sk-add'&&state.stkTarget==='bg'){
    var nb={id:'b'+Date.now().toString(36)+Math.random().toString(36).slice(2,4),t:el.dataset.t,c:state.bnewc,x:.3+Math.random()*.4,y:(window.scrollY+window.innerHeight*.3+Math.random()*window.innerHeight*.2)/(document.getElementById('bg').getBoundingClientRect().width||1),s:9,r:0};
    data.bg.push(nb);state.bsel=nb.id;state.stkPop=false;bgTouch();
  }
  else if(a==='sk-add'){
    var L=data.stickers[stkKey(state.pmonth)]=data.stickers[stkKey(state.pmonth)]||[],k=L.length;
    var ns={id:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,4),t:el.dataset.t,c:state.newc,x:Math.min(.9,.2+(k%6)*.11),y:.1+(k%3)*.05,s:7,r:0};
    L.push(ns);state.sel=ns.id;state.stkPop=false;persist();
  }
  else if(a==='sk-color'||a==='sk-size'||a==='sk-rot'||a==='sk-del'){
    var cs=curSticker();
    if(cs){
      if(a==='sk-color')cs.c=el.dataset.v;
      else if(a==='sk-size')cs.s=Math.max(3,Math.min(20,cs.s+Number(el.dataset.v)));
      else if(a==='sk-rot')cs.r=(cs.r+Number(el.dataset.v))%360;
      else{data.stickers[stkKey(state.pmonth)]=data.stickers[stkKey(state.pmonth)].filter(function(x){return x.id!==cs.id;});state.sel=null;}
      persist();
    }
  }
  else if(a==='sk-clear'){data.stickers[stkKey(state.pmonth)]=[];state.sel=null;persist();}
  else if(a==='pprev'||a==='pnext'){var ms=monthsList(),j=ms.indexOf(state.pmonth)+(a==='pnext'?1:-1);if(j>=0&&j<ms.length)state.pmonth=ms[j];}
  else if(a==='alertclose'){state.alertOpen=false;}
  else if(a==='simreset'){state.sim=null;state.alertOpen=dueSoon().length>0;}
  render();
});
document.addEventListener('change',function(ev){
  var el=ev.target;
  if(el.dataset&&el.dataset.act==='done'){
    if(el.checked)data.done[el.dataset.id]=true;else delete data.done[el.dataset.id];
    persist();render();
  }else if(el.dataset&&el.dataset.nt){
    var arr=data.notes[state.noteFor.key]||[];arr.forEach(function(n){if(n.id===el.dataset.nt)n.v=el.value;});persist();
  }else if(el.id==='nt-file'){
    if(el.files&&el.files.length)addFiles(el.files);
  }else if(el.dataset&&el.dataset.ed){
    var pp=el.dataset.ed.split('|');
    var okk=setEd(pp[0],pp[1],el.value);
    if(el.type==='text'&&okk!==false){var h1=document.querySelector('h1');if(h1&&pp[0]==='app')h1.textContent=appTitle();if(pp[0]==='app'&&pp[1]==='eyebrow')render();}
    else render();
    if(okk===false)render();
  }else if(el.dataset&&el.dataset.pk&&el.tagName==='INPUT'){
    applyHex(el.dataset.pk,el.value);
  }else if(el.id==='pmonth'){
    state.pmonth=el.value;render();
  }else if(el.id==='simdate'){
    state.sim=el.value||null;state.alertOpen=dueSoon().length>0;
    if(state.view==='month'){state.month=today().slice(0,7);}
    render();
  }
});
document.addEventListener('input',function(ev){
  var el=ev.target;
  if(el.dataset&&el.dataset.nt&&state.noteFor){
    (data.notes[state.noteFor.key]||[]).forEach(function(n){if(n.id===el.dataset.nt)n.v=el.value;});persist();return;
  }
  if(el.dataset&&el.dataset.ed){
    var q=el.dataset.ed.split('|');
    if(setEd(q[0],q[1],el.value)!==false){
      if(q[0]==='app'){var hh=document.querySelector('h1');if(hh)hh.textContent=appTitle();}
      refreshPv();
    }
    return;
  }
  if(el.form&&el.form.id==='addform'&&state.form.hasOwnProperty(el.name))state.form[el.name]=el.value;
});
document.addEventListener('submit',function(ev){
  if(ev.target.id!=='addform')return;
  ev.preventDefault();
  var f=state.form,title=(f.title||'').trim(),date=f.date||today();
  if(!title)return;
  data.custom.push({id:'c'+Date.now(),title:title,subject:f.subject||'',date:date,time:f.time||'',tend:f.tend||''});
  persist();
  state.form={title:'',subject:'',date:'',time:'',tend:''};state.formOpen=false;
  render();
});
function applyHex(kind,v){
  v=String(v||'').trim();
  if(v.charAt(0)!=='#')v='#'+v;
  if(/^#[0-9a-f]{3}$/i.test(v))v='#'+v.slice(1).split('').map(function(c){return c+c;}).join('');
  if(!/^#[0-9a-f]{6}$/i.test(v)){render();return;}
  pkSet(kind,v.toLowerCase());
  state['hsv_'+kind]=null;persist();render();
  if(kind==='theme')applyTheme();
}
function applyHsvLive(kind){
  var v=state['hsv_'+kind],hex=hsv2hex(v),col={m:hex,s:softOf(hex)};
  state.pickHex=hex;
  var q=function(id){return document.getElementById(id+'-'+kind);};
  if(!q('svbox'))return;
  q('svbox').style.backgroundColor='hsl('+Math.round(v.h)+',100%,50%)';
  q('svth').style.left=(v.s*100)+'%';q('svth').style.top=((1-v.v)*100)+'%';
  q('hueth').style.left=(v.h/360*100)+'%';
  q('hexchip').style.background=hex;q('hexin').value=hex.toUpperCase();
  var i,els;
  if(kind==='stk'){
    els=document.querySelectorAll(curSticker()?'.stk.sel .sv':'.tray .sv');
    for(i=0;i<els.length;i++){els[i].style.setProperty('--m',col.m);els[i].style.setProperty('--s',col.s);}
  }else if(kind==='bg'){
    var bl=document.querySelectorAll('#bg .bgs.sel .sv');for(i=0;i<bl.length;i++){bl[i].style.setProperty('--m',col.m);bl[i].style.setProperty('--s',col.s);}
  }else if(kind.indexOf('subj:')===0){
    var sk='s:'+kind.slice(5);(data.edits[sk]=data.edits[sk]||{}).color=hex;applyEdits();refreshPv();
  }else if(kind==='theme'){
    data.prefs.custom=hex;data.prefs.pal='perso';applyTheme();
  }else{
    els=document.querySelectorAll('.sheet');
    for(i=0;i<els.length;i++){els[i].style.setProperty('--pt',col.m);els[i].style.setProperty('--pts',col.s);}
  }
}
var pdrag=null;
function pickAt(ev){
  var r=pdrag.el.getBoundingClientRect(),v=state['hsv_'+pdrag.kind];
  var x=Math.min(1,Math.max(0,(ev.clientX-r.left)/r.width)),y=Math.min(1,Math.max(0,(ev.clientY-r.top)/r.height));
  if(pdrag.part==='hue')v.h=Math.min(359.99,x*360);else{v.s=x;v.v=1-y;}
  applyHsvLive(pdrag.kind);
}
document.addEventListener('pointerdown',function(ev){
  var el=ev.target.closest&&ev.target.closest('.svbox,.huebar');
  if(!el||!state['hsv_'+el.dataset.pk])return;
  ev.preventDefault();
  pdrag={kind:el.dataset.pk,part:el.dataset.part,el:el,pid:ev.pointerId};
  try{el.setPointerCapture(ev.pointerId);}catch(e){}
  pickAt(ev);
});
document.addEventListener('pointermove',function(ev){if(pdrag&&ev.pointerId===pdrag.pid)pickAt(ev);});
function endPick(ev){
  if(!pdrag||ev.pointerId!==pdrag.pid)return;
  var kind=pdrag.kind,hex=state.pickHex;pdrag=null;
  if(hex){pkSet(kind,hex);persist();}
  render();
}
document.addEventListener('pointerup',endPick);
document.addEventListener('pointercancel',endPick);
var bdrag=null;
document.addEventListener('pointerdown',function(ev){
  var el=ev.target.closest&&ev.target.closest('.bgs');if(!el||!state.deco)return;
  var b=bgGet(el.dataset.id);if(!b)return;
  ev.preventDefault();
  var rc=document.getElementById('bg').getBoundingClientRect();bdrag={id:b.id,el:el,pid:ev.pointerId,ox:(ev.clientX-rc.left)/rc.width-b.x,oy:(ev.clientY-rc.top)/rc.width-b.y,moved:false};
  try{el.setPointerCapture(ev.pointerId);}catch(e){}
  var olds=document.querySelectorAll('#bg .bgs.sel');for(var i=0;i<olds.length;i++)olds[i].classList.remove('sel');
  el.classList.add('sel');state.bsel=b.id;
});
document.addEventListener('pointermove',function(ev){
  if(!bdrag||ev.pointerId!==bdrag.pid)return;
  var b=bgGet(bdrag.id);if(!b)return;
  var rc=document.getElementById('bg').getBoundingClientRect();
  b.x=Math.min(1,Math.max(0,(ev.clientX-rc.left)/rc.width-bdrag.ox));b.y=Math.min(30,Math.max(0,(ev.clientY-rc.top)/rc.width-bdrag.oy));
  bdrag.moved=true;bdrag.el.style.left=(b.x*100).toFixed(3)+'%';bdrag.el.style.top='calc(var(--w,1000px)*'+b.y.toFixed(4)+')';
  if(ev.clientY>window.innerHeight-170)window.scrollBy(0,10);else if(ev.clientY<50)window.scrollBy(0,-10);
});
function endBgDrag(ev){
  if(!bdrag||ev.pointerId!==bdrag.pid)return;
  var mv=bdrag.moved;bdrag=null;if(mv)bgTouch();render();
}
document.addEventListener('pointerup',endBgDrag);
document.addEventListener('pointercancel',endBgDrag);
var drag=null;
document.addEventListener('pointerdown',function(ev){
  var el=ev.target.closest&&ev.target.closest('.stk.ed');if(!el)return;
  ev.preventDefault();
  drag={id:el.dataset.id,month:el.dataset.month,el:el,sheet:el.closest('.sheet'),moved:false,pid:ev.pointerId,x:0,y:0};
  try{el.setPointerCapture(ev.pointerId);}catch(e){}
  state.sel=el.dataset.id;el.classList.add('sel');
});
document.addEventListener('pointermove',function(ev){
  if(!drag||ev.pointerId!==drag.pid)return;
  var r=drag.sheet.getBoundingClientRect();
  var x=Math.min(1,Math.max(0,(ev.clientX-r.left)/r.width)),y=Math.min(1,Math.max(0,(ev.clientY-r.top)/r.height));
  drag.x=x;drag.y=y;drag.moved=true;
  drag.el.style.left=(x*100).toFixed(2)+'%';drag.el.style.top=(y*100).toFixed(2)+'%';
});
function endDrag(ev){
  if(!drag||ev.pointerId!==drag.pid)return;
  if(drag.moved){
    var L=data.stickers[drag.month]||[];
    for(var i=0;i<L.length;i++)if(L[i].id===drag.id){L[i].x=drag.x;L[i].y=drag.y;}
    persist();
  }
  drag=null;render();
}
document.addEventListener('pointerup',endDrag);
document.addEventListener('pointercancel',endDrag);
document.addEventListener('keydown',function(ev){
  if(ev.key==='Escape'){
    if(state.noteFor){closeNotes();render();}
    else if(state.stkPop){state.stkPop=false;renderAlert();}
    else if(state.printHelp){state.printHelp=false;renderAlert();}
    else if(state.alertOpen){state.alertOpen=false;renderAlert();}
  }
});

state.month=today().slice(0,7);
state.alertOpen=dueSoon().length>0;
try{
  if(window.matchMedia)window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
}catch(e){}
render();
PlannerSync.attach({getData:function(){return data;},adopt:adopt,onStatus:showSync});
if(BOOT.offline)showSync('offline');
})();
