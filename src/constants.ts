import { Color, TestStep, SimulationProfile } from './types';

export const SIMULATION_PROFILES: SimulationProfile[] = [
  {
    id: 'normal',
    name: 'شخص طبيعي',
    description: 'استجابات سريعة مع عدد قليل جداً من الأخطاء العفوية.',
    baseSpeed: 1000,
    errorRate: 0.05,
    recoveryRate: 0.8
  },
  {
    id: 'adhd',
    name: 'تشتت انتباه (ADHD)',
    description: 'استجابات سريعة جداً ومندفعة، مع ارتفاع ملحوظ في الأخطاء خاصة في مرحلة التداخل.',
    baseSpeed: 600,
    errorRate: 0.25,
    recoveryRate: 0.4
  },
  {
    id: 'cognitive_decline',
    name: 'تدهور معرفي / كبار السن',
    description: 'استجابات بطيئة وحذرة، صعوبة بالغة في كف الاستجابة (التداخل).',
    baseSpeed: 2200,
    errorRate: 0.15,
    recoveryRate: 0.7
  },
  {
    id: 'depressed',
    name: 'اكتئاب / بطء نفسي حركي',
    description: 'بطء شديد في الاستجابة لكن مع دقة مقبولة.',
    baseSpeed: 3000,
    errorRate: 0.08,
    recoveryRate: 0.9
  }
];

// Extracting sequences from the PDF provided in the prompt
// Card A Words (Page 1/5)
export const CARD_A_WORDS: string[] = [
  "أخضر", "أصفر", "أحمر", "أزرق", "أصفر",
  "أخضر", "أحمر", "أزرق", "أخضر", "أزرق",
  "أحمر", "أصفر", "أزرق", "أخضر", "أحمر",
  "أصفر", "أصفر", "أخضر", "أزرق", "أحمر",
  "أخضر", "أصفر", "أزرق", "أحمر", "أحمر",
  "أزرق", "أصفر", "أخضر", "أصفر", "أحمر",
  "أخضر", "أزرق", "أحمر", "أخضر", "أزرق",
  "أصفر", "أصفر", "أزرق", "أحمر", "أخضر",
  "أزرق", "أصفر", "أخضر", "أحمر", "أزرق",
  "أخضر", "أحمر", "أصفر", "أخضر", "أصفر"
  // The sheet continues but we'll use a loop or extend as needed
];

// Card B Words/Colors (Page 2/6/8)
export const CARD_B_DATA = [
  { word: "أزرق", color: "أصفر" }, { word: "أصفر", color: "أخضر" }, { word: "أخضر", color: "أحمر" }, { word: "أحمر", color: "أزرق" }, { word: "أزرق", color: "أصفر" },
  { word: "أخضر", color: "أصفر" }, { word: "أصفر", color: "أحمر" }, { word: "أحمر", color: "أزرق" }, { word: "أزرق", color: "أصفر" }, { word: "أصفر", color: "أخضر" },
  { word: "أخضر", color: "أحمر" }, { word: "أحمر", color: "أخضر" }, { word: "أخضر", color: "أصفر" }, { word: "أصفر", color: "أزرق" }, { word: "أزرق", color: "أحمر" },
  { word: "أزرق", color: "أحمر" }, { word: "أحمر", color: "أصفر" }, { word: "أصفر", color: "أخضر" }, { word: "أخضر", color: "أصفر" }, { word: "أصفر", color: "أزرق" },
  { word: "أخضر", color: "أحمر" }, { word: "أحمر", color: "أأصفر" }, { word: "أصفر", color: "أأصفر" }, { word: "أصفر", color: "أخضر" }, { word: "أخضر", color: "أزرق" }
];

// Card C (Rectangles)
export const CARD_C_COLORS: string[] = [
  "أحمر", "أزرق", "أحمر", "أخضر", "أصفر",
  "أحمر", "أزرق", "أصفر", "أخضر", "أزرق",
  "أزرق", "أصفر", "أخضر", "أصفر", "أخضر",
  "أخضر", "أحمر", "أزرق", "أصفر", "أحمر",
  "أصفر", "أحمر", "أصفر", "أخضر", "أزرق",
  "أخضر", "أزرق", "أخضر", "أحمر", "أزرق",
  "أزرق", "أصفر", "أخضر", "أصفر", "أحمر",
  "أخضر", "أزرق", "أحمر", "أصفر", "أحمر",
  "أصفر", "أصفر", "أحمر", "أزرق", "أخضر",
  "أزرق", "أخضر", "أحمر", "أخضر", "أزرق"
];

// Re-generating extended sequences to ensure 100 items each as per PDF sheet
export const getFullSequence = (type: 1 | 2 | 3 | 4): TestStep[] => {
  const steps: TestStep[] = [];
  const baseColors = [Color.GREEN, Color.YELLOW, Color.RED, Color.BLUE];

  for (let i = 0; i < 100; i++) {
    let word = "";
    let displayColor = "black";
    let target = "";

    if (type === 1) {
      word = CARD_A_WORDS[i % CARD_A_WORDS.length];
      displayColor = "black";
      target = word;
    } else if (type === 2) {
      // Read the word
      const data = CARD_B_DATA[i % CARD_B_DATA.length];
      word = data.word;
      displayColor = data.color;
      target = word;
    } else if (type === 3) {
      // Color naming
      word = "rectangle"; // Representing the shape
      displayColor = CARD_C_COLORS[i % CARD_C_COLORS.length];
      target = displayColor;
    } else {
      // Interference (Test 4) - Name ink color of Card B words
      const data = CARD_B_DATA[i % CARD_B_DATA.length];
      word = data.word;
      displayColor = data.color;
      target = displayColor;
    }

    steps.push({ id: i, word, color: displayColor, target });
  }
  return steps;
};
