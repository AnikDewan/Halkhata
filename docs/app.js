/* ============================================================
   HalKhata — landing page interactions
   ============================================================ */

/* ------------------------------------------------------------------
   Replace these two URLs with your real links:
   - APK_URL: where the Android APK is hosted
   - GITHUB_URL: your public source code repository
   Every download / GitHub link on the page is wired to these.
   ------------------------------------------------------------------ */
var APK_URL = "https://github.com/AnikDewan/Halkhata/releases/latest/download/HalKhata.apk";
var GITHUB_URL = "https://github.com/AnikDewan/Halkhata";

document.querySelectorAll("[data-apk]").forEach(function (el) {
  el.setAttribute("href", APK_URL);
  el.setAttribute("download", "HalKhata.apk");
});
document.querySelectorAll("[data-github]").forEach(function (el) {
  el.setAttribute("href", GITHUB_URL);
  el.setAttribute("target", "_blank");
  el.setAttribute("rel", "noopener noreferrer");
});

var PREFERS_REDUCED_MOTION = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

/* ------------------------------------------------------------------
   Mobile nav
   ------------------------------------------------------------------ */
(function () {
  var toggle = document.getElementById("nav-toggle");
  var panel = document.getElementById("nav-panel");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", function () {
    var open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    panel.classList.toggle("is-open", !open);
  });

  panel.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      toggle.setAttribute("aria-expanded", "false");
      panel.classList.remove("is-open");
    });
  });
})();

/* ------------------------------------------------------------------
   The live khata — an interactive ledger
   ------------------------------------------------------------------ */
(function () {
  var rowsEl = document.getElementById("khata-rows");
  var totalEl = document.getElementById("khata-total");
  var statusEl = document.getElementById("khata-status");
  var creditBtn = document.getElementById("khata-credit");
  var paymentBtn = document.getElementById("khata-payment");
  var newBtn = document.getElementById("khata-new");
  if (!rowsEl || !totalEl || !statusEl) return;

  var fmt = new Intl.NumberFormat("en-IN");

  var SCRIPT = [
    { name: "Ramesh Kumar", item: "credit \u2014 milk, dal", kind: "credit", amount: 1240 },
    { name: "Ramesh Kumar", item: "payment received", kind: "payment", amount: 500 },
    { name: "Prakash Tea Stall", item: "credit \u2014 sugar, atta", kind: "credit", amount: 860 },
    { name: "Sunita Devi", item: "payment received", kind: "payment", amount: 740 },
    { name: "Imran Bhai", item: "credit \u2014 rice, oil", kind: "credit", amount: 1620 },
    { name: "Ramesh Kumar", item: "payment received", kind: "payment", amount: 1600 }
  ];

  var creditIndex = 0;
  var paymentIndex = 0;
  var balance = 0;
  var MAX_ROWS = 5;

  var displayValue = 0;
  var rafId = null;
  var snapId = null;

  function rupee(v) {
    return "\u20B9" + fmt.format(v);
  }

  function renderTotal() {
    totalEl.textContent = rupee(displayValue);
    statusEl.classList.toggle("is-settled", displayValue === 0);
  }

  function setBalance(v, animate) {
    if (snapId) {
      window.clearTimeout(snapId);
      snapId = null;
    }
    if (!animate || PREFERS_REDUCED_MOTION) {
      displayValue = v;
      renderTotal();
      return;
    }
    var from = displayValue;
    var start = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    function step(t) {
      var p = Math.min(1, (t - start) / 450);
      var eased = 1 - Math.pow(1 - p, 3);
      displayValue = Math.round(from + (v - from) * eased);
      renderTotal();
      rafId = p < 1 ? requestAnimationFrame(step) : null;
    }
    rafId = requestAnimationFrame(step);
    /* Safety net: if rAF stalls, snap to the real total. */
    snapId = window.setTimeout(function () {
      if (displayValue !== v) {
        displayValue = v;
        renderTotal();
      }
      snapId = null;
    }, 700);
  }

  function addRow(entry, animate) {
    var row = document.createElement("div");
    row.className = "khata__row khata__row--" + entry.kind;
    if (animate && !PREFERS_REDUCED_MOTION) row.classList.add("is-pending");

    var words = document.createElement("span");
    words.className = "khata__words";
    words.textContent = entry.name + " \u00B7 " + entry.item;

    var text = document.createElement("span");
    text.className = "khata__text";
    text.appendChild(words);

    if (animate && !PREFERS_REDUCED_MOTION) {
      var caret = document.createElement("span");
      caret.className = "caret";
      caret.setAttribute("aria-hidden", "true");
      text.appendChild(caret);
    }

    var sign = entry.kind === "credit" ? "+ " : "\u2212 ";
    var amt = document.createElement("span");
    amt.className = "khata__amt";
    amt.textContent = sign + rupee(entry.amount);

    row.appendChild(text);
    row.appendChild(amt);
    rowsEl.appendChild(row);

    while (rowsEl.children.length > MAX_ROWS) rowsEl.removeChild(rowsEl.firstChild);

    if (animate && !PREFERS_REDUCED_MOTION) {
      window.setTimeout(function () {
        row.classList.remove("is-pending");
      }, 850);
    }

    return row;
  }

  function record(kind) {
    var pool = kind === "credit" ? SCRIPT.filter(function (e) { return e.kind === "credit"; }) : SCRIPT.filter(function (e) { return e.kind === "payment"; });
    var idx = kind === "credit" ? creditIndex : paymentIndex;
    var entry = pool[idx % pool.length];
    if (kind === "credit") creditIndex = (creditIndex + 1) % pool.length;
    else paymentIndex = (paymentIndex + 1) % pool.length;

    addRow(entry, true);
    balance += entry.kind === "credit" ? entry.amount : -entry.amount;
    setBalance(balance, true);
  }

  function resetBook() {
    rowsEl.innerHTML = "";
    creditIndex = 0;
    paymentIndex = 0;
    balance = 0;
    setBalance(0, false);
  }

  if (creditBtn) creditBtn.addEventListener("click", function () { record("credit"); });
  if (paymentBtn) paymentBtn.addEventListener("click", function () { record("payment"); });
  if (newBtn) newBtn.addEventListener("click", resetBook);

  /* Auto-play: write three entries (credit, payment, credit) into the book. */
  function autoplay() {
    if (PREFERS_REDUCED_MOTION) {
      SCRIPT.slice(0, 3).forEach(function (e) {
        addRow(e, false);
        balance += e.kind === "credit" ? e.amount : -e.amount;
        if (e.kind === "credit") creditIndex++;
        else paymentIndex++;
      });
      setBalance(balance, false);
      return;
    }
    [0, 1, 2].forEach(function (i) {
      window.setTimeout(function () {
        var e = SCRIPT[i];
        addRow(e, true);
        balance += e.kind === "credit" ? e.amount : -e.amount;
        if (e.kind === "credit") creditIndex++;
        else paymentIndex++;
        setBalance(balance, true);
      }, i * 700 + 500);
    });
  }

  /* Pause auto-play until the khata is on screen, then run it once. */
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            autoplay();
            observer.disconnect();
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(document.querySelector(".khata") || document.body);
  } else {
    autoplay();
  }
})();

/* ------------------------------------------------------------------
   Active nav link highlighting
   ------------------------------------------------------------------ */
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav__link"));
  if (!links.length || !("IntersectionObserver" in window)) return;

  var ids = links
    .map(function (l) { return l.getAttribute("href"); })
    .filter(function (h) { return h && h.length > 1 && h[0] === "#"; })
    .map(function (h) { return h.slice(1); });

  var map = {};
  links.forEach(function (l, i) {
    var id = ids[i];
    if (id) map[id] = l;
  });

  var current = null;
  function highlight(id) {
    if (current) current.style.color = "";
    current = id ? map[id] : null;
    if (current) current.style.color = "#ee161f";
  }

  var sections = ids
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  if (!sections.length) return;

  var visible = {};
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        visible[entry.target.id] = entry.isIntersecting;
      });
      var topId = null;
      sections.forEach(function (s) {
        if (visible[s.id]) {
          if (!topId || s.getBoundingClientRect().top < document.getElementById(topId).getBoundingClientRect().top) {
            topId = s.id;
          }
        }
      });
      highlight(topId);
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );

  sections.forEach(function (s) { observer.observe(s); });
})();
