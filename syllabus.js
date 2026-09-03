// Preliminary Physics (NSW Stage 6, 2017 syllabus) — module and content-area map.
// Sub-areas mirror the syllabus's own inquiry-question headings within each module.
const SYLLABUS = {
  "Kinematics": ["Motion in a Straight Line", "Motion on a Plane"],
  "Dynamics": ["Forces", "Forces, Acceleration and Energy", "Momentum, Energy and Simple Systems"],
  "Waves and Thermodynamics": ["Wave Properties", "Wave Behaviour", "Energy Transfer", "Thermodynamics"],
  "Electricity and Magnetism": ["Electrostatics", "Electric Circuits", "Magnetism"],
  "Working Scientifically": ["Questioning and Predicting", "Planning and Conducting Investigations", "Processing and Analysing Data", "Problem Solving and Communicating"]
};

// The NESA inquiry question for each content area, shown in the UI.
const SUB_INQUIRY = {
  "Motion in a Straight Line": "How is the motion of an object moving in a straight line described and predicted?",
  "Motion on a Plane": "How can the motion of objects on a plane, including projectiles, be described and predicted?",
  "Forces": "How does the concept of force explain changes in the motion of an object?",
  "Forces, Acceleration and Energy": "How can the motion of objects be explained and analysed in terms of energy and work?",
  "Momentum, Energy and Simple Systems": "How is the motion of objects in a simple, isolated system dependent on the interaction between the objects?",
  "Wave Properties": "How are the properties of wave motion demonstrated?",
  "Wave Behaviour": "How do the observed properties of wave behaviour compare with the predictions made by wave theory?",
  "Energy Transfer": "How is energy transferred and transformed from one form to another?",
  "Thermodynamics": "How does the transfer of heat energy explain the concept of thermal equilibrium?",
  "Electrostatics": "How do charged objects interact with other charged and neutral objects?",
  "Electric Circuits": "How do electric circuits function?",
  "Magnetism": "How do magnetised and magnetic objects interact?",
  "Questioning and Predicting": "Developing and evaluating questions and hypotheses for scientific investigation.",
  "Planning and Conducting Investigations": "Designing and conducting valid, reliable and accurate investigations.",
  "Processing and Analysing Data": "Selecting, processing and analysing primary and secondary data.",
  "Problem Solving and Communicating": "Solving scientific problems and communicating understanding."
};

// Indicative NESA weighting of course time. The four modules are 30 indicative
// hours each (25% apiece). Working Scientifically is embedded across all four
// rather than timetabled separately, so it carries no weight of its own.
const TOPIC_WEIGHT = {
  "Kinematics": 25,
  "Dynamics": 25,
  "Waves and Thermodynamics": 25,
  "Electricity and Magnetism": 25,
  "Working Scientifically": 0
};

// Module numbers, used for display ordering and short labels.
const MODULE_NO = {
  "Kinematics": 1,
  "Dynamics": 2,
  "Waves and Thermodynamics": 3,
  "Electricity and Magnetism": 4
};
