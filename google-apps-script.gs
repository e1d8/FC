const NOM_FULL = 'Resultats';
const TOTAL_BLOCS = 17;
const PUNTUACIONS_VALIDES = [0, 10, 25];
const GENERES_VALIDS = ['Femení', 'Masculí', 'Altre'];
const DOMINI_ANONIM = '@anonim.invalid';
const NOM_REMITENT = 'FormulariCompeticióGaia';
const CLAU_ID_FULL = 'SPREADSHEET_ID';
const CAPCALERES = [
  'id', 'correo', 'nombre', 'genero',
  ...Array.from({ length: TOTAL_BLOCS }, (_, index) => `bloque${index + 1}`),
  'total', 'updated_at'
];

function configuraFull() {
  const llibre = SpreadsheetApp.getActiveSpreadsheet();
  if (!llibre) throw new Error('Obri Apps Script des del full de càlcul abans d’executar esta funció.');
  PropertiesService.getScriptProperties().setProperty(CLAU_ID_FULL, llibre.getId());
  const full = preparaFull_(llibre);
  full.getRange(1, 1, full.getMaxRows(), 4).setNumberFormat('@');
  full.autoResizeColumns(1, CAPCALERES.length);
}

function doPost(event) {
  try {
    const contingut = event && event.postData ? event.postData.contents : '';
    const dades = validaResultat_(JSON.parse(contingut || '{}'));
    const bloqueig = LockService.getScriptLock();
    if (!bloqueig.tryLock(10000)) {
      return respostaJson_({
        ok: false,
        code: 'BUSY',
        message: 'Hi ha un altre guardat en curs. Torna-ho a provar.'
      });
    }

    let guardat;
    try {
      guardat = guardaResultat_(dades);
    } finally {
      bloqueig.releaseLock();
    }

    let emailSent = null;
    let emailError = null;
    if (!dades.correo.endsWith(DOMINI_ANONIM)) {
      try {
        if (MailApp.getRemainingDailyQuota() < 1) {
          throw new Error('QUOTA');
        }
        enviaCorreu_(dades);
        emailSent = true;
      } catch (error) {
        console.error('No s’ha pogut enviar el correu de resum.', error);
        emailSent = false;
        emailError = error && error.message === 'QUOTA' ? 'QUOTA' : 'SEND_FAILED';
      }
    }

    return respostaJson_({
      ok: true,
      action: guardat.action,
      id: guardat.id,
      emailSent,
      emailError
    });
  } catch (error) {
    console.error('No s’ha pogut processar el resultat.', error);
    return respostaJson_({
      ok: false,
      code: error && error.code ? error.code : 'SERVER_ERROR',
      message: error && error.publicMessage
        ? error.publicMessage
        : 'No s’han pogut guardar els resultats. Torna-ho a provar.'
    });
  }
}

function doGet(event) {
  try {
    const action = event && event.parameter ? event.parameter.action : '';
    if (action && action !== 'resultats') {
      return respostaJson_({ ok: false, code: 'NOT_FOUND', message: 'Acció desconeguda.' });
    }
    return respostaJson_({ ok: true, resultats: lligResultatsPublics_() });
  } catch (error) {
    console.error('No s’han pogut llegir els resultats.', error);
    return respostaJson_({
      ok: false,
      code: 'SERVER_ERROR',
      message: 'No s’han pogut llegir els resultats.'
    });
  }
}

function validaResultat_(entrada) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    fallaValidacio_('Les dades enviades no són vàlides.');
  }

  const nombre = String(entrada.nombre || '').trim();
  const correo = String(entrada.correo || '').trim().toLowerCase();
  const genero = String(entrada.genero || '');
  if (!nombre || nombre.length > 30) fallaValidacio_('El nom ha de tindre entre 1 i 30 caràcters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) fallaValidacio_('El correu electrònic no és vàlid.');
  if (!GENERES_VALIDS.includes(genero)) fallaValidacio_('El gènere no és vàlid.');

  const resultat = { nombre, correo, genero };
  let totalCalculat = 0;
  for (let index = 1; index <= TOTAL_BLOCS; index += 1) {
    const camp = `bloque${index}`;
    const puntuacio = Number(entrada[camp]);
    if (!Number.isInteger(puntuacio) || !PUNTUACIONS_VALIDES.includes(puntuacio)) {
      fallaValidacio_(`La puntuació del bloc ${index} no és vàlida.`);
    }
    resultat[camp] = puntuacio;
    totalCalculat += puntuacio;
  }
  if (!Number.isInteger(Number(entrada.total)) || Number(entrada.total) !== totalCalculat) {
    fallaValidacio_('El total no coincidix amb la suma dels blocs.');
  }
  resultat.total = totalCalculat;
  return resultat;
}

function fallaValidacio_(message) {
  const error = new Error(message);
  error.code = 'VALIDATION_ERROR';
  error.publicMessage = message;
  throw error;
}

function guardaResultat_(dades) {
  const full = preparaFull_(obriLlibre_());
  const ultimaFila = full.getLastRow();
  let fila = ultimaFila + 1;
  let id = Utilities.getUuid();
  let action = 'created';

  if (ultimaFila >= 2) {
    const correus = full.getRange(2, 2, ultimaFila - 1, 1).getDisplayValues();
    const index = correus.findIndex(([correo]) => String(correo).trim().toLowerCase() === dades.correo);
    if (index >= 0) {
      fila = index + 2;
      id = String(full.getRange(fila, 1).getDisplayValue()) || id;
      action = 'updated';
    }
  }

  const valors = [id, dades.correo, dades.nombre, dades.genero];
  for (let index = 1; index <= TOTAL_BLOCS; index += 1) valors.push(dades[`bloque${index}`]);
  valors.push(dades.total, new Date());

  full.getRange(fila, 1, 1, 4).setNumberFormat('@');
  full.getRange(fila, 1, 1, CAPCALERES.length).setValues([valors]);
  full.getRange(fila, CAPCALERES.length).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  return { id, action };
}

function lligResultatsPublics_() {
  const full = preparaFull_(obriLlibre_());
  const ultimaFila = full.getLastRow();
  if (ultimaFila < 2) return [];
  const files = full.getRange(2, 1, ultimaFila - 1, CAPCALERES.length).getValues();
  return files.filter(fila => fila[0]).map(fila => {
    const resultat = {
      id: String(fila[0]),
      nombre: String(fila[2]),
      genero: String(fila[3])
    };
    for (let index = 1; index <= TOTAL_BLOCS; index += 1) {
      resultat[`bloque${index}`] = Number(fila[index + 3]);
    }
    const indexTotal = 4 + TOTAL_BLOCS;
    const indexData = indexTotal + 1;
    resultat.total = Number(fila[indexTotal]);
    resultat.updated_at = fila[indexData] instanceof Date
      ? fila[indexData].toISOString()
      : String(fila[indexData] || '');
    return resultat;
  });
}

function enviaCorreu_(dades) {
  const linies = [
    `Nom: ${dades.nombre}`,
    `Gènere: ${dades.genero}`,
    ''
  ];
  const filesHtml = [];
  for (let index = 1; index <= TOTAL_BLOCS; index += 1) {
    const puntuacio = dades[`bloque${index}`];
    const descripcio = descriuPuntuacio_(puntuacio);
    linies.push(`Bloc ${index}: ${descripcio}`);
    filesHtml.push(
      `<tr><td style="padding:6px 16px 6px 0">Bloc ${index}</td>` +
      `<td style="padding:6px 0;font-weight:600">${escapaHtml_(descripcio)}</td></tr>`
    );
  }
  linies.push('', `Total: ${dades.total} punts`);

  const html =
    `<p><strong>Nom:</strong><br>${escapaHtml_(dades.nombre)}</p>` +
    `<p><strong>Gènere:</strong><br>${escapaHtml_(dades.genero)}</p>` +
    `<table style="border-collapse:collapse">${filesHtml.join('')}</table>` +
    `<p style="font-size:20px"><strong>Total: ${dades.total} punts</strong></p>`;

  MailApp.sendEmail(
    dades.correo,
    'Resum de la puntuació · Gaia Climb',
    linies.join('\n'),
    { htmlBody: html, name: NOM_REMITENT }
  );
}

function descriuPuntuacio_(puntuacio) {
  if (puntuacio === 10) return 'Zona · 10 punts';
  if (puntuacio === 25) return 'Top · 25 punts';
  return '0 punts';
}

function escapaHtml_(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function obriLlibre_() {
  const properties = PropertiesService.getScriptProperties();
  let id = properties.getProperty(CLAU_ID_FULL);
  if (!id) {
    const actiu = SpreadsheetApp.getActiveSpreadsheet();
    if (!actiu) throw new Error('Executa configuraFull() abans de publicar l’aplicació web.');
    id = actiu.getId();
    properties.setProperty(CLAU_ID_FULL, id);
  }
  return SpreadsheetApp.openById(id);
}

function preparaFull_(llibre) {
  let full = llibre.getSheetByName(NOM_FULL);
  if (!full) full = llibre.insertSheet(NOM_FULL);
  if (full.getLastRow() === 0) {
    full.getRange(1, 1, 1, CAPCALERES.length).setValues([CAPCALERES]);
    full.setFrozenRows(1);
    full.getRange(1, 1, 1, CAPCALERES.length).setFontWeight('bold');
    full.getRange(1, 1, full.getMaxRows(), 4).setNumberFormat('@');
  } else {
    const actuals = full.getRange(1, 1, 1, CAPCALERES.length).getDisplayValues()[0];
    if (actuals.join('|') !== CAPCALERES.join('|')) {
      throw new Error(`Les capçaleres del full ${NOM_FULL} no coincidixen amb les esperades.`);
    }
  }
  return full;
}

function respostaJson_(dades) {
  return ContentService
    .createTextOutput(JSON.stringify(dades))
    .setMimeType(ContentService.MimeType.JSON);
}

function afegirDadesProva() {
  configuraFull();
  const participants = [
    ['proves.gaia.01@example.invalid', 'Aitana Ferrer', 'Femení'],
    ['proves.gaia.02@example.invalid', 'Vicent Peris', 'Masculí'],
    ['proves.gaia.03@example.invalid', 'Neus Sanchis', 'Femení'],
    ['proves.gaia.04@example.invalid', 'Ferran Martí', 'Masculí'],
    ['proves.gaia.05@example.invalid', 'Laia Soler', 'Femení'],
    ['proves.gaia.06@example.invalid', 'Pau Navarro', 'Masculí'],
    ['proves.gaia.07@example.invalid', 'Núria Benavent', 'Femení'],
    ['proves.gaia.08@example.invalid', 'Jordi Lloret', 'Masculí'],
    ['proves.gaia.09@example.invalid', 'Mar Cervera', 'Altre'],
    ['proves.gaia.10@example.invalid', 'Joan Fuster', 'Masculí'],
    ['proves.gaia.11@example.invalid', 'Carme Seguí', 'Femení'],
    ['proves.gaia.12@example.invalid', 'Andreu Valls', 'Masculí'],
    ['proves.gaia.13@example.invalid', 'Àngela Esteve', 'Femení'],
    ['proves.gaia.14@example.invalid', 'Guillem Pastor', 'Masculí'],
    ['proves.gaia.15@example.invalid', 'Teresa Miralles', 'Femení'],
    ['proves.gaia.16@example.invalid', 'Arnau Climent', 'Masculí'],
    ['proves.gaia.17@example.invalid', 'Àlex Carbonell', 'Altre'],
    ['proves.gaia.18@example.invalid', 'Biel Roig', 'Masculí'],
    ['proves.gaia.19@example.invalid', 'Alba Tormo', 'Femení'],
    ['proves.gaia.20@example.invalid', 'Ariel Blasco', 'Altre']
  ];
  const bloqueig = LockService.getScriptLock();
  bloqueig.waitLock(10000);
  try {
    participants.forEach(([correo, nombre, genero]) => {
      const dades = { correo, nombre, genero, total: 0 };
      for (let index = 1; index <= TOTAL_BLOCS; index += 1) {
        const puntuacio = PUNTUACIONS_VALIDES[Math.floor(Math.random() * PUNTUACIONS_VALIDES.length)];
        dades[`bloque${index}`] = puntuacio;
        dades.total += puntuacio;
      }
      guardaResultat_(dades);
    });
  } finally {
    bloqueig.releaseLock();
  }
}

function eliminarDadesProva() {
  const full = preparaFull_(obriLlibre_());
  const bloqueig = LockService.getScriptLock();
  bloqueig.waitLock(10000);
  try {
    for (let fila = full.getLastRow(); fila >= 2; fila -= 1) {
      const correo = String(full.getRange(fila, 2).getDisplayValue()).toLowerCase();
      if (/^proves\.gaia\.\d+@example\.invalid$/.test(correo)) full.deleteRow(fila);
    }
  } finally {
    bloqueig.releaseLock();
  }
}
