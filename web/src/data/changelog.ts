/**
 * What is new in each version, shown once after an update (and on demand from the "Nouveautés" button).
 * Add an entry here for every release that changes something the user can see; the newest goes first.
 * The `version` is the one the release will get (the "[minor]" / "[major]" marker in the pull request title decides it).
 */
export interface ChangeItem { fr: string; en: string; es: string }
export interface ChangeEntry { version: string; date: string; items: ChangeItem[] }

export const CHANGELOG: ChangeEntry[] = [
  {
    version: '1.15.0', date: '2026-10-18',
    items: [
      { fr: '🗣️ Le quiz d’anglais t’apprend maintenant à bien prononcer : 305 nouvelles questions, A1 : 105, A2 : 100 et B1 : 100, avec des phrases entières et pas seulement des mots.', en: '🗣️ The English quiz now teaches you to pronounce well: 305 new questions (A1: 105, A2: 100, B1: 100) with whole sentences, not only words.', es: '🗣️ El quiz de inglés ahora te enseña a pronunciar bien: 305 preguntas nuevas (A1: 105, A2: 100, B1: 100) con frases enteras y no solo palabras.' },
      { fr: '👂 Écoute-et-choisis (quel mot ou quelle phrase entends-tu ?), sons identiques, rimes, intrus, lettres muettes, accent des mots, terminaisons -ed et -s, mots qui se prononcent pareil, rythme de la phrase, petites phrases de la vraie vie, remise en ordre, textes à écouter seulement.', en: '👂 Listen-and-choose (which word or sentence do you hear?), same sounds, rhymes, odd one out, silent letters, word stress, -ed and -s endings, words that sound alike, sentence rhythm, real-life phrases, putting words in order, listen-only texts.', es: '👂 Escucha y elige (¿qué palabra o frase oyes?), sonidos iguales, rimas, intruso, letras mudas, acento de las palabras, terminaciones -ed y -s, palabras que suenan igual, ritmo de la frase, frases de la vida real, ordenar palabras, textos solo para escuchar.' },
      { fr: '🐢 Après chaque réponse : « Plus lentement » et « Répète à voix haute » pour imiter la voix.', en: '🐢 After each answer: “Slower” and “Say it out loud” to copy the voice.', es: '🐢 Después de cada respuesta: « Más despacio » y « Repítelo en voz alta » para imitar la voz.' },
      { fr: '🖼️ En A1, les questions avec image sont mieux mélangées avec les autres, et la bonne réponse est dite en phrase (« It’s a horse. »).', en: '🖼️ In A1, picture questions are now better mixed with the others, and the right answer is said as a sentence (“It’s a horse.”).', es: '🖼️ En A1, las preguntas con imagen se mezclan mejor con las demás y la respuesta correcta se dice en frase (« It’s a horse. »).' },
      { fr: '📂 Les listes « À rattraper » et « À suivre » (et chaque mois) se replient, sont classées par date, et le mois est affiché à côté du jour.', en: '📂 The “To catch up” and “Coming up” lists (and each month) can be folded, are sorted by date, and the month is shown next to the day.', es: '📂 Las listas « Por recuperar » y « Próximas » (y cada mes) se pueden plegar, están ordenadas por fecha y el mes se muestra junto al día.' }
    ]
  },
  {
    version: '1.14.0', date: '2026-10-17',
    items: [
      { fr: '⏭️ Un bouton « Passer et accéder au site » permet d’entrer tout de suite sans répondre au quiz d’anglais (il sera reposé à la prochaine ouverture).', en: '⏭️ A “Skip and go to the site” button lets you in at once without answering the English quiz (it will be asked again at the next opening).', es: '⏭️ Un botón « Saltar y entrar en el sitio » permite entrar enseguida sin responder al quiz de inglés (se volverá a preguntar en la próxima apertura).' },
      { fr: '🎚️ Tu peux choisir ton niveau (Auto, A1, A2 ou B1) directement dans les questions et dans la fenêtre 🎓 Quiz.', en: '🎚️ You can choose your level (Auto, A1, A2 or B1) right in the questions and in the 🎓 Quiz window.', es: '🎚️ Puedes elegir tu nivel (Auto, A1, A2 o B1) directamente en las preguntas y en la ventana 🎓 Quiz.' },
      { fr: '📚 600 questions de plus : 200 en A1, 200 en A2 et 200 en B1 (près de 930 au total), toutes avec la voix.', en: '📚 600 more questions: 200 in A1, 200 in A2 and 200 in B1 (almost 930 in total), all with the voice.', es: '📚 600 preguntas más: 200 en A1, 200 en A2 y 200 en B1 (casi 930 en total), todas con la voz.' }
    ]
  },
  {
    version: '1.13.0', date: '2026-10-17',
    items: [
      { fr: '🔊 Dans le quiz d’anglais, la voix se lance toute seule : chaque question est lue dès qu’elle apparaît, puis la bonne réponse après ta réponse. Plus besoin de cliquer sur « Écouter ».', en: '🔊 In the English quiz the voice now starts by itself: each question is read as soon as it appears, then the right answer after you answer. No need to click “Listen” any more.', es: '🔊 En el quiz de inglés la voz se inicia sola: cada pregunta se lee en cuanto aparece y, después de tu respuesta, la respuesta correcta. Ya no hace falta pulsar « Escuchar ».' },
      { fr: 'Si ton navigateur refuse de lancer un son avant le premier clic, un message te le dit pour la première question ; ensuite tout se lance seul. Le bouton 🔊 Voix coupe la lecture automatique.', en: 'If your browser refuses to start a sound before the first click, a message tells you for the first question; after that everything starts by itself. The 🔊 Voice button switches the automatic reading off.', es: 'Si tu navegador se niega a iniciar un sonido antes del primer clic, un mensaje te lo dice para la primera pregunta; después todo se inicia solo. El botón 🔊 Voz desactiva la lectura automática.' }
    ]
  },
  {
    version: '1.12.0', date: '2026-10-17',
    items: [
      { fr: '🎓 Le quiz d’anglais pose maintenant 5 questions à chaque ouverture, avec le bilan à la fin.', en: '🎓 The English quiz now asks 5 questions each time you open the app, with a summary at the end.', es: '🎓 El quiz de inglés ahora hace 5 preguntas cada vez que abres la aplicación, con un resumen al final.' },
      { fr: '🔊 Une voix lit la question en anglais (bouton « Écouter la question ») et la bonne réponse après chaque réponse. Elle peut être coupée avec le bouton Voix.', en: '🔊 A voice reads the question in English (“Listen to the question” button) and the right answer after each answer. It can be switched off with the Voice button.', es: '🔊 Una voz lee la pregunta en inglés (botón « Escuchar la pregunta ») y la respuesta correcta después de cada respuesta. Se puede apagar con el botón Voz.' },
      { fr: '📚 Beaucoup plus de questions : niveaux A2 et B1, avec des phrases entières (grammaire, situations de la vie courante, expressions, petits textes). Quand toutes les questions d’un niveau sont réussies, on passe au niveau suivant.', en: '📚 Many more questions: levels A2 and B1, with whole sentences (grammar, everyday situations, expressions, short texts). When every question of a level has been answered right, you move on to the next level.', es: '📚 Muchas más preguntas: niveles A2 y B1, con frases completas (gramática, situaciones cotidianas, expresiones, textos cortos). Cuando se han acertado todas las preguntas de un nivel, pasas al siguiente.' }
    ]
  },
  {
    version: '1.11.0', date: '2026-10-16',
    items: [
      { fr: '🔁 Quand tu choisis un cours à rattraper sur un créneau où un cours est déjà prévu, tu peux le remplacer : le cours remplacé passe directement dans « À rattraper » (et n’apparaît plus dans le programme du jour ni dans les rappels).', en: '🔁 When you pick a class to catch up in a slot where a class is already planned, you can replace it: the replaced class goes straight to “To catch up” (and no longer shows in today’s agenda or reminders).', es: '🔁 Cuando eliges una clase para recuperar en un hueco donde ya hay una clase prevista, puedes reemplazarla: la clase reemplazada pasa directamente a « Por recuperar » (y ya no aparece en el programa del día ni en los recordatorios).' },
      { fr: 'Rien n’est supprimé : en remettant « — Rien — » sur ce créneau, le cours retrouve sa place.', en: 'Nothing is deleted: choosing “— Nothing —” for that slot again gives the class its place back.', es: 'No se elimina nada: al volver a elegir « — Nada — » en ese hueco, la clase recupera su sitio.' }
    ]
  },
  {
    version: '1.10.0', date: '2026-10-16',
    items: [
      { fr: '📁 Tes notes et tes fichiers sont aussi rangés dans un dossier lisible sans le planner : un dossier par matière, un sous-dossier par cours, avec notes.txt (en texte simple) et les fichiers joints sous leur nom.', en: '📁 Your notes and files are also stored in a folder you can read without the planner: one folder per subject, one sub-folder per class, with notes.txt (plain text) and the attached files under their own names.', es: '📁 Tus notas y tus archivos también se guardan en una carpeta legible sin el planner: una carpeta por asignatura, una subcarpeta por clase, con notes.txt (texto simple) y los archivos adjuntos con su nombre.' },
      { fr: 'L’emplacement se choisit dans le docker-compose (LIBRARY_DIR). Le bouton 📁 Bibliothèque montre où il est, ce qu’il contient, et permet de l’éteindre ou de copier tout de suite. Rien n’est jamais effacé : ce que tu supprimes va dans « _Supprimé ».', en: 'You choose where it goes in the docker-compose file (LIBRARY_DIR). The 📁 Library button shows where it is and what it holds, and lets you switch it off or copy right away. Nothing is ever erased: what you delete goes to “_Supprimé”.', es: 'La ubicación se elige en el docker-compose (LIBRARY_DIR). El botón 📁 Biblioteca muestra dónde está y qué contiene, y permite apagarla o copiar ahora mismo. Nunca se borra nada: lo que eliminas va a « _Supprimé ».' }
    ]
  },
  {
    version: '1.9.0', date: '2026-10-15',
    items: [
      { fr: '🏆 Un succès par séance : plus aucun palier sauté (1, 2, 3, 4, 5…), pour les séances de chaque matière, toutes matières confondues et les rattrapages.', en: '🏆 One achievement per class: no step skipped (1, 2, 3, 4, 5…), for each subject’s classes, all subjects together and catch-ups.', es: '🏆 Un logro por clase: ningún escalón saltado (1, 2, 3, 4, 5…), para las clases de cada asignatura, todas juntas y las recuperaciones.' },
      { fr: '🎁 Chaque succès débloqué donne un sticker mignon en plus (30 dessins bicolores) : à retrouver dans les stickers, rubrique Récompenses.', en: '🎁 Every achievement you unlock gives an extra cute sticker (30 two-colour drawings): find them in the stickers, under Rewards.', es: '🎁 Cada logro desbloqueado da una pegatina mona extra (30 dibujos bicolores): búscalas en las pegatinas, en Recompensas.' },
      { fr: '📅 Rattrapages au choix : en cochant « Je choisis moi-même mes rattrapages », l’appli te demande quels cours rattraper demain (matin et après-midi/soir, avec l’heure : 8h, 9h, 10h…), une fois par jour quand tu coches le dernier cours. Le rattrapage automatique reste le choix par défaut.', en: '📅 Catch-ups your way: tick “I choose my catch-ups myself” and the app asks which classes to catch up tomorrow (morning and afternoon/evening, with the hour: 8, 9, 10…), once a day when you tick the last class. Automatic catch-up stays the default.', es: '📅 Recuperaciones a tu manera: marca « Elijo yo mismo mis recuperaciones » y la aplicación te pregunta qué clases recuperar mañana (mañana y tarde/noche, con la hora: 8h, 9h, 10h…), una vez al día al marcar la última clase. La recuperación automática sigue por defecto.' }
    ]
  },
  {
    version: '1.8.0', date: '2026-10-12',
    items: [
      { fr: 'Les nouveautés s’affichent ici après chaque mise à jour, au premier démarrage.', en: 'What is new is shown here after each update, the first time you open the app.', es: 'Las novedades se muestran aquí después de cada actualización, la primera vez que abres la aplicación.' },
      { fr: 'Un interrupteur « Réafficher au prochain démarrage » permet de les revoir ; le bouton 🆕 Nouveautés les rouvre à tout moment.', en: 'A “Show again at next start-up” switch lets you see them again; the 🆕 What’s new button opens them any time.', es: 'Un interruptor « Mostrar de nuevo al próximo inicio » permite volver a verlas; el botón 🆕 Novedades las abre en cualquier momento.' }
    ]
  },
  {
    version: '1.7.0', date: '2026-10-11',
    items: [
      { fr: '🎓 Quiz d’anglais (niveau A1) à chaque ouverture : 50 questions, en français/espagnol + anglais. Une erreur ne bloque pas : la bonne réponse passe en vert.', en: '🎓 English quiz (level A1) each time you open the app: 50 questions, in your language + English. A mistake never blocks you: the right answer turns green.', es: '🎓 Quiz de inglés (nivel A1) cada vez que abres la aplicación: 50 preguntas, en tu idioma + inglés. Un error no te bloquea: la respuesta correcta se pone en verde.' },
      { fr: 'Le bouton 🎓 Quiz permet de l’activer ou le désactiver, et de s’entraîner.', en: 'The 🎓 Quiz button switches it on or off, and lets you practise.', es: 'El botón 🎓 Quiz permite activarlo o desactivarlo, y practicar.' }
    ]
  },
  {
    version: '1.6.0', date: '2026-10-11',
    items: [
      { fr: '🏆 Onglet Succès : des médailles (bronze → diamant) pour chaque matière, les séries jusqu’à 60 jours, les devoirs, les stickers…', en: '🏆 Achievements tab: medals (bronze → diamond) for each subject, streaks up to 60 days, assignments, stickers…', es: '🏆 Pestaña Logros: medallas (bronce → diamante) para cada asignatura, rachas de hasta 60 días, tareas, pegatinas…' },
      { fr: 'Chaque médaille débloquée devient un sticker utilisable (Imprimer → Stickers et emojis → Succès).', en: 'Every unlocked medal becomes a sticker you can use (Print → Stickers and emojis → Achievements).', es: 'Cada medalla desbloqueada se convierte en una pegatina utilizable (Imprimir → Pegatinas y emojis → Logros).' }
    ]
  },
  {
    version: '1.5.0', date: '2026-10-11',
    items: [
      { fr: 'Programme du jour sous le compteur de cours en retard : ce qui est prévu, ce qui est en cours, le prochain.', en: 'Today’s agenda under the late-classes counter: what is planned, what is under way, what is next.', es: 'Programa de hoy bajo el contador de clases atrasadas: lo previsto, lo que está en curso, lo siguiente.' },
      { fr: '🔔 Rappels avant chaque début (15 min par défaut) : message, son et vibration dans l’application, et notification sur le téléphone (adresse HTTPS nécessaire).', en: '🔔 Reminders before every start (15 min by default): message, sound and vibration in the app, and a phone notification (needs the HTTPS address).', es: '🔔 Recordatorios antes de cada comienzo (15 min por defecto): mensaje, sonido y vibración en la aplicación, y notificación en el teléfono (necesita la dirección HTTPS).' }
    ]
  }
];

/** Devices that have never recorded a version are told about everything after this one. */
export const BASELINE_VERSION = '1.4.0';
