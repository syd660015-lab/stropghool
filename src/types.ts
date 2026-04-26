export enum Color {
  GREEN = 'أخضر',
  YELLOW = 'أصفر',
  RED = 'أحمر',
  BLUE = 'أزرق'
}

export const ColorMap: Record<string, string> = {
  'أخضر': '#16a34a', // green-600
  'أصفر': '#eab308', // yellow-500
  'أحمر': '#dc2626', // red-600
  'أزرق': '#2563eb'  // blue-600
};

export interface Participant {
  firstName: string;
  lastName: string;
  age: string;
  testDate: string;
}

export interface TestResult {
  frequency: number; // الترددات (ت): الإجابات الصحيحة
  errors: number;    // الأخطاء (خ): الأخطاء غير المصححة
}

export interface FullResults {
  test1: TestResult;
  test2: TestResult;
  test3: TestResult;
  test4: TestResult;
  interferenceScore: number;
}

export interface TestStep {
  id: number;
  word: string;
  color: string; // The UI color to display
  target: string; // What the user should say
}

export interface SimulationProfile {
  id: string;
  name: string;
  description: string;
  baseSpeed: number; // ms per item
  errorRate: number; // 0 to 1
  recoveryRate: number; // 0 to 1 (chance to self-correct)
}
