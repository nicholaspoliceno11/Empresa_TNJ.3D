/**
 * Eleições 2026 — Backend (Google Apps Script)
 *
 * Este arquivo é um placeholder local. Após `npm run clasp:login`, rode
 * `npm run clasp:pull` para baixar o código real do projeto no Google.
 *
 * Publicação: npm run clasp:push && npm run clasp:deploy
 */

function doGet(e) {
  return json({ ok: true, message: "Eleições 2026 API — substitua pelo código do clasp pull" });
}

function doPost(e) {
  return json({ ok: false, error: "Não implementado — use clasp pull para obter o código do Google" });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
