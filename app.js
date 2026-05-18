/* Pulse Of Raga — demo PWA. Raga cards, detail view, and the 5-axis raga map. */

const grid = document.getElementById("grid");
const detail = document.getElementById("detail");
const detailBody = document.getElementById("detail-body");
const SVGNS = "http://www.w3.org/2000/svg";

let HEROES = {};   // name -> full hero record, for map-dot clicks

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function svg(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

/* Brightness 0..1 -> colour, dim slate to warm gold. */
function brightColor(b) {
  const a = [120, 104, 134], z = [232, 176, 75];
  const m = (i) => Math.round(a[i] + (z[i] - a[i]) * b);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

/* ---------- raga cards ---------- */
function pills(seq) {
  const wrap = el("div", "pills");
  seq.forEach((sw) => wrap.appendChild(el("span", "pill" + (sw === "S" ? " sa" : ""), sw)));
  return wrap;
}

function ragaTags(r) {
  const t = el("div", "tags");
  if (r.pentatonic) t.appendChild(el("span", "tag hot", "5-note pentatonic"));
  if (r.vakra) t.appendChild(el("span", "tag", "vakra"));
  if (r.bhashanga) t.appendChild(el("span", "tag", "bhashanga"));
  if (r.rasa && !r.rasa.startsWith("undocumented"))
    t.appendChild(el("span", "tag", r.rasa.split("/")[0].trim()));
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

/* ---------- 5-axis radar ---------- */
const AXES = [
  ["valence", "Valence"], ["arousal", "Arousal"], ["brightness", "Brightness"],
  ["density", "Density"], ["regularity", "Regularity"],
];

function radar(vec) {
  const size = 240, c = size / 2, R = 78;
  const s = svg("svg", { viewBox: `0 0 ${size} ${size}`, class: "radar" });
  const ang = (i) => (-90 + i * 72) * Math.PI / 180;
  const pt = (i, r) => [c + R * r * Math.cos(ang(i)), c + R * r * Math.sin(ang(i))];

  // grid rings
  [0.5, 1].forEach((ring) => {
    const d = AXES.map((_, i) => pt(i, ring).join(",")).join(" ");
    s.appendChild(svg("polygon", { points: d, class: "radar-grid" }));
  });
  // spokes + labels
  AXES.forEach(([key, label], i) => {
    const [x, y] = pt(i, 1);
    s.appendChild(svg("line", { x1: c, y1: c, x2: x, y2: y, class: "radar-grid" }));
    const [lx, ly] = pt(i, 1.28);
    const t = svg("text", { x: lx, y: ly, class: "radar-label" });
    t.setAttribute("text-anchor", lx < c - 5 ? "end" : lx > c + 5 ? "start" : "middle");
    t.textContent = label;
    s.appendChild(t);
  });
  // the raga's polygon
  const poly = AXES.map(([k], i) => pt(i, vec[k]).join(",")).join(" ");
  s.appendChild(svg("polygon", { points: poly, class: "radar-shape" }));
  AXES.forEach(([k], i) => {
    const [x, y] = pt(i, vec[k]);
    s.appendChild(svg("circle", { cx: x, cy: y, r: 3.2, class: "radar-dot" }));
  });
  return s;
}

/* ---------- raga map (scatter) ----------
   x = valence (mood), y = arousal (energy), colour = brightness,
   size = density, opacity = regularity — all 5 axes on one map. Hero dots
   are decluttered so same-rasa ragas (identical x,y) stay tappable. */
function renderMap(rows) {
  const W = 360, H = 332, padL = 34, padR = 20, padT = 20, padB = 36;
  const x = (v) => padL + v * (W - padL - padR);
  const y = (a) => H - padB - a * (H - padT - padB);
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "ragamap" });

  s.appendChild(svg("rect", { x: padL, y: padT, width: W - padL - padR,
    height: H - padT - padB, class: "map-frame" }));
  const cap = (txt, ax, ay, anchor) => {
    const t = svg("text", { x: ax, y: ay, class: "map-axis" });
    t.setAttribute("text-anchor", anchor);
    t.textContent = txt;
    s.appendChild(t);
  };
  cap("darker  ←  mood  →  brighter", W / 2, H - 12, "middle");
  cap("↑ intense", padL + 3, padT + 11, "start");
  cap("↓ calm", padL + 3, H - padB - 5, "start");

  // non-hero dots — dim context
  rows.filter((r) => !r.hero).forEach((r) => {
    const v = r.vector;
    s.appendChild(svg("circle", {
      cx: x(v.valence), cy: y(v.arousal), r: 3 + v.density * 5.5,
      fill: brightColor(v.brightness),
      "fill-opacity": 0.30 + v.regularity * 0.40, class: "dot",
    }));
  });

  // hero dots — decluttered so identical-rasa ragas don't stack
  const heroes = rows.filter((r) => r.hero).map((r) => ({
    r, v: r.vector, x: x(r.vector.valence), y: y(r.vector.arousal),
  }));
  // tiny golden-angle pre-spread so exactly-coincident dots get a non-zero
  // push direction for the declutter passes below
  heroes.forEach((h, i) => {
    h.x += Math.cos(i * 2.39996) * 1.5;
    h.y += Math.sin(i * 2.39996) * 1.5;
  });
  for (let pass = 0; pass < 24; pass++) {
    for (let i = 0; i < heroes.length; i++) {
      for (let j = i + 1; j < heroes.length; j++) {
        const a = heroes[i], b = heroes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy) || 0.01;
        const min = 26;
        if (d < min) {
          const push = (min - d) / 2;
          dx /= d; dy /= d;
          a.x -= dx * push; a.y -= dy * push;
          b.x += dx * push; b.y += dy * push;
        }
      }
    }
  }
  heroes.forEach((h) => {
    h.x = Math.max(padL + 8, Math.min(W - padR - 8, h.x));
    h.y = Math.max(padT + 8, Math.min(H - padB - 8, h.y));
    const g = svg("g", { class: "herodot" });
    g.appendChild(svg("circle", {
      cx: h.x, cy: h.y, r: 5 + h.v.density * 6,
      fill: brightColor(h.v.brightness), stroke: "#e8b04b", "stroke-width": 2,
    }));
    const t = svg("title");                       // native tap/hover tooltip
    t.textContent = h.r.display;
    g.appendChild(t);
    g.addEventListener("click", () => {
      const hero = HEROES[h.r.name] || HEROES[h.r.display];
      if (hero) openDetail(hero);
    });
    s.appendChild(g);
  });
  document.getElementById("map").appendChild(s);
}

/* ---------- detail overlay ---------- */
function scaleBlock(label, seq) {
  const s = el("div", "scale");
  s.appendChild(el("div", "label", label));
  s.appendChild(pills(seq));
  return s;
}

function seedPanel(f) {
  const s = el("div", "seed");
  const fit = f.fit != null ? ` <span class="bpm">· ${Math.round(f.fit * 100)}% fit</span>` : "";
  s.appendChild(el("div", "genre", f.genre + fit));
  s.appendChild(el("p", "prompt", f.prompt));
  const btn = el("button", "copy", "Copy Suno prompt");
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(f.prompt);
      btn.textContent = "Copied ✓";
      btn.classList.add("done");
      setTimeout(() => { btn.textContent = "Copy Suno prompt"; btn.classList.remove("done"); }, 1600);
    } catch { btn.textContent = "Press & hold to copy"; }
  });
  s.appendChild(btn);
  return s;
}

function section(title) {
  const d = el("div", "section");
  d.appendChild(el("h3", null, title));
  return d;
}

function openDetail(r) {
  detailBody.innerHTML = "";
  detailBody.appendChild(el("div", "d-name", r.name));
  if (r.also_known_as)
    detailBody.appendChild(el("div", "d-aka", "also known as " + r.also_known_as));
  detailBody.appendChild(el("div", "d-lineage", r.lineage));
  detailBody.appendChild(el("div", "d-tagline", r.tagline));

  const scale = section("The Scale");
  scale.appendChild(scaleBlock("Arohanam (ascending)", r.arohanam));
  scale.appendChild(scaleBlock("Avarohanam (descending)", r.avarohanam));
  detailBody.appendChild(scale);

  const mood = section("Rasa & Mood");
  const rasa = r.rasa && !r.rasa.startsWith("undocumented") ? r.rasa : "—";
  mood.appendChild(el("div", "mood-line", `<span class="k">Rasa:</span> ${rasa}`));
  if (r.mood) mood.appendChild(el("div", "mood-line", `<span class="k">Mood:</span> ${r.mood}`));
  if (r.time_of_day)
    mood.appendChild(el("div", "mood-line", `<span class="k">Time:</span> ${r.time_of_day}`));
  detailBody.appendChild(mood);

  if (r.vector) {
    const fp = section("Fusion Fingerprint");
    fp.appendChild(el("p", "fp-note", "Where this raga sits on the 5 axes that drive genre matching."));
    fp.appendChild(radar(r.vector));
    detailBody.appendChild(fp);
  }

  if (r.recordings && r.recordings.length) {
    const rec = section("Master Recordings");
    r.recordings.forEach((rc) => {
      rec.appendChild(el("div", "rec-label",
        `<span class="varnam">${rc.varnam} — </span><span class="artist">${rc.artist}</span>`));
      const audio = el("audio");
      audio.controls = true; audio.preload = "none"; audio.src = rc.file;
      rec.appendChild(audio);
    });
    detailBody.appendChild(rec);
  }

  const fus = section("Suno Fusion Seeds");
  fus.appendChild(el("p", "fp-note", "Best-fit genres from the 5-axis match."));
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

/* ---------- load ---------- */
fetch("demo_data.json")
  .then((res) => res.json())
  .then((data) => {
    document.getElementById("subtitle").textContent = data._meta.subtitle;
    data.ragas.forEach((r) => { HEROES[r.name] = r; grid.appendChild(card(r)); });
    return fetch("raga_map.json");
  })
  .then((res) => res.json())
  .then((data) => renderMap(data.ragas))
  .catch(() => grid.appendChild(el("p", "foot", "Could not load raga data.")));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
