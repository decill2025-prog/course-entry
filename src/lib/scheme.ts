// Scheme of work used to steer Nexus AI posts. Based on the NUC CCMAS (2023) course structure
// for Nigerian universities: 100L core/GST courses + 200L departmental courses for each of the 35 FUTES programmes.
import type { Level } from "@/lib/nexus-data";
import { groupOf } from "@/lib/lessons";

export type SchemeCourse = { code: string; title: string; topics: string[] };
const P = (s: string): SchemeCourse => {
  const [code = "", title = "", t = ""] = s.split("|");
  return { code, title, topics: t.split(";").map((x) => x.trim()).filter(Boolean) };
};

const GST111 = "GST 111|Communication in English|parts of speech; sentence types; paragraph writing; note-taking; essay structure; reading comprehension; avoiding plagiarism";
const MTH101 = "MTH 101|Elementary Mathematics I|sets and Venn diagrams; real numbers and indices; quadratic equations; sequences and series; binomial theorem; complex numbers; trigonometric identities";
const MTH102 = "MTH 102|Elementary Mathematics II|functions and graphs; limits; differentiation rules; applications of differentiation; integration basics; definite integrals; area under a curve";
const PHY101 = "PHY 101|General Physics I|units and dimensions; vectors; kinematics; Newton's laws; work energy and power; circular motion; gravitation";
const PHY102 = "PHY 102|General Physics II|electric charge and Coulomb's law; electric field; potential; capacitors; current and resistance; magnetism; electromagnetic induction";
const CHM101 = "CHM 101|General Chemistry I|atomic structure; mole concept; periodic table trends; chemical bonding; gas laws; stoichiometry; energy changes";
const CHM102 = "CHM 102|General Chemistry II|hydrocarbons; functional groups; isomerism; acids and bases; redox reactions; chemical equilibrium; reaction rates";
const BIO101 = "BIO 101|General Biology I|characteristics of living things; cell structure; cell division; classification; heredity basics; ecology basics";
const COS101 = "COS 101|Introduction to Computing Sciences|history of computers; hardware and software; number systems; algorithms and flowcharts; the internet; computer ethics";
const COS102 = "COS 102|Problem Solving|problem-solving steps; pseudocode; flowcharts; variables and data types; selection; loops; debugging";
const STA111 = "STA 111|Descriptive Statistics|types of data; frequency tables; mean median mode; measures of dispersion; charts and graphs; probability basics";
const GET101 = "GET 101|Engineering Craft Practice|workshop safety; hand tools; measuring instruments; fitting; welding basics; carpentry joints";
const GET102 = "GET 102|Engineering Graphics and Solid Modelling|drawing instruments; lettering and lines; geometric construction; orthographic projection; isometric drawing; dimensioning";
const ENV101 = "ENV 101|Introduction to the Built Environment|built environment professions; human settlements; climate and buildings; site analysis; sustainability";
const ENV102 = "ENV 102|Graphic Communication|drawing equipment; freehand sketching; scale drawing; plans sections elevations; perspective basics; presentation";

const CORE100: Record<string, string[]> = {
  computing: [COS101, COS102, MTH101, MTH102, PHY101, STA111, GST111],
  engineering: [MTH101, MTH102, PHY101, PHY102, CHM101, GET101, GET102, GST111],
  science: [BIO101, CHM101, CHM102, PHY101, MTH101, COS101, STA111, GST111],
  environment: [ENV101, ENV102, MTH101, PHY101, COS101, STA111, GST111],
};

const GST212 = "GST 212|Philosophy, Logic and Human Existence|what philosophy is; logic and arguments; fallacies; ethics; critical thinking";
const ENT211 = "ENT 211|Entrepreneurship and Innovation|opportunity spotting; business models; market research; startup finance; pitching";
const MTH201 = "MTH 201|Mathematical Methods I|partial differentiation; Taylor series; first-order ODEs; vector calculus basics; multiple integrals";
const GET201 = "GET 201|Applied Electricity I|Ohm's law; Kirchhoff's laws; network theorems; AC fundamentals; power factor";
const GET211 = "GET 211|Applied Mechanics|statics; free-body diagrams; friction; centroids; moments of inertia";
const GET209 = "GET 209|Engineering Mathematics I|linear algebra; matrices and determinants; complex numbers; differential equations";

const COMMON200: Record<string, string[]> = {
  computing: [GST212, ENT211, MTH201],
  engineering: [GET201, GET211, GET209, ENT211],
  science: [MTH201, GST212, ENT211],
  environment: [GST212, ENT211],
};

/** Departmental 200L courses per programme (name without degree prefix). */
const DEPT200: Record<string, string[]> = {
  "Biochemistry": ["BCH 201|General Biochemistry I|amino acids; protein structure; enzymes and kinetics; carbohydrates; lipids", "BCH 203|Biochemical Methods|buffers and pH; chromatography; electrophoresis; spectrophotometry"],
  "Biology": ["BIO 201|Genetics I|Mendel's laws; linkage; mutations; DNA replication", "BIO 203|General Physiology|homeostasis; transport across membranes; nerve impulse; hormones"],
  "Animal & Environmental Biology": ["AEB 201|Invertebrate Zoology|protozoa; arthropods; molluscs; annelids", "AEB 203|Principles of Ecology|ecosystems; food webs; population ecology; biomes"],
  "Mathematics": ["MTH 203|Linear Algebra I|vector spaces; linear maps; matrices; eigenvalues", "MTH 205|Real Analysis I|sequences; limits; continuity; supremum and infimum"],
  "Forensic Science": ["FSC 201|Introduction to Forensic Science|crime scene processing; chain of custody; fingerprints; trace evidence", "FSC 203|Forensic Biology|blood spatter; DNA profiling; body fluids; hair and fibre"],
  "Geology": ["GLY 201|Mineralogy|crystal systems; physical properties of minerals; silicates; mineral identification", "GLY 203|Physical Geology|rock cycle; weathering; plate tectonics; geologic time"],
  "Chemistry": ["CHM 211|Physical Chemistry I|thermodynamics laws; enthalpy; entropy; Gibbs free energy", "CHM 221|Organic Chemistry I|alkanes alkenes alkynes; reaction mechanisms; aromaticity; nomenclature", "CHM 231|Inorganic Chemistry I|periodicity; s-block; p-block; coordination basics"],
  "Microbiology": ["MCB 201|General Microbiology|bacterial structure; Gram staining; microbial growth; sterilisation", "MCB 203|Microbial Diversity|bacteria; fungi; viruses; protozoa"],
  "Physics": ["PHY 201|Classical Mechanics|Newtonian mechanics; momentum; oscillations; rigid bodies", "PHY 203|Thermal Physics|temperature; heat transfer; kinetic theory; laws of thermodynamics", "PHY 205|Electromagnetism|Gauss's law; magnetic fields; Faraday's law; Maxwell's equations"],
  "Statistics": ["STA 201|Probability I|sample spaces; conditional probability; Bayes' theorem; random variables", "STA 203|Statistical Inference I|sampling distributions; estimation; confidence intervals; hypothesis testing"],
  "Biotechnology": ["BTG 201|Introduction to Biotechnology|history of biotechnology; fermentation; recombinant DNA; biosafety", "BTG 203|Cell Biology|organelles; cell cycle; cell signalling; membrane transport"],
  "Science Laboratory Technology": ["SLT 201|Laboratory Techniques|lab safety; glassware and calibration; titration; sample preparation", "SLT 203|Instrumentation|microscopy; pH meters; centrifuges; spectrophotometers"],
  "Environmental Management and Toxicology": ["EMT 201|Principles of Toxicology|dose-response; LD50; routes of exposure; bioaccumulation", "EMT 203|Environmental Pollution|air pollution; water pollution; soil contamination; waste"],
  "Agricultural & Biosystems Engineering": ["ABE 201|Farm Power and Machinery|tractors; tillage implements; engine basics; machine maintenance", "ABE 203|Soil and Water Engineering|soil properties; irrigation; drainage; erosion control"],
  "Biomedical Engineering": ["BME 201|Introduction to Biomedical Engineering|medical devices; biomaterials; biomechanics; regulation", "BME 203|Human Anatomy for Engineers|skeletal system; cardiovascular system; nervous system; muscles"],
  "Mining Engineering": ["MNE 201|Introduction to Mining|mining methods; surface vs underground; mine safety; mineral economics", "MNE 203|Rock Mechanics I|rock properties; stress and strain; rock classification; slope stability"],
  "Civil and Environmental Engineering": ["CVE 201|Strength of Materials I|stress and strain; Hooke's law; shear force; bending moment", "CVE 203|Building Materials|cement and concrete; steel; timber; bricks and blocks"],
  "Computer Engineering": ["CPE 201|Digital Logic Design|logic gates; Boolean algebra; Karnaugh maps; combinational circuits", "CPE 203|Computer Programming|C basics; control structures; functions; arrays and pointers"],
  "Electrical / Electronics Engineering": ["EEE 201|Circuit Theory I|DC circuits; Thevenin and Norton; transients; AC phasors", "EEE 203|Electronics I|semiconductors; diodes; rectifiers; transistor basics"],
  "Mechanical Engineering": ["MEE 201|Engineering Thermodynamics I|systems and properties; first law; steam tables; ideal gases", "MEE 203|Engineering Drawing II|sectional views; assembly drawings; tolerances; CAD basics"],
  "Mechatronics Engineering": ["MCT 201|Introduction to Mechatronics|sensors; actuators; microcontrollers; control loops", "MCT 203|Electrical Machines I|DC motors; generators; transformers; stepper motors"],
  "Software Engineering": ["SEN 201|Software Engineering Principles|SDLC; requirements; agile and scrum; UML diagrams", "CSC 201|Object-Oriented Programming|classes and objects; encapsulation; inheritance; polymorphism", "CSC 203|Data Structures|arrays; linked lists; stacks and queues; trees"],
  "Computer Science": ["CSC 201|Object-Oriented Programming|classes and objects; encapsulation; inheritance; polymorphism", "CSC 203|Data Structures|arrays; linked lists; stacks and queues; trees", "CSC 205|Discrete Structures|logic and proofs; sets and relations; graphs; counting"],
  "Cyber Security": ["CYB 201|Introduction to Cyber Security|CIA triad; threats and attacks; malware; social engineering", "CYB 203|Cryptography Basics|ciphers; symmetric encryption; public-key encryption; hashing", "CSC 201|Object-Oriented Programming|classes and objects; inheritance; polymorphism; exceptions"],
  "Data Science": ["DTS 201|Introduction to Data Science|data lifecycle; data cleaning; exploratory analysis; visualisation", "DTS 203|Python for Data Science|NumPy; pandas; plotting; notebooks", "STA 201|Probability I|random variables; distributions; Bayes' theorem; expectation"],
  "Information & Communication Technology": ["ICT 201|Computer Networks I|OSI model; TCP/IP; IP addressing; network devices", "ICT 203|Web Technologies|HTML; CSS; JavaScript basics; how the web works"],
  "Architecture": ["ARC 201|Architectural Design I|design process; space planning; form and function; site response", "ARC 203|History of Architecture|ancient architecture; African traditional architecture; classical orders; modernism", "ARC 205|Building Construction I|foundations; walls; floors; roofs"],
  "Building Technology": ["BLD 201|Building Construction I|substructure; walling; openings; roof construction", "BLD 203|Building Materials|concrete; steel; timber; finishes"],
  "Environmental Management": ["EVM 201|Principles of Environmental Management|sustainability; EIA basics; environmental policy; resource conservation", "EVM 203|Waste Management|waste types; 3Rs; landfills; composting"],
  "Estate Management and Valuation": ["ESM 201|Principles of Valuation|value concepts; methods of valuation; years' purchase; rental value", "ESM 203|Land Economics|land as a resource; demand and supply of land; land tenure; Land Use Act"],
  "Industrial Design": ["IND 201|Design Studio I|design process; ideation sketches; prototyping; user-centred design", "IND 203|Materials and Processes|plastics; metals; ceramics; manufacturing processes"],
  "Quantity Surveying": ["QSV 201|Measurement of Building Works I|SMM rules; taking-off; substructure measurement; bill of quantities", "QSV 203|Construction Economics|cost planning; cost control; tendering; contracts"],
  "Surveying & Geoinformatics": ["SVG 201|Plane Surveying I|chain surveying; levelling; traversing; bearings", "SVG 203|Introduction to GIS|spatial data; coordinate systems; maps and layers; remote sensing basics"],
  "Urban & Regional Planning": ["URP 201|Planning Theory I|origins of planning; garden city; land-use zoning; planning process", "URP 203|Urban Sociology|urbanisation; settlement patterns; housing; informal settlements"],
  "Forestry and environmental Management": ["FWM 201|Introduction to Forestry|forest types in Nigeria; silviculture; forest products; deforestation", "FWM 203|Dendrology|tree identification; leaves and bark; Nigerian timber species; tree growth"],
};

/** Ordered scheme of work (week order) for a level + course. */
export function schemeFor(level: Level, course: string, faculty: string): SchemeCourse[] {
  const g = groupOf(faculty);
  const name = course.replace(/^B\.(Sc|Eng)\.\s*/, "");
  const list = level === "100 Level" ? CORE100[g] ?? [] : [...(DEPT200[name] ?? []), ...(COMMON200[g] ?? [])];
  return list.map(P);
}

export type Topic = { code: string; courseTitle: string; topic: string; week: number };
export function topicsFor(level: Level, course: string, faculty: string): Topic[] {
  return schemeFor(level, course, faculty).flatMap((c) => c.topics.map((t, i) => ({ code: c.code, courseTitle: c.title, topic: t, week: i + 1 })));
}
