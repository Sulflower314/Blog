(function () {
  "use strict";

  const data = window.anatomyData;
  const STORAGE_KEY = "systemAnatomyReviewV1";
  const typeNames = { single: "单选题", multiple: "多选题", judge: "判断题", short: "简答题" };

  const elements = {
    systemNav: document.getElementById("systemNav"),
    systemMap: document.getElementById("systemMap"),
    mapStatus: document.getElementById("mapStatus"),
    progressNumber: document.getElementById("progressNumber"),
    overallProgress: document.getElementById("overallProgress"),
    continueText: document.getElementById("continueText"),
    continueButton: document.getElementById("continueButton"),
    knowledgePanel: document.getElementById("knowledgePanel"),
    knowledgeSearch: document.getElementById("knowledgeSearch"),
    quizPanel: document.getElementById("quizPanel"),
    quizPosition: document.getElementById("quizPosition"),
    quizSummary: document.getElementById("quizSummary"),
    quizSystemFilter: document.getElementById("quizSystemFilter"),
    quizTypeFilter: document.getElementById("quizTypeFilter"),
    examSystemFilter: document.getElementById("examSystemFilter"),
    examCount: document.getElementById("examCount"),
    examMinutes: document.getElementById("examMinutes"),
    examClock: document.getElementById("examClock"),
    examStage: document.getElementById("examStage"),
    cardPanel: document.getElementById("cardPanel"),
    cardPosition: document.getElementById("cardPosition"),
    cardSummary: document.getElementById("cardSummary"),
    cardSystemFilter: document.getElementById("cardSystemFilter"),
    toggleCardMastery: document.getElementById("toggleCardMastery"),
    reviewList: document.getElementById("reviewList"),
    reviewCount: document.getElementById("reviewCount"),
    practiceReview: document.getElementById("practiceReview"),
    clearReview: document.getElementById("clearReview"),
    confirmDialog: document.getElementById("confirmDialog"),
    confirmTitle: document.getElementById("confirmTitle"),
    confirmMessage: document.getElementById("confirmMessage")
  };

  const initialState = {
    answers: {},
    mistakes: [],
    favorites: [],
    masteredCards: [],
    viewedSystems: [],
    recentView: "knowledge",
    recentSystem: data.systems[0].id
  };

  let state = loadState();
  let mistakes = new Set(state.mistakes);
  let favorites = new Set(state.favorites);
  let masteredCards = new Set(state.masteredCards);
  let viewedSystems = new Set(state.viewedSystems);
  let activeSystemId = state.recentSystem || data.systems[0].id;
  let quizQuestions = [];
  let quizIndex = 0;
  let quizSelection = [];
  let quizSubmitted = false;
  let shortRevealed = false;
  let shortDraft = "";
  let customQuizIds = null;
  let cardQuestions = [...data.flashcards];
  let cardIndex = 0;
  let cardFlipped = false;
  let reviewFilter = "all";
  let confirmAction = null;
  let exam = { questions: [], index: 0, selections: {}, seconds: 0, timer: null, submitted: false };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return saved && typeof saved === "object" ? { ...initialState, ...saved } : { ...initialState };
    } catch (error) {
      return { ...initialState };
    }
  }

  function saveState() {
    state.mistakes = [...mistakes];
    state.favorites = [...favorites];
    state.masteredCards = [...masteredCards];
    state.viewedSystems = [...viewedSystems];
    state.recentSystem = activeSystemId;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* The app remains usable without storage. */ }
  }

  function fisherYates(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
  }

  function percent(value, total) {
    return total ? Math.round((value / total) * 100) : 0;
  }

  function sameAnswer(left, right) {
    return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
  }

  function setView(viewName, remember) {
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
      const active = panel.dataset.viewPanel === viewName;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
    document.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === viewName;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    if (remember !== false && viewName !== "overview") {
      state.recentView = viewName;
      saveState();
    }
    if (viewName === "overview") renderDashboard();
    if (viewName === "mistakes") renderReview();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderDashboard() {
    const answerIds = Object.keys(state.answers);
    const correct = answerIds.filter((id) => state.answers[id].correct).length;
    const progress = percent(answerIds.length, data.questions.length);
    elements.progressNumber.textContent = `${progress}%`;
    elements.overallProgress.style.width = `${progress}%`;
    elements.continueText.textContent = answerIds.length
      ? `已完成 ${answerIds.length} / ${data.questions.length} 题，答对 ${correct} 题；错题 ${mistakes.size} 道。`
      : "尚未开始答题，先从一个系统建立结构。";
    elements.continueButton.textContent = answerIds.length ? "继续上次学习" : "从运动系统开始";

    let startedSystems = 0;
    elements.systemMap.innerHTML = data.systems.map((system) => {
      const systemQuestions = data.questions.filter((question) => question.system === system.name);
      const answered = systemQuestions.filter((question) => state.answers[question.id]).length;
      const systemProgress = percent(answered, systemQuestions.length);
      if (answered || viewedSystems.has(system.id)) startedSystems += 1;
      return `
        <button type="button" class="map-row" data-map-system="${system.id}" aria-label="${system.name}，完成 ${systemProgress}%">
          <span>${system.index}</span><strong>${system.name}</strong>
          <span class="map-track"><i style="width:${systemProgress}%"></i></span><b>${systemProgress}%</b>
        </button>`;
    }).join("");
    elements.mapStatus.textContent = `${startedSystems} / ${data.systems.length} 已开始`;
    elements.systemMap.querySelectorAll("[data-map-system]").forEach((button) => {
      button.addEventListener("click", () => selectSystem(button.dataset.mapSystem, "knowledge"));
    });

    document.getElementById("systemCount").textContent = data.systems.length;
    document.getElementById("questionCount").textContent = data.questions.length;
    document.getElementById("cardCount").textContent = data.flashcards.length;
  }

  function renderSystemNav(filterText) {
    const query = (filterText || "").trim().toLowerCase();
    const matches = data.systems.filter((system) => {
      const text = [system.name, system.subtitle, ...system.focus, ...system.compare.flat(), system.pathway, ...system.memory].join(" ").toLowerCase();
      return !query || text.includes(query);
    });
    elements.systemNav.innerHTML = matches.length ? matches.map((system) => `
      <button type="button" class="system-button ${system.id === activeSystemId ? "active" : ""}" data-system="${system.id}">
        <span>${system.index}</span><span><strong>${system.name}</strong><small>${system.subtitle}</small></span>
      </button>`).join("") : '<p class="empty-state">没有匹配的系统或考点。</p>';
    elements.systemNav.querySelectorAll("[data-system]").forEach((button) => {
      button.addEventListener("click", () => selectSystem(button.dataset.system, "knowledge"));
    });
    return matches;
  }

  function selectSystem(systemId, targetView) {
    activeSystemId = systemId;
    viewedSystems.add(systemId);
    saveState();
    renderSystemNav(elements.knowledgeSearch.value);
    renderKnowledge();
    if (targetView) setView(targetView);
  }

  function renderKnowledge() {
    const system = data.systems.find((item) => item.id === activeSystemId) || data.systems[0];
    elements.knowledgePanel.innerHTML = `
      <div class="knowledge-title"><span class="large-index">${system.index}</span><div><p class="eyebrow">${system.subtitle}</p><h2>${system.name}</h2></div></div>
      <div class="knowledge-layout">
        <section class="focus-block"><h3>核心复习坐标</h3><ol>${system.focus.map((item) => `<li>${item}</li>`).join("")}</ol></section>
        <section class="compare-block"><h3>易混对照</h3><div class="compare-list">${system.compare.map((row) => `<div><strong>${row[0]}</strong><span>${row[1]}</span></div>`).join("")}</div></section>
      </div>
      <section class="pathway-block"><span>结构路径</span><p>${system.pathway}</p></section>
      <section class="memory-block"><h3>复习抓手</h3><div>${system.memory.map((item, index) => `<p><span>${String(index + 1).padStart(2, "0")}</span>${item}</p>`).join("")}</div></section>`;
  }

  function populateFilters() {
    const systems = ['<option value="all">全部系统</option>', ...data.systems.map((system) => `<option value="${system.name}">${system.name}</option>`)].join("");
    elements.quizSystemFilter.innerHTML = systems;
    elements.examSystemFilter.innerHTML = systems;
    elements.cardSystemFilter.innerHTML = systems;
    elements.quizTypeFilter.innerHTML = '<option value="all">全部题型</option><option value="single">单选题</option><option value="multiple">多选题</option><option value="judge">判断题</option><option value="short">简答题</option>';
  }

  function buildQuizPool() {
    const systemValue = elements.quizSystemFilter.value;
    const typeValue = elements.quizTypeFilter.value;
    quizQuestions = data.questions.filter((question) => {
      const inCustom = !customQuizIds || customQuizIds.includes(question.id);
      const systemMatch = systemValue === "all" || question.system === systemValue;
      const typeMatch = typeValue === "all" || question.type === typeValue;
      return inCustom && systemMatch && typeMatch;
    });
    quizIndex = 0;
    loadQuizQuestion();
  }

  function loadQuizQuestion() {
    const question = quizQuestions[quizIndex];
    const saved = question ? state.answers[question.id] : null;
    quizSelection = saved && Array.isArray(saved.selected) ? [...saved.selected] : [];
    quizSubmitted = Boolean(saved);
    shortRevealed = Boolean(saved && question && question.type === "short");
    shortDraft = saved && typeof saved.text === "string" ? saved.text : "";
    renderQuiz();
  }

  function saveChoiceAnswer(question) {
    const correct = sameAnswer(quizSelection, question.answer);
    state.answers[question.id] = { selected: [...quizSelection], correct, type: question.type };
    if (correct) mistakes.delete(question.id); else mistakes.add(question.id);
    quizSubmitted = true;
    saveState();
    renderQuiz();
    renderDashboard();
  }

  function saveShortAnswer(question, correct) {
    const textArea = document.getElementById("shortAnswer");
    state.answers[question.id] = { text: textArea ? textArea.value.trim() : shortDraft.trim(), selected: [], correct, type: question.type };
    if (correct) mistakes.delete(question.id); else mistakes.add(question.id);
    quizSubmitted = true;
    shortRevealed = true;
    saveState();
    renderQuiz();
    renderDashboard();
  }

  function renderQuiz() {
    elements.quizSummary.textContent = customQuizIds ? "复习队列" : `共 ${quizQuestions.length} 题`;
    elements.quizPosition.textContent = quizQuestions.length ? `${quizIndex + 1} / ${quizQuestions.length}` : "0 / 0";
    if (!quizQuestions.length) {
      elements.quizPanel.innerHTML = '<div class="empty-state large-empty"><strong>没有匹配题目</strong><span>请调整系统或题型筛选。</span></div>';
      return;
    }

    const question = quizQuestions[quizIndex];
    const correct = quizSubmitted && state.answers[question.id] && state.answers[question.id].correct;
    const isFavorite = favorites.has(question.id);
    const optionsHtml = question.type === "short" ? `
      <label class="short-answer-field"><span>先默写你的答案</span><textarea id="shortAnswer" ${quizSubmitted ? "disabled" : ""} placeholder="按结构、位置、通路或关键词作答">${escapeHtml(shortDraft)}</textarea></label>
      ${shortRevealed ? `<div class="reference-answer"><strong>参考答案</strong><p>${question.analysis}</p></div>` : ""}
      ${shortRevealed && !quizSubmitted ? '<div class="self-review"><button type="button" data-self-review="true">自评掌握</button><button type="button" data-self-review="false">自评未掌握</button></div>' : ""}` : `
      <div class="answer-options">${question.options.map((option, index) => {
        const selected = quizSelection.includes(index);
        const answerClass = quizSubmitted && question.answer.includes(index) ? "answer" : "";
        const wrongClass = quizSubmitted && selected && !question.answer.includes(index) ? "wrong" : "";
        return `<button type="button" class="answer-option ${selected ? "selected" : ""} ${answerClass} ${wrongClass}" data-option="${index}" ${quizSubmitted ? "disabled" : ""}><span>${String.fromCharCode(65 + index)}</span>${option}</button>`;
      }).join("")}</div>
      ${quizSubmitted ? `<div class="feedback ${correct ? "correct" : "incorrect"}"><strong>${correct ? "回答正确" : "需要再看一遍"}</strong><p>${question.analysis}</p></div>` : ""}`;

    elements.quizPanel.innerHTML = `
      <article class="question-card">
        <div class="question-meta"><span>${question.system}</span><span>${typeNames[question.type]}</span>${mistakes.has(question.id) ? "<span>错题</span>" : ""}</div>
        <h2>${question.stem}</h2>${optionsHtml}
        <div class="question-actions">
          <button type="button" id="previousQuestion" ${quizIndex === 0 ? "disabled" : ""}>上一题</button>
          ${question.type === "short" ? `<button type="button" id="revealAnswer" class="primary-action" ${quizSubmitted || shortRevealed ? "disabled" : ""}>显示参考答案</button>` : `<button type="button" id="submitAnswer" class="primary-action" ${quizSelection.length === 0 || quizSubmitted ? "disabled" : ""}>提交答案</button>`}
          <button type="button" id="nextQuestion">${quizIndex === quizQuestions.length - 1 ? "回到第一题" : "下一题"}</button>
          <button type="button" id="favoriteQuestion">${isFavorite ? "取消收藏" : "收藏此题"}</button>
          ${quizSubmitted ? '<button type="button" id="retryQuestion">重新作答</button>' : ""}
        </div>
      </article>`;

    elements.quizPanel.querySelectorAll("[data-option]").forEach((button) => {
      button.addEventListener("click", () => {
        const option = Number(button.dataset.option);
        if (question.type === "multiple") {
          quizSelection = quizSelection.includes(option) ? quizSelection.filter((item) => item !== option) : [...quizSelection, option];
        } else {
          quizSelection = [option];
        }
        renderQuiz();
      });
    });
    elements.quizPanel.querySelectorAll("[data-self-review]").forEach((button) => button.addEventListener("click", () => saveShortAnswer(question, button.dataset.selfReview === "true")));

    const submit = document.getElementById("submitAnswer");
    if (submit) submit.addEventListener("click", () => saveChoiceAnswer(question));
    const reveal = document.getElementById("revealAnswer");
    if (reveal) reveal.addEventListener("click", () => {
      const textArea = document.getElementById("shortAnswer");
      shortDraft = textArea ? textArea.value : shortDraft;
      shortRevealed = true;
      renderQuiz();
    });
    const retry = document.getElementById("retryQuestion");
    if (retry) retry.addEventListener("click", () => { delete state.answers[question.id]; quizSelection = []; quizSubmitted = false; shortRevealed = false; shortDraft = ""; saveState(); renderQuiz(); });

    document.getElementById("previousQuestion").addEventListener("click", () => { quizIndex = Math.max(0, quizIndex - 1); loadQuizQuestion(); });
    document.getElementById("nextQuestion").addEventListener("click", () => { quizIndex = (quizIndex + 1) % quizQuestions.length; loadQuizQuestion(); });
    document.getElementById("favoriteQuestion").addEventListener("click", () => {
      if (favorites.has(question.id)) favorites.delete(question.id); else favorites.add(question.id);
      saveState(); renderQuiz(); renderReview();
    });
  }

  function setQuizFilterFromSystem(systemName) {
    customQuizIds = null;
    elements.quizSystemFilter.value = systemName;
    elements.quizTypeFilter.value = "all";
    buildQuizPool();
    setView("quiz");
  }

  function renderCard() {
    if (!cardQuestions.length) {
      elements.cardPosition.textContent = "0 / 0";
      elements.cardPanel.innerHTML = '<div class="empty-state large-empty"><strong>没有匹配卡片</strong><span>请切换系统筛选。</span></div>';
      return;
    }
    const card = cardQuestions[cardIndex];
    const mastered = masteredCards.has(card.id);
    elements.cardPosition.textContent = `${cardIndex + 1} / ${cardQuestions.length}`;
    elements.cardSummary.textContent = `${masteredCards.size} 张已掌握`;
    elements.toggleCardMastery.textContent = mastered ? "取消已掌握" : "标记已掌握";
    elements.cardPanel.innerHTML = `
      <button type="button" class="memory-card ${cardFlipped ? "flipped" : ""} ${mastered ? "mastered" : ""}" id="memoryCard" aria-label="翻转速记卡">
        <span class="card-system">${card.system}${mastered ? " · 已掌握" : ""}</span><span class="card-side">${cardFlipped ? "答案" : "问题"}</span>
        <strong>${cardFlipped ? card.back : card.front}</strong><small>${cardFlipped ? "再次翻转返回问题" : "点击或按 Enter / Space 查看答案"}</small>
      </button>`;
    document.getElementById("memoryCard").addEventListener("click", toggleCard);
  }

  function filterCards() {
    const value = elements.cardSystemFilter.value;
    cardQuestions = data.flashcards.filter((card) => value === "all" || card.system === value);
    cardIndex = 0;
    cardFlipped = false;
    renderCard();
  }

  function toggleCard() {
    cardFlipped = !cardFlipped;
    renderCard();
  }

  function getReviewIds() {
    if (reviewFilter === "mistakes") return [...mistakes];
    if (reviewFilter === "favorites") return [...favorites];
    return [...new Set([...mistakes, ...favorites])];
  }

  function renderReview() {
    const ids = getReviewIds();
    const questions = data.questions.filter((question) => ids.includes(question.id));
    elements.reviewCount.textContent = questions.length;
    elements.practiceReview.disabled = questions.length === 0;
    elements.clearReview.disabled = mistakes.size === 0;
    elements.reviewList.innerHTML = questions.length ? questions.map((question) => `
      <article class="review-item">
        <div class="question-meta"><span>${question.system}</span><span>${typeNames[question.type]}</span>${mistakes.has(question.id) ? "<span>错题</span>" : ""}${favorites.has(question.id) ? "<span>收藏</span>" : ""}</div>
        <h2>${question.stem}</h2>
        <div><button type="button" data-review-question="${question.id}">重新练习</button><button type="button" data-review-favorite="${question.id}">${favorites.has(question.id) ? "取消收藏" : "加入收藏"}</button></div>
      </article>`).join("") : '<div class="empty-state large-empty"><strong>当前队列为空</strong><span>答错的题目会自动进入这里，也可以在刷题时主动收藏。</span></div>';
    elements.reviewList.querySelectorAll("[data-review-question]").forEach((button) => button.addEventListener("click", () => {
      customQuizIds = [button.dataset.reviewQuestion];
      elements.quizSystemFilter.value = "all";
      elements.quizTypeFilter.value = "all";
      buildQuizPool();
      if (quizQuestions[0]) { delete state.answers[quizQuestions[0].id]; saveState(); loadQuizQuestion(); }
      setView("quiz");
    }));
    elements.reviewList.querySelectorAll("[data-review-favorite]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.reviewFavorite;
      if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
      saveState(); renderReview();
    }));
  }

  function startExam() {
    window.clearInterval(exam.timer);
    const systemValue = elements.examSystemFilter.value;
    const pool = data.questions.filter((question) => question.type !== "short" && (systemValue === "all" || question.system === systemValue));
    const count = Math.min(Number(elements.examCount.value), pool.length);
    exam = {
      questions: fisherYates(pool).slice(0, count),
      index: 0,
      selections: {},
      seconds: Math.max(1, Number(elements.examMinutes.value)) * 60,
      timer: null,
      submitted: false
    };
    updateExamClock();
    exam.timer = window.setInterval(() => {
      exam.seconds -= 1;
      updateExamClock();
      if (exam.seconds <= 0) submitExam();
    }, 1000);
    renderExamQuestion();
  }

  function updateExamClock() {
    const minutes = String(Math.floor(Math.max(0, exam.seconds) / 60)).padStart(2, "0");
    const seconds = String(Math.max(0, exam.seconds) % 60).padStart(2, "0");
    elements.examClock.textContent = `${minutes}:${seconds}`;
  }

  function renderExamQuestion() {
    const question = exam.questions[exam.index];
    if (!question) return;
    const selected = exam.selections[question.id] || [];
    elements.examStage.innerHTML = `
      <div class="exam-progress"><span>第 ${exam.index + 1} / ${exam.questions.length} 题</span><span>已答 ${Object.keys(exam.selections).length} 题</span></div>
      <article class="exam-question-card">
        <div class="question-meta"><span>${question.system}</span><span>${typeNames[question.type]}</span></div>
        <h2>${question.stem}</h2>
        <div class="answer-options">${question.options.map((option, index) => `<button type="button" class="answer-option ${selected.includes(index) ? "selected" : ""}" data-exam-option="${index}"><span>${String.fromCharCode(65 + index)}</span>${option}</button>`).join("")}</div>
        <div class="question-actions"><button type="button" id="examPrevious" ${exam.index === 0 ? "disabled" : ""}>上一题</button><button type="button" id="examNext" ${exam.index === exam.questions.length - 1 ? "disabled" : ""}>下一题</button><button type="button" id="submitExam" class="primary-action">交卷</button></div>
      </article>`;
    elements.examStage.querySelectorAll("[data-exam-option]").forEach((button) => button.addEventListener("click", () => {
      const option = Number(button.dataset.examOption);
      const previous = exam.selections[question.id] || [];
      exam.selections[question.id] = question.type === "multiple"
        ? (previous.includes(option) ? previous.filter((item) => item !== option) : [...previous, option])
        : [option];
      renderExamQuestion();
    }));
    document.getElementById("examPrevious").addEventListener("click", () => { exam.index -= 1; renderExamQuestion(); });
    document.getElementById("examNext").addEventListener("click", () => { exam.index += 1; renderExamQuestion(); });
    document.getElementById("submitExam").addEventListener("click", submitExam);
  }

  function submitExam() {
    if (!exam.questions.length || exam.submitted) return;
    exam.submitted = true;
    window.clearInterval(exam.timer);
    elements.examClock.textContent = "已交卷";
    let score = 0;
    const weak = {};
    const wrong = [];
    exam.questions.forEach((question) => {
      const selected = exam.selections[question.id] || [];
      const correct = sameAnswer(selected, question.answer);
      state.answers[question.id] = { selected: [...selected], correct, type: question.type };
      if (correct) {
        score += 1;
        mistakes.delete(question.id);
      } else {
        mistakes.add(question.id);
        wrong.push(question);
        weak[question.system] = (weak[question.system] || 0) + 1;
      }
    });
    saveState();
    renderDashboard();
    renderReview();
    const weakText = Object.entries(weak).sort((left, right) => right[1] - left[1]).map(([system, count]) => `${system} ${count} 题`).join("；") || "暂无明显薄弱系统";
    elements.examStage.innerHTML = `
      <section class="exam-report">
        <p class="eyebrow">Exam Report</p><h2>${score} / ${exam.questions.length}</h2><strong>正确率 ${percent(score, exam.questions.length)}%</strong>
        <div><span>薄弱系统</span><p>${weakText}</p></div>
        <div><span>错题数量</span><p>${wrong.length} 题，已同步进入错题队列。</p></div>
        <button type="button" id="restartExam" class="primary-action">重新组卷</button>
      </section>`;
    document.getElementById("restartExam").addEventListener("click", startExam);
  }

  function requestConfirm(title, message, action) {
    elements.confirmTitle.textContent = title;
    elements.confirmMessage.textContent = message;
    confirmAction = action;
    elements.confirmDialog.showModal();
  }

  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  document.querySelectorAll("[data-open-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.openView)));

  elements.continueButton.addEventListener("click", () => {
    if (Object.keys(state.answers).length) setView(state.recentView || "knowledge");
    else selectSystem(data.systems[0].id, "knowledge");
  });
  elements.knowledgeSearch.addEventListener("input", () => {
    const matches = renderSystemNav(elements.knowledgeSearch.value);
    if (matches.length && !matches.some((system) => system.id === activeSystemId)) {
      activeSystemId = matches[0].id;
      renderSystemNav(elements.knowledgeSearch.value);
      renderKnowledge();
    }
  });

  [elements.quizSystemFilter, elements.quizTypeFilter].forEach((select) => select.addEventListener("change", () => { customQuizIds = null; buildQuizPool(); }));
  document.getElementById("shuffleQuiz").addEventListener("click", () => { quizQuestions = fisherYates(quizQuestions); quizIndex = 0; loadQuizQuestion(); });
  document.getElementById("resetQuiz").addEventListener("click", () => requestConfirm("重置答题记录", "将清除当前筛选题目的答题结果，但保留收藏。", () => {
    quizQuestions.forEach((question) => { delete state.answers[question.id]; mistakes.delete(question.id); });
    saveState(); loadQuizQuestion(); renderDashboard(); renderReview();
  }));

  elements.cardSystemFilter.addEventListener("change", filterCards);
  document.getElementById("shuffleCards").addEventListener("click", () => { cardQuestions = fisherYates(cardQuestions); cardIndex = 0; cardFlipped = false; renderCard(); });
  document.getElementById("prevCard").addEventListener("click", () => { cardIndex = (cardIndex - 1 + cardQuestions.length) % cardQuestions.length; cardFlipped = false; renderCard(); });
  document.getElementById("nextCard").addEventListener("click", () => { cardIndex = (cardIndex + 1) % cardQuestions.length; cardFlipped = false; renderCard(); });
  document.getElementById("flipCard").addEventListener("click", toggleCard);
  elements.toggleCardMastery.addEventListener("click", () => {
    const card = cardQuestions[cardIndex];
    if (!card) return;
    if (masteredCards.has(card.id)) masteredCards.delete(card.id); else masteredCards.add(card.id);
    saveState(); renderCard();
  });

  document.querySelectorAll("[data-review-filter]").forEach((button) => button.addEventListener("click", () => {
    reviewFilter = button.dataset.reviewFilter;
    document.querySelectorAll("[data-review-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderReview();
  }));
  elements.practiceReview.addEventListener("click", () => {
    customQuizIds = getReviewIds();
    elements.quizSystemFilter.value = "all";
    elements.quizTypeFilter.value = "all";
    buildQuizPool();
    setView("quiz");
  });
  elements.clearReview.addEventListener("click", () => requestConfirm("清空错题", "将移除全部错题标记，收藏题不会受影响。", () => { mistakes.clear(); saveState(); renderReview(); renderDashboard(); }));

  document.getElementById("startExam").addEventListener("click", startExam);
  elements.confirmDialog.addEventListener("close", () => {
    if (elements.confirmDialog.returnValue === "confirm" && confirmAction) confirmAction();
    confirmAction = null;
  });
  document.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && document.activeElement && document.activeElement.id === "memoryCard") {
      event.preventDefault();
      toggleCard();
    }
  });

  populateFilters();
  renderSystemNav("");
  renderKnowledge();
  buildQuizPool();
  filterCards();
  renderReview();
  renderDashboard();
  setView("overview", false);
}());
