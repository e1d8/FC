# Registre de puntuació de Gaia Climb

Formulari en valencià amb HTML, CSS i JavaScript, publicable en GitHub Pages. Registra 17 blocs amb `✕` (sense puntuació, 0 punts), `Zona` (10 punts) o `Top` (25 punts), fins a un màxim de **425 punts**. Usa el SDK modular de Firebase **12.4.0**, carregat des del CDN oficial quan cal guardar; no necessita npm ni compilació.

Davall de les tres opcions de puntuació de cada bloc hi ha l’etiqueta **Intents** i un comptador **− / número / +**, inicialment en **0**. Cada botó resta o suma un intent, amb límits de **0 a 99**. També pots escriure fins a dos dígits amb el teclat numèric o usar les fletxes amunt i avall. No s’admeten signes, decimals ni més de dos dígits; un camp buit torna a 0 en eixir-ne o guardar. El resum mostra el número exacte. Els intents no modifiquen els punts ni el rànquing.

## 1. Preparar Firebase

El formulari està configurat per al projecte **`compe-gaia-octubre-2026`**, aplicació web **Compe Gaia Octubre 2026**. El bloc `firebaseConfig` està al principi de `script.js`.

1. Entra en la [consola de Firebase](https://console.firebase.google.com/) i obri el projecte.
2. En **Firestore Database**, crea la base de dades si encara no existix: edició **Standard**, identificador **`(default)`**, ubicació **Madrid (`europe-southwest1`)** i mode **producció**.
3. Obri la pestanya **Regles**, substituïx el contingut per tot el fitxer [`firestore.rules`](firestore.rules) i prem **Publica**. Guardar el fitxer en GitHub no publica les regles en Firebase.
4. Espera que Firebase confirme la publicació abans de provar el formulari. No actives les regles obertes del mode de prova.

No cal crear manualment la col·lecció: el primer enviament vàlid crearà `resultados` i el seu document. No necessites Authentication, Storage, Analytics, Firebase Hosting ni un compte de servei. Pots mantindre el pla **Spark**, dins de les [quotes gratuïtes de Firestore](https://firebase.google.com/docs/firestore/quotas).

La configuració web és pública. Els permisos i la validació de les dades depenen de les regles, que permeten consultar resultats i crear o reemplaçar participacions vàlides, però no esborrar-les des del navegador. [Configuració web](https://firebase.google.com/docs/web/setup), [claus de Firebase](https://firebase.google.com/docs/projects/api-keys).

## 2. Identitat i dades guardades

L’ordre del formulari és **Número de dorçal → Anònim → Nom → Gènere → Blocs → Total → Guardar**.

El dorçal és obligatori en tots els modes. Admet entre 1 i 20 lletres ASCII o números. En escriure o apegar text, les minúscules es convertixen immediatament a majúscules i s’eliminen espais, accents, símbols i guions. `a001` i `A001` identifiquen la mateixa participació; `A001` i `A1` són diferents.

Cada enviament reemplaça completament el document **`resultados/{dorsal}`**. Per exemple, el dorçal `A001` es guarda en `resultados/A001`. Reenviar-lo actualitza el nom, el mode, el gènere, totes les puntuacions i la data; no genera una segona participació. Si hi ha enviaments simultanis per al mateix dorçal, preval l’última escriptura acceptada.

| Camp | Contingut |
| --- | --- |
| `dorsal` | Identificador normalitzat, igual que l’ID del document. |
| `anonimo` | Booleà: `true` o `false`. |
| `nombre` | Nom d’1 a 30 caràcters, sense espais exteriors. |
| `genero` | `Femení`, `Masculí` o `Altre`. |
| `bloque1`…`bloque17` | Nombres enters: `0`, `10` o `25`. |
| `intentos` | Llista de 17 enters de `0` a `99`, en l’ordre dels blocs. Cada valor nou representa el nombre exacte d’intents. |
| `total` | Suma dels 17 blocs, de 0 a 425. |
| `updated_at` | Timestamp de Firestore generat pel servidor en cada enviament. |

En mode anònim s’oculten nom i gènere i es guarda `anonimo: true`, `nombre: "Anònim"` i `genero: "Altre"`. El dorçal continua visible i és la mateixa clau única. En desactivar el mode, reapareixen els valors introduïts abans. No es recull ni s’envia cap correu electrònic, ni s’envien correus de resum.

Les regles exigixen tots els camps, rebutgen camps addicionals, verifiquen la identitat, cada puntuació, la suma i la data del servidor. **No hi ha login: qualsevol persona que conega un dorçal pot substituir els seus resultats.** Tots els camps dels documents, inclòs el dorçal i l’estat anònim, són de lectura pública.

El camp `intentos` és opcional en les regles per a mantindre compatibles els documents i les versions anteriors del formulari. Si està present, ha de contindre exactament 17 enters de 0 a 99. **Torna a publicar el fitxer `firestore.rules` actualitzat abans de publicar el comptador**: les regles antigues no admeten valors superiors a 5. No cal migrar ni esborrar documents antics; els valors guardats com `4+` i `5+` es conserven com a 4 i 5, perquè no es pot recuperar el número exacte.

La web de resultats mostra **Puntuació per bloc** i **Intents per bloc**, amb paginació independent. El segon gràfic suma els valors registrats segons el resultat final (Top, Zona o Sense puntuació), inclosos els nous valors fins a 99. Les dades antigues limitades a `4+` o `5+` aporten només el mínim conegut. Els valors absents o invàlids s’exclouen només d’eixa suma; els intents no modifiquen els punts, el rànquing ni la mitjana de puntuació.

## 3. Guardat i errors

El formulari usa **Firestore Lite**, sense cua persistent de guardats fora de línia. Una escriptura confirmada és suficient: no es fa una consulta posterior per a comprovar-la.

Durant l’enviament apareix `Guardant…` i es bloquegen els controls per a evitar dobles pulsacions. Només després de la confirmació de Firestore s’oculta el formulari i apareix `Gràcies per participar`, amb el resum, el focus en el títol i la pàgina situada al logo.

Si falla la xarxa, la configuració o els permisos, apareix un missatge en valencià i es mantenen els valors per a reintentar. Si s’ha perdut la resposta però el resultat ha arribat al servidor, reintentar amb el mateix dorçal reemplaça el mateix document.

Després de l’èxit el formulari queda bloquejat fins a recarregar. Una recàrrega inicia un formulari buit. `localStorage` només conserva la marca de visita `gaia_form_visited` per a recordar que cal reutilitzar el mateix dorçal; no identifica participants ni conserva puntuacions.

## 4. Provar i publicar

Des de la carpeta del projecte executa:

```sh
python3 -m http.server 8000
```

Obri `http://localhost:8000`. No òbrigues `index.html` directament com a fitxer, perquè el navegador pot bloquejar la càrrega dels mòduls de Firebase.

Després de publicar les regles:

1. Envia el dorçal `PROVA001` amb nom i gènere. Comprova en **Firestore Database → Dades → resultados** el document, el total i `updated_at`.
2. Des d’un altre navegador, envia `prova001` amb altres puntuacions. Ha de continuar existint un únic document `PROVA001`, amb les dades noves.
3. Envia el mateix dorçal amb `Anònim` activat: ha de substituir la identitat anterior per `Anònim` i `Altre` i guardar el booleà `true`.
4. Prova dorçal buit o invàlid, nom buit o massa llarg i gènere sense seleccionar. En mode anònim, el dorçal buit també ha de rebutjar-se.
5. Comprova 17 seleccions exclusives, total inicial 0, puntuacions intermèdies i màxim 425.
   Comprova també els 17 comptadors, els límits 0 i 99, l’escriptura, el pegat, els camps buits, les fletxes del teclat i el resum exacte d’intents. Canviar els intents no modifica el total. Intro dins del camp no envia el formulari; en els botons del comptador, només suma o resta. En Firestore, `intentos[0]` correspon al bloc 1 i `intentos[16]` al bloc 17.
6. Prova sense connexió: no ha d’aparéixer l’agraïment i les dades han de conservar-se. Torna a connectar i reintenta.
7. Comprova dos clics ràpids, les ajudes amb ratolí i teclat, l’avís de segona visita i el disseny des de 320 px.

Per a activar este canvi, publica en este ordre:

1. Les regles ampliades a 0–99 en **Firestore Database → Regles → Publica**.
2. La web `ResultatsCompeGaia` actualitzada, que admet intents fins a 99 en el gràfic.
3. El formulari amb els comptadors nous.

Per a publicar, puja els canvis al repositori i configura **Settings → Pages → Deploy from a branch**, amb la branca corresponent i **/(root)**. Les regles es publiquen separadament en Firebase. La configuració de GitHub Pages no necessita secrets ni cap backend propi.

Si apareix un error de permisos, comprova que les regles s’han publicat en `compe-gaia-octubre-2026`, base `(default)`, i que coincidixen amb el fitxer actual. Si l’error és de configuració, comprova que la base existix i que `firebaseConfig` correspon a la seua aplicació web.

### Proves automatitzades de les regles

El fitxer `tests/test_firestore_rules.py` comprova permisos, dades manipulades, dates del servidor i enviaments simultanis. Usa només Python estàndard i un emulador local; no accedix al projecte real.

Amb Java i el JAR oficial de l’emulador de Firestore (verificat amb la versió 1.22.0), inicia’l des de la carpeta del projecte:

```sh
java -jar /ruta/cloud-firestore-emulator.jar --host 127.0.0.1 --port 8089 --project_id demo-gaia --rules firestore.rules
```

En un altre terminal, també des de la carpeta del projecte:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8089 PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
```

## 5. Consultar o esborrar participacions

En **Firestore Database → Dades → resultados** pots consultar els documents i eliminar una participació pel seu dorçal. Per a buidar tots els resultats, elimina la col·lecció `resultados` des de la consola. El següent enviament tornarà a crear-la. No hi ha esborrat públic des de la web.

Elimina també `PROVA001` des de la consola en acabar les proves. Les regles exigixen una data del servidor, així que per a crear participacions de prova usa el formulari.

## 6. Transició des de Google Sheets

El formulari i la web `ResultatsCompeGaia` utilitzen el mateix projecte Firestore i la mateixa col·lecció `resultados`. La web de resultats consulta les participacions en obrir-se; recarrega-la per a vore els nous enviaments o les modificacions del mateix dorçal. Manté la classificació, les categories i les estadístiques dels 17 blocs, amb els anònims inclosos en el rànquing general.

Les dos webs ja no consulten Google Sheets ni executen Apps Script. Els resultats antics no es migren ni s’esborren automàticament. Després de publicar i comprovar les dos webs, pots retirar la implementació antiga d’Apps Script i conservar el Sheet com a arxiu, si vols.
