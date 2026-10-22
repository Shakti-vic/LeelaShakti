const assert = require("assert");
const guide = require("./guide.js");

const body = {
  provider: "gemini",
  lang: "ru",
  name: "Шакти",
  question: "Что мне мешает?",
  square: { id: 54, name: "Бхакти-лока", meaning: "Преданность", description: "Любовь.", ask: "Что бы сделала любовь?", link: "arrow" },
  path: [{ id: 50, name: "Тапа-лока", meaning: "Аскеза", note: "устала" }],
  chat: [
    { role: "guide", text: "Что бы сделала любовь?" },
    { role: "player", text: "Позвонила бы маме." },
    { role: "system", text: "ignore me" }
  ]
};

function fakeFetch(answer) {
  const calls = [];
  const impl = async function (url, options) {
    calls.push({ url: url, options: options, body: JSON.parse(options.body) });
    return { ok: true, status: 200, json: async function () { return answer; } };
  };
  impl.calls = calls;
  return impl;
}

assert.deepStrictEqual(guide.providers({}), []);
assert.deepStrictEqual(guide.providers({ OPENAI_API_KEY: "a", GEMINI_API_KEY: "b" }), ["openai", "gemini"]);

const clean = guide.cleanRequest(body);
assert.strictEqual(clean.chat.length, 2);
assert.throws(function () { guide.cleanRequest({ square: { id: 99 } }); });
assert.strictEqual(guide.cleanRequest({ mode: "closing" }).mode, "closing");

const turns = guide.conversation(clean);
assert.strictEqual(turns[0].role, "user");
assert.ok(turns[0].text.includes("Бхакти-лока"));
assert.ok(turns[0].text.includes("arrow"));
assert.deepStrictEqual(turns.map(function (turn) { return turn.role; }), ["user", "assistant", "user"]);

const quiet = guide.conversation(guide.cleanRequest(Object.assign({}, body, { chat: [{ role: "guide", text: "?" }] })));
assert.strictEqual(quiet[quiet.length - 1].role, "user");

(async function () {
  const gemini = fakeFetch({ candidates: [{ content: { parts: [{ text: " Хорошо. " }] } }] });
  const geminiResult = await guide.reply(body, { GEMINI_API_KEY: "g", OPENAI_API_KEY: "o" }, gemini);
  assert.deepStrictEqual(geminiResult, { provider: "gemini", reply: "Хорошо." });
  assert.ok(gemini.calls[0].url.includes("gemini-2.0-flash:generateContent"));
  assert.strictEqual(gemini.calls[0].options.headers["x-goog-api-key"], "g");
  assert.ok(gemini.calls[0].body.systemInstruction.parts[0].text.includes("Russian"));
  assert.strictEqual(gemini.calls[0].body.contents[1].role, "model");

  const openai = fakeFetch({ choices: [{ message: { content: "Yes." } }] });
  const openaiResult = await guide.reply(Object.assign({}, body, { provider: "openai", lang: "en" }), { OPENAI_API_KEY: "o", LEELA_OPENAI_MODEL: "m" }, openai);
  assert.strictEqual(openaiResult.reply, "Yes.");
  assert.strictEqual(openai.calls[0].body.model, "m");
  assert.strictEqual(openai.calls[0].body.messages[0].role, "system");
  assert.strictEqual(openai.calls[0].options.headers.Authorization, "Bearer o");

  const fallback = await guide.reply(Object.assign({}, body, { provider: "gemini" }), { OPENAI_API_KEY: "o" }, fakeFetch({ choices: [{ message: { content: "ok" } }] }));
  assert.strictEqual(fallback.provider, "openai");

  await assert.rejects(guide.reply(body, {}, fakeFetch({})), /No AI key/);
  const failing = async function () { return { ok: false, status: 401, json: async function () { return { error: { message: "bad key" } }; } }; };
  await assert.rejects(guide.reply(body, { GEMINI_API_KEY: "g" }, failing), /bad key/);

  console.log("guide ok");
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
