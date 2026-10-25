(function () {
  const content = window.LEELA_CONTENT;
  const rules = window.LeelaRules;
  const SAVE = "leela-journey-v1";
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = ["#ff7ab6", "#5ee7c8", "#ffd166", "#8fa8ff", "#c792ff", "#ff9f6b"];
  const PLANE_COLORS = ["#ff4d6d", "#ff8c42", "#ffd166", "#3ddc97", "#4cc9f0", "#7b6cff", "#c77dff", "#ffe8a3"];
  const CHAKRAS = {
    5: { color: "#ff3b5c", petals: 4 },
    14: { color: "#ff8a3d", petals: 6 },
    23: { color: "#ffd23f", petals: 10 },
    32: { color: "#3ddc97", petals: 12 },
    41: { color: "#4cc9f0", petals: 16 },
    50: { color: "#8f7bff", petals: 2 },
    59: { color: "#c77dff", petals: 24 },
    68: { color: "#fff1c1", om: true }
  };
  const SKINS = [
    ["#ff7ab6", "#7a1f5c"], ["#5ee7c8", "#145a6b"], ["#ffd166", "#a0432a"], ["#9b8cff", "#2e2380"],
    ["#ff9f6b", "#7a2d1f"], ["#7ee081", "#1f5e3a"], ["#f78fff", "#5b1a7a"], ["#6fd3ff", "#1d3f8a"],
    ["#ffb3c7", "#8a2a4f"], ["#c3a6ff", "#3d2a7a"]
  ];
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const FACE_TURN = { 1: [0, 0], 2: [90, 0], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [0, 180] };
  const VIEW_TILT = "rotateX(-22deg) rotateY(30deg)";
  const ROLL_MS = 1300;
  const GOLD = ["#ffe7a8", "#ffd98a", "#fff6d8", "#ffb3d9"];
  const MAGIC = ["#ff9ad5", "#b388ff", "#6fe3ff", "#ffe7a8", "#ffffff"];
  const SHADOW = ["#c77dff", "#7b6cff", "#ff7ab6", "#3a1a8a"];
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let undoStack = [];
  let rolling = false;
  let aiProviders = [];
  let guideBusy = false;
  let followGuide = false;
  const state = load() || fresh();
  if (state.sound === undefined) state.sound = true;
  if (!Array.isArray(state.chat)) state.chat = [];
  if (typeof state.guideDraft !== "string") state.guideDraft = "";
  if (state.reading && !state.chat.length && state.reading.result.kind !== "burn") openChat(state.reading.square);
  const sound = createSound();

  const guideButton = document.getElementById("guide-toggle");
  const langButton = document.getElementById("lang-toggle");
  const soundButton = document.getElementById("sound-toggle");
  const rulesButton = document.getElementById("rules-open");
  const newButton = document.getElementById("new-game");
  const dialog = document.getElementById("rules-dialog");

  langButton.addEventListener("click", function () {
    state.lang = state.lang === "ru" ? "en" : "ru";
    save();
    render();
  });
  soundButton.addEventListener("click", function () {
    state.sound = !state.sound;
    save();
    render();
    sound.soft();
  });
  guideButton.addEventListener("click", openGuide);
  rulesButton.addEventListener("click", openRules);
  newButton.addEventListener("click", newGame);
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
  });
  window.addEventListener("resize", drawLinks);
  document.addEventListener("keydown", function (event) {
    if (event.target.matches("input, textarea")) return;
    if ((event.key === " " || event.key === "Enter") && state.phase === "roll" && !event.target.matches("button")) {
      event.preventDefault();
      rollDie();
    }
  });

  render();
  if (document.fonts) document.fonts.ready.then(drawLinks);
  fetch("/api/guide")
    .then(function (response) { return response.ok ? response.json() : { providers: [] }; })
    .then(function (data) {
      aiProviders = Array.isArray(data.providers) ? data.providers : [];
      render();
    })
    .catch(function () {});

  function fresh() {
    return {
      lang: (navigator.language || "").toLowerCase().startsWith("ru") ? "ru" : "en",
      sound: true,
      phase: "setup",
      players: [],
      drafts: [{ name: "", question: "" }],
      current: 0,
      rolls: [],
      face: null,
      lit: null,
      preview: null,
      noticeKey: "",
      reading: null,
      chat: [],
      guideDraft: "",
      log: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.players) || !Array.isArray(data.drafts)) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  function save() {
    localStorage.setItem(SAVE, JSON.stringify(state));
  }

  function t(key) {
    return content.ui[state.lang][key];
  }

  function cell(id) {
    return content.cells[id - 1];
  }

  function textOf(id) {
    return cell(id)[state.lang];
  }

  function nameOf(id) {
    return content.names[id - 1][state.lang === "ru" ? 1 : 0];
  }

  function planeColor(id) {
    return PLANE_COLORS[Math.ceil(id / 9) - 1];
  }

  function snapshot() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > 40) undoStack.shift();
  }

  function replaceState(next) {
    Object.keys(state).forEach(function (key) { delete state[key]; });
    Object.assign(state, next);
  }

  function undo() {
    const raw = undoStack.pop();
    if (!raw) return;
    replaceState(JSON.parse(raw));
    save();
    render();
  }

  function newGame() {
    if (state.phase !== "setup") {
      const message = state.lang === "ru" ? "Начать путь заново?" : "Start the journey again?";
      if (!window.confirm(message)) return;
    }
    const next = fresh();
    next.lang = state.lang;
    next.sound = state.sound;
    next.guideMode = state.guideMode;
    replaceState(next);
    undoStack = [];
    save();
    render();
  }

  function currentPlayer() {
    return state.players[state.current] || null;
  }

  function placement(number) {
    const rowFromBottom = Math.floor((number - 1) / 9);
    const index = (number - 1) % 9;
    const column = rowFromBottom % 2 === 0 ? index : 8 - index;
    return { column: column + 1, row: 8 - rowFromBottom };
  }

  function afterPaint(callback) {
    window.requestAnimationFrame(function () { window.requestAnimationFrame(callback); });
  }

  function rollDie() {
    if (rolling || state.phase !== "roll") return;
    const scene = document.querySelector(".die-scene");
    const cube = document.querySelector(".cube");
    const rollButton = document.querySelector(".roll-btn");
    if (!scene || !cube) return;
    const value = 1 + Math.floor(Math.random() * 6);
    rolling = true;
    if (rollButton) rollButton.disabled = true;
    sound.rattle(ROLL_MS - 200);
    if (calm) {
      finishRoll(value, scene);
      return;
    }
    const from = FACE_TURN[state.face || 1];
    const to = FACE_TURN[value];
    const spinX = 360 * (2 + Math.floor(Math.random() * 2));
    const spinY = 360 * (2 + Math.floor(Math.random() * 2));
    cube.animate([
      { transform: cubeTransform(from[0], from[1], 0) },
      { transform: cubeTransform(to[0] + spinX, to[1] + spinY, 360) }
    ], { duration: ROLL_MS, easing: "cubic-bezier(.15,.75,.25,1)", fill: "forwards" });
    scene.animate([
      { transform: "translateY(0) scale(1)" },
      { transform: "translateY(-54px) scale(1.15)", offset: 0.3 },
      { transform: "translateY(0) scale(1)", offset: 0.62 },
      { transform: "translateY(-14px) scale(1.04)", offset: 0.8 },
      { transform: "translateY(0) scale(1)" }
    ], { duration: ROLL_MS, easing: "ease-out" });
    const chips = Array.prototype.slice.call(document.querySelectorAll(".face-chip"));
    chips.forEach(function (chip) { chip.classList.remove("lit"); });
    const trail = window.setInterval(function () {
      const box = scene.getBoundingClientRect();
      burst(box.left + box.width / 2, box.top + box.height / 2, { count: 5, spread: 110, colors: MAGIC });
      chips.forEach(function (chip) { chip.classList.remove("flicker"); });
      if (chips.length) chips[Math.floor(Math.random() * chips.length)].classList.add("flicker");
    }, 90);
    window.setTimeout(function () {
      window.clearInterval(trail);
      finishRoll(value, scene);
    }, ROLL_MS);
  }

  function finishRoll(value, scene) {
    rolling = false;
    const box = scene.getBoundingClientRect();
    burst(box.left + box.width / 2, box.top + box.height / 2, { count: 34, spread: 170, colors: MAGIC, ring: "#ffd98a" });
    addRoll(value);
  }

  function addRoll(value) {
    if (state.phase !== "roll" || rolling) return;
    const player = currentPlayer();
    if (!player || player.done) return;
    snapshot();
    state.preview = null;
    state.rolls.push(value);
    state.face = value;
    state.lit = value;
    const result = rules.resolveThrow(player.position, state.rolls);
    if (result.pending) {
      state.noticeKey = "again";
      save();
      render();
      sound.shimmer();
      afterPaint(burstAtDie);
      return;
    }
    state.rolls = [];
    if (result.kind === "wait") {
      state.noticeKey = "stay";
      remember(player, result);
      advance();
      save();
      render();
      sound.soft();
      return;
    }
    if (result.kind === "burn") {
      state.noticeKey = "fade";
      remember(player, result);
      state.phase = "read";
      state.reading = { square: player.position, result: result };
      state.chat = [];
      save();
      render();
      sound.fall();
      return;
    }
    player.position = result.position;
    state.noticeKey = noticeFor(result);
    state.phase = result.link ? "link" : "read";
    state.reading = { square: result.position, result: result };
    openChat(result.position);
    remember(player, result);
    save();
    render();
    if (result.win) {
      sound.bowl();
      afterPaint(function () { celebrate(result.position); });
    } else {
      sound.chime();
      afterPaint(function () {
        burstAtCell(result.position, { colors: [planeColor(result.position), "#ffffff", "#ffe7a8"], ring: planeColor(result.position) });
      });
    }
  }

  function noticeFor(result) {
    if (result.burnedSixes) return "burned";
    if (result.born) return "born";
    if (result.crossed) return "passed";
    if (result.win) return "winNote";
    if (result.wrapped) return "returned";
    if (result.link && result.link.type === "arrow") return "arrowNote";
    if (result.link && result.link.type === "snake") return "snakeNote";
    return "";
  }

  function remember(player, result) {
    state.log.push({
      name: player.name,
      kind: result.kind || result.linkType,
      rolls: result.rolls || null,
      square: result.position,
      from: result.from
    });
  }

  function reflectionReady() {
    if (!state.reading || state.reading.result.kind === "burn") return true;
    if (guideBusy) return false;
    const last = state.chat[state.chat.length - 1];
    return answeredCount() >= 1 && last && last.role === "guide" && last.kind === "reply";
  }

  function follow() {
    if (!reflectionReady()) {
      state.noticeKey = "reflectFirst";
      render();
      return;
    }
    if (state.phase !== "link" || !state.reading) return;
    const player = currentPlayer();
    const step = rules.followLink(state.reading.square);
    if (!step) return;
    snapshot();
    player.path.push({
      square: state.reading.square,
      from: state.reading.result.from,
      rolls: state.reading.result.rolls || null,
      note: noteFromChat()
    });
    player.position = step.position;
    state.noticeKey = step.win ? "winNote" : "";
    state.phase = "read";
    state.reading = { square: step.position, result: step };
    openChat(step.position);
    state.log.push({ name: player.name, kind: step.linkType, square: step.position, from: step.from });
    save();
    render();
    if (step.win) {
      sound.bowl();
      afterPaint(function () { celebrate(step.position); });
    } else if (step.linkType === "arrow") {
      sound.rise();
      afterPaint(function () { burstAtCell(step.position, { colors: GOLD, ring: "#ffe7a8", count: 40 }); });
    } else {
      sound.fall();
      afterPaint(function () { burstAtCell(step.position, { colors: SHADOW, ring: "#c77dff", count: 26 }); });
    }
  }

  function continueTurn() {
    if (!reflectionReady()) {
      state.noticeKey = "reflectFirst";
      render();
      return;
    }
    if (state.phase !== "read" || !state.reading) return;
    const player = currentPlayer();
    snapshot();
    if (state.reading.result.kind !== "burn") {
      player.path.push({
        square: state.reading.square,
        from: state.reading.result.from,
        rolls: state.reading.result.rolls || null,
        note: noteFromChat()
      });
    }
    if (state.reading.square === 68 && player.position === 68) player.done = true;
    state.chat = [];
    state.guideDraft = "";
    state.noticeKey = "";
    const finished = player.done && state.players.every(function (item) { return item.done; });
    if (finished) {
      state.phase = "over";
      state.reading = null;
      state.noticeKey = "allDone";
    } else {
      nextTurn();
    }
    save();
    render();
    if (finished) congrats();
  }

  function advance() {
    const next = nextOpen(state.current);
    state.current = next === -1 ? state.current : next;
    state.phase = state.players.some(function (player) { return !player.done; }) ? "roll" : "over";
    state.reading = null;
    state.rolls = [];
  }

  function nextTurn() {
    advance();
    state.lit = null;
  }

  function cleanKey(value) {
    return String(value || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim()
      .replace(/^['"]+|['"]+$/g, "")
      .replace(/\s+/g, "");
  }

  function keyKind(value) {
    const key = cleanKey(value);
    if (key.indexOf("AQ.") === 0 && key.length >= 24) return "auth";
    if (key.indexOf("AIza") === 0 && key.length >= 30) return "old";
    if (!key) return "empty";
    return "odd";
  }

  function browserKey() {
    try {
      const stored = localStorage.getItem("leela-gemini-key") || "";
      const key = cleanKey(stored);
      if (key && key !== stored) localStorage.setItem("leela-gemini-key", key);
      return key;
    } catch (error) {
      return "";
    }
  }

  function keyHint(value) {
    const kind = keyKind(value);
    const key = cleanKey(value);
    if (kind === "auth") return t("guideKeyOk").replace("{count}", String(key.length));
    if (kind === "old") return t("guideKeyOld");
    if (kind === "odd") return t("guideKeyShape");
    return "";
  }

  function guideMode() {
    if (state.guideMode === "offline") return "offline";
    if (state.guideMode === "openai" && aiProviders.indexOf("openai") !== -1) return "openai";
    if (browserKey() || aiProviders.indexOf("gemini") !== -1) return "gemini";
    if (aiProviders[0]) return aiProviders[0];
    return "offline";
  }

  function guideText() {
    return content.guide[state.lang];
  }

  function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, function (match, key) {
      return values[key] === undefined ? match : String(values[key]);
    });
  }

  function journalFor(id) {
    const book = window.LEELA_JOURNAL;
    const lang = state.lang === "ru" ? "ru" : "en";
    const lines = [];
    const born = state.reading && state.reading.result && state.reading.result.born && state.reading.square === id;
    if (born && book.entry) lines.push(book.entry[lang]);
    if (book.cells[id] && book.cells[id][lang]) lines.push(book.cells[id][lang]);
    return lines.concat(book.shared[lang]);
  }

  function openChat(square) {
    const lines = journalFor(square);
    state.chat = [{ role: "guide", text: lines[0] || "", kind: "prompt", step: 0 }];
    state.guideDraft = "";
  }

  function settleChat() {
    if (!state.reading || state.reading.result.kind === "burn") return;
    const hasPlayer = state.chat.some(function (message) { return message.role === "player"; });
    const shaped = state.chat.some(function (message) { return message.kind; });
    if (!hasPlayer && !shaped) {
      openChat(state.reading.square);
      save();
    }
  }

  function displayChat() {
    const lines = state.reading ? journalFor(state.reading.square) : [];
    return state.chat.map(function (message) {
      if (message.kind === "prompt" && lines[message.step]) {
        return { role: "guide", text: lines[message.step], kind: "prompt", step: message.step };
      }
      return message;
    });
  }

  function answeredCount() {
    return state.chat.filter(function (message) {
      return message.role === "player" && message.text.trim().length >= 8;
    }).length;
  }

  function noteFromChat() {
    return state.chat
      .filter(function (message) { return message.role === "player"; })
      .map(function (message) { return message.text; })
      .join(" / ");
  }

  function squareInfo(id) {
    const link = rules.linkFrom(id);
    return {
      id: id,
      name: nameOf(id),
      meaning: textOf(id)[0],
      description: textOf(id)[1],
      ask: (journalFor(id)[0] || ""),
      link: link ? link.type : null
    };
  }

  function pathInfo(player) {
    return player.path.map(function (step) {
      return { id: step.square, name: nameOf(step.square), meaning: textOf(step.square)[0], note: step.note };
    });
  }

  function offlineReply(square, chat) {
    const script = guideText();
    const player = currentPlayer();
    const link = rules.linkFrom(square);
    const answers = chat.filter(function (message) { return message.role === "player"; }).length;
    const values = { name: nameOf(square), meaning: textOf(square)[0], question: player ? player.question : "" };
    if (link && answers === 1) return fill(script[link.type], values);
    const index = answers - 1 - (link ? 1 : 0);
    return fill(index < script.follow.length ? script.follow[index] : script.rest, values);
  }

  function askGuide(payload) {
    const body = Object.assign({ provider: guideMode(), lang: state.lang }, payload);
    if (body.provider === "gemini" && browserKey() && window.LeelaGuide) {
      return window.LeelaGuide.reply(body, { GEMINI_API_KEY: browserKey() }, fetch).then(function (result) {
        return result.reply;
      });
    }
    return fetch("/api/guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok || !data.reply) throw new Error(data.error || "Guide failed");
        return data.reply;
      });
    });
  }

  function sendAnswer() {
    const text = state.guideDraft.trim();
    if (!text || guideBusy || !state.reading) return;
    if (text.length < 8) {
      state.noticeKey = "reflectFirst";
      render();
      return;
    }
    const chat = state.chat;
    const square = state.reading.square;
    const player = currentPlayer();
    chat.push({ role: "player", text: text });
    state.guideDraft = "";
    state.noticeKey = "";
    followGuide = true;
    if (guideMode() === "offline") {
      chat.push({ role: "guide", text: mirrorOffline(chat), kind: "reply" });
      save();
      render();
      sound.soft();
      return;
    }
    guideBusy = true;
    save();
    render();
    askGuide({ mode: "square", name: player.name, question: player.question, square: squareInfo(square), path: pathInfo(player), chat: displayChat() })
      .then(function (reply) {
        guideBusy = false;
        followGuide = true;
        state.guideFault = "";
        if (state.chat === chat) chat.push({ role: "guide", text: reply, kind: "reply" });
        save();
        render();
        sound.soft();
      })
      .catch(function (error) {
        guideBusy = false;
        followGuide = true;
        state.noticeKey = "guideDown";
        state.guideFault = faultText(error);
        if (state.chat === chat) chat.push({ role: "guide", text: liveMissed(chat), kind: "error" });
        save();
        render();
      });
  }

  function lastPlayerWords(chat) {
    const said = chat.filter(function (message) { return message.role === "player"; });
    const last = said[said.length - 1];
    return last ? last.text.trim().replace(/\s+/g, " ").slice(0, 160) : "";
  }

  function mirrorOffline(chat) {
    const words = lastPlayerWords(chat);
    const lang = state.lang === "ru" ? "ru" : "en";
    if (!words) return guideText().rest;
    if (lang === "ru") return "Вы написали: «" + words + "». Я остаюсь с этими словами. Напишите ещё одну фразу о том, что в них живое, и тогда можно идти дальше.";
    return "You wrote: “" + words + "”. I am staying with those words. Write one more sentence about what is alive in them, and then you can go on.";
  }

  function faultText(error) {
    const message = String(error && error.message || "")
      .replace(/AIza[0-9A-Za-z_-]+/g, "")
      .replace(/AQ\.[0-9A-Za-z_-]+/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    if (/API key not valid/i.test(message)) {
      return keyKind(browserKey()) === "old" ? t("guideKeyOld") : t("guideKeyShape");
    }
    return message;
  }

  function liveMissed(chat) {
    const words = lastPlayerWords(chat);
    if (!words) return t("guideDown");
    return t("guideMissed").replace("{words}", words);
  }

  function offlineClosing(player) {
    const up = player.path.filter(function (step) { return rules.ARROWS[step.square]; }).length;
    const down = player.path.filter(function (step) { return rules.SNAKES[step.square]; }).length;
    const written = player.path
      .filter(function (step) { return step.note; })
      .sort(function (a, b) { return b.note.length - a.note.length; })
      .slice(0, 3)
      .map(function (step) { return nameOf(step.square); });
    return fill(guideText().closing, {
      question: player.question,
      count: player.path.length,
      up: up,
      down: down,
      names: written.length ? written.join(", ") : nameOf(68)
    });
  }

  function askClosing(player) {
    if (guideBusy) return;
    if (guideMode() === "offline") {
      player.guideClosing = offlineClosing(player);
      save();
      render();
      sound.chime();
      return;
    }
    guideBusy = true;
    render();
    askGuide({ mode: "closing", name: player.name, question: player.question, path: pathInfo(player) })
      .catch(function () {
        state.noticeKey = "guideDown";
        return offlineClosing(player);
      })
      .then(function (reply) {
        guideBusy = false;
        player.guideClosing = reply;
        save();
        render();
        sound.chime();
      });
  }

  function nextOpen(from) {
    for (let step = 1; step <= state.players.length; step += 1) {
      const index = (from + step) % state.players.length;
      if (!state.players[index].done) return index;
    }
    return -1;
  }

  function startGame() {
    const players = state.drafts
      .map(function (draft, index) {
        return {
          id: String(Date.now()) + "-" + String(index),
          name: draft.name.trim(),
          question: draft.question.trim(),
          color: COLORS[index % COLORS.length],
          position: 0,
          done: false,
          path: [],
          closing: ""
        };
      })
      .filter(function (player) { return player.name && player.question; });
    if (!players.length) {
      state.noticeKey = "needPlayer";
      render();
      return;
    }
    state.players = players.slice(0, 6);
    state.current = 0;
    state.phase = "roll";
    state.noticeKey = "goal";
    state.lit = null;
    state.log = [];
    state.preview = null;
    undoStack = [];
    save();
    render();
    sound.chime();
    afterPaint(function () { burstAtCell(68, { colors: GOLD, ring: "#fff1c1", count: 36 }); });
  }

  function render() {
    settleChat();
    document.documentElement.lang = state.lang;
    document.getElementById("eyebrow").textContent = t("subtitle");
    document.getElementById("title").textContent = t("title");
    langButton.textContent = t("lang");
    soundButton.textContent = state.sound ? t("soundOn") : t("soundOff");
    const mode = guideMode();
    guideButton.textContent = t(mode === "openai" ? "guideOpenai" : mode === "gemini" ? "guideGemini" : "guideOffline");
    guideButton.title = aiProviders.length ? "" : t("guideHint");
    rulesButton.textContent = t("rules");
    newButton.textContent = t("newGame");
    document.getElementById("legend").textContent = state.lang === "ru"
      ? "Золотая стрела поднимает. Змея опускает. Клетка 68 — и источник, и возвращение."
      : "A golden arrow lifts you. A snake takes you down. Square 68 is both the source and the return.";
    renderPlanes();
    renderBoard();
    renderPanel();
    window.requestAnimationFrame(function () {
      pinGuide();
      window.requestAnimationFrame(function () {
        pinGuide();
        followGuide = false;
      });
    });
    window.requestAnimationFrame(drawLinks);
  }

  function pinGuide() {
    const list = document.querySelector(".guide-chat");
    if (list) list.scrollTop = list.scrollHeight;
    const panel = document.getElementById("panel");
    const row = document.querySelector(".guide-input");
    if (panel && row) {
      const extra = row.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom;
      if (extra > 0) panel.scrollTop += extra + 12;
    }
    if (!followGuide) return;
    const input = document.querySelector(".guide-input textarea");
    if (input && !input.disabled) input.focus({ preventScroll: true });
  }

  function renderPlanes() {
    const labels = document.getElementById("plane-labels");
    labels.replaceChildren();
    for (let plane = 8; plane >= 1; plane -= 1) {
      const span = document.createElement("span");
      const label = document.createElement("b");
      label.textContent = content.planes[plane - 1][state.lang];
      span.appendChild(label);
      span.style.color = PLANE_COLORS[plane - 1];
      labels.appendChild(span);
    }
  }

  function chakraMarkup(info) {
    if (info.om) return '<span class="om">ॐ</span>';
    const petals = [];
    const width = info.petals > 12 ? 5 : info.petals === 2 ? 14 : 8;
    const offset = info.petals === 2 ? 90 : 0;
    for (let index = 0; index < info.petals; index += 1) {
      const angle = offset + (360 / info.petals) * index;
      petals.push('<ellipse cx="50" cy="24" rx="' + width + '" ry="20" transform="rotate(' + angle + ' 50 50)"/>');
    }
    return '<svg viewBox="0 0 100 100">' +
      '<g fill="' + info.color + '" fill-opacity=".28" stroke="' + info.color + '" stroke-opacity=".9" stroke-width="1.4">' + petals.join("") + "</g>" +
      '<circle cx="50" cy="50" r="22" fill="none" stroke="' + info.color + '" stroke-width="2.2"/>' +
      '<circle cx="50" cy="50" r="12" fill="' + info.color + '" fill-opacity=".55"/></svg>';
  }

  function renderBoard() {
    const grid = document.getElementById("grid");
    grid.replaceChildren();
    for (let number = 1; number <= 72; number += 1) {
      const place = placement(number);
      const info = textOf(number);
      const link = rules.linkFrom(number);
      const element = document.createElement("button");
      element.type = "button";
      element.className = "cell";
      element.dataset.cell = String(number);
      element.style.setProperty("--h", planeColor(number));
      element.style.gridColumn = String(place.column);
      element.style.gridRow = String(place.row);
      if (number === 68) element.classList.add("is-goal");
      const focus = state.preview || (state.reading && state.reading.square);
      if (focus === number) element.classList.add("is-current");
      if (CHAKRAS[number]) {
        const chakra = document.createElement("span");
        chakra.className = "chakra";
        chakra.style.setProperty("--h", CHAKRAS[number].color);
        chakra.innerHTML = chakraMarkup(CHAKRAS[number]);
        element.appendChild(chakra);
      }
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = String(number);
      const name = document.createElement("span");
      name.className = "nm";
      name.textContent = nameOf(number);
      element.title = nameOf(number) + " · " + info[0];
      element.setAttribute("aria-label", String(number) + " " + nameOf(number) + ", " + info[0]);
      element.append(num, name);
      if (link) {
        const mark = document.createElement("span");
        mark.className = "linkmark " + link.type;
        mark.textContent = (link.type === "arrow" ? "↑" : "↓") + String(link.to);
        element.appendChild(mark);
      }
      const tokens = document.createElement("span");
      tokens.className = "tokens";
      state.players.forEach(function (player) {
        const shown = player.position === 0 ? 68 : player.position;
        if (shown !== number) return;
        const token = orb(player);
        if (player.position === 0) token.classList.add("ghost");
        if (player.done) token.classList.add("home");
        tokens.appendChild(token);
      });
      element.appendChild(tokens);
      element.addEventListener("click", function () {
        state.preview = number;
        render();
        sound.soft();
      });
      grid.appendChild(element);
    }
  }

  function orb(player) {
    const token = document.createElement("span");
    token.className = "token";
    token.style.setProperty("--c", player.color);
    token.textContent = player.name.slice(0, 1).toUpperCase();
    token.title = player.name;
    return token;
  }

  function renderPanel() {
    const panel = document.getElementById("panel");
    panel.replaceChildren();
    if (state.preview) {
      panel.appendChild(cellArticle(state.preview, t("map"), true));
      if (state.phase !== "setup") {
        const actions = div("actions");
        actions.appendChild(button(t("back"), function () {
          state.preview = null;
          render();
        }, "btn"));
        panel.appendChild(actions);
      }
      return;
    }
    if (state.phase === "setup") renderSetup(panel);
    else if (state.phase === "over") renderSummary(panel);
    else renderTurn(panel);
  }

  function toast() {
    if (!state.noticeKey) return null;
    if (state.noticeKey === "guideDown" && state.guideFault) return paragraph("toast", state.guideFault);
    return paragraph("toast", t(state.noticeKey));
  }

  function renderSetup(panel) {
    panel.appendChild(heading(t("players")));
    panel.appendChild(paragraph("hint", t("questionHint")));
    const note = toast();
    if (note) panel.appendChild(note);
    state.drafts.forEach(function (draft, index) {
      const box = div("player-draft stack");
      box.appendChild(field(t("name"), draft.name, function (value) { draft.name = value; save(); }, "text"));
      box.appendChild(field(t("question"), draft.question, function (value) { draft.question = value; save(); }, "textarea"));
      if (state.drafts.length > 1) {
        box.appendChild(button(t("remove"), function () {
          state.drafts.splice(index, 1);
          save();
          render();
        }, "link-btn"));
      }
      panel.appendChild(box);
    });
    panel.appendChild(paragraph("hint", t("study")));
    const actions = div("actions");
    if (state.drafts.length < 6) {
      actions.appendChild(button("+ " + t("addPlayer"), function () {
        state.drafts.push({ name: "", question: "" });
        save();
        render();
      }, "btn"));
    }
    const start = button("✦ " + t("start") + " ✦", startGame, "roll-btn");
    start.id = "start-game";
    actions.appendChild(start);
    panel.appendChild(actions);
  }

  function renderTurn(panel) {
    const player = currentPlayer();
    panel.appendChild(turnCard(player));
    const note = toast();
    if (note) panel.appendChild(note);
    if (state.phase === "roll") {
      panel.appendChild(history());
      panel.appendChild(rollZone());
      return;
    }
    if (!state.reading) return;
    if (state.reading.result.kind !== "burn") {
      const label = state.reading.square === 68 && player.position === 68 ? t("complete") : t("landed");
      panel.appendChild(cellArticle(state.reading.square, label, false));
      panel.appendChild(guideBox());
    }
    const finishing = state.phase === "read" && state.reading.square === 68 && player.position === 68;
    const actions = div("actions");
    let moveLabel = t("next");
    let move = continueTurn;
    let ready = reflectionReady();
    if (state.phase === "link") {
      const link = rules.linkFrom(state.reading.square);
      moveLabel = (link.type === "arrow" ? "↑ " + t("followArrow") : "↓ " + t("followSnake"));
      move = follow;
    } else if (finishing) {
      moveLabel = "✦ " + t("finish") + " ✦";
      ready = !guideBusy && answeredCount() >= 1;
      actions.classList.add("finish");
    }
    const moveOn = button(moveLabel, move, "roll-btn");
    moveOn.disabled = !ready;
    actions.appendChild(moveOn);
    if (!ready && state.reading.result.kind !== "burn") actions.appendChild(paragraph("hint", t("reflectFirst")));
    if (undoStack.length) actions.appendChild(button("↶ " + t("undo"), undo, "link-btn"));
    panel.appendChild(actions);
  }

  function guideBox() {
    const box = div("guide-box");
    box.appendChild(paragraph("guide-head", "✦ " + t("guideName")));
    const list = div("guide-chat");
    list.setAttribute("aria-live", "polite");
    displayChat().forEach(function (message) {
      list.appendChild(paragraph("msg " + message.role, message.text));
    });
    if (guideBusy) list.appendChild(paragraph("msg guide thinking", t("listening")));
    box.appendChild(list);
    if (guideMode() === "offline") box.appendChild(paragraph("hint", t("guideNeed")));
    const row = div("guide-input");
    const input = document.createElement("textarea");
    input.rows = 2;
    input.value = state.guideDraft;
    input.placeholder = t("answer");
    input.setAttribute("aria-label", t("answer"));
    input.addEventListener("input", function () {
      state.guideDraft = input.value;
      save();
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendAnswer();
      }
    });
    const send = button(t("send"), sendAnswer, "btn primary");
    send.disabled = guideBusy;
    row.append(input, send);
    box.appendChild(row);
    return box;
  }

  function turnCard(player) {
    const card = div("turn-card");
    card.appendChild(orb(player));
    const name = heading(player.name);
    card.appendChild(name);
    const chips = div("chips");
    if (player.position === 0) chips.appendChild(paragraph("chip", t("waiting")));
    else chips.appendChild(paragraph("chip", t("square") + " " + String(player.position)));
    if (state.phase === "roll") chips.appendChild(paragraph("chip", t("yourTurn")));
    card.appendChild(chips);
    card.appendChild(paragraph("quote", "“" + player.question + "”"));
    return card;
  }

  function rollZone() {
    const zone = div("roll-zone");
    if (state.rolls.length) zone.appendChild(paragraph("rolls-chip", state.rolls.join(" + ") + " + …"));
    zone.appendChild(dieScene());
    zone.appendChild(button("✦ " + t("roll") + " ✦", rollDie, "roll-btn"));
    const result = div("result");
    result.appendChild(paragraph("hint", t("rolled")));
    const faces = div("faces");
    faces.setAttribute("aria-live", "polite");
    for (let face = 1; face <= 6; face += 1) {
      const chip = document.createElement("span");
      chip.className = "face-chip";
      if (state.lit === face) chip.classList.add("lit");
      chip.textContent = String(face);
      faces.appendChild(chip);
    }
    result.appendChild(faces);
    zone.appendChild(result);
    if (undoStack.length) zone.appendChild(button("↶ " + t("undo"), undo, "link-btn"));
    return zone;
  }

  function cubeTransform(rx, ry, rz) {
    return VIEW_TILT + " rotateX(" + rx + "deg) rotateY(" + ry + "deg) rotateZ(" + rz + "deg)";
  }

  function dieScene() {
    const scene = div("die-scene");
    scene.setAttribute("role", "button");
    scene.setAttribute("tabindex", "0");
    scene.setAttribute("aria-label", t("roll"));
    const cube = div("cube");
    const turn = FACE_TURN[state.face || 1];
    cube.style.transform = cubeTransform(turn[0], turn[1], 0);
    for (let face = 1; face <= 6; face += 1) {
      const side = div("cube-face f" + String(face));
      for (let index = 0; index < 9; index += 1) {
        const pip = document.createElement("span");
        pip.className = "pip";
        if (PIPS[face].indexOf(index) === -1) pip.classList.add("off");
        side.appendChild(pip);
      }
      cube.appendChild(side);
    }
    scene.appendChild(cube);
    scene.addEventListener("click", rollDie);
    return scene;
  }

  function renderSummary(panel) {
    panel.appendChild(heading(t("allDone")));
    panel.appendChild(paragraph("hint", t("keptHere")));
    state.players.forEach(function (player) {
      const card = div("player-card stack");
      const row = div("row");
      row.append(orb(player), heading(player.name));
      card.appendChild(row);
      card.appendChild(paragraph("quote", "“" + player.question + "”"));
      card.appendChild(pathList(player));
      if (player.guideClosing) card.appendChild(paragraph("msg guide", player.guideClosing));
      else if (guideBusy) card.appendChild(paragraph("msg guide thinking", t("listening")));
      else card.appendChild(button(t("closingAsk"), function () { askClosing(player); }, "btn"));
      card.appendChild(field(t("summary"), player.closing, function (value) {
        player.closing = value;
        save();
      }, "textarea"));
      panel.appendChild(card);
    });
  }

  function cellArticle(id, label, withAsk) {
    const info = textOf(id);
    const article = document.createElement("article");
    article.className = "reading";
    article.style.setProperty("--h", planeColor(id));
    article.appendChild(paragraph("status", label));
    const title = document.createElement("h2");
    title.id = "reading-title";
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = String(id);
    title.append(badge, document.createTextNode(nameOf(id)));
    article.appendChild(title);
    article.appendChild(paragraph("meaning", info[0]));
    if (withAsk) {
      article.appendChild(paragraph("hint", t("mapHint")));
      return article;
    }
    article.appendChild(paragraph("quote", info[1]));
    article.appendChild(moreBlock(id));
    const plane = Math.ceil(id / 9);
    article.appendChild(paragraph("hint", t("plane") + " " + String(plane) + " · " + content.planes[plane - 1][state.lang]));
    return article;
  }

  function detailOf(id) {
    return (window.LEELA_DETAILS && window.LEELA_DETAILS[id]) || (content.details && content.details[id]) || null;
  }

  function moreBlock(id) {
    const detail = detailOf(id);
    const box = div("more-box");
    const body = div("more-body");
    body.hidden = true;
    if (detail) {
      const lang = state.lang === "ru" ? "ru" : "en";
      const story = detail[lang].story;
      (Array.isArray(story) ? story : [story]).forEach(function (line) {
        body.appendChild(paragraph("quote", line));
      });
      body.appendChild(paragraph("meaning", t("inLife")));
      body.appendChild(paragraph("quote", detail[lang].life));
    }
    body.appendChild(paragraph("meaning", t("onBoard")));
    body.appendChild(paragraph("quote", boardSentence(id)));
    const toggle = button(t("more"), function () {
      body.hidden = !body.hidden;
      toggle.textContent = body.hidden ? t("more") : t("less");
    }, "btn");
    box.append(toggle, body);
    return box;
  }

  function boardSentence(id) {
    const link = rules.linkFrom(id);
    const plane = Math.ceil(id / 9);
    const where = fill(t("onPlane"), { plane: plane, planeName: content.planes[plane - 1][state.lang] });
    if (!link) return where;
    return fill(t(link.type === "arrow" ? "arrowTo" : "snakeTo"), { to: link.to, name: nameOf(link.to) }) + " " + where;
  }

  function history() {
    const wrap = document.createElement("details");
    wrap.className = "history";
    wrap.open = true;
    const summary = document.createElement("summary");
    summary.textContent = t("history");
    wrap.appendChild(summary);
    if (!state.log.length) {
      wrap.appendChild(paragraph("hint", t("emptyHistory")));
      return wrap;
    }
    const list = document.createElement("ul");
    list.className = "path-list";
    state.log.slice().reverse().forEach(function (entry) {
      const item = document.createElement("li");
      item.textContent = lineFor(entry);
      list.appendChild(item);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function pathList(player) {
    const list = document.createElement("ul");
    list.className = "path-list";
    player.path.forEach(function (step) {
      const item = document.createElement("li");
      item.textContent = String(step.square) + " " + nameOf(step.square) + " · " + textOf(step.square)[0] + (step.note ? " — " + step.note : "");
      list.appendChild(item);
    });
    return list;
  }

  function lineFor(entry) {
    const rolls = entry.rolls ? entry.rolls.join("+") : "";
    if (entry.kind === "wait") return entry.name + " · " + rolls + " · " + t("stay");
    if (entry.kind === "burn") return entry.name + " · " + rolls + " · " + t("fade");
    const via = entry.kind === "arrow" ? " ↑ " : entry.kind === "snake" ? " ↓ " : " → ";
    return entry.name + (rolls ? " · " + rolls : "") + via + String(entry.square) + " " + nameOf(entry.square) + " · " + textOf(entry.square)[0];
  }

  function field(labelText, value, onInput, kind) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement(kind === "textarea" ? "textarea" : "input");
    if (kind !== "textarea") input.type = "text";
    input.value = value;
    input.addEventListener("input", function () { onInput(input.value); });
    label.appendChild(input);
    return label;
  }

  function button(label, onClick, kind) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = kind;
    element.textContent = label;
    element.addEventListener("click", onClick);
    return element;
  }

  function div(className) {
    const element = document.createElement("div");
    element.className = className;
    return element;
  }

  function heading(text) {
    const title = document.createElement("h2");
    title.textContent = text;
    return title;
  }

  function paragraph(className, text) {
    const element = document.createElement("p");
    element.className = className;
    element.textContent = text;
    return element;
  }

  function openGuide() {
    dialog.replaceChildren();
    const input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.name = "leela-gemini-key";
    input.setAttribute("aria-label", t("guideKey"));
    const check = paragraph("hint", keyHint(browserKey()));
    input.addEventListener("input", function () {
      check.textContent = keyHint(input.value);
    });
    const saveKey = button(t("guideSave"), function () {
      const value = cleanKey(input.value);
      if (!value && !browserKey()) {
        state.noticeKey = "guideMissing";
        return;
      }
      if (value && keyKind(value) === "odd" && value.length < 20) {
        check.textContent = t("guideKeyShape");
        return;
      }
      if (value) localStorage.setItem("leela-gemini-key", value);
      state.guideMode = "gemini";
      state.noticeKey = "";
      save();
      dialog.close();
      render();
    }, "btn primary");
    const offline = button(t("guideKeepOffline"), function () {
      state.guideMode = "offline";
      save();
      dialog.close();
      render();
    }, "btn");
    const steps = document.createElement("ol");
    content.ui[state.lang].guideSteps.forEach(function (line) {
      const item = document.createElement("li");
      item.textContent = line;
      steps.appendChild(item);
    });
    const openKey = button(t("guideOpenKey"), function () {
      window.open("https://aistudio.google.com/apikey", "_blank", "noopener");
    }, "btn");
    dialog.append(
      heading(t("guideName")),
      paragraph("hint", t("guideHint")),
      steps,
      openKey,
      browserKey() ? paragraph("hint", keyHint(browserKey()) || t("guideSaved")) : paragraph("hint", t("guideNeed")),
      field(t("guideKey"), "", function () {}, "text"),
      check
    );
    dialog.querySelector("label input").replaceWith(input);
    dialog.append(saveKey, offline);
    dialog.showModal();
  }

  function openRules() {
    dialog.replaceChildren();
    const list = document.createElement("ol");
    content.rules[state.lang].forEach(function (line) {
      const item = document.createElement("li");
      item.textContent = line;
      list.appendChild(item);
    });
    const steps = document.createElement("ol");
    content.ui[state.lang].guideSteps.forEach(function (line) {
      const item = document.createElement("li");
      item.textContent = line;
      steps.appendChild(item);
    });
    const openKey = button(t("guideOpenKey"), function () {
      window.open("https://aistudio.google.com/apikey", "_blank", "noopener");
    }, "btn");
    dialog.append(
      heading(t("rules")),
      paragraph("hint", t("guideHint")),
      steps,
      openKey,
      list,
      paragraph("hint", t("guide")),
      paragraph("hint credit", t("credit")),
      button(t("close"), function () { dialog.close(); }, "btn primary")
    );
    dialog.showModal();
  }

  function burst(x, y, options) {
    if (calm) return;
    const colors = options.colors || MAGIC;
    const count = options.count || 22;
    const spread = options.spread || 120;
    for (let index = 0; index < count; index += 1) {
      const spark = document.createElement("span");
      const size = 6 + Math.random() * 12;
      const color = colors[Math.floor(Math.random() * colors.length)];
      spark.className = Math.random() < 0.35 ? "spark dot" : "spark";
      spark.style.width = size + "px";
      spark.style.height = size + "px";
      spark.style.left = x - size / 2 + "px";
      spark.style.top = y - size / 2 + "px";
      spark.style.background = color;
      spark.style.color = color;
      document.body.appendChild(spark);
      const angle = Math.random() * Math.PI * 2;
      const distance = spread * (0.3 + Math.random() * 0.7);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - spread * 0.15;
      const spin = (Math.random() - 0.5) * 540;
      spark.animate([
        { transform: "translate(0, 0) scale(0) rotate(0deg)", opacity: 1 },
        { transform: "translate(" + dx * 0.6 + "px, " + dy * 0.6 + "px) scale(1.1) rotate(" + spin / 2 + "deg)", opacity: 1, offset: 0.35 },
        { transform: "translate(" + dx + "px, " + (dy + 30) + "px) scale(0.2) rotate(" + spin + "deg)", opacity: 0 }
      ], { duration: 900 + Math.random() * 800, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" }).onfinish = function () {
        spark.remove();
      };
    }
    if (options.ring) {
      const ring = document.createElement("span");
      const size = spread * 1.4;
      ring.className = "ring";
      ring.style.width = size + "px";
      ring.style.height = size + "px";
      ring.style.left = x - size / 2 + "px";
      ring.style.top = y - size / 2 + "px";
      ring.style.color = options.ring;
      document.body.appendChild(ring);
      ring.animate([
        { transform: "scale(0.1)", opacity: 0.9 },
        { transform: "scale(1)", opacity: 0 }
      ], { duration: 900, easing: "ease-out", fill: "forwards" }).onfinish = function () {
        ring.remove();
      };
    }
  }

  function burstAtCell(number, options) {
    const target = document.querySelector('[data-cell="' + String(number) + '"]');
    if (!target) return;
    const box = target.getBoundingClientRect();
    burst(box.left + box.width / 2, box.top + box.height / 2, Object.assign({ spread: box.width * 1.6 }, options));
  }

  function burstAtDie() {
    const scene = document.querySelector(".die-scene");
    if (!scene) return;
    const box = scene.getBoundingClientRect();
    burst(box.left + box.width / 2, box.top + box.height / 2, { count: 26, spread: 150, colors: GOLD, ring: "#ffe7a8" });
  }

  function celebrate(number) {
    burstAtCell(number, { colors: GOLD.concat(MAGIC), ring: "#fff1c1", count: 70 });
    window.setTimeout(function () {
      burst(window.innerWidth / 2, window.innerHeight / 3, { count: 90, spread: Math.min(window.innerWidth, 900) / 2, colors: GOLD.concat(MAGIC), ring: "#ffd98a" });
    }, 350);
  }

  function congrats() {
    celebrate(68);
    const veil = div("congrats");
    veil.appendChild(heading(t("congrats")));
    veil.appendChild(paragraph("hint", t("congratsNote")));
    document.body.appendChild(veil);
    window.setTimeout(function () { veil.remove(); }, 3200);
  }

  function make(tag, attributes, parent) {
    const element = document.createElementNS(NS, tag);
    Object.keys(attributes).forEach(function (key) { element.setAttribute(key, String(attributes[key])); });
    if (parent) parent.appendChild(element);
    return element;
  }

  function drawLinks() {
    const grid = document.getElementById("grid");
    const svg = document.getElementById("links");
    const bounds = grid.getBoundingClientRect();
    const first = grid.querySelector(".cell");
    if (!bounds.width || !first) return;
    const size = first.getBoundingClientRect().width;
    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 " + bounds.width + " " + bounds.height);
    const defs = make("defs", {}, svg);
    const glow = make("filter", { id: "glow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
    make("feGaussianBlur", { stdDeviation: "3", result: "blur" }, glow);
    const merge = make("feMerge", {}, glow);
    make("feMergeNode", { in: "blur" }, merge);
    make("feMergeNode", { in: "SourceGraphic" }, merge);
    const shade = make("filter", { id: "shade", x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs);
    make("feDropShadow", { dx: "0", dy: "3", stdDeviation: "3", "flood-color": "#05001a", "flood-opacity": "0.7" }, shade);

    function center(number) {
      const box = grid.querySelector('[data-cell="' + String(number) + '"]').getBoundingClientRect();
      return { x: box.left - bounds.left + box.width / 2, y: box.top - bounds.top + box.height / 2 };
    }

    Object.keys(rules.ARROWS).forEach(function (from, index) {
      drawArrow(svg, defs, center(Number(from)), center(rules.ARROWS[from]), size, index);
    });
    Object.keys(rules.SNAKES).forEach(function (from, index) {
      drawSnake(svg, defs, center(Number(from)), center(rules.SNAKES[from]), size, SKINS[index % SKINS.length], index);
    });
  }

  function drawArrow(svg, defs, from, to, size, index) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const px = -uy;
    const py = ux;
    const start = { x: from.x + ux * size * 0.1, y: from.y + uy * size * 0.1 };
    const tip = { x: to.x - ux * size * 0.18, y: to.y - uy * size * 0.18 };
    const id = "arrow-" + index;
    const gradient = make("linearGradient", { id: id, gradientUnits: "userSpaceOnUse", x1: start.x, y1: start.y, x2: tip.x, y2: tip.y }, defs);
    make("stop", { offset: "0", "stop-color": "#ffb3d9", "stop-opacity": "0.55" }, gradient);
    make("stop", { offset: "0.6", "stop-color": "#ffd98a" }, gradient);
    make("stop", { offset: "1", "stop-color": "#fff6d8" }, gradient);
    const group = make("g", { filter: "url(#glow)", opacity: "0.95" }, svg);
    make("line", { x1: start.x, y1: start.y, x2: tip.x, y2: tip.y, stroke: "url(#" + id + ")", "stroke-width": Math.max(2.4, size * 0.05), "stroke-linecap": "round" }, group);
    const head = size * 0.3;
    const back = { x: tip.x - ux * head, y: tip.y - uy * head };
    const notch = { x: tip.x - ux * head * 0.68, y: tip.y - uy * head * 0.68 };
    make("polygon", {
      points: [
        tip.x + "," + tip.y,
        back.x + px * head * 0.48 + "," + (back.y + py * head * 0.48),
        notch.x + "," + notch.y,
        back.x - px * head * 0.48 + "," + (back.y - py * head * 0.48)
      ].join(" "),
      fill: "#fff2c4",
      stroke: "#ffd98a",
      "stroke-width": "1"
    }, group);
    for (let feather = 0; feather < 3; feather += 1) {
      const base = { x: start.x + ux * size * 0.1 * feather, y: start.y + uy * size * 0.1 * feather };
      const reach = size * 0.15;
      [1, -1].forEach(function (side) {
        make("line", {
          x1: base.x,
          y1: base.y,
          x2: base.x - ux * reach + px * reach * side,
          y2: base.y - uy * reach + py * reach * side,
          stroke: "#ff9ad5",
          "stroke-width": "2",
          "stroke-linecap": "round",
          opacity: "0.85"
        }, group);
      });
    }
  }

  function drawSnake(svg, defs, head, tail, size, skin, index) {
    const dx = tail.x - head.x;
    const dy = tail.y - head.y;
    const length = Math.hypot(dx, dy) || 1;
    const px = -dy / length;
    const py = dx / length;
    const width = size * 0.2;
    const amplitude = Math.min(size * 0.34, length * 0.14);
    const waves = Math.max(1.5, Math.round((length / size) * 0.9) / 2 + 1);
    const phase = index % 2 ? 0 : Math.PI;
    const steps = Math.max(48, Math.round(length / 3));
    const points = [];
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const envelope = Math.min(1, t * 5) * (1 - 0.35 * t);
      const offset = amplitude * Math.sin(t * waves * Math.PI * 2 + phase) * envelope;
      points.push({ x: head.x + dx * t + px * offset, y: head.y + dy * t + py * offset, t: t });
    }
    const left = [];
    const right = [];
    points.forEach(function (point, step) {
      const before = points[Math.max(0, step - 1)];
      const after = points[Math.min(points.length - 1, step + 1)];
      const tx = after.x - before.x;
      const ty = after.y - before.y;
      const span = Math.hypot(tx, ty) || 1;
      const nx = -ty / span;
      const ny = tx / span;
      const neck = point.t < 0.05 ? 0.75 + point.t * 5 : 1;
      const half = (width * (1 - 0.88 * point.t) * neck) / 2 + 0.6;
      left.push((point.x + nx * half).toFixed(1) + " " + (point.y + ny * half).toFixed(1));
      right.push((point.x - nx * half).toFixed(1) + " " + (point.y - ny * half).toFixed(1));
    });
    const id = "snake-" + index;
    const gradient = make("linearGradient", { id: id, gradientUnits: "userSpaceOnUse", x1: head.x, y1: head.y, x2: tail.x, y2: tail.y }, defs);
    make("stop", { offset: "0", "stop-color": skin[0] }, gradient);
    make("stop", { offset: "0.55", "stop-color": skin[1] }, gradient);
    make("stop", { offset: "1", "stop-color": skin[0], "stop-opacity": "0.7" }, gradient);
    const group = make("g", { filter: "url(#shade)", opacity: "0.93" }, svg);
    make("path", {
      d: "M" + left.join(" L") + " L" + right.reverse().join(" L") + " Z",
      fill: "url(#" + id + ")",
      stroke: "rgba(10,0,30,0.6)",
      "stroke-width": "1.1",
      "stroke-linejoin": "round"
    }, group);
    make("polyline", {
      points: points.slice(3, points.length - 4).map(function (point) { return point.x.toFixed(1) + "," + point.y.toFixed(1); }).join(" "),
      fill: "none",
      stroke: "rgba(255,255,255,0.4)",
      "stroke-width": width * 0.22,
      "stroke-dasharray": size * 0.07 + " " + size * 0.06,
      "stroke-linecap": "round"
    }, group);
    const ahead = points[0];
    const neckPoint = points[2];
    const angle = (Math.atan2(ahead.y - neckPoint.y, ahead.x - neckPoint.x) * 180) / Math.PI;
    const skull = make("g", { transform: "translate(" + ahead.x + " " + ahead.y + ") rotate(" + angle + ")" }, group);
    make("path", {
      d: "M" + width * 1.75 + " 0 L" + width * 1.3 + " 0 M" + width * 1.75 + " 0 L" + width * 2.05 + " " + -width * 0.25 + " M" + width * 1.75 + " 0 L" + width * 2.05 + " " + width * 0.25,
      stroke: "#ff3b6b",
      "stroke-width": "1.6",
      "stroke-linecap": "round",
      fill: "none",
      class: "tongue"
    }, skull);
    make("ellipse", { cx: width * 0.35, cy: "0", rx: width * 1.0, ry: width * 0.7, fill: skin[0], stroke: "rgba(10,0,30,0.6)", "stroke-width": "1.1" }, skull);
    [-1, 1].forEach(function (side) {
      make("circle", { cx: width * 0.7, cy: side * width * 0.34, r: width * 0.17, fill: "#fff6c2" }, skull);
      make("circle", { cx: width * 0.76, cy: side * width * 0.34, r: width * 0.08, fill: "#1a0010" }, skull);
    });
  }

  function createSound() {
    let context = null;
    let master = null;

    function audio() {
      if (!state.sound) return null;
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      if (!context) {
        context = new AudioCtor();
        master = context.createGain();
        master.gain.value = 0.35;
        master.connect(context.destination);
      }
      if (context.state === "suspended") context.resume();
      return context;
    }

    function tone(frequency, start, length, type, peak, glideTo) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (glideTo) oscillator.frequency.exponentialRampToValueAtTime(glideTo, start + length);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + length + 0.05);
    }

    function click(start, pitch) {
      const length = Math.floor(context.sampleRate * 0.04);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, 3);
      }
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = pitch;
      filter.Q.value = 3;
      gain.gain.value = 0.9;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
    }

    return {
      rattle: function (ms) {
        if (!audio()) return;
        const now = context.currentTime;
        let time = 0;
        let gap = 0.045;
        while (time < ms / 1000) {
          click(now + time, 1600 + Math.random() * 2600);
          time += gap;
          gap *= 1.13;
        }
        [1318, 1760, 2349].forEach(function (frequency, index) {
          tone(frequency, now + index * 0.12, 0.9, "sine", 0.03);
        });
      },
      chime: function () {
        if (!audio()) return;
        const now = context.currentTime;
        [1046.5, 1568, 2093].forEach(function (frequency, index) {
          tone(frequency, now + index * 0.07, 2, "sine", 0.16 / (index + 1));
        });
      },
      shimmer: function () {
        if (!audio()) return;
        const now = context.currentTime;
        [1318, 1568, 1976, 2637].forEach(function (frequency, index) {
          tone(frequency, now + index * 0.05, 0.7, "triangle", 0.07);
        });
      },
      rise: function () {
        if (!audio()) return;
        const now = context.currentTime;
        [523, 587, 659, 784, 880, 1046, 1318].forEach(function (frequency, index) {
          tone(frequency, now + index * 0.07, 1.1, "sine", 0.12);
        });
      },
      fall: function () {
        if (!audio()) return;
        const now = context.currentTime;
        tone(740, now, 1.1, "triangle", 0.14, 110);
        tone(370, now + 0.05, 1.3, "sine", 0.12, 70);
      },
      bowl: function () {
        if (!audio()) return;
        const now = context.currentTime;
        tone(196, now, 6, "sine", 0.26);
        tone(197.2, now, 6, "sine", 0.18);
        tone(196 * 2.76, now, 4.5, "sine", 0.1);
        tone(196 * 5.4, now, 3, "sine", 0.05);
        [784, 988, 1175, 1568].forEach(function (frequency, index) {
          tone(frequency, now + 0.3 + index * 0.12, 2.4, "sine", 0.06);
        });
      },
      soft: function () {
        if (!audio()) return;
        tone(660, context.currentTime, 0.5, "sine", 0.05);
      }
    };
  }
})();
