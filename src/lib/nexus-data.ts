export const LEVELS = ["100 Level", "200 Level"] as const;
export type Level = (typeof LEVELS)[number];

export const FACULTIES = [
  "Computing & Cyber Systems",
  "Natural & Applied Sciences",
  "Environmental Sciences",
  "Engineering & Technology",
] as const;

const RAW_COURSES: [string, (typeof FACULTIES)[number]][] = [
  ["B.Sc. Biochemistry", "Natural & Applied Sciences"],
  ["B.Sc. Biology", "Natural & Applied Sciences"],
  ["B.Sc. Animal & Environmental Biology", "Natural & Applied Sciences"],
  ["B.Sc. Mathematics", "Natural & Applied Sciences"],
  ["B.Sc. Forensic Science", "Natural & Applied Sciences"],
  ["B.Sc. Geology", "Natural & Applied Sciences"],
  ["B.Sc. Chemistry", "Natural & Applied Sciences"],
  ["B.Sc. Microbiology", "Natural & Applied Sciences"],
  ["B.Sc. Physics", "Natural & Applied Sciences"],
  ["B.Sc. Statistics", "Natural & Applied Sciences"],
  ["B.Sc. Biotechnology", "Natural & Applied Sciences"],
  ["B.Sc. Science Laboratory Technology", "Natural & Applied Sciences"],
  ["B.Sc. Environmental Management and Toxicology", "Natural & Applied Sciences"],
  ["B.Eng. Agricultural & Biosystems Engineering", "Engineering & Technology"],
  ["B.Eng. Biomedical Engineering", "Engineering & Technology"],
  ["B.Eng. Mining Engineering", "Engineering & Technology"],
  ["B.Eng. Civil and Environmental Engineering", "Engineering & Technology"],
  ["B.Eng. Computer Engineering", "Engineering & Technology"],
  ["B.Eng. Electrical / Electronics Engineering", "Engineering & Technology"],
  ["B.Eng. Mechanical Engineering", "Engineering & Technology"],
  ["B.Eng. Mechatronics Engineering", "Engineering & Technology"],
  ["B.Sc. Software Engineering", "Computing & Cyber Systems"],
  ["B.Sc. Computer Science", "Computing & Cyber Systems"],
  ["B.Sc. Cyber Security", "Computing & Cyber Systems"],
  ["B.Sc. Data Science", "Computing & Cyber Systems"],
  ["B.Sc. Information & Communication Technology", "Computing & Cyber Systems"],
  ["B.Sc. Architecture", "Environmental Sciences"],
  ["B.Sc. Building Technology", "Environmental Sciences"],
  ["B.Sc. Environmental Management", "Environmental Sciences"],
  ["B.Sc. Estate Management and Valuation", "Environmental Sciences"],
  ["B.Sc. Industrial Design", "Environmental Sciences"],
  ["B.Sc. Quantity Surveying", "Environmental Sciences"],
  ["B.Sc. Surveying & Geoinformatics", "Environmental Sciences"],
  ["B.Sc. Urban & Regional Planning", "Environmental Sciences"],
  ["B.Sc. Forestry and environmental Management", "Environmental Sciences"],
];

/** Sort A–Z by course name, ignoring the degree prefix. */
export const courseName = (c: string) => c.replace(/^B\.(Sc|Eng)\.\s*/, "");
export const COURSES = RAW_COURSES.map(([name, faculty]) => ({ name, faculty })).sort((a, b) =>
  courseName(a.name).localeCompare(courseName(b.name)),
);

export const CACHE_TTL_MS = 72 * 60 * 60 * 1000;
export const isExpired = (cachedAt: number, now = Date.now()) => now - cachedAt > CACHE_TTL_MS;

export type Post = { id: string; code: string; tag: string; title: string; body: string; hue: number; icon: "cpu" | "flask" | "atom" | "sigma" | "book" };
export const POSTS: Post[] = [
  { id: "p1", code: "GST 101", tag: "Use of English", title: "Writing clear academic paragraphs", body: "A strong paragraph has one main idea, a topic sentence, supporting evidence and a closing link. Practise by rewriting a lecture note into three short paragraphs.", hue: 250, icon: "book" },
  { id: "p2", code: "CSC 101", tag: "Computing", title: "How a computer follows instructions", body: "Input → Processing → Output → Storage. The CPU fetches an instruction, decodes it and executes it — billions of times every second.", hue: 220, icon: "cpu" },
  { id: "p3", code: "CHM 101", tag: "Chemistry", title: "Atoms, moles and Avogadro's number", body: "One mole contains 6.022 × 10²³ particles. To find moles, divide the mass of a substance by its molar mass.", hue: 170, icon: "flask" },
  { id: "p4", code: "PHY 101", tag: "Physics", title: "Newton's three laws in everyday life", body: "Objects keep their motion unless a force acts (1st), F = ma (2nd), and every action has an equal and opposite reaction (3rd).", hue: 290, icon: "atom" },
  { id: "p5", code: "MTH 101", tag: "Mathematics", title: "Sets, unions and intersections", body: "A ∪ B holds everything in A or B. A ∩ B holds only what both share. Draw a Venn diagram before solving any set question.", hue: 200, icon: "sigma" },
];

/** Fresher clearance steps (demo wording — confirm against the official FUTES notice). */
export const CLEARANCE = [
  "Print JAMB admission letter",
  "Accept admission on JAMB CAPS",
  "Pay acceptance fee",
  "Collect FUTES admission letter",
  "Pay school fees",
  "Complete online registration portal",
  "Upload O'Level results",
  "Submit birth certificate / age declaration",
  "Submit state of origin letter",
  "Medical screening at the health centre",
  "Departmental clearance",
  "Collect student ID card",
  "Course registration with your adviser",
] as const;

export const TIMETABLE = [
  { day: "Mon", time: "8:00 – 10:00", code: "GST 101", room: "Lecture Theatre A" },
  { day: "Mon", time: "12:00 – 2:00", code: "MTH 101", room: "Hall 2" },
  { day: "Tue", time: "10:00 – 12:00", code: "CHM 101", room: "Chem Lab 1" },
  { day: "Wed", time: "8:00 – 10:00", code: "PHY 101", room: "Physics Hall" },
  { day: "Thu", time: "2:00 – 4:00", code: "CSC 101", room: "ICT Centre" },
  { day: "Fri", time: "10:00 – 11:00", code: "GST 103", room: "Lecture Theatre B" },
];
