/*
 * Warmachine MkIV — Tales from the Frontlines 2026, CASUAL PLAY scenarios (pp. 9–14).
 * Source: "Tales from the Frontlines" packet, Steamforged Games (PDF created 17 Feb 2026, modified 20 Feb 2026), free download:
 *   https://cdn.shopify.com/s/files/1/0602/0156/6449/files/WM-Steamroller-2026-TalesFromTheFrontlines_1__compressed_1.pdf
 *   (linked from https://warmachine.gg/pages/event-resources -> "Tales from the Frontlines 2026 Packet")
 *
 * Same conventions as scenarios.js (Steamroller): inches; Defender (blue) edge at the TOP, Attacker (red) at the BOTTOM,
 * left/right as printed. pos = distance printed on the diagram from the table edge to the NEAREST EDGE OF THE BASE.
 * The packet doesn't state the table size or the edge-of-base convention in words; both were verified by measuring the
 * diagrams: with a 48"x48" table every marker centre sits at (printed distance + base radius) within ~0.5",
 * for 31 of 32 printed distances (the exception is the Close Quarters flags, see the note there).
 * Deployment (all six diagrams): Defender 11", Attacker 6". Kill Box (p.5): 12" from own table edge, from the Attacker's 2nd turn.
 * Objective markers are drawn black/grey (either player can secure them) -> owner "neutral".
 * advanceDeploymentExtra is not stated in this pack; it's the same game rule value used for the Steamroller data.
 */
(typeof window !== "undefined" ? window : globalThis).TFTF = {
  pack: "Tales from the Frontlines 2026",
  short: "Tales from the Frontlines",
  publisher: "Steamforged Games",
  sourceUrl: "https://cdn.shopify.com/s/files/1/0602/0156/6449/files/WM-Steamroller-2026-TalesFromTheFrontlines_1__compressed_1.pdf",
  table: { width: 48, depth: 48 },
  deployment: { attacker: 6, defender: 11, advanceDeploymentExtra: 3 },
  killBox: 12,
  baseDiameterMM: { 50: 50, 40: 40, 30: 30 },
  scenarios: [
    {
      id: "first-blood", number: 1, name: "First Blood", source: { page: 9 },
      summary: "One 40mm and one 50mm objective on opposite flanks, and a cache for each player near the centre. Designed as the starting scenario for new players.",
      scoring: ["From the Defender's 2nd turn, at the end of each player's turn: 1 VP per objective secured", "Claiming the opponent's cache = 2 VP (forfeit a combat action within 3\")", "Win on 3+ VP lead after scoring at the end of the opponent's turn (not during your own turn)"],
      elements: [
        { kind: "cache",     base: 30, owner: "defender", pos: { top: 16, left: 23 } },
        { kind: "objective", base: 40, owner: "neutral",  pos: { bottom: 23, left: 16 } },
        { kind: "objective", base: 50, owner: "neutral",  pos: { top: 23, right: 16 } },
        { kind: "cache",     base: 30, owner: "attacker", pos: { bottom: 16, right: 23 } }
      ]
    },
    {
      id: "lines-drawn", number: 2, name: "Lines Drawn", source: { page: 10 },
      summary: "Two 50mm objectives and a flag (Scenario Terrain) for each player, spread diagonally. The most open of the casual scenarios.",
      scoring: ["From the Defender's 2nd turn, at the end of each player's turn: 1 VP per objective and per piece of Scenario Terrain secured", "Win on 3+ VP lead after scoring at the end of the opponent's turn (not during your own turn)"],
      elements: [
        { kind: "flag",      base: 30, owner: "defender", pos: { top: 16, right: 16 } },
        { kind: "objective", base: 50, owner: "neutral",  pos: { top: 18, left: 18 } },
        { kind: "objective", base: 50, owner: "neutral",  pos: { bottom: 18, right: 18 } },
        { kind: "flag",      base: 30, owner: "attacker", pos: { bottom: 16, left: 16 } }
      ]
    },
    {
      id: "close-quarters", number: 3, name: "Close Quarters", source: { page: 11 },
      summary: "A 40mm and a 50mm objective side by side in the centre, with a flag (Scenario Terrain) for each player out on the flanks.",
      scoring: ["From the Defender's 2nd turn, at the end of each player's turn: 1 VP per objective and per piece of Scenario Terrain secured", "Win on 3+ VP lead after scoring at the end of the opponent's turn (not during your own turn)"],
      elements: [
        { kind: "flag",      base: 30, owner: "defender", pos: { top: 23, left: 16 } },
        { kind: "objective", base: 40, owner: "neutral",  pos: { bottom: 23, left: 21 } },
        { kind: "objective", base: 50, owner: "neutral",  pos: { top: 23, right: 21 } },
        { kind: "flag",      base: 30, owner: "attacker", pos: { bottom: 23, right: 16 } }
      ],
      notes: ["Check the packet: both flags are printed as 16\" from their side edge, and that's what the app shows. But the diagram draws them only about 10\" from the edge, with a wide gap to the central objectives. Every other distance in the pack matches its drawing."]
    },
    {
      id: "seize-the-initiative", number: 4, name: "Seize the Initiative", source: { page: 12 },
      summary: "A central 50mm objective. Each player's flag is in the opponent's half, next to the opponent's cache (based on a Brawlmachine classic).",
      scoring: ["From the Defender's 2nd turn, at the end of each player's turn: 1 VP per objective and per piece of Scenario Terrain secured", "Claiming the opponent's cache = 2 VP (forfeit a combat action within 3\")", "Win on 3+ VP lead after scoring at the end of the opponent's turn (not during your own turn)"],
      elements: [
        { kind: "cache",     base: 30, owner: "defender", pos: { top: 14, right: 14 } },
        { kind: "flag",      base: 30, owner: "attacker", pos: { top: 16, right: 16 } },
        { kind: "objective", base: 50, owner: "neutral",  pos: { top: 23, left: 23 } },
        { kind: "flag",      base: 30, owner: "defender", pos: { bottom: 16, left: 16 } },
        { kind: "cache",     base: 30, owner: "attacker", pos: { bottom: 14, left: 14 } }
      ]
    },
    {
      id: "breakthrough", number: 5, name: "Breakthrough", source: { page: 13 },
      summary: "A diagonal battle line of 40mm, 50mm and 40mm objectives across the middle, with each player's cache far out in a corner area.",
      scoring: ["From the Defender's 2nd turn, at the end of each player's turn: 1 VP per objective secured", "Claiming the opponent's cache = 2 VP (forfeit a combat action within 3\")", "Win on 3+ VP lead after scoring at the end of the opponent's turn (not during your own turn)"],
      elements: [
        { kind: "cache",     base: 30, owner: "defender", pos: { top: 12, right: 12 } },
        { kind: "objective", base: 40, owner: "neutral",  pos: { top: 16, left: 16 } },
        { kind: "objective", base: 50, owner: "neutral",  pos: { top: 23, left: 23 } },
        { kind: "objective", base: 40, owner: "neutral",  pos: { bottom: 16, right: 16 } },
        { kind: "cache",     base: 30, owner: "attacker", pos: { bottom: 12, left: 12 } }
      ]
    },
    {
      id: "point-of-no-return", number: 6, name: "Point of No Return", source: { page: 14 },
      summary: "Two 40mm objectives on the flanks and two caches for each player, one on a flank and one in the centre.",
      scoring: ["From the Defender's 2nd turn, at the end of each player's turn: 1 VP per objective secured", "Claiming an opponent's cache = 2 VP (forfeit a combat action within 3\")", "Win on 3+ VP lead after scoring at the end of the opponent's turn (not during your own turn)"],
      elements: [
        { kind: "cache",     base: 30, owner: "defender", pos: { top: 16, left: 14 } },
        { kind: "cache",     base: 30, owner: "defender", pos: { top: 21, right: 23 } },
        { kind: "objective", base: 40, owner: "neutral",  pos: { top: 23, left: 14 } },
        { kind: "objective", base: 40, owner: "neutral",  pos: { bottom: 23, right: 14 } },
        { kind: "cache",     base: 30, owner: "attacker", pos: { bottom: 21, left: 23 } },
        { kind: "cache",     base: 30, owner: "attacker", pos: { bottom: 16, right: 14 } }
      ]
    }
  ]
};
if (typeof module !== "undefined") module.exports = globalThis.TFTF;
