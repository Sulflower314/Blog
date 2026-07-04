const state = {
  chapter: "全部",
  type: "全部",
  query: "",
  onlyPast: false,
  hideAnswers: false,
  done: new Set(JSON.parse(localStorage.getItem("reviewDone") || "[]")),
};

const $ = (sel) => document.querySelector(sel);
const data = window.REVIEW_DATA.items;
const sources = window.REVIEW_DATA.sources;

function saveDone() {
  localStorage.setItem("reviewDone", JSON.stringify([...state.done]));
}

function init() {
  const chapters = ["全部", ...new Set(data.map(x => x.chapterTitle))];
  $("#chapterFilter").innerHTML = chapters.map(x => `<option>${x}</option>`).join("");
  const types = ["全部", ...new Set(data.map(x => x.origin.type))];
  $("#typeFilter").innerHTML = types.map(x => `<option>${x}</option>`).join("");

  $("#searchInput").addEventListener("input", e => { state.query = e.target.value.trim(); render(); });
  $("#chapterFilter").addEventListener("change", e => { state.chapter = e.target.value; render(); });
  $("#typeFilter").addEventListener("change", e => { state.type = e.target.value; render(); });
  $("#onlyPast").addEventListener("change", e => { state.onlyPast = e.target.checked; render(); });
  $("#hideAnswers").addEventListener("change", e => { state.hideAnswers = e.target.checked; render(); });
  $("#themeBtn").addEventListener("click", () => document.body.classList.toggle("dark"));
  renderSources();
  render();
}

function filtered() {
  const q = state.query.toLowerCase();
  return data.filter(item => {
    const hay = [item.question, item.originalAnswer, item.web.webAnswer, item.chapterTitle, item.origin.raw].join(" ").toLowerCase();
    if (state.chapter !== "全部" && item.chapterTitle !== state.chapter) return false;
    if (state.type !== "全部" && item.origin.type !== state.type) return false;
    if (state.onlyPast && !item.origin.years.length) return false;
    if (q && !hay.includes(q)) return false;
    return true;
  });
}

function renderStats(list) {
  const past = data.filter(x => x.origin.years.length).length;
  $("#stats").innerHTML = `
    <div class="stat"><strong>${data.length}</strong><span>题目</span></div>
    <div class="stat"><strong>${past}</strong><span>有年份</span></div>
    <div class="stat"><strong>${state.done.size}</strong><span>已掌握</span></div>`;
}

function renderNav() {
  const counts = {};
  data.forEach(x => counts[x.chapterTitle] = (counts[x.chapterTitle] || 0) + 1);
  $("#chapterNav").innerHTML = ["全部", ...Object.keys(counts)].map(ch => {
    const count = ch === "全部" ? data.length : counts[ch];
    return `<button class="nav-btn ${state.chapter === ch ? "active" : ""}" data-chapter="${ch}">
      <span>${ch}</span><strong>${count}</strong>
    </button>`;
  }).join("");
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.chapter = btn.dataset.chapter;
      $("#chapterFilter").value = state.chapter;
      render();
    });
  });
}

function renderSources() {
  $("#sourceList").innerHTML = Object.values(sources).map(s => `
    <div>${s.url ? `<a href="${s.url}" target="_blank" rel="noreferrer">${s.label}</a>` : s.label}<br>${s.note}</div>
  `).join("");
}

function chip(text, cls = "") {
  return `<span class="chip ${cls}">${text}</span>`;
}

function renderCards() {
  const list = filtered();
  const wrap = $("#cards");
  wrap.innerHTML = "";
  if (!list.length) {
    wrap.innerHTML = `<div class="empty">没有匹配的题目，换个关键词试试。</div>`;
    return;
  }
  const tpl = $("#cardTpl");
  list.forEach(item => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = item.id;
    if (state.done.has(item.id)) node.classList.add("done");
    node.querySelector(".meta-line").textContent = `${item.chapterTitle} · 第 ${item.number} 题 · ${item.origin.type}`;
    node.querySelector(".question").textContent = item.question;
    const chips = [
      chip(item.origin.raw),
      chip(item.hasOriginalAnswer ? "原文有答案" : "原文未给答案", item.hasOriginalAnswer ? "" : "warn"),
      ...item.web.sourceKeys.map(k => chip(sources[k]?.label || k))
    ];
    node.querySelector(".chips").innerHTML = chips.join("");
    node.querySelector(".cue").textContent = item.web.studyCue;
    node.querySelector(".original").textContent = item.hasOriginalAnswer ? item.originalAnswer : "【原文未给出答案，建议补充。】";
    node.querySelector(".web").textContent = item.web.webAnswer;
    node.querySelector(".tips").innerHTML = item.web.tips.map(x => `• ${x}`).join("\n");

    if (state.hideAnswers) {
      node.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
      node.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
    }

    node.querySelector(".done-btn").addEventListener("click", () => {
      state.done.has(item.id) ? state.done.delete(item.id) : state.done.add(item.id);
      saveDone();
      render();
    });

    node.querySelectorAll(".tabs button").forEach(btn => {
      btn.addEventListener("click", () => {
        node.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
        node.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
        btn.classList.add("active");
        node.querySelector(`.${btn.dataset.tab}`).classList.remove("hidden");
      });
    });
    wrap.appendChild(node);
  });
}

function render() {
  renderStats(filtered());
  renderNav();
  renderCards();
}

init();
