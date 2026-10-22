const assert = require("assert");
global.window = global;
require("./content.js");
const rules = require("./rules.js");

const cells = window.LEELA_CONTENT.cells;
assert.strictEqual(cells.length, 72);
cells.forEach(function (item, index) {
  assert.strictEqual(item.en.length, 2, index + 1);
  assert.strictEqual(item.ru.length, 2, index + 1);
  assert.strictEqual(item.ask.length, 2, index + 1);
});
const names = window.LEELA_CONTENT.names;
assert.strictEqual(names.length, 72);
names.forEach(function (pair, index) {
  assert.strictEqual(pair.length, 2, index + 1);
  assert.ok(pair[0] && pair[1], index + 1);
});
assert.strictEqual(names[1][0], "Maya");
assert.strictEqual(names[18][0], "Karma-loka");
assert.strictEqual(names[53][0], "Bhakti-loka");
assert.strictEqual(names[67][1], "Вайкунтха-лока");
assert.strictEqual(cells[0].en[0], "Birth");
assert.strictEqual(cells[5].en[0], "Delusion");
assert.strictEqual(cells[67].ru[0], "Космическое сознание");
assert.strictEqual(rules.ARROWS[54], 68);
assert.strictEqual(Object.keys(rules.ARROWS).length, 10);
assert.strictEqual(Object.keys(rules.SNAKES).length, 10);

function land(position, rolls) {
  return rules.resolveThrow(position, rolls);
}

assert.deepStrictEqual(land(0, [4]).kind, "wait");
assert.strictEqual(land(0, [6, 5]).position, 11);
assert.strictEqual(land(0, [6, 6, 6, 1]).position, 1);
assert.strictEqual(land(0, [6, 6, 6, 1]).burnedSixes, true);
assert.strictEqual(land(0, [6, 6, 6, 6, 1]).position, 25);
assert.strictEqual(land(20, [6, 2]).position, 28);
assert.strictEqual(land(20, [6, 2]).link.to, 50);
assert.strictEqual(land(30, [6, 6, 6, 4]).position, 34);
assert.strictEqual(land(30, [6, 6, 6, 4]).burnedSixes, true);
assert.strictEqual(land(15, [6, 6, 6, 6, 1]).position, 40);
assert.strictEqual(land(66, [2]).win, true);
assert.strictEqual(land(67, [6]).pending, true);
assert.strictEqual(land(67, [6, 1]).kind, "burn");
assert.strictEqual(land(70, [2]).position, 72);
assert.strictEqual(land(70, [2]).link.to, 51);
assert.strictEqual(land(69, [1]).position, 70);
assert.strictEqual(land(64, [5]).crossed, true);
assert.strictEqual(land(11, [2]).position, 13);
assert.strictEqual(land(11, [2]).link, null);

const devotion = land(53, [1]);
assert.strictEqual(devotion.position, 54);
assert.strictEqual(devotion.link.type, "arrow");
assert.deepStrictEqual(rules.followLink(54), {
  kind: "link",
  from: 54,
  position: 68,
  linkType: "arrow",
  win: true,
  link: null
});
assert.strictEqual(rules.followLink(72).position, 51);
assert.strictEqual(rules.followLink(17).position, 69);
assert.strictEqual(land(6, [6]).pending, true);

console.log("rules ok");
