(function () {
  var cfg = window.EleicoesConfig || {};
  var titulo = document.getElementById("titulo-painel");
  if (titulo) titulo.textContent = cfg.TITULO || "Eleições 2026";

  var status = document.getElementById("status-api");
  if (!status) return;

  if (!cfg.API_URL) {
    status.textContent = "Modo local — configure API_URL em assets/js/config.js após o deploy.";
    status.className = "status status--aviso";
    return;
  }

  status.textContent = "API configurada: " + cfg.API_URL;
  status.className = "status status--ok";
})();
