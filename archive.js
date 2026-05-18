/* Raga Archive — browse 1,387 shivkumar.org recordings, play, and ♥-save.
   Likes persist in localStorage; one shared player keeps it light. */

const LIKES_KEY = "por_archive_likes";
const rowsEl = document.getElementById("rows");
const player = document.getElementById("player");
const nowPlaying = document.getElementById("nowplaying");
const countEl = document.getElementById("count");
const qEl = document.getElementById("q");
const kindEl = document.getElementById("kind");
const likedOnlyEl = document.getElementById("likedonly");

let tracks = [];                       // flat list of {kind,title,raga,by,url,hay}
let likes = new Set(JSON.parse(localStorage.getItem(LIKES_KEY) || "[]"));

function saveLikes() {
  localStorage.setItem(LIKES_KEY, JSON.stringify([...likes]));
}

function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

/* ---- build the flat track list from the two catalogs ---- */
function flatten(krithis, manodharma) {
  const out = [];
  for (const k of krithis.items) {
    (k.audio || []).forEach((url, i) => {
      out.push({ kind: "kriti", title: k.name + (k.audio.length > 1 ? ` (${i + 1})` : ""),
                 raga: k.raga || "", by: k.composer || "", url });
    });
  }
  for (const r of manodharma.ragas) {
    for (const c of r.clips) {
      out.push({ kind: "manodharma", title: c.label, raga: r.raga, by: "", url: c.url });
    }
  }
  out.forEach((t) => { t.hay = `${t.title} ${t.raga} ${t.by}`.toLowerCase(); });
  return out;
}

/* ---- a row ---- */
function makeRow(t) {
  const row = el("div", "arow");
  row.dataset.url = t.url;

  const like = el("button", "like-btn", likes.has(t.url) ? "♥" : "♡");
  if (likes.has(t.url)) like.classList.add("liked");
  like.title = "save this recording";
  like.addEventListener("click", () => {
    if (likes.has(t.url)) { likes.delete(t.url); like.textContent = "♡"; like.classList.remove("liked"); }
    else { likes.add(t.url); like.textContent = "♥"; like.classList.add("liked"); }
    saveLikes();
    if (likedOnlyEl.checked) applyFilter();
    updateCount();
  });

  const play = el("button", "play-btn", "▶");
  play.title = "play";
  play.addEventListener("click", () => {
    document.querySelectorAll(".arow.playing").forEach((r) => r.classList.remove("playing"));
    row.classList.add("playing");
    player.src = t.url;
    player.play().catch(() => {});
    nowPlaying.textContent = `${t.title} — ${t.raga}`;
  });

  const meta = el("div", "arow-meta");
  meta.appendChild(el("div", "arow-title", t.title));
  const sub = el("div", "arow-sub");
  sub.textContent = [t.raga, t.by, t.kind].filter(Boolean).join("  ·  ");
  meta.appendChild(sub);

  row.append(like, play, meta);
  return row;
}

/* ---- filtering ---- */
function applyFilter() {
  const q = qEl.value.trim().toLowerCase();
  const kind = kindEl.value;
  const likedOnly = likedOnlyEl.checked;
  let shown = 0;
  for (const row of rowsEl.children) {
    const t = row._track;
    const ok = (!q || t.hay.includes(q)) &&
               (!kind || t.kind === kind) &&
               (!likedOnly || likes.has(t.url));
    row.classList.toggle("hidden", !ok);
    if (ok) shown++;
  }
  countEl.textContent = `${shown} shown · ${likes.size} liked · ${tracks.length} total`;
}

function updateCount() {
  countEl.textContent =
    `${[...rowsEl.children].filter((r) => !r.classList.contains("hidden")).length}` +
    ` shown · ${likes.size} liked · ${tracks.length} total`;
}

/* ---- export likes ---- */
document.getElementById("export").addEventListener("click", async () => {
  const liked = tracks.filter((t) => likes.has(t.url));
  if (!liked.length) { alert("No likes yet — tap ♡ on rows you want to keep."); return; }
  const text = liked.map((t) => `${t.title}\t${t.raga}\t${t.by}\t${t.url}`).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    alert(`Copied ${liked.length} liked recordings to the clipboard (title, raga, composer, URL).`);
  } catch {
    prompt(`${liked.length} liked recordings — copy this:`, text);
  }
});

qEl.addEventListener("input", applyFilter);
kindEl.addEventListener("change", applyFilter);
likedOnlyEl.addEventListener("change", applyFilter);

/* ---- load ---- */
Promise.all([
  fetch("krithis.json").then((r) => r.json()),
  fetch("manodharma.json").then((r) => r.json()),
])
  .then(([k, m]) => {
    tracks = flatten(k, m);
    const frag = document.createDocumentFragment();
    for (const t of tracks) {
      const row = makeRow(t);
      row._track = t;
      frag.appendChild(row);
    }
    rowsEl.appendChild(frag);
    applyFilter();
  })
  .catch(() => { countEl.textContent = "Could not load the archive."; });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
