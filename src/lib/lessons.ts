import type { Level } from "@/lib/nexus-data";

export type Icon = "cpu" | "flask" | "atom" | "sigma" | "book" | "cog" | "building" | "dna";
export type Lesson = {
  id: string; code: string; tag: string; title: string; body: string;
  trick: string; trap: string; points: string[]; hue: number; icon: Icon;
};
export type Group = "computing" | "engineering" | "science" | "environment";

export const groupOf = (faculty: string): Group =>
  faculty.startsWith("Computing") ? "computing" : faculty.startsWith("Engineering") ? "engineering" : faculty.startsWith("Natural") ? "science" : "environment";

const L = (id: string, code: string, tag: string, title: string, body: string, trick: string, trap: string, points: string[], hue: number, icon: Icon): Lesson =>
  ({ id, code, tag, title, body, trick, trap, points, hue, icon });

const GENERAL: Record<Level, Lesson[]> = {
  "100 Level": [
    L("g1", "GST 101", "Use of English", "Write a paragraph lecturers love", "Every strong paragraph has one main idea. Start with a topic sentence, add evidence, explain it, then link to the next point.", "PEEL — Point, Evidence, Explain, Link.", "Students cram two ideas into one paragraph. One paragraph = one idea.", ["Topic sentence first", "Evidence supports the point", "End with a link"], 250, "book"),
    L("g2", "MTH 101", "Mathematics", "Sets: union vs intersection", "A ∪ B holds everything in A or B. A ∩ B holds only what both share. Always sketch a Venn diagram first.", "∪ looks like a cUp — it holds everything. ∩ is a bridge — only what both sides share.", "n(A ∪ B) = n(A) + n(B) − n(A ∩ B). Forgetting to subtract the overlap is the #1 mistake.", ["∪ = or", "∩ = and", "Subtract the overlap"], 200, "sigma"),
  ],
  "200 Level": [
    L("g3", "GST 201", "Entrepreneurship", "Turn a campus problem into a business", "A business solves a real pain for people who will pay. Find the pain, test a tiny version, then charge for it.", "PSP — Pain, Small test, Pay.", "Writing a big business plan before talking to a single customer.", ["Find a real pain", "Test small first", "Someone must pay"], 85, "book"),
    L("g4", "MTH 201", "Mathematical Methods", "Differentiation in one glance", "To differentiate xⁿ, bring the power down and reduce it by one: d/dx(xⁿ) = n·xⁿ⁻¹.", "\"Power comes down, power goes down.\"", "The derivative of a constant is 0 — students often leave it in.", ["Bring power down", "Reduce power by 1", "Constants vanish"], 200, "sigma"),
  ],
};

const BANK: Record<Group, Record<Level, Lesson[]>> = {
  computing: {
    "100 Level": [
      L("c1", "CSC 101", "Intro to Computing", "How a CPU follows instructions", "The CPU repeats one cycle billions of times a second: fetch the instruction, decode it, execute it, then store the result.", "\"Fast Dogs Eat Steak\" — Fetch, Decode, Execute, Store.", "Mixing up RAM (temporary, fast) with storage (permanent, slow).", ["Fetch → Decode → Execute → Store", "RAM is temporary", "Storage is permanent"], 220, "cpu"),
      L("c2", "CSC 103", "Number Systems", "Binary in 30 seconds", "Each binary place doubles: 1, 2, 4, 8, 16. Add the places that have a 1. 1011 = 8 + 2 + 1 = 11.", "Read right to left: 1, 2, 4, 8 — \"double the trouble\".", "Starting the place values from the left instead of the right.", ["Places double", "Add only the 1s", "Read right to left"], 240, "cpu"),
      L("c3", "PHY 101", "Physics", "Newton's three laws", "Things keep moving unless pushed (1st), F = ma (2nd), every action has an equal opposite reaction (3rd).", "\"Lazy, Math, Mirror\" — inertia, F=ma, reaction.", "Action and reaction act on DIFFERENT bodies, so they never cancel.", ["Inertia", "F = ma", "Equal and opposite"], 290, "atom"),
    ],
    "200 Level": [
      L("c4", "CSC 201", "Data Structures", "Stack vs Queue", "A stack is last-in, first-out like plates. A queue is first-in, first-out like a bank line.", "Stack = Plates (LIFO). Queue = Bank line (FIFO).", "Calling dequeue on a stack — stacks use push and pop.", ["Stack: push/pop, LIFO", "Queue: enqueue/dequeue, FIFO", "Pick by access order"], 220, "cpu"),
      L("c5", "CSC 205", "Algorithms", "Big-O made simple", "Big-O tells how work grows with input. O(1) constant, O(log n) halving, O(n) one pass, O(n²) loop inside a loop.", "\"One Log Never Squares\" — O(1) < O(log n) < O(n) < O(n²).", "Counting exact steps. Big-O ignores constants: O(2n) is O(n).", ["Drop constants", "Nested loops → n²", "Halving → log n"], 260, "sigma"),
      L("c6", "CYB 201", "Cyber Security", "The CIA triad", "Security protects Confidentiality (only the right people see it), Integrity (nobody changes it), Availability (it works when needed).", "CIA — like the agency: keep Secrets, keep Truth, stay Online.", "Encryption gives confidentiality, NOT availability.", ["Confidentiality", "Integrity", "Availability"], 190, "cpu"),
    ],
  },
  engineering: {
    "100 Level": [
      L("e1", "PHY 101", "Physics", "Newton's three laws", "Things keep moving unless pushed (1st), F = ma (2nd), every action has an equal opposite reaction (3rd).", "\"Lazy, Math, Mirror\" — inertia, F=ma, reaction.", "Action and reaction act on DIFFERENT bodies, so they never cancel.", ["Inertia", "F = ma", "Equal and opposite"], 290, "atom"),
      L("e2", "GET 101", "Engineering Drawing", "Orthographic projection", "One object, three views: front, top and side. Each view shows true lengths in two directions.", "\"Face, Roof, Wall\" — front, top, side.", "Placing the top view beside the front view. It goes directly above (or below) it.", ["Three views", "Top aligns with front", "Hidden edges are dashed"], 30, "cog"),
      L("e3", "CHM 101", "Chemistry", "Moles and Avogadro", "One mole = 6.022 × 10²³ particles. Moles = mass ÷ molar mass.", "\"Mass over Molar\" — Mole = M/Mr, like a fraction you can see.", "Using atomic number instead of molar mass.", ["n = m / Mr", "6.022 × 10²³", "Check units in grams"], 170, "flask"),
    ],
    "200 Level": [
      L("e4", "EEE 201", "Circuit Theory", "Ohm's law triangle", "Voltage = Current × Resistance. Cover the one you want in the V-I-R triangle to see the formula.", "\"Virgin Island Rum\" — V on top, I and R below.", "Forgetting to convert kΩ to Ω before calculating.", ["V = IR", "I = V/R", "Convert units first"], 60, "cog"),
      L("e5", "GET 201", "Engineering Mechanics", "Equilibrium in 3 equations", "A body at rest has ΣFx = 0, ΣFy = 0 and ΣM = 0. Draw a free-body diagram before any maths.", "\"No push, no lift, no twist.\"", "Taking moments about a point but forgetting sign direction.", ["ΣFx = 0", "ΣFy = 0", "ΣM = 0"], 30, "cog"),
      L("e6", "MEE 201", "Thermodynamics", "First law of thermodynamics", "Energy is never created or destroyed: heat added = change in internal energy + work done (Q = ΔU + W).", "\"Quick Users Work\" — Q = ΔU + W.", "Mixing sign conventions for work done BY vs ON the system.", ["Q = ΔU + W", "Energy is conserved", "Watch the signs"], 20, "atom"),
    ],
  },
  science: {
    "100 Level": [
      L("s1", "BIO 101", "General Biology", "Characteristics of living things", "All living things share seven signs: movement, respiration, sensitivity, growth, reproduction, excretion, nutrition.", "MRS GREN.", "Saying \"breathing\" for respiration — respiration is releasing energy in cells.", ["Seven signs", "Respiration ≠ breathing", "All must apply"], 150, "dna"),
      L("s2", "CHM 101", "Chemistry", "Moles and Avogadro", "One mole = 6.022 × 10²³ particles. Moles = mass ÷ molar mass.", "\"Mass over Molar\" — n = m/Mr.", "Using atomic number instead of molar mass.", ["n = m / Mr", "6.022 × 10²³", "Grams, not kg"], 170, "flask"),
      L("s3", "PHY 101", "Physics", "Newton's three laws", "Things keep moving unless pushed (1st), F = ma (2nd), every action has an equal opposite reaction (3rd).", "\"Lazy, Math, Mirror\".", "Action and reaction act on different bodies.", ["Inertia", "F = ma", "Equal and opposite"], 290, "atom"),
    ],
    "200 Level": [
      L("s4", "BCH 201", "Biochemistry", "Enzymes: lock and key", "Enzymes speed up reactions without being used up. The substrate fits the active site like a key in a lock.", "\"Enzymes are Reusable Keys.\"", "Saying enzymes are destroyed by heat — they are DENATURED (shape changed).", ["Active site", "Not used up", "Denatured, not killed"], 140, "dna"),
      L("s5", "CHM 201", "Organic Chemistry", "Naming alkanes", "Alkane prefixes by carbon count: meth (1), eth (2), prop (3), but (4), pent (5).", "\"Monkeys Eat Peeled Bananas\" — Meth, Eth, Prop, But.", "Counting the longest chain wrongly when it bends.", ["Find longest chain", "Prefix by carbons", "Ending -ane"], 170, "flask"),
      L("s6", "MCB 201", "Microbiology", "Gram staining", "Gram-positive bacteria keep the purple stain (thick wall). Gram-negative lose it and turn pink.", "\"Positive is Purple.\"", "Forgetting the decolouriser step decides the result.", ["Positive = purple", "Negative = pink", "Wall thickness matters"], 320, "dna"),
    ],
  },
  environment: {
    "100 Level": [
      L("v1", "ARC 101", "Design Basics", "Elements of design", "Every design uses line, shape, form, space, colour and texture. Good design balances them.", "\"Little Snakes Form Silly Coloured Tails.\"", "Ignoring negative space — empty space is part of the design.", ["Six elements", "Balance them", "Space counts"], 40, "building"),
      L("v2", "SVG 101", "Surveying", "Bearings made easy", "Bearings are measured clockwise from north, always written with three digits: east is 090°.", "\"Never Eat Soggy Waffles\" — N 000°, E 090°, S 180°, W 270°.", "Measuring anticlockwise or writing 90° instead of 090°.", ["From north", "Clockwise", "Three digits"], 120, "building"),
      L("v3", "MTH 101", "Mathematics", "Ratios and scale", "A scale of 1:100 means 1 cm on paper is 100 cm (1 m) in real life.", "\"Paper first, real second.\"", "Forgetting to convert cm to m in the final answer.", ["Paper : Real", "Convert units", "Check reasonableness"], 200, "sigma"),
    ],
    "200 Level": [
      L("v4", "URP 201", "Urban Planning", "Land use zoning", "Cities are split into zones — residential, commercial, industrial, recreational — to keep activities compatible.", "\"Real Cities Inspire Residents\" — R, C, I, Rec.", "Placing industrial zones upwind of homes.", ["Four main zones", "Consider wind and noise", "Plan for growth"], 120, "building"),
      L("v5", "QSV 201", "Quantity Surveying", "Bill of quantities", "A BOQ lists every item in a project with measured quantity and rate, so cost = quantity × rate.", "\"Count, Price, Multiply.\"", "Measuring to the wrong unit (m² vs m³).", ["Measure accurately", "Unit matters", "Cost = Q × rate"], 85, "building"),
      L("v6", "EVM 201", "Environmental Mgmt", "The 3 Rs", "Reduce waste first, reuse what you can, recycle the rest — in that order of impact.", "\"Reduce beats Reuse beats Recycle.\"", "Thinking recycling is the most effective — reducing is.", ["Reduce", "Reuse", "Recycle"], 150, "building"),
    ],
  },
};

/** Lessons matched to the student's level and faculty only. */
export const lessonsFor = (level: Level, faculty: string): Lesson[] => [
  ...BANK[groupOf(faculty)][level],
  ...GENERAL[level],
];

export const allLessons = (): Lesson[] => [
  ...Object.values(GENERAL).flat(),
  ...Object.values(BANK).flatMap((g) => Object.values(g).flat()),
];
