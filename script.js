// Configuració pública de l’aplicació web. Els permisos es definixen en firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyAvXaeDAdu3R_Yufb-CjwEypjjJR_xcvcc',
  authDomain: 'compe-gaia-octubre-2026.firebaseapp.com',
  projectId: 'compe-gaia-octubre-2026',
  storageBucket: 'compe-gaia-octubre-2026.firebasestorage.app',
  messagingSenderId: '575564173083',
  appId: '1:575564173083:web:76820b5d7287db51fe4dbe'
};

const BLOCK_COUNT = 17;
const ALLOWED_SCORES = [0, 10, 25];
const SCORE_LABELS = new Map([[0, '0'], [10, 'Zona'], [25, 'Top']]);

const form = document.getElementById('resultats');
const fields = document.getElementById('formulari');
const anonymousInput = document.getElementById('anonimo');
const identityFields = document.getElementById('dades-personals');
const dorsalInput = document.getElementById('dorsal');
const nameInput = document.getElementById('nombre');
const genderGroup = document.getElementById('grup-genero');
const nameLabel = document.querySelector('label[for="nombre"]');
const dorsalLabel = document.querySelector('label[for="dorsal"]');
const genderLegend = genderGroup.querySelector('legend');
const genderInputs = [
  document.getElementById('genero-femeni'),
  document.getElementById('genero-masculi'),
  document.getElementById('genero-altre')
];
const saveButton = document.getElementById('guardar');
const statusMessage = document.getElementById('estat');
const returnNotice = document.getElementById('avis-retorn');
const helpButtons = [...document.querySelectorAll('.boto-ajuda')];

let sending = false;
let saved = false;
let firebaseClientPromise = null;

const VISIT_STORAGE_KEY = 'gaia_form_visited';
const DORSAL_PATTERN = /^[A-Za-z0-9]{1,20}$/;
const requiredIndicatorTimers = new WeakMap();

function detectReturnVisit() {
  try {
    const hasVisited = localStorage.getItem(VISIT_STORAGE_KEY) === '1';
    returnNotice.hidden = !hasVisited;
    localStorage.setItem(VISIT_STORAGE_KEY, '1');
    // Retira l’identificador de l’antic mode anònim; ara la identitat és el dorçal.
    localStorage.removeItem('gaia_anonymous_id');
  } catch (error) {
    returnNotice.hidden = true;
    console.warn('No s’ha pogut comprovar si és una visita repetida.', error);
  }
}

function setHelpOpen(button, isOpen) {
  button.closest('.etiqueta-amb-ajuda').classList.toggle('ajuda-oberta', isOpen);
  button.setAttribute('aria-expanded', String(isOpen));
}

function closeHelpTips(exceptButton = null) {
  helpButtons.forEach(button => {
    if (button !== exceptButton) setHelpOpen(button, false);
  });
}

helpButtons.forEach(button => {
  button.addEventListener('click', event => {
    event.stopPropagation();
    const shouldOpen = button.getAttribute('aria-expanded') !== 'true';
    closeHelpTips(button);
    setHelpOpen(button, shouldOpen);
  });
});

document.addEventListener('click', event => {
  if (!event.target.closest('.etiqueta-amb-ajuda')) closeHelpTips();
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const openButton = helpButtons.find(button => button.getAttribute('aria-expanded') === 'true');
  if (!openButton) return;
  setHelpOpen(openButton, false);
  openButton.focus();
});

detectReturnVisit();

function flashRequiredIndicator(label) {
  clearTimeout(requiredIndicatorTimers.get(label));
  label.classList.remove('camp-obligatori-pendent');
  void label.offsetWidth;
  label.classList.add('camp-obligatori-pendent');
  const timer = setTimeout(() => {
    label.classList.remove('camp-obligatori-pendent');
    requiredIndicatorTimers.delete(label);
  }, 2000);
  requiredIndicatorTimers.set(label, timer);
}

function createScores() {
  const container = document.getElementById('blocs');
  for (let i = 1; i <= BLOCK_COUNT; i += 1) {
    const group = document.createElement('fieldset');
    group.className = 'puntuacio';
    const legend = document.createElement('legend');
    legend.textContent = `Bloc ${i}`;
    group.append(legend);

    const options = document.createElement('div');
    options.className = 'opcions';
    for (const score of ALLOWED_SCORES) {
      const option = document.createElement('label');
      option.className = 'opcio';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `bloque${i}`;
      radio.value = String(score);
      radio.checked = score === 0;
      radio.setAttribute('aria-label', score === 0 ? '0 punts' : `${SCORE_LABELS.get(score)}, ${score} punts`);
      const text = document.createElement('span');
      text.textContent = SCORE_LABELS.get(score);
      option.append(radio, text);
      options.append(option);
    }
    group.append(options);
    container.append(group);
  }
}

createScores();

function readResult() {
  const data = new FormData(form);
  const isAnonymous = anonymousInput.checked;
  const selectedGender = genderInputs.find(input => input.checked);
  const result = {
    dorsal: dorsalInput.value.trim().toUpperCase(),
    anonimo: isAnonymous,
    nombre: isAnonymous ? 'Anònim' : nameInput.value.trim(),
    genero: isAnonymous ? 'Altre' : selectedGender?.value || ''
  };

  let total = 0;
  for (let i = 1; i <= BLOCK_COUNT; i += 1) {
    const raw = data.get(`bloque${i}`);
    const score = Number(raw);
    if (raw === null || !ALLOWED_SCORES.includes(score)) {
      throw new Error('Selecciona una puntuació vàlida en cada bloc.');
    }
    result[`bloque${i}`] = score;
    total += score;
  }
  result.total = total;
  return result;
}

form.addEventListener('change', () => {
  document.getElementById('total').textContent = `Total: ${readResult().total} punts`;
});
nameInput.addEventListener('input', () => nameInput.removeAttribute('aria-invalid'));
function cleanDorsal(value) {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function normalizeDorsalInput() {
  const value = dorsalInput.value;
  const start = dorsalInput.selectionStart;
  const end = dorsalInput.selectionEnd;
  const direction = dorsalInput.selectionDirection;
  const normalized = cleanDorsal(value).slice(0, dorsalInput.maxLength);
  if (value !== normalized) {
    dorsalInput.value = normalized;
    dorsalInput.setSelectionRange(
      cleanDorsal(value.slice(0, start)).length,
      cleanDorsal(value.slice(0, end)).length,
      direction
    );
  }
  dorsalInput.removeAttribute('aria-invalid');
}

dorsalInput.addEventListener('input', event => {
  if (!event.isComposing) normalizeDorsalInput();
});
dorsalInput.addEventListener('compositionend', normalizeDorsalInput);
dorsalInput.addEventListener('paste', event => {
  if (!event.clipboardData) return;
  event.preventDefault();
  const available = dorsalInput.maxLength - dorsalInput.value.length +
    dorsalInput.selectionEnd - dorsalInput.selectionStart;
  const text = cleanDorsal(event.clipboardData.getData('text')).slice(0, available);
  dorsalInput.setRangeText(text, dorsalInput.selectionStart, dorsalInput.selectionEnd, 'end');
  normalizeDorsalInput();
});
genderInputs.forEach(input => input.addEventListener('change', () => genderGroup.removeAttribute('aria-invalid')));
anonymousInput.addEventListener('change', () => {
  const isAnonymous = anonymousInput.checked;
  closeHelpTips();
  identityFields.hidden = isAnonymous;
  nameInput.disabled = isAnonymous;
  nameInput.required = !isAnonymous;
  genderInputs.forEach(input => { input.disabled = isAnonymous; });
  nameInput.removeAttribute('aria-invalid');
  genderGroup.removeAttribute('aria-invalid');
  statusMessage.textContent = '';
});
form.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.isComposing && !event.target.classList.contains('boto-ajuda')) {
    event.preventDefault();
  }
});

function scrollToTop() {
  function resetPosition() {
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }
  resetPosition();
  requestAnimationFrame(() => {
    resetPosition();
    requestAnimationFrame(resetPosition);
  });
}

function scoreSummary(score) {
  if (score === 10) return 'Zona · 10 punts';
  if (score === 25) return 'Top · 25 punts';
  return '0 punts';
}

function showScoreSummary(result) {
  const container = document.getElementById('resum-blocs');
  container.replaceChildren();
  for (let i = 1; i <= BLOCK_COUNT; i += 1) {
    const row = document.createElement('div');
    const title = document.createElement('dt');
    title.textContent = `Bloc ${i}`;
    const score = document.createElement('dd');
    score.textContent = scoreSummary(result[`bloque${i}`]);
    row.append(title, score);
    container.append(row);
  }
}

function validateIdentity() {
  const dorsal = dorsalInput.value.trim();
  if (!DORSAL_PATTERN.test(dorsal)) {
    dorsalInput.setAttribute('aria-invalid', 'true');
    flashRequiredIndicator(dorsalLabel);
    statusMessage.textContent = 'Introduïx un número de dorçal d’entre 1 i 20 lletres o números, sense espais ni guions.';
    dorsalInput.focus();
    return false;
  }
  dorsalInput.value = dorsal.toUpperCase();
  if (anonymousInput.checked) return true;
  if (!nameInput.value.trim()) {
    nameInput.setAttribute('aria-invalid', 'true');
    flashRequiredIndicator(nameLabel);
    statusMessage.textContent = 'Introduïx el nom de l’escalador.';
    nameInput.focus();
    return false;
  }
  if (nameInput.value.trim().length > 30) {
    nameInput.setAttribute('aria-invalid', 'true');
    flashRequiredIndicator(nameLabel);
    statusMessage.textContent = 'El nom no pot tindre més de 30 caràcters.';
    nameInput.focus();
    return false;
  }

  if (!genderInputs.some(input => input.checked)) {
    genderGroup.setAttribute('aria-invalid', 'true');
    flashRequiredIndicator(genderLegend);
    statusMessage.textContent = 'Selecciona una opció de gènere.';
    genderInputs[0].focus();
    return false;
  }
  return true;
}

async function saveResult(result) {
  if (navigator.onLine === false) throw new TypeError('Sense connexió.');
  if (!firebaseClientPromise) {
    firebaseClientPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore-lite.js')
    ]).then(([appSdk, firestoreSdk]) => {
      const app = appSdk.initializeApp(firebaseConfig);
      return { ...firestoreSdk, db: firestoreSdk.getFirestore(app) };
    }).catch(error => {
      firebaseClientPromise = null;
      throw error;
    });
  }

  const { db, doc, setDoc, serverTimestamp } = await firebaseClientPromise;
  // Sense merge: cada enviament reemplaça totes les dades del mateix dorçal.
  await setDoc(doc(db, 'resultados', result.dorsal), {
    ...result,
    updated_at: serverTimestamp()
  });
}

function saveErrorMessage(error) {
  switch (error?.code) {
    case 'permission-denied':
      return 'No s’han pogut guardar els resultats. Cal revisar les regles de Firestore amb l’organització.';
    case 'resource-exhausted':
      return 'S’ha arribat al límit d’ús de la base de dades. Avisa l’organització.';
    case 'invalid-argument':
    case 'failed-precondition':
    case 'not-found':
    case 'app/invalid-api-key':
      return 'No s’ha pogut accedir a la base de dades. Cal revisar la configuració de Firebase amb l’organització.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'No s’ha pogut confirmar el guardat. Comprova la connexió i torna-ho a provar amb el mateix número de dorçal.';
    default:
      return error instanceof TypeError
        ? 'No s’ha pogut connectar. Comprova la connexió a Internet i torna-ho a provar.'
        : 'No s’han pogut guardar els resultats. Torna-ho a provar. Si continua, avisa l’organització.';
  }
}

function showConfirmation(result) {
  document.getElementById('resum-dorsal').textContent = result.dorsal;
  document.getElementById('resum-anonim').textContent = result.anonimo ? 'Sí' : 'No';
  document.getElementById('resum-nom').textContent = result.nombre;
  document.getElementById('resum-genero').textContent = result.genero;
  showScoreSummary(result);
  document.getElementById('resum-total').textContent = `${result.total} punts`;

  form.hidden = true;
  returnNotice.hidden = true;
  statusMessage.textContent = '';
  document.getElementById('confirmacio').hidden = false;
  document.getElementById('agraiment').focus({ preventScroll: true });
  scrollToTop();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending || saved) return;
  statusMessage.textContent = '';
  if (!validateIdentity()) return;

  try {
    const result = readResult();
    dorsalInput.value = result.dorsal;
    if (!anonymousInput.checked) {
      nameInput.value = result.nombre;
    }
    sending = true;
    fields.disabled = true;
    form.setAttribute('aria-busy', 'true');
    saveButton.textContent = 'Guardant…';

    closeHelpTips();
    await saveResult(result);
    saved = true;
    showConfirmation(result);
  } catch (error) {
    console.error('No s’han pogut guardar els resultats:', error);
    statusMessage.textContent = saveErrorMessage(error);
    saveButton.textContent = 'GUARDAR RESULTATS';
  } finally {
    sending = false;
    fields.disabled = saved;
    form.removeAttribute('aria-busy');
  }
});
