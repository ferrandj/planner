(function () {
  'use strict';
  var box = document.getElementById('app');
  function fail(msg) {
    box.innerHTML = '<div class="fatal"><h1>Planner</h1><p>' + msg + '</p><button type="button" id="retry">Réessayer / Retry</button></div>';
    document.getElementById('retry').onclick = function () { location.reload(); };
  }
  PlannerSync.load().then(function (boot) {
    window.PLANNER_BOOT = boot;
    var s = document.createElement('script');
    s.src = 'app.js';
    s.onerror = function () { fail('Impossible de charger l\'application.'); };
    document.body.appendChild(s);
  }).catch(function () {
    fail('Le serveur est injoignable et aucune copie locale n\'existe sur cet appareil. Rien n\'a été modifié. Vérifie que le conteneur tourne puis réessaie.<br>Server unreachable and no local copy on this device. Nothing was changed.');
  });
})();
