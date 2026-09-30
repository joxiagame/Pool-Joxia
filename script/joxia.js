/* ============================================================
   Intégration Joxia pour Classic Pool Game (Chen Shmilovich, MIT)
   Ajoute UNIQUEMENT : pseudo du hub + classement Firebase + contrôles tactiles.
   Le moteur du jeu n'est pas modifié (patchs par-dessus les prototypes).
   Score classement = billes empochées par l'humain + 15 par match gagné (mode 1 joueur).
   ============================================================ */
(function () {
  // --- Firebase (base commune Joxia) ---
  var firebaseConfig = {
    apiKey: "AIzaSyCPecKQH6DURfYitjY4bXMeW0URLrcNnsI",
    authDomain: "joxiahub-2928b.firebaseapp.com",
    databaseURL: "https://joxiahub-2928b-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "joxiahub-2928b",
    storageBucket: "joxiahub-2928b.firebasestorage.app",
    messagingSenderId: "303698595695",
    appId: "1:303698595695:web:5c99c2cb2a9ea88e36a29a"
  };
  var db = null;
  try { if (!firebase.apps.length) firebase.initializeApp(firebaseConfig); db = firebase.database(); }
  catch (e) { console.warn("Firebase indisponible", e); }

  var params = new URLSearchParams(location.search);
  var player = params.get("player");
  var tag = document.getElementById("joxia-player");
  if (tag) tag.textContent = player && player !== "null" ? player : "Invité";

  var bestSaved = 0;
  function saveScore(score) {
    if (!db || !player || player === "null" || score <= 0 || score <= bestSaved) return;
    bestSaved = score;
    var path = "games/POOL/scores";
    db.ref(path).orderByChild("name").equalTo(player).once("value", function (snap) {
      var val = snap.val();
      if (val) {
        var k = Object.keys(val)[0];
        if (Number(score) > Number(val[k].score)) db.ref(path + "/" + k).update({ score: Number(score), date: Date.now() });
      } else {
        db.ref(path).push({ name: player, score: Number(score), date: Date.now() });
      }
    });
  }

  // --- accroche du score (patch des prototypes une fois chargés) ---
  window.__poolHumanPots = 0;
  function patchScore() {
    if (!window.GamePolicy || !GamePolicy.prototype.handleBallInHole || !GamePolicy.prototype.updateTurnOutcome) {
      return setTimeout(patchScore, 250);
    }
    var soloMode = function () { return typeof AI_ON !== "undefined" && AI_ON; };
    var isHumanTurn = function (self) { return typeof AI_PLAYER_NUM === "undefined" || self.turn !== AI_PLAYER_NUM; };

    var _hbih = GamePolicy.prototype.handleBallInHole;
    GamePolicy.prototype.handleBallInHole = function (ball) {
      _hbih.call(this, ball);
      if (soloMode() && isHumanTurn(this)) {
        var p = this.players[this.turn];
        if (p && p.color !== undefined && p.color === ball.color) window.__poolHumanPots++;
      }
    };
    var _uto = GamePolicy.prototype.updateTurnOutcome;
    GamePolicy.prototype.updateTurnOutcome = function () {
      _uto.call(this);
      if (soloMode()) {
        var wins = (this.players && this.players[0]) ? this.players[0].totalScore.value : 0;
        saveScore(window.__poolHumanPots + wins * 15);
      }
    };
  }
  patchScore();

  // --- contrôles tactiles ---
  // Menus : tap = clic souris. En jeu : tirer-glisser depuis la bille = viser
  // (direction du doigt) + doser la puissance (longueur du glissement), relâcher = frapper.
  function pt(t) { return { pageX: t.pageX, pageY: t.pageY, which: 1 }; }
  var aiming = false, movedPx = 0, startScreen = null;
  function inGameHumanTurn() {
    try {
      if (typeof GAME_STOPPED !== "undefined" && GAME_STOPPED) return false;
      if (!window.Game || !Game.policy || !Game.gameWorld || !Game.gameWorld.stick) return false;
      if (Game.policy.turnPlayed) return false;
      if (typeof AI_ON !== "undefined" && AI_ON && typeof AI_PLAYER_NUM !== "undefined" && Game.policy.turn === AI_PLAYER_NUM) return false;
      return true;
    } catch (e) { return false; }
  }
  document.addEventListener("touchstart", function (e) {
    if (!e.touches.length) return;
    var t = e.touches[0];
    if (typeof handleMouseDown === "function") handleMouseDown(pt(t)); // menus + visée
    aiming = inGameHumanTurn();
    movedPx = 0; startScreen = { x: t.clientX, y: t.clientY };
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  document.addEventListener("touchmove", function (e) {
    if (!e.touches.length) return;
    var t = e.touches[0];
    if (typeof handleMouseMove === "function") handleMouseMove(pt(t)); // la visée suit le doigt
    if (startScreen) movedPx = Math.max(movedPx, Math.hypot(t.clientX - startScreen.x, t.clientY - startScreen.y));
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  document.addEventListener("touchend", function (e) {
    var t = (e.changedTouches && e.changedTouches[0]) || { pageX: 0, pageY: 0 };
    // frappe tactile : glissement suffisant depuis la bille -> tir
    if (aiming && movedPx > 18) {
      try {
        if (typeof handleMouseMove === "function") handleMouseMove(pt(t));
        var wb = Game.gameWorld.whiteBall.position, mp = Mouse.position;
        var dx = mp.x - wb.x, dy = mp.y - wb.y, dist = Math.hypot(dx, dy);
        var power = Math.max(8, Math.min(75, dist * 0.09));
        Game.gameWorld.stick.shoot(power, Math.atan2(dy, dx));
      } catch (err) { console.warn("tir tactile", err); }
    }
    aiming = false; startScreen = null;
    if (typeof handleMouseUp === "function") handleMouseUp(pt(t));
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
})();
