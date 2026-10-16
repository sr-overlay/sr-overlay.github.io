/*
 * Warmachine MkIV — Steamroller 2026 scenario layouts.
 * Source: "Steamroller 2026" packet, Steamforged Games, published 21 Jan 2026
 *   Full colour: https://cdn.shopify.com/s/files/1/0602/0156/6449/files/WM-Steamroller-2026-JanuaryRules-compressed.pdf?v=1769018266
 *   Printer friendly: https://cdn.shopify.com/s/files/1/0602/0156/6449/files/WM-Steamroller-2026-JanuaryRules-B_W.pdf?v=1769017554
 *   (linked from https://steamforged.com/blogs/brands/warmachine-wednesday_january_21_2026 and warmachine.gg/pages/event-resources)
 *
 * COORDINATES: inches. Table is 48" x 48" (the diagrams are drawn to that scale and the
 * dimension labels only add up on a 48" table; the packet itself doesn't state the table size in words).
 * The diagram is stored as printed: Defender (blue) edge at the TOP, Attacker (red) edge at the BOTTOM.
 * "left"/"right" = left/right as printed, which is also the Attacker's left/right when
 * standing at their own edge.
 *
 * pos: distances exactly as labelled on the diagram, measured from the table edge to the
 * NEAREST EDGE OF THE BASE (packet p.2: "measure from the table edge to the edge of the base").
 * The app converts these to centre points by adding the base radius.
 *
 * Deployment: Attacker 6" from own edge, Defender 11" from own edge (the red/blue bands on every diagram).
 * Kill Box (p.3): 12" from each player's own table edge, from the Attacker's 2nd turn onwards.
 */
(typeof window !== "undefined" ? window : globalThis).STEAMROLLER = {
  pack: "Steamroller 2026",
  publisher: "Steamforged Games",
  sourceUrl: "https://cdn.shopify.com/s/files/1/0602/0156/6449/files/WM-Steamroller-2026-JanuaryRules-compressed.pdf?v=1769018266",
  table: { width: 48, depth: 48 },
  deployment: { attacker: 6, defender: 11, advanceDeploymentExtra: 3 },
  killBox: 12,
  baseDiameterMM: { 50: 50, 40: 40, 30: 30 },
  scenarios: [
    {
      id: "trench-warfare", number: 1, name: "Trench Warfare", source: { page: 5 },
      summary: "Two 50mm and two 40mm objectives, a cache and a flag each. Earthworks: small/medium warriors within 3\" of their own objectives get cover and Resistance: Blast.",
      scoring: ["Objective secured = 1 VP", "Opponent's Scenario Terrain scored = 2 VP", "Own Scenario Terrain scored = 0 VP", "Scoring a cache = 2 VP", "Win on 3+ VP lead after scoring on opponent's turn", "Game ends at the end of Defender's turn 7"],
      rings: [{ of: "objective", ownerOnly: true, radius: 3, label: "Earthworks 3\"" }],
      elements: [
        { kind: "objective", base: 40, owner: "defender", pos: { top: 12, left: 22 } },
        { kind: "cache",     base: 30, owner: "defender", pos: { top: 18, left: 20 } },
        { kind: "objective", base: 50, owner: "defender", pos: { top: 21, left: 12 } },
        { kind: "flag",      base: 30, owner: "defender", pos: { top: 15, right: 6 } },
        { kind: "objective", base: 50, owner: "attacker", pos: { bottom: 25, right: 12 } },
        { kind: "cache",     base: 30, owner: "attacker", pos: { bottom: 22, right: 20 } },
        { kind: "objective", base: 40, owner: "attacker", pos: { bottom: 14, right: 22 } },
        { kind: "flag",      base: 30, owner: "attacker", pos: { bottom: 17, left: 6 } }
      ]
    },
    {
      id: "two-fronts", number: 2, name: "Two Fronts", source: { page: 6 },
      summary: "Each player has a 50mm and a 40mm objective on opposite flanks; one (blue) flag near the centre.",
      scoring: ["Objective secured = 1 VP", "Scenario Terrain secured = 1 VP", "Scored both 40mm = +1 VP", "Scored both 50mm = +1 VP", "Win on 3+ VP lead after scoring on opponent's turn", "Game ends at the end of Defender's turn 7"],
      elements: [
        { kind: "objective", base: 40, owner: "defender", pos: { top: 19, left: 12 } },
        { kind: "objective", base: 50, owner: "defender", pos: { top: 17, right: 12 } },
        { kind: "flag",      base: 30, owner: "defender", pos: { top: 24, left: 23 }, note: "Only flag in this scenario; drawn blue (Defender chooses the terrain)." },
        { kind: "objective", base: 40, owner: "attacker", pos: { bottom: 20, left: 8 } },
        { kind: "objective", base: 50, owner: "attacker", pos: { bottom: 19, right: 8 } }
      ]
    },
    {
      id: "wolves-at-our-heels", number: 3, name: "Wolves at Our Heels", source: { page: 7 },
      summary: "A 50mm, 40mm and flag each. Kill Box grows 2\" per Attacker turn from turn 3; secured own 40mm gains tokens and the opponent moves it 3\" toward the same-colour 50mm.",
      scoring: ["Objective secured = 1 VP", "Scenario Terrain secured = 1 VP", "Add 3rd token to own 40mm before opponent = 3 VP (once per game)", "Kill Box extends 2\" at the start of each Attacker turn from Attacker turn 3", "Win on 3+ VP lead after scoring on opponent's turn", "Game ends at the end of Defender's turn 7"],
      arrows: [{ from: { kind: "objective", base: 40, owner: "defender" }, to: { kind: "objective", base: 50, owner: "defender" }, label: "moves 3\"" },
               { from: { kind: "objective", base: 40, owner: "attacker" }, to: { kind: "objective", base: 50, owner: "attacker" }, label: "moves 3\"" }],
      elements: [
        { kind: "flag",      base: 30, owner: "defender", pos: { top: 20, left: 12 } },
        { kind: "objective", base: 50, owner: "defender", pos: { top: 20, right: 19 } },
        { kind: "objective", base: 40, owner: "defender", pos: { top: 15, right: 8 } },
        { kind: "objective", base: 50, owner: "attacker", pos: { bottom: 24, left: 19 } },
        { kind: "objective", base: 40, owner: "attacker", pos: { bottom: 20, left: 8 } },
        { kind: "flag",      base: 30, owner: "attacker", pos: { bottom: 20, right: 12 }, note: "Diagram artwork puts this icon about 1\" closer to the right edge than the 12\" label; label used." }
      ]
    },
    {
      id: "pressure-point", number: 4, name: "Pressure Point", source: { page: 8 },
      summary: "Four flags (Scenario Terrain), two in each half, plus one 50mm objective just past the centre toward the Defender side.",
      scoring: ["Scenario Terrain secured = 1 VP", "Objective secured = 2 VP", "Win on 3+ VP lead after scoring on opponent's turn", "Game ends at the end of Defender's turn 7"],
      elements: [
        { kind: "flag",      base: 30, owner: "neutral", drawn: "blue", pos: { top: 20, left: 12 } },
        { kind: "flag",      base: 30, owner: "neutral", drawn: "blue", pos: { top: 20, right: 12 } },
        { kind: "flag",      base: 30, owner: "neutral", drawn: "blue", pos: { top: 31, left: 6 } },
        { kind: "flag",      base: 30, owner: "neutral", drawn: "blue", pos: { top: 31, right: 6 } },
        { kind: "objective", base: 50, owner: "neutral", drawn: "red",  pos: { bottom: 22, right: 23 } }
      ],
      notes: ["All four flags are drawn blue and the 50mm red in the diagram, but the text doesn't say who owns them; the scoring applies to both players, so the app shows them as shared. The flag order (Attacker first, then Defender) comes from the general flag rules."]
    },
    {
      id: "high-stakes", number: 5, name: "High Stakes", source: { page: 9 },
      summary: "A central 50mm objective, plus a 40mm and a flag each. Countdown tokens (5 each) on the 50mm and both Scenario Terrain pieces; when one reaches 0 it deals a POW 14 blast within 3\" and is then worth +1 VP.",
      scoring: ["40mm objective secured = 1 VP", "50mm secured = 1 VP (+1 at 0 tokens)", "Scenario Terrain secured = 1 VP (+1 at 0 tokens)", "Light the Fuse: whoever secures the 50mm removes 1d3 tokens; otherwise roll 1d3", "Win on 3+ VP lead after scoring on opponent's turn", "Game ends at the end of Defender's turn 7"],
      rings: [{ of: "objective", base: 50, radius: 3, label: "Blast 3\"" }],
      elements: [
        { kind: "flag",      base: 30, owner: "defender", pos: { top: 23, left: 8 } },
        { kind: "objective", base: 50, owner: "neutral", drawn: "blue", pos: { top: 22, right: 23 } },
        { kind: "objective", base: 40, owner: "defender", pos: { top: 17, right: 14 } },
        { kind: "objective", base: 40, owner: "attacker", pos: { bottom: 18, left: 14 } },
        { kind: "flag",      base: 30, owner: "attacker", pos: { bottom: 20, right: 8 } }
      ],
      notes: ["The 50mm is drawn blue but either player can score it (shown as shared)."]
    },
    {
      id: "fault-line", number: 6, name: "Fault Line", source: { page: 10 },
      summary: "Symmetrical: each player has one 40mm near home, a 50mm in midfield and one 40mm deep on the opponent's side (all 8\" from the flanks except the 50s).",
      scoring: ["Objective secured = 1 VP", "Secured two of your own objectives = +1 VP", "Secured all three of your own = +1 VP", "Win on 3+ VP lead after scoring on opponent's turn", "Game ends at the end of Defender's turn 7"],
      elements: [
        { kind: "objective", base: 40, owner: "defender", pos: { top: 15, right: 8 } },
        { kind: "objective", base: 50, owner: "defender", pos: { top: 20, right: 23 } },
        { kind: "objective", base: 40, owner: "defender", pos: { top: 25, left: 8 } },
        { kind: "objective", base: 40, owner: "attacker", pos: { bottom: 15, left: 8 } },
        { kind: "objective", base: 50, owner: "attacker", pos: { bottom: 20, left: 23 } },
        { kind: "objective", base: 40, owner: "attacker", pos: { bottom: 25, right: 8 } }
      ]
    },
    {
      id: "payload", number: 7, name: "Payload", source: { page: 11 },
      summary: "Symmetrical: a 50mm 'payload', a 40mm and a flag each. A secured 50mm moves 3\" (+1\" per other objective secured) toward the opponent's Scenario Terrain; delivering it scores 3 VP.",
      scoring: ["Objective secured = 1 VP", "Scenario Terrain secured = 1 VP", "Own 50mm ends in/within 3\" of opponent's Scenario Terrain = 3 VP (then removed)", "Made to Haul: after moving your 50mm, one friendly Cohort may move 5\" toward it", "Game ends at the end of Defender's turn 7"],
      arrows: [{ from: { kind: "objective", base: 50, owner: "defender" }, to: { kind: "flag", owner: "attacker" }, label: "payload" },
               { from: { kind: "objective", base: 50, owner: "attacker" }, to: { kind: "flag", owner: "defender" }, label: "payload" }],
      elements: [
        { kind: "objective", base: 50, owner: "defender", pos: { top: 16, left: 9 } },
        { kind: "objective", base: 40, owner: "defender", pos: { top: 20, left: 20 } },
        { kind: "flag",      base: 30, owner: "defender", pos: { top: 19, right: 16 } },
        { kind: "flag",      base: 30, owner: "attacker", pos: { bottom: 19, left: 16 } },
        { kind: "objective", base: 40, owner: "attacker", pos: { bottom: 20, right: 20 } },
        { kind: "objective", base: 50, owner: "attacker", pos: { bottom: 16, right: 9 } }
      ]
    }
  ]
};
if (typeof module !== "undefined") module.exports = globalThis.STEAMROLLER;
