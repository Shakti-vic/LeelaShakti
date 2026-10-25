/* Leela reflection guide: turns a game moment into a prompt and asks OpenAI or Gemini for a reply. */
const MAX_MESSAGES = 16;
const MAX_TEXT = 1500;
const MAX_PATH = 24;

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  gemini: "gemini-3.5-flash-lite"
};

const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash"];

function providers(env) {
  const list = [];
  if (env.OPENAI_API_KEY) list.push("openai");
  if (env.GEMINI_API_KEY) list.push("gemini");
  return list;
}

function clip(value, limit) {
  return String(value == null ? "" : value).slice(0, limit || MAX_TEXT);
}

function cleanSquare(square) {
  if (!square || typeof square !== "object") return null;
  const id = Number(square.id);
  if (!Number.isInteger(id) || id < 1 || id > 72) return null;
  return {
    id: id,
    name: clip(square.name, 80),
    meaning: clip(square.meaning, 120),
    description: clip(square.description, 600),
    ask: clip(square.ask, 900),
    link: square.link === "arrow" || square.link === "snake" ? square.link : null
  };
}

function cleanRequest(body) {
  if (!body || typeof body !== "object") throw new Error("Request must be a JSON object.");
  const mode = body.mode === "closing" ? "closing" : "square";
  const square = cleanSquare(body.square);
  if (mode === "square" && !square) throw new Error("A square between 1 and 72 is required.");
  const chat = Array.isArray(body.chat) ? body.chat.slice(-MAX_MESSAGES) : [];
  return {
    mode: mode,
    lang: body.lang === "ru" ? "ru" : "en",
    name: clip(body.name, 60),
    question: clip(body.question, 400),
    square: square,
    path: (Array.isArray(body.path) ? body.path : []).slice(-MAX_PATH).map(function (step) {
      return {
        id: Number(step && step.id) || 0,
        name: clip(step && step.name, 80),
        meaning: clip(step && step.meaning, 120),
        note: clip(step && step.note, 400)
      };
    }),
    chat: chat
      .filter(function (item) { return item && (item.role === "guide" || item.role === "player"); })
      .map(function (item) { return { role: item.role, text: clip(item.text) }; })
  };
}

function systemPrompt(lang) {
  const language = lang === "ru" ? "Russian" : "English";
  return [
    "You are sitting with one player of Leela, a game of self-knowledge. You are a warm person in a real conversation, not a questionnaire and not a script.",
    "Reply in " + language + " only. The player may write in English, Russian, or Hebrew. Understand whatever they wrote, and answer in " + language + ".",
    "Their latest message is the whole subject. Start by quoting a short exact phrase from that message, in the language they used, inside quotation marks. Then say what you hear in it: the feeling, the image, or the choice.",
    "Do not open with the square name. Do not ask them to set their question beside the square. Do not ask where they notice it in the body, what small honest step to take, or tell them to keep what they found, unless their own words were about the body, a step, or keeping something.",
    "Ask at most one question, and only about a concrete detail they just wrote.",
    "Write three to five sentences of ordinary conversation. No lists, no headings, no emojis.",
    "Never predict the future, diagnose, or give medical, legal, or financial advice, and do not claim spiritual authority.",
    "If the player mentions self-harm or a crisis, gently suggest talking to someone they trust or a local helpline, and stop the game reflection."
  ].join(" ");
}

function closingPrompt(lang) {
  const language = lang === "ru" ? "Russian" : "English";
  return [
    "You are a calm, warm guide for Leela, the traditional Indian game of self-knowledge.",
    "The player has finished the journey. Write a closing reflection in " + language + " of 4 to 6 sentences.",
    "Name two or three turning points from the path, using what the player wrote, and how they relate to the original question.",
    "End with one question the player can keep for the coming days.",
    "Do not predict the future or give advice as an authority. No lists, no headings, no emojis."
  ].join(" ");
}

function contextText(request) {
  const lines = [
    "Player: " + (request.name || "the player"),
    "Their question: " + (request.question || "(not written)")
  ];
  if (request.path.length) {
    lines.push("Path so far:");
    request.path.forEach(function (step) {
      lines.push("- " + step.id + " " + step.name + " (" + step.meaning + ")" + (step.note ? ": \"" + step.note + "\"" : ""));
    });
  }
  if (request.mode === "square" && request.square) {
    const square = request.square;
    lines.push("Current square: " + square.id + " " + square.name + " — " + square.meaning + ".");
    lines.push("Meaning: " + square.description);
    if (square.link === "arrow") lines.push("This square holds an arrow: it lifts the player upward.");
    if (square.link === "snake") lines.push("This square holds a snake: it takes the player down.");
    lines.push("Square background only. Do not turn this into your reply: " + square.ask);
  } else {
    lines.push("The journey is complete. Please write the closing reflection.");
  }
  return lines.join("\n");
}

function conversation(request) {
  const turns = [{ role: "user", text: contextText(request) }];
  request.chat.forEach(function (item) {
    const role = item.role === "guide" ? "assistant" : "user";
    const last = turns[turns.length - 1];
    if (last.role === role) last.text += "\n\n" + item.text;
    else turns.push({ role: role, text: item.text });
  });
  if (turns[turns.length - 1].role === "assistant") {
    turns.push({ role: "user", text: request.lang === "ru" ? "(Игрок молчит. Мягко продолжи.)" : "(The player is quiet. Continue gently.)" });
  }
  return turns;
}

async function callOpenAI(request, env, fetchImpl) {
  const turns = conversation(request);
  const messages = [{ role: "system", content: request.mode === "closing" ? closingPrompt(request.lang) : systemPrompt(request.lang) }]
    .concat(turns.map(function (turn) { return { role: turn.role, content: turn.text }; }));
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.OPENAI_API_KEY },
    body: JSON.stringify({ model: env.LEELA_OPENAI_MODEL || DEFAULT_MODELS.openai, messages: messages })
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error("OpenAI: " + ((data.error && data.error.message) || response.status));
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error("OpenAI returned no text.");
  return text.trim();
}

function geminiModels(env) {
  return env.LEELA_GEMINI_MODEL ? [env.LEELA_GEMINI_MODEL] : GEMINI_MODELS.slice();
}

async function callGeminiModel(model, request, env, fetchImpl) {
  const turns = conversation(request);
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent";
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.mode === "closing" ? closingPrompt(request.lang) : systemPrompt(request.lang) }] },
      generationConfig: { maxOutputTokens: 600 },
      contents: turns.map(function (turn) {
        return { role: turn.role === "assistant" ? "model" : "user", parts: [{ text: turn.text }] };
      })
    })
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) {
    const error = new Error("Gemini: " + ((data.error && data.error.message) || response.status));
    error.status = response.status;
    throw error;
  }
  const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  const spoken = (parts || []).filter(function (part) { return !part.thought; });
  const text = (spoken.length ? spoken : (parts || [])).map(function (part) { return part.text || ""; }).join("");
  if (!text) throw new Error("Gemini returned no text.");
  return text.trim();
}

async function callGemini(request, env, fetchImpl) {
  const models = geminiModels(env);
  let lastError = null;
  for (let index = 0; index < models.length; index += 1) {
    try {
      return await callGeminiModel(models[index], request, env, fetchImpl);
    } catch (error) {
      lastError = error;
      const missing = /not found|not supported|shut down|deprecated|no longer available/i.test(String(error && error.message));
      if (index < models.length - 1 && (error.status === 404 || missing)) continue;
      throw error;
    }
  }
  throw lastError || new Error("Gemini returned no text.");
}

async function reply(body, env, fetchImpl) {
  const available = providers(env);
  const provider = body && available.indexOf(body.provider) !== -1 ? body.provider : available[0];
  if (!provider) throw new Error("No AI key is set on the server.");
  const request = cleanRequest(body);
  const text = provider === "openai"
    ? await callOpenAI(request, env, fetchImpl)
    : await callGemini(request, env, fetchImpl);
  return { provider: provider, reply: text };
}

const api = { providers: providers, cleanRequest: cleanRequest, conversation: conversation, reply: reply };
if (typeof module === "object" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.LeelaGuide = api;
