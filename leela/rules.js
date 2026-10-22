/* Movement rules for the traditional 72-square game.
   Descriptions and artwork live elsewhere; this file only moves a token. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LeelaRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ARROWS = {
    10: 23,
    17: 69,
    20: 32,
    22: 60,
    27: 41,
    28: 50,
    37: 66,
    45: 67,
    46: 62,
    54: 68
  };

  const SNAKES = {
    12: 8,
    16: 4,
    24: 7,
    29: 6,
    44: 9,
    52: 35,
    55: 3,
    61: 13,
    63: 2,
    72: 51
  };

  function linkFrom(square) {
    if (ARROWS[square]) return { type: "arrow", to: ARROWS[square] };
    if (SNAKES[square]) return { type: "snake", to: SNAKES[square] };
    return null;
  }

  function parseRolls(rolls) {
    if (!Array.isArray(rolls) || rolls.length === 0) {
      throw new Error("A throw needs at least one die.");
    }
    rolls.forEach(function (roll) {
      if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
        throw new Error("The die shows 1 through 6.");
      }
    });
    const last = rolls[rolls.length - 1];
    if (last === 6) return { pending: true, rolls: rolls.slice() };
    const sixes = rolls.length - 1;
    if (!rolls.slice(0, sixes).every(function (roll) { return roll === 6; })) {
      throw new Error("Only a six is rolled again.");
    }
    const burnedSixes = sixes === 3;
    return {
      pending: false,
      rolls: rolls.slice(),
      sixes: sixes,
      burnedSixes: burnedSixes,
      total: burnedSixes ? last : sixes * 6 + last
    };
  }

  function resolveThrow(position, rolls) {
    const parsed = parseRolls(rolls);
    if (parsed.pending) return parsed;
    if (position === 0 && parsed.sixes === 0) {
      return Object.assign({ kind: "wait", position: 0 }, parsed);
    }
    const land = position + parsed.total;
    if (land > 72) {
      return Object.assign({ kind: "burn", position: position }, parsed);
    }
    const link = linkFrom(land);
    return Object.assign({
      kind: "land",
      from: position,
      position: land,
      link: link,
      win: land === 68 && !link,
      born: position === 0,
      crossed: position > 0 && position < 68 && land > 68
    }, parsed);
  }

  function followLink(square) {
    const link = linkFrom(square);
    if (!link) return null;
    return {
      kind: "link",
      from: square,
      position: link.to,
      linkType: link.type,
      win: link.to === 68,
      link: null
    };
  }

  return {
    ARROWS: ARROWS,
    SNAKES: SNAKES,
    linkFrom: linkFrom,
    parseRolls: parseRolls,
    resolveThrow: resolveThrow,
    followLink: followLink
  };
});
