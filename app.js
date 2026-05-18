/* Pulse Of Raga — demo PWA. Loads demo_data.json, renders raga cards + detail. */

const grid = document.getElementById("grid");
const detail = document.getElementById("detail");
const detailBody = document.getElementById("detail-body");

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/* Render a swara sequence as pills; Sa is highlighted. */
function pills(seq) {
  const wrap = el("div", "pills");
  seq.forEach((sw) => {
    const p = el("span", "pill" + (sw === "S" ? " sa" : ""), sw);
    wrap.appendChild(p);
  });
  return wrap;
}

function ragaTags(r) {
  const t = el("div", "tags");
  if (r.pentatonic) t.appendChild(el("span", "tag hot", "5-note pentatonic"));
  if (r.vakra) t.appendChild(el("span", "tag", "vakra"));
  if (r.bhashanga) t.appendChild(el("span", "tag", "bhashanga"));
  if (r.rasa && !r.rasa.startsWith("undocumented")) {
    t.appendChild(el("span", "tag", r.rasa.split("/")[0].trim()));
  }
  return t;
}

function card(r) {
  const c = el("div", "card");
  c.appendChild(el("h2", null, r.name));
  if (r.also_known_as) c.appendChild(el("div", "aka", "also known as " + r.also_known_as));
  c.appendChild(el("div", "lineage", r.lineage));
  c.appendChild(el("div", "tagline", r.tagline));
  c.appendChild(ragaTags(r));
  c.addEventListener("click", () => openDetail(r));
  return c;
}

function scaleBlock(label, seq) {
  const s = el("div", "scale");
  s.appendChild(el("div", "label", label));
  s.appendChild(pills(seq));
  return s;
}

function seedPanel(f) {
  const s = el("div", "seed");
  const bpm = f.bpm ? ` <span class="bpm">· ${f.bpm} BPM</span>` : "";
  s.appendChild(el("div", "genre", f.genre + bpm));
  s.appendChild(el("p", "prompt", f.prompt));
  const btn = el("button", "copy", "Copy Suno prompt");
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(f.prompt);
      btn.textContent = "Copied ✓";
      btn.classList.add("done");
      setTimeout(() => {
        btn.textContent = "Copy Suno prompt";
        btn.classList.remove("done");
      }, 1600);
    } catch {
      btn.textContent = "Press & hold to copy";
    }
  });
  s.appendChild(btn);
  return s;
}

function openDetail(r) {
  detailBody.innerHTML = "";
  detailBody.appendChild(el("div", "d-name", r.name));
  if (r.also_known_as)
    detailBody.appendChild(el("div", "d-aka", "also known as " + r.also_known_as));
  detailBody.appendChild(el("div", "d-lineage", r.lineage));
  detailBody.appendChild(el("div", "d-tagline", r.tagline));

  // Scale
  const scale = el("div", "section");
  scale.appendChild(el("h3", null, "The Scale"));
  scale.appendChild(scaleBlock("Arohanam (ascending)", r.arohanam));
  scale.appendChild(scaleBlock("Avarohanam (descending)", r.avarohanam));
  detailBody.appendChild(scale);

  // Mood
  const mood = el("div", "section");
  mood.appendChild(el("h3", null, "Rasa & Mood"));
  const rasa = r.rasa && !r.rasa.startsWith("undocumented") ? r.rasa : "—";
  mood.appendChild(el("div", "mood-line",
    `<span class="k">Rasa:</span> ${rasa}`));
  if (r.mood) mood.appendChild(el("div", "mood-line",
    `<span class="k">Mood:</span> ${r.mood}`));
  if (r.time_of_day) mood.appendChild(el("div", "mood-line",
    `<span class="k">Time:</span> ${r.time_of_day}`));
  detailBody.appendChild(mood);

  // Recordings
  if (r.recordings.length) {
    const rec = el("div", "section");
    rec.appendChild(el("h3", null, "Master Recordings"));
    r.recordings.forEach((rc) => {
      rec.appendChild(el("div", "rec-label",
        `<span class="varnam">${rc.varnam} — </span>` +
        `<span class="artist">${rc.artist}</span>`));
      const audio = el("audio");
      audio.controls = true;
      audio.preload = "none";
      audio.src = rc.file;
      rec.appendChild(audio);
    });
    detailBody.appendChild(rec);
  }

  // Fusion seeds
  const fus = el("div", "section");
  fus.appendChild(el("h3", null, "Suno Fusion Seeds"));
  r.fusion.forEach((f) => fus.appendChild(seedPanel(f)));
  detailBody.appendChild(fus);

  detail.hidden = false;
  detail.querySelector(".sheet").scrollTop = 0;
  document.body.style.overflow = "hidden";
}

function closeDetail() {
  detail.hidden = true;
  document.body.style.overflow = "";
}

document.getElementById("close").addEventListener("click", closeDetail);
detail.addEventListener("click", (e) => { if (e.target === detail) closeDetail(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });

/* Load data and render. */
fetch("demo_data.json")
  .then((res) => res.json())
  .then((data) => {
    document.getElementById("subtitle").textContent = data._meta.subtitle;
    data.ragas.forEach((r) => grid.appendChild(card(r)));
  })
  .catch(() => {
    grid.appendChild(el("p", "foot", "Could not load raga data."));
  });

/* Register the service worker for offline use. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
