# Registre de puntuació de Gaia Climb

Formulari web en valencià, sense dependències, per a registrar els resultats de 17 blocs. Cada bloc admet `0`, `Zona` (10 punts) o `Top` (25 punts); la puntuació màxima és 425.

Les dades es guarden en un full privat de Google Sheets mitjançant Google Apps Script. Un correu identificat actualitza la seua fila anterior. El mode anònim conserva una identitat aleatòria en `localStorage` i no envia correu.

## 1. Crear el full i configurar Apps Script

1. Crea un full nou en [Google Sheets](https://sheets.google.com). No el publiques ni el compartisques públicament.
2. Dins del full, obri **Extensions → Apps Script**.
3. Esborra el contingut de `Code.gs`, copia tot el fitxer `google-apps-script.gs` d’este repositori i guarda el projecte.
4. En el selector de funcions, tria `configuraFull` i prem **Executa**. Accepta els permisos sol·licitats. Es crearà la pestanya `Resultats` amb les capçaleres correctes.
5. Obri **Implementa → Implementació nova**, tria **Aplicació web** i configura:
   - **Executa com:** jo.
   - **Qui té accés:** qualsevol persona.
6. Prem **Implementa** i copia l’URL acabada en `/exec`. La URL `/dev` només servix per a proves de l’editor i no s’ha d’usar en GitHub Pages.
7. Al principi de `script.js`, apega l’URL:

   ```js
   const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/IDENTIFICADOR/exec';
   ```

Quan modifiques el codi d’Apps Script, obri **Implementa → Gestiona les implementacions**, edita la implementació i selecciona una versió nova. Així conservaràs la mateixa URL.

## 2. Funcionament de les dades

La pestanya `Resultats` conté `id`, `correo`, `nombre`, `genero`, `bloque1`…`bloque17`, `total` i `updated_at`. No canvies els noms ni l’ordre de les capçaleres.

El servidor valida de nou tots els camps, calcula la suma, normalitza el correu a minúscules i usa un bloqueig per a evitar col·lisions entre enviaments simultanis. El full es manté privat. La lectura pública d’Apps Script exclou sempre el correu:

```text
URL_DE_APPS_SCRIPT?action=resultats
```

La resposta JSON té esta forma:

```json
{
  "ok": true,
  "resultats": [
    {
      "id": "uuid",
      "nombre": "Aitana Ferrer",
      "genero": "Femení",
      "bloque1": 25,
      "bloque17": 10,
      "total": 180,
      "updated_at": "2026-10-08T10:00:00.000Z"
    }
  ]
}
```

Qualsevol persona que conega un correu registrat pot reemplaçar el seu resultat, perquè no hi ha autenticació. L’adreça de l’aplicació web també és pública, però no dona accés directe al full ni retorna els correus.

## 3. Correu de resum

Apps Script envia el resum amb `MailApp` després de guardar. El remitent visible és `FormulariCompeticióGaia` i el missatge inclou nom, gènere, els 17 blocs i el total. No s’envien correus per a participacions anònimes.

Si s’esgota la quota o Gmail falla, la puntuació continua guardada i el formulari mostra un avís. Un compte personal de Gmail admet habitualment fins a 100 destinataris diaris; Google pot modificar esta quota.

## 4. Afegir i eliminar dades de prova

Des de l’editor d’Apps Script pots executar manualment:

- `afegirDadesProva()`: crea o actualitza 20 participants ficticis amb noms valencians i puntuacions aleatòries.
- `eliminarDadesProva()`: elimina només les files amb correus `proves.gaia.*@example.invalid`.

Estes funcions no envien correus.

## 5. Provar i publicar

Per a provar la web localment:

```sh
python3 -m http.server 8000
```

Obri `http://localhost:8000`. Per a publicar-la en GitHub Pages, activa **Settings → Pages → Deploy from a branch**, selecciona la branca i la carpeta **/(root)**.

Comprovacions principals:

- Hi ha 17 blocs i tots comencen en 0.
- Zona suma 10, Top suma 25 i el màxim és 425.
- Nom, correu i gènere són obligatoris fora del mode anònim; el nom admet 30 caràcters.
- Dos enviaments amb el mateix correu actualitzen una sola fila.
- El mateix navegador reutilitza la identitat anònima després de recarregar.
- Un error de xarxa conserva les dades i permet reintentar.
- Un error de correu no elimina el resultat guardat.
- La consulta pública no conté la propietat `correo`.
- El formulari funciona amb teclat i des de 320 px sense desplaçament horitzontal.
