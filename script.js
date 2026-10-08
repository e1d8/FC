// Copia ací l’URL de la implementació web de Google Apps Script, acabada en /exec.
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_6xXSPIx5A1duDRSo-9iMPRQKQ3JSD5WjF5tFKZH_J6jxMwpqHGpRvrV-N4zFnCcw/exec';

const BLOCK_COUNT = 17;
const ALLOWED_SCORES = [0, 10, 25];
const SCORE_LABELS = new Map([[0, '0'], [10, 'Zona'], [25, 'Top']]);
const REQUEST_TIMEOUT = 60000;

const form = document.getElementById('resultats');
const fields = document.getElementById('formulari');
const anonymousInput = document.getElementById('anonimo');
const identityFields = document.getElementById('dades-personals');
const nameInput = document.getElementById('nombre');
const emailInput = document.getElementById('correo');
const genderGroup = document.getElementById('grup-genero');
const nameLabel = document.querySelector('label[for="nombre"]');
const emailLabel = document.querySelector('label[for="correo"]');
const genderLegend = genderGroup.querySelector('legend');
const genderInputs = [
  document.getElementById('genero-femeni'),
  document.getElementById('genero-masculi'),
  document.getElementById('genero-altre')
];
const saveButton = document.getElementById('guardar');
const statusMessage = document.getElementById('estat');
const emailWarning = document.getElementById('resum-avis-correu');

let sending = false;
let saved = false;
let pendingResult = null;
let anonymousKey = null;

const ANONYMOUS_STORAGE_KEY = 'gaia_anonymous_id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const requiredIndicatorTimers = new WeakMap();

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

function getAnonymousKey() {
  if (anonymousKey) return anonymousKey;
  let id = null;
  try {
    const storedId = localStorage.getItem(ANONYMOUS_STORAGE_KEY);
    if (storedId && UUID_PATTERN.test(storedId)) id = storedId;
  } catch (error) {
    console.warn('No s’ha pogut llegir l’identificador anònim local.', error);
  }
  if (!id) {
    id = crypto.randomUUID();
    try {
      localStorage.setItem(ANONYMOUS_STORAGE_KEY, id);
    } catch (error) {
      console.warn('No s’ha pogut conservar l’identificador anònim local.', error);
    }
  }
  anonymousKey = `anonim-${id}`;
  return anonymousKey;
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
    nombre: isAnonymous ? 'Anònim' : nameInput.value.trim(),
    correo: isAnonymous ? `${getAnonymousKey()}@anonim.invalid` : emailInput.value.trim().toLowerCase(),
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
emailInput.addEventListener('input', () => emailInput.removeAttribute('aria-invalid'));
genderInputs.forEach(input => input.addEventListener('change', () => genderGroup.removeAttribute('aria-invalid')));
anonymousInput.addEventListener('change', () => {
  const isAnonymous = anonymousInput.checked;
  identityFields.hidden = isAnonymous;
  nameInput.disabled = isAnonymous;
  emailInput.disabled = isAnonymous;
  genderInputs.forEach(input => { input.disabled = isAnonymous; });
  nameInput.removeAttribute('aria-invalid');
  emailInput.removeAttribute('aria-invalid');
  genderGroup.removeAttribute('aria-invalid');
  statusMessage.textContent = '';
});
form.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.isComposing) event.preventDefault();
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

  emailInput.value = emailInput.value.trim().toLowerCase();
  if (!emailInput.value || !emailInput.validity.valid || !EMAIL_PATTERN.test(emailInput.value)) {
    emailInput.setAttribute('aria-invalid', 'true');
    flashRequiredIndicator(emailLabel);
    statusMessage.textContent = 'Introduïx un correu electrònic vàlid.';
    emailInput.focus();
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
  if (!GOOGLE_APPS_SCRIPT_URL || !GOOGLE_APPS_SCRIPT_URL.endsWith('/exec')) {
    throw new Error('Cal configurar l’URL de Google Apps Script abans de guardar. Consulta el README.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(result),
      redirect: 'follow',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`El servidor ha respost amb l’estat HTTP ${response.status}.`);
    const answer = await response.json().catch(() => null);
    if (!answer || answer.ok !== true) {
      throw new Error(answer?.message || 'Google Sheets ha rebutjat les dades enviades.');
    }
    return answer;
  } finally {
    clearTimeout(timeout);
  }
}

function showConfirmation(result, answer) {
  document.getElementById('resum-nom').textContent = result.nombre;
  document.getElementById('resum-correu').textContent = result.correo;
  document.getElementById('resum-genero').textContent = result.genero;
  const isAnonymous = result.correo.endsWith('@anonim.invalid');
  document.getElementById('resum-correu-etiqueta').hidden = isAnonymous;
  document.getElementById('resum-correu').hidden = isAnonymous;
  showScoreSummary(result);
  document.getElementById('resum-total').textContent = `${result.total} punts`;

  emailWarning.hidden = true;
  emailWarning.textContent = '';
  if (!isAnonymous && answer.emailSent === false) {
    emailWarning.textContent = 'Els resultats s’han guardat, però no s’ha pogut enviar el correu de resum.';
    emailWarning.hidden = false;
  }

  form.hidden = true;
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
    if (!anonymousInput.checked) {
      nameInput.value = result.nombre;
      emailInput.value = result.correo;
    }
    pendingResult = result;
    sending = true;
    fields.disabled = true;
    form.setAttribute('aria-busy', 'true');
    saveButton.textContent = 'Guardant…';

    const answer = await saveResult(pendingResult);
    saved = true;
    showConfirmation(pendingResult, answer);
  } catch (error) {
    console.error('No s’han pogut guardar els resultats:', error);
    statusMessage.textContent = error.name === 'AbortError'
      ? 'No s’ha pogut confirmar el guardat a temps. Comprova els resultats abans de tornar-ho a provar.'
      : error instanceof TypeError
        ? 'No s’ha pogut connectar. Comprova la connexió a Internet i torna-ho a provar.'
        : error.message;
    saveButton.textContent = 'GUARDAR RESULTATS';
  } finally {
    sending = false;
    fields.disabled = saved;
    form.removeAttribute('aria-busy');
  }
});
