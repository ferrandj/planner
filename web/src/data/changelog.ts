/**
 * What is new in each version, shown once after an update (and on demand from the "Nouveautés" button).
 * Add an entry here for every release that changes something the user can see; the newest goes first.
 * The `version` is the one the release will get (the "[minor]" / "[major]" marker in the pull request title decides it).
 */
export interface ChangeItem { fr: string; en: string; es: string }
export interface ChangeEntry { version: string; date: string; items: ChangeItem[] }

export const CHANGELOG: ChangeEntry[] = [
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
