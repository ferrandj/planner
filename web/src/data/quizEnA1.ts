/**
 * "Basic English" quiz, level A1: 50 questions, from the easiest to a little harder (words with pictures, polite phrases,
 * "to be" and "to have", articles and plurals, numbers and days, everyday words).
 * The question is asked in English and in the language of the app; the answers are in English; after each answer a short
 * explanation says what the right one means.
 */

export interface Question {
  id: string;
  /** theme the question belongs to (more themes can be added later) */
  theme: 'en-a1';
  q: string;
  fr: string;
  es: string;
  /** the right answer, then three wrong ones (they are shuffled when shown) */
  correct: string;
  wrong: [string, string, string];
  why: { en: string; fr: string; es: string };
}

const id = (n: number): string => 'en-a1-' + String(n).padStart(2, '0');

function Q(n: number, q: string, fr: string, es: string, correct: string, wrong: [string, string, string], en: string, frWhy: string, esWhy: string): Question {
  return { id: id(n), theme: 'en-a1', q, fr, es, correct, wrong, why: { en, fr: frWhy, es: esWhy } };
}

/** A picture-word question. */
function V(n: number, emoji: string, correct: string, wrong: [string, string, string], fr: string, es: string): Question {
  return Q(n, `What is the English word for ${emoji}?`, `Quel est le mot anglais pour ${emoji} ?`, `¿Cómo se dice ${emoji} en inglés?`, correct, wrong,
    `${emoji} = “${correct}”.`, `${emoji} se dit « ${correct} » (${fr}).`, `${emoji} se dice “${correct}” (${es}).`);
}

export const QUESTIONS: Question[] = [
  // words with pictures
  V(1, '🐱', 'cat', ['dog', 'cow', 'pig'], 'chat', 'gato'),
  V(2, '🐶', 'dog', ['fish', 'bird', 'horse'], 'chien', 'perro'),
  V(3, '🍎', 'apple', ['banana', 'orange', 'cake'], 'pomme', 'manzana'),
  V(4, '🍞', 'bread', ['milk', 'cheese', 'egg'], 'pain', 'pan'),
  V(5, '🥛', 'milk', ['water', 'juice', 'tea'], 'lait', 'leche'),
  V(6, '🏠', 'house', ['car', 'school', 'tree'], 'maison', 'casa'),
  V(7, '🚗', 'car', ['bus', 'bike', 'train'], 'voiture', 'coche'),
  V(8, '📖', 'book', ['pen', 'desk', 'bag'], 'livre', 'libro'),
  V(9, '☀️', 'sun', ['moon', 'star', 'cloud'], 'soleil', 'sol'),
  V(10, '🌧️', 'rain', ['snow', 'wind', 'sun'], 'pluie', 'lluvia'),
  V(11, '🔴', 'red', ['blue', 'green', 'yellow'], 'rouge', 'rojo'),
  V(12, '💧', 'water', ['fire', 'milk', 'tea'], 'eau', 'agua'),

  // polite phrases and introductions
  Q(13, '“Hello! How are you?” Which answer is good?', '« Hello! How are you? » Quelle réponse convient ?', '« Hello! How are you? » ¿Qué respuesta es adecuada?',
    "I'm fine, thank you.", ["I'm twelve.", "It's Monday.", 'Yes, please.'],
    '“How are you?” asks how you feel. You can answer “I’m fine, thank you.”', '« How are you? » demande comment tu vas. On répond « I’m fine, thank you. » (Je vais bien, merci.)', '« How are you? » pregunta cómo estás. Se responde « I’m fine, thank you. » (Estoy bien, gracias.)'),
  Q(14, 'What do you say in the morning?', 'Que dit-on le matin ?', '¿Qué se dice por la mañana?',
    'Good morning', ['Good night', 'Good evening', 'See you'],
    '“Good morning” is how you greet people in the morning.', '« Good morning » = bonjour (le matin).', '« Good morning » = buenos días.'),
  Q(15, 'What do you say before you go to bed?', "Que dit-on avant d'aller dormir ?", '¿Qué se dice antes de ir a dormir?',
    'Good night', ['Good morning', 'Good afternoon', 'Welcome'],
    '“Good night” is for the end of the day, before sleeping.', '« Good night » = bonne nuit.', '« Good night » = buenas noches (al despedirse).'),
  Q(16, 'Someone says “Thank you!”. What do you answer?', 'Quelqu’un te dit « Thank you! ». Que réponds-tu ?', 'Alguien te dice « Thank you! ». ¿Qué respondes?',
    "You're welcome.", ['Good morning.', "I'm sorry.", 'See you.'],
    '“You’re welcome” is the polite answer to “Thank you”.', '« You’re welcome » = de rien.', '« You’re welcome » = de nada.'),
  Q(17, "You step on someone's foot. What do you say?", "Tu marches sur le pied de quelqu'un. Que dis-tu ?", 'Pisas el pie de alguien. ¿Qué dices?',
    'Sorry!', ['Please.', 'Hello.', 'Goodbye.'],
    '“Sorry” is what you say when you make a mistake or hurt someone.', '« Sorry » = pardon, désolé.', '« Sorry » = perdón, lo siento.'),
  Q(18, 'You are leaving. What do you say?', 'Tu t’en vas. Que dis-tu ?', 'Te vas. ¿Qué dices?',
    'Goodbye!', ['Hello!', 'Welcome!', 'Please!'],
    '“Goodbye” is what you say when you leave.', '« Goodbye » = au revoir.', '« Goodbye » = adiós.'),
  Q(19, '“What’s your name?” Which answer is good?', '« What’s your name? » Quelle réponse convient ?', '« What’s your name? » ¿Qué respuesta es adecuada?',
    'My name is Anna.', ["I'm fine.", "I'm ten.", "It's red."],
    '“What’s your name?” asks for your name: “My name is…”.', '« What’s your name? » = comment tu t’appelles ? On répond « My name is Anna. »', '« What’s your name? » = ¿cómo te llamas? Se responde « My name is Anna. »'),
  Q(20, '“How old are you?” Which answer is good?', '« How old are you? » Quelle réponse convient ?', '« How old are you? » ¿Qué respuesta es adecuada?',
    "I'm twenty.", ["I'm happy.", "I'm Tom.", "I'm here."],
    '“How old are you?” asks your age: “I’m twenty.”', '« How old are you? » = quel âge as-tu ? On répond « I’m twenty. »', '« How old are you? » = ¿cuántos años tienes? Se responde « I’m twenty. »'),
  Q(21, '“Where are you from?” Which answer is good?', '« Where are you from? » Quelle réponse convient ?', '« Where are you from? » ¿Qué respuesta es adecuada?',
    "I'm from France.", ["I'm from Monday.", "I'm a teacher.", "I'm very well."],
    '“Where are you from?” asks for your country or town: “I’m from…”.', '« Where are you from? » = d’où viens-tu ? On répond « I’m from France. »', '« Where are you from? » = ¿de dónde eres? Se responde « I’m from France. »'),
  Q(22, 'Someone says “Nice to meet you.” What do you answer?', 'Quelqu’un te dit « Nice to meet you. ». Que réponds-tu ?', 'Alguien te dice « Nice to meet you. ». ¿Qué respondes?',
    'Nice to meet you, too.', ["You're welcome.", 'Good night.', "I'm eight."],
    'You answer “Nice to meet you, too.” (too = also).', '« Nice to meet you, too. » = enchanté(e) aussi.', '« Nice to meet you, too. » = encantado/a yo también.'),

  // grammar: to be, to have, articles, plurals, question words
  Q(23, 'I ___ a student.', 'Complète : « I ___ a student. »', 'Completa: « I ___ a student. »',
    'am', ['is', 'are', 'be'],
    'With “I” we use “am”: I am.', 'Avec « I » (je), on utilise « am » : I am (je suis).', 'Con « I » (yo) se usa « am »: I am (yo soy).'),
  Q(24, 'She ___ happy.', 'Complète : « She ___ happy. »', 'Completa: « She ___ happy. »',
    'is', ['am', 'are', 'be'],
    'With he, she, it we use “is”.', 'Avec he, she, it (il, elle), on utilise « is ».', 'Con he, she, it (él, ella) se usa « is ».'),
  Q(25, 'They ___ at home.', 'Complète : « They ___ at home. »', 'Completa: « They ___ at home. »',
    'are', ['is', 'am', 'be'],
    'With you, we, they we use “are”.', 'Avec you, we, they (vous, nous, ils), on utilise « are ».', 'Con you, we, they (vosotros, nosotros, ellos) se usa « are ».'),
  Q(26, 'He ___ a new bike.', 'Complète : « He ___ a new bike. »', 'Completa: « He ___ a new bike. »',
    'has', ['have', 'is', 'are'],
    '“To have” becomes “has” with he, she, it.', '« To have » (avoir) devient « has » avec he, she, it.', '« To have » (tener) se convierte en « has » con he, she, it.'),
  Q(27, 'I ___ two brothers.', 'Complète : « I ___ two brothers. »', 'Completa: « I ___ two brothers. »',
    'have', ['has', 'am', 'is'],
    'With I, you, we, they we say “have”.', 'Avec I, you, we, they, on dit « have » (j’ai).', 'Con I, you, we, they se dice « have » (tengo).'),
  Q(28, 'This is ___ apple.', 'Complète : « This is ___ apple. »', 'Completa: « This is ___ apple. »',
    'an', ['a', 'two', 'many'],
    'We use “an” before a vowel sound: an apple, an egg.', 'On utilise « an » devant une voyelle : an apple, an egg.', 'Se usa « an » delante de una vocal: an apple, an egg.'),
  Q(29, 'I have ___ dog.', 'Complète : « I have ___ dog. »', 'Completa: « I have ___ dog. »',
    'a', ['an', 'two', 'many'],
    'We use “a” before a consonant sound: a dog, a book.', 'On utilise « a » devant une consonne : a dog, a book.', 'Se usa « a » delante de una consonante: a dog, a book.'),
  Q(30, 'One cat, two ___.', 'Complète : « One cat, two ___. »', 'Completa: « One cat, two ___. »',
    'cats', ['cat', 'cates', 'catten'],
    'Most plurals just add -s: cat → cats.', 'La plupart des pluriels ajoutent -s : cat → cats.', 'La mayoría de plurales añaden -s: cat → cats.'),
  Q(31, 'One child, two ___.', 'Complète : « One child, two ___. »', 'Completa: « One child, two ___. »',
    'children', ['childs', 'childes', 'childen'],
    '“Child” has an irregular plural: children.', '« Child » a un pluriel irrégulier : children.', '« Child » tiene un plural irregular: children.'),
  Q(32, '___ is your name?', 'Complète : « ___ is your name? »', 'Completa: « ___ is your name? »',
    'What', ['Where', 'Who', 'When'],
    '“What” asks about a thing: What is your name?', '« What » (quoi, quel) : What is your name?', '« What » (qué, cuál): What is your name?'),
  Q(33, 'The book is ___ the table.', 'Complète : « The book is ___ the table. »', 'Completa: « The book is ___ the table. »',
    'on', ['at', 'to', 'of'],
    '“On” means touching the top of something: on the table.', '« On » = sur : on the table (sur la table).', '« On » = sobre, encima de: on the table (sobre la mesa).'),
  Q(34, 'This is my sister. ___ name is Maria.', 'Complète : « This is my sister. ___ name is Maria. »', 'Completa: « This is my sister. ___ name is Maria. »',
    'Her', ['His', 'Its', 'My'],
    '“Her” is for a girl or a woman: her name.', '« Her » = son/sa (d’une fille ou d’une femme) : her name.', '« Her » = su (de una chica o mujer): her name.'),

  // numbers, days, months, time
  Q(35, 'What is the English word for 3?', 'Quel est le mot anglais pour 3 ?', '¿Cómo se dice 3 en inglés?',
    'three', ['tree', 'thirty', 'free'],
    '3 = three. (A “tree” is an arbre / un árbol; 30 = thirty.)', '3 = three. (« tree » = arbre ; 30 = thirty.)', '3 = three. (« tree » = árbol; 30 = thirty.)'),
  Q(36, 'What is the English word for 7?', 'Quel est le mot anglais pour 7 ?', '¿Cómo se dice 7 en inglés?',
    'seven', ['six', 'seventeen', 'seventy'],
    '7 = seven. 17 = seventeen, 70 = seventy.', '7 = seven. 17 = seventeen, 70 = seventy.', '7 = seven. 17 = seventeen, 70 = seventy.'),
  Q(37, 'What is the English word for 12?', 'Quel est le mot anglais pour 12 ?', '¿Cómo se dice 12 en inglés?',
    'twelve', ['two', 'ten', 'twenty'],
    '12 = twelve. 20 = twenty.', '12 = twelve. 20 = twenty.', '12 = twelve. 20 = twenty.'),
  Q(38, 'What day comes after Monday?', 'Quel jour vient après Monday (lundi) ?', '¿Qué día viene después de Monday (lunes)?',
    'Tuesday', ['Sunday', 'Thursday', 'Friday'],
    'Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.', 'Monday (lundi), Tuesday (mardi), Wednesday (mercredi), Thursday (jeudi), Friday (vendredi), Saturday (samedi), Sunday (dimanche).', 'Monday (lunes), Tuesday (martes), Wednesday (miércoles), Thursday (jueves), Friday (viernes), Saturday (sábado), Sunday (domingo).'),
  Q(39, 'Which word is a month?', 'Quel mot est un mois ?', '¿Qué palabra es un mes?',
    'March', ['Monday', 'Morning', 'Mother'],
    'March is a month (mars). Monday is a day, morning is a part of the day.', '« March » = mars. « Monday » est un jour, « morning » le matin.', '« March » = marzo. « Monday » es un día, « morning » la mañana.'),
  Q(40, 'It is 3:00. What do you say?', 'Il est 3 h. Que dit-on ?', 'Son las 3:00. ¿Qué se dice?',
    "It's three o'clock.", ["It's three years.", "It's three days.", "It's third."],
    'For a full hour we say “It’s … o’clock”.', 'Pour une heure pile : « It’s three o’clock » (il est trois heures).', 'Para una hora en punto: « It’s three o’clock » (son las tres).'),
  Q(41, 'Which days are the weekend?', 'Quels jours forment le week-end ?', '¿Qué días forman el fin de semana?',
    'Saturday and Sunday', ['Monday and Tuesday', 'Friday and Monday', 'Wednesday and Thursday'],
    'The weekend is Saturday and Sunday.', 'Le week-end, c’est Saturday (samedi) et Sunday (dimanche).', 'El fin de semana es Saturday (sábado) y Sunday (domingo).'),
  Q(42, 'Which is the first month of the year?', 'Quel est le premier mois de l’année ?', '¿Cuál es el primer mes del año?',
    'January', ['December', 'June', 'March'],
    'January is the first month, December the last.', 'January (janvier) est le premier mois, December (décembre) le dernier.', 'January (enero) es el primer mes, December (diciembre) el último.'),

  // everyday words
  Q(43, 'Your mother and your father are your ___.', 'Ta mère et ton père sont tes ___.', 'Tu madre y tu padre son tus ___.',
    'parents', ['children', 'friends', 'teachers'],
    'Mother + father = parents.', 'Mother + father = parents (les parents).', 'Mother + father = parents (los padres).'),
  Q(44, "Your mother's mother is your ___.", 'La mère de ta mère est ta ___.', 'La madre de tu madre es tu ___.',
    'grandmother', ['aunt', 'sister', 'daughter'],
    'The mother of your mother or father is your grandmother.', '« Grandmother » = grand-mère.', '« Grandmother » = abuela.'),
  Q(45, 'I ___ breakfast at eight o’clock.', 'Complète : « I ___ breakfast at eight o’clock. »', 'Completa: « I ___ breakfast at eight o’clock. »',
    'have', ['am', 'are', 'is'],
    'In English we “have” breakfast, lunch and dinner.', 'En anglais, on « have » breakfast (prend le petit-déjeuner).', 'En inglés se dice « have breakfast » (desayunar).'),
  Q(46, 'You write with a ___.', 'On écrit avec un ___.', 'Se escribe con un ___.',
    'pen', ['cup', 'shoe', 'fork'],
    'You write with a pen (or a pencil).', '« Pen » = stylo.', '« Pen » = bolígrafo.'),
  Q(47, 'What is the opposite of “big”?', 'Quel est le contraire de « big » ?', '¿Cuál es lo contrario de « big »?',
    'small', ['tall', 'hot', 'new'],
    'big ↔ small.', 'big (grand) ↔ small (petit).', 'big (grande) ↔ small (pequeño).'),
  Q(48, 'What is the opposite of “hot”?', 'Quel est le contraire de « hot » ?', '¿Cuál es lo contrario de « hot »?',
    'cold', ['warm', 'sad', 'old'],
    'hot ↔ cold.', 'hot (chaud) ↔ cold (froid).', 'hot (caliente) ↔ cold (frío).'),
  Q(49, 'What colour is the sky on a sunny day?', 'De quelle couleur est le ciel un jour de soleil ?', '¿De qué color es el cielo en un día de sol?',
    'blue', ['green', 'black', 'red'],
    'The sky is blue.', 'Le ciel est « blue » (bleu).', 'El cielo es « blue » (azul).'),
  Q(50, 'Complete: “I ___ English.”', 'Complète : « I ___ English. »', 'Completa: « I ___ English. »',
    'speak', ['speaks', 'speaking', 'am speak'],
    'With “I” the verb has no ending: I speak. Well done!', 'Avec « I », le verbe ne change pas : I speak (je parle). Bravo !', 'Con « I », el verbo no cambia: I speak (hablo). ¡Muy bien!')
];
