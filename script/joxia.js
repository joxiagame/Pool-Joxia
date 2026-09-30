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

  // --- contrôles tactiles -> souris (le moteur écoute document.onmouse*) ---
  function pt(t) { return { pageX: t.pageX, pageY: t.pageY, which: 1 }; }
  document.addEventListener("touchstart", function (e) {
    if (!e.touches.length) return;
    if (typeof handleMouseDown === "function") handleMouseDown(pt(e.touches[0]));
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  document.addEventListener("touchmove", function (e) {
    if (!e.touches.length) return;
    if (typeof handleMouseMove === "function") handleMouseMove(pt(e.touches[0]));
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  document.addEventListener("touchend", function (e) {
    var t = (e.changedTouches && e.changedTouches[0]) || { pageX: 0, pageY: 0 };
    if (typeof handleMouseUp === "function") handleMouseUp(pt(t));
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
})();
