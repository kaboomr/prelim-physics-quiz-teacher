// Preliminary Physics — Section II short-answer sub-questions
// ORIGINAL practice questions written for this quiz (not sourced from a real
// past paper), with marking criteria and sample answers written in NESA
// marking-guideline style. Intended as a placeholder bank: once official past
// papers with answer keys are supplied, these should be replaced with verified
// questions and criteria cross-checked against the source marking guidelines.
const SA_QUESTIONS = [
  {
    "id": "ORIG-Q1(a)",
    "year": 2026,
    "n": 1,
    "part": "a",
    "marks": 2,
    "topic": "Kinematics",
    "subs": ["Motion in a Straight Line"],
    "img": "PHYS_sa01a.svg",
    "w": 900,
    "h": 294,
    "criteria": "Correct formula selected, e.g. v = u - gt with v = 0 at maximum height \u2014 1\nCorrect final answer with correct units \u2014 1",
    "sample": "At maximum height, v = 0.\n0 = 15 - 9.8t\nt = 15 / 9.8 = 1.5 s"
  },
  {
    "id": "ORIG-Q1(b)",
    "year": 2026,
    "n": 1,
    "part": "b",
    "marks": 1,
    "topic": "Kinematics",
    "subs": ["Motion in a Straight Line"],
    "img": "PHYS_sa01b.svg",
    "w": 900,
    "h": 176,
    "criteria": "Correct maximum height calculated using the time from part (a), or an equivalent valid method \u2014 1",
    "sample": "h = ut - 1/2 g t^2 = 15(1.5) - 0.5(9.8)(1.5)^2 = 22.5 - 11.0 = 11.5 m"
  },
  {
    "id": "ORIG-Q2",
    "year": 2026,
    "n": 2,
    "part": null,
    "marks": 2,
    "topic": "Dynamics",
    "subs": ["Forces"],
    "img": "PHYS_sa02.svg",
    "w": 900,
    "h": 212,
    "criteria": "Correctly identifies the action-reaction force pair (swimmer on water / water on swimmer) \u2014 1\nExplains that the reaction force from the water on the swimmer is what propels the swimmer forward, being equal in magnitude and opposite in direction to the action force \u2014 1",
    "sample": "The swimmer's hands and arms push backward on the water (the action force). By Newton's Third Law, the water exerts an equal and opposite reaction force forward on the swimmer, and it is this reaction force that propels the swimmer forward through the water."
  },
  {
    "id": "ORIG-Q3",
    "year": 2026,
    "n": 3,
    "part": null,
    "marks": 2,
    "topic": "Dynamics",
    "subs": ["Momentum, Energy and Simple Systems"],
    "img": "PHYS_sa03.svg",
    "w": 900,
    "h": 330,
    "criteria": "Correct application of conservation of momentum, m1v1 = (m1 + m2)v' \u2014 1\nCorrect final velocity with correct units \u2014 1",
    "sample": "m1v1 = (m1 + m2)v'\n(0.50)(4.0) = (0.50 + 0.50)v'\n2.0 = 1.0 v'\nv' = 2.0 m/s"
  },
  {
    "id": "ORIG-Q4(a)",
    "year": 2026,
    "n": 4,
    "part": "a",
    "marks": 2,
    "topic": "Waves and Thermodynamics",
    "subs": ["Wave Properties"],
    "img": "PHYS_sa04a.svg",
    "w": 900,
    "h": 294,
    "criteria": "Correct formula rearranged (lambda = v / f) and substituted \u2014 1\nCorrect final answer with correct units \u2014 1",
    "sample": "lambda = v / f = 340 / 440 = 0.77 m"
  },
  {
    "id": "ORIG-Q4(b)",
    "year": 2026,
    "n": 4,
    "part": "b",
    "marks": 1,
    "topic": "Waves and Thermodynamics",
    "subs": ["Wave Properties"],
    "img": "PHYS_sa04b.svg",
    "w": 900,
    "h": 248,
    "criteria": "Correctly states that the wavelength increases, justified by the frequency remaining constant while speed increases \u2014 1",
    "sample": "The wavelength increases. The frequency of the wave stays the same as it crosses into the water (it is set by the source), so since v = f (lambda), a higher speed at the same frequency requires a proportionally longer wavelength."
  },
  {
    "id": "ORIG-Q5",
    "year": 2026,
    "n": 5,
    "part": null,
    "marks": 3,
    "topic": "Electricity and Magnetism",
    "subs": ["Electric Circuits"],
    "img": "PHYS_sa05.svg",
    "w": 900,
    "h": 534,
    "criteria": "Correct total resistance calculated \u2014 1\nCorrect formula selected to find current (I = V / R) \u2014 1\nCorrect current calculated with correct units \u2014 1",
    "sample": "(i) R_total = 4 + 4 = 8 ohm\n(ii) I = V / R = 12 / 8 = 1.5 A"
  },
  {
    "id": "ORIG-Q6",
    "year": 2026,
    "n": 6,
    "part": null,
    "marks": 2,
    "topic": "Electricity and Magnetism",
    "subs": ["Magnetism"],
    "img": "PHYS_sa06.svg",
    "w": 900,
    "h": 284,
    "criteria": "States that the wire experiences a force (and moves) due to the interaction between its own field and the external magnetic field \u2014 1\nCorrectly names the right-hand palm rule (or right-hand slap rule) as the rule used to predict the direction of the force \u2014 1",
    "sample": "The current-carrying wire experiences a force perpendicular to both the current and the magnetic field, causing it to move (the motor effect). The direction of this force is predicted using the right-hand palm rule."
  }
];
