/* Quick-reference summaries (hand-condensed from the official Steamroller 2026 and Tales from the Frontlines PDFs; unofficial fan tool).
   Markup: **bold**  and  [[chip]]  (VP chips etc).  kind: setup | score | special | end. The full verbatim text stays in scoring.js. */
(function () {
  const TIMING = "From the **Defender’s 2nd turn**, at the **end of each player’s turn**:";
  const WIN = "**Instant win:** [[3+ VP lead]] after scoring on your **opponent’s** turn.";
  const LEN = "**Game ends** at the end of the **Defender’s 7th turn**.";
  const NOLIMIT = "No limit to VP you can score.";
  const sr = {
    "trench-warfare": [
      { kind: "setup", title: "Set up", items: ["**2×** 50mm obj · **2×** 40mm obj", "**2** flags · **2** caches"] },
      { kind: "score", title: "Scoring", lead: TIMING, items: ["Objective secured [[1 VP]]", "**Opponent’s** Scenario Terrain scored [[2 VP]]", "**Your own** Scenario Terrain scored [[0 VP]]", "Scoring a Cache [[2 VP]]", NOLIMIT] },
      { kind: "special", title: "Special rule", items: ["**Earthworks:** within **3”** of your own 40mm or 50mm objectives, **medium and small-based warrior models** gain **Cover** and **Resistance: Blast**."] },
      { kind: "end", title: "Victory & game end", items: [WIN, LEN] }
    ],
    "two-fronts": [
      { kind: "setup", title: "Set up", items: ["**2×** 50mm obj · **2×** 40mm obj", "**1** flag"] },
      { kind: "score", title: "Scoring", lead: TIMING, items: ["Objective secured [[1 VP]]", "Scenario Terrain secured [[1 VP]]", "You have scored **both 40mm** [[+1 VP]]", "You have scored **both 50mm** [[+1 VP]]", NOLIMIT] },
      { kind: "end", title: "Victory & game end", items: [WIN, LEN] }
    ],
    "wolves-at-our-heels": [
      { kind: "setup", title: "Set up", items: ["**2×** 50mm obj · **2×** 40mm obj", "**2** flags"] },
      { kind: "score", title: "Scoring", lead: TIMING, items: ["Objective secured [[1 VP]]", "Scenario Terrain secured [[1 VP]]", "You add the **3rd token** to your objective and your opponent did not [[3 VP]]", NOLIMIT] },
      { kind: "special", title: "Special rules", items: [
        "**The Wolves Advance:** from the **Attacker’s 3rd turn**, **extend the Kill Box by 2”** at the start of each of the Attacker’s turns.",
        "**Tokens:** at the end of each scoring turn, **after points are scored**, if you have secured your own **40mm** objective you can **add a token** to it. If you do, your **opponent may move that objective 3”** toward the **50mm objective of the same colour**.",
        "If **both** objectives get their 3rd token in the **same turn**, **no points** are scored this way.",
        "This token scoring is checked **only once per game**."] },
      { kind: "end", title: "Victory & game end", items: [WIN, LEN] }
    ],
    "pressure-point": [
      { kind: "setup", title: "Set up", items: ["**4** flags · **1×** 50mm obj"] },
      { kind: "score", title: "Scoring", lead: TIMING, items: ["Scenario Terrain secured [[1 VP]]", "Objective secured [[2 VP]]"] },
      { kind: "end", title: "Victory & game end", items: [WIN, LEN] }
    ],
    "high-stakes": [
      { kind: "setup", title: "Set up", items: ["**1×** 50mm obj · **2×** 40mm obj · **2** flags", "Put **5 countdown tokens** on **each** piece of objective terrain **and** the 50mm objective."] },
      { kind: "score", title: "Scoring", lead: TIMING, items: ["40mm objective secured [[1 VP]]", "50mm objective secured [[1 VP]] [[+1 VP]] while it has **0** tokens", "Scenario Terrain secured [[1 VP]] [[+1 VP]] while it has **0** tokens", NOLIMIT] },
      { kind: "special", title: "Light the Fuse", items: [
        "From the **Defender’s 2nd turn**, at the end of each player’s turn, **before scoring**:",
        "**If someone has secured the 50mm objective:** that player picks that objective **or** either objective terrain and **removes 1d3 countdown tokens**. They can’t pick one that is already at 0.",
        "**If nobody has secured it:** roll **1d3**. **1** = −1 token from the **blue** terrain/flag · **2** = −1 token from the **red** terrain/flag · **3** = −1 token from the **50mm** objective.",
        "**At 0 tokens:** when an objective reaches **0 tokens**, models in the objective terrain, or within **3”** of the objective or impassable objective terrain, suffer a **POW 14 magical blast** damage roll. Then carry on to scoring."] },
      { kind: "end", title: "Victory & game end", items: [WIN, LEN] }
    ],
    "fault-line": [
      { kind: "setup", title: "Set up", items: ["**4×** 40mm obj · **2×** 50mm obj"] },
      { kind: "score", title: "Scoring", lead: TIMING, items: ["Objective secured [[1 VP]]", "You’ve secured **2** of your own objectives [[+1 VP]]", "You’ve secured **all 3** of your own objectives [[+1 VP]]", NOLIMIT] },
      { kind: "end", title: "Victory & game end", items: [WIN, LEN] }
    ],
    "payload": [
      { kind: "setup", title: "Set up", items: ["**2×** 50mm obj · **2×** 40mm obj", "**2** flags"] },
      { kind: "score", title: "Scoring", lead: TIMING, items: ["Objective secured [[1 VP]]", "Scenario Terrain secured [[1 VP]]", "Your **50mm** objective **ends its move** in your **opponent’s terrain area** (or, if it can’t fit inside the piece, within **3”** of it) [[3 VP]] **immediately** — then **remove** that 50mm objective from play.", NOLIMIT] },
      { kind: "special", title: "Special rules", items: [
        "**Made to Haul:** after moving your 50mm objective at the end of your turn, you may move **1 friendly Cohort model 5”** directly toward your 50mm objective.",
        "**Moving the 50mm:** at the end of each scoring turn, **after points are scored**, a player securing a 50mm objective may move it **up to 3”** toward their opponent’s scenario terrain, **+1”** for each **other** 40mm or 50mm objective they have secured."] },
      { kind: "end", title: "Game end", items: [LEN, "(This scenario’s page gives no Scenario Victory line.)"] }
    ]
  };
  const T_START = "From the **defender’s 2nd turn**, at the **end of each player’s turn**, you earn:";
  const T_WIN = "**Win:** [[3+ VP lead]] after scoring at the end of your **opponent’s** turn. You **can’t win during your own turn**.";
  const t = (what) => [
    { kind: "score", title: "Scoring", lead: T_START, items: ["[[1 VP]] per " + what + " you are currently **securing**"] },
    { kind: "end", title: "Victory", items: [T_WIN] }
  ];
  window.QUICKREF = {
    sr2026: sr,
    tftf: {
      "first-blood": t("objective"),
      "lines-drawn": t("objective **and** piece of scenario terrain"),
      "close-quarters": t("objective **and** piece of scenario terrain"),
      "seize-the-initiative": t("objective **and** piece of scenario terrain"),
      "breakthrough": t("objective"),
      "point-of-no-return": t("objective")
    }
  };
})();
