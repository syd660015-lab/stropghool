import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardCheck, 
  User, 
  Calendar, 
  Play, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Timer,
  Share2,
  Copy,
  History,
  ArrowRight,
  Trash2,
  Cpu,
  BrainCircuit,
  Wand2,
  MessageSquare,
  FileText
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Participant, FullResults, TestStep, ColorMap, TestResult, SimulationProfile } from './types.ts';
import { getFullSequence, SIMULATION_PROFILES } from './constants.ts';
import { 
  saveSession, 
  fetchHistory, 
  auth, 
  signInWithGoogle, 
  signOutUser,
  FirebaseUser
} from './services/firebase';
import { generateSimulationEvents, SimulationEvent } from './services/aiSimulationService';

const TEST_DURATION = 45; // 45 seconds per test

export default function App() {
  const [stage, setStage] = useState<'info' | 'ready' | 'testing' | 'summary' | 'history'>('info');
  const [currentTest, setCurrentTest] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<SimulationProfile | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [notes, setNotes] = useState('');
  const [examinerObservations, setExaminerObservations] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [participant, setParticipant] = useState<Participant>({
    firstName: '',
    lastName: '',
    birthDate: '',
    age: '',
    testDate: new Date().toISOString().split('T')[0]
  });

  // Calculate age when birthDate or testDate changes
  useEffect(() => {
    if (participant.birthDate && participant.testDate) {
      const birthDate = new Date(participant.birthDate);
      const testDate = new Date(participant.testDate);
      
      let years = testDate.getFullYear() - birthDate.getFullYear();
      let months = testDate.getMonth() - birthDate.getMonth();
      let days = testDate.getDate() - birthDate.getDate();

      if (days < 0) {
        months--;
      }
      if (months < 0) {
        years--;
      }
      
      if (!isNaN(years) && years >= 0) {
        setParticipant(prev => ({ ...prev, age: years.toString() }));
      }
    }
  }, [participant.birthDate, participant.testDate]);

  const [results, setResults] = useState<FullResults>({
    test1: { frequency: 0, errors: 0 },
    test2: { frequency: 0, errors: 0 },
    test3: { frequency: 0, errors: 0 },
    test4: { frequency: 0, errors: 0 },
    interferenceScore: 0
  });

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const [timeLeft, setTimeLeft] = useState(TEST_DURATION);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [testSteps, setTestSteps] = useState<TestStep[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync test steps when currentTest changes
  useEffect(() => {
    setTestSteps(getFullSequence(currentTest as 1 | 2 | 3 | 4));
    setCurrentStepIndex(0);
    setTimeLeft(TEST_DURATION);
  }, [currentTest]);

  const startTest = async (practice: boolean = false, simulationProfile: SimulationProfile | null = null) => {
    setIsPracticeMode(practice);
    setIsSimulationMode(!!simulationProfile);
    setSelectedProfile(simulationProfile);
    setStage('testing');
    
    if (simulationProfile) {
      setSimulationLoading(true);
      const events = await generateSimulationEvents(simulationProfile, currentTest);
      setSimulationLoading(false);
      runSimulation(events);
    } else if (!practice) {
      setTimeLeft(TEST_DURATION);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            finishTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const runSimulation = (events: SimulationEvent[]) => {
    let currentEventIndex = 0;
    let accumulatedDelay = 0;

    const playNextEvent = () => {
      if (currentEventIndex >= events.length) {
        finishTest();
        return;
      }

      const event = events[currentEventIndex];
      setTimeout(() => {
        if (event.type === 'correct') markCorrect();
        else if (event.type === 'error') markError();
        else if (event.type === 'correction') {
          // A correction in Stroop is often handled as "fixing the last mistake" 
          // or just another correct response after an error.
          // For simplicity, we count it as a "correct" but it was delayed.
          markCorrect();
        }
        
        currentEventIndex++;
        playNextEvent();
      }, event.delay);
    };

    // Also start a visual timer even in simulation
    setTimeLeft(TEST_DURATION);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    playNextEvent();
  };

  const calculateFinalResult = (res: TestResult) => {
    // النتيجة = الترددات (ت) + (2 × الأخطاء "خ")
    return res.frequency + (2 * res.errors);
  };

  const finishTest = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPracticeMode && currentTest < 4) {
      setStage('ready');
      setCurrentTest(currentTest + 1);
    } else if (isPracticeMode) {
      setStage('ready');
      setIsPracticeMode(false);
    } else {
      setStage('summary');
      if (!isPracticeMode) {
        // Calculate interference score immediately to save the correct value
        const res3 = calculateFinalResult(results.test3);
        const res4 = calculateFinalResult(results.test4);
        const interferenceScore = res3 - res4;
        
        const finalResults = { ...results, interferenceScore };
        saveSession(participant, finalResults, isSimulationMode, selectedProfile?.name || '', notes, examinerObservations);
      }
    }
  };

  // Re-calculate interference whenever summary stage is reached or results change
  useEffect(() => {
    if (stage === 'summary') {
      const res3 = calculateFinalResult(results.test3);
      const res4 = calculateFinalResult(results.test4);
      // نتيجة التداخل = (نتيجة التسمية) - (نتيجة اختبار التداخل في البطاقة ب)
      setResults(prev => ({ ...prev, interferenceScore: res3 - res4 }));
    }
  }, [stage, results.test3, results.test4]);

  const markCorrect = () => {
    const key = `test${currentTest}` as keyof Omit<FullResults, 'interferenceScore'>;
    setResults(prev => ({
      ...prev,
      [key]: { ...prev[key], frequency: prev[key].frequency + 1 }
    }));
    setCurrentStepIndex(prev => prev + 1);
  };

  const markError = () => {
    const key = `test${currentTest}` as keyof Omit<FullResults, 'interferenceScore'>;
    setResults(prev => ({
      ...prev,
      [key]: { ...prev[key], errors: prev[key].errors + 1 }
    }));
    setCurrentStepIndex(prev => prev + 1);
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await fetchHistory();
      setHistoryItems(data || []);
      setStage('history');
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingHistory(false);
    }
  };
  const resetAll = () => {
    setStage('info');
    setCurrentTest(1);
    setNotes('');
    setExaminerObservations('');
    setCurrentStepIndex(0);
    setResults({
      test1: { frequency: 0, errors: 0 },
      test2: { frequency: 0, errors: 0 },
      test3: { frequency: 0, errors: 0 },
      test4: { frequency: 0, errors: 0 },
      interferenceScore: 0
    });
    setParticipant({
      firstName: '',
      lastName: '',
      birthDate: '',
      age: '',
      testDate: new Date().toISOString().split('T')[0]
    });
  };

  const chartData = [
    { name: 'أ', frequency: results.test1.frequency, errors: results.test1.errors, score: calculateFinalResult(results.test1) },
    { name: 'ب (ق)', frequency: results.test2.frequency, errors: results.test2.errors, score: calculateFinalResult(results.test2) },
    { name: 'ج', frequency: results.test3.frequency, errors: results.test3.errors, score: calculateFinalResult(results.test3) },
    { name: 'ب (ت)', frequency: results.test4.frequency, errors: results.test4.errors, score: calculateFinalResult(results.test4) },
  ];

  const handleDownloadPDF = async () => {
    if (!summaryRef.current) return;
    
    setIsExporting(true);
    try {
      const element = summaryRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Stroop_Report_${participant.firstName}_${participant.lastName}_${participant.testDate}.pdf`);
    } catch (error) {
      console.error('PDF Generation Error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 overflow-x-hidden font-sans" dir="rtl">
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-50 flex items-center px-8 justify-between">
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-sm flex items-center justify-center text-white">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">اختبار سترووب</h1>
              <p className="text-[10px] text-slate-500 font-medium -mt-1 uppercase tracking-widest">Stroop Cognitive Test</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {!user ? (
              <button 
                onClick={() => signInWithGoogle()}
                className="bg-white hover:bg-slate-50 text-slate-700 py-2 px-6 rounded-lg font-bold border border-slate-200 shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
              >
                تسجيل الدخول <User size={18} className="text-slate-400" />
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">مرحباً</p>
                  <p className="text-xs font-bold text-slate-800">{user.displayName}</p>
                </div>
                <button 
                  onClick={() => signOutUser()}
                  className="bg-white hover:bg-red-50 text-red-600 py-2 px-4 rounded-lg font-bold border border-slate-200 shadow-sm transition-all text-xs"
                >
                  خروج
                </button>
              </div>
            )}

            {stage !== 'info' && (
              <div className="flex items-center gap-4">
                <div className="text-right ml-4">
                  <p className="text-sm font-bold text-slate-800">{participant.firstName} {participant.lastName}</p>
                  <p className="text-xs text-slate-500">الجلسة الحالية</p>
                </div>
                <div className="w-10 h-10 bg-indigo-100 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-indigo-700 font-bold uppercase">
                  {participant.firstName[0]}{participant.lastName[0]}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 flex flex-col gap-8">
        <AnimatePresence mode="wait">
          {stage === 'info' && (
            <motion.div 
              key="info"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-8"
            >
              <div className="bg-white p-10 rounded-xl border border-slate-200 shadow-sm max-w-2xl mx-auto w-full">
                <div className="mb-10 text-center border-b border-slate-100 pb-8">
                  <h3 className="text-xl font-black text-slate-800">إعداد وبرمجة: دكتور. أحمد حمدي عاشور الغول</h3>
                  <p className="text-slate-500 text-sm font-bold mt-2">دكتوراه في علم النفس التربوي وخبير مايكروسوفت لتكنولوجيا المعلومات</p>
                </div>

                <div className="mb-10 flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">بيانات المشارك</h2>
                    <p className="text-slate-500">يرجى إدخال معلومات المفحوص لبدء الجلسة السريرية</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setShowTutorial(true)}
                      className="text-indigo-600 font-bold text-sm bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2"
                    >
                      <AlertCircle size={18} /> ما هو اختبار سترووب؟
                    </button>
                    <button 
                      onClick={() => {
                        if (!user) {
                          signInWithGoogle().then(() => loadHistory());
                        } else {
                          loadHistory();
                        }
                      }}
                      disabled={loadingHistory}
                      className="text-slate-600 font-bold text-sm bg-slate-50 px-4 py-2 rounded-lg hover:bg-slate-100 transition-all flex items-center gap-2"
                    >
                      <History size={18} /> سجل الاختبارات
                    </button>
                  </div>
                </div>

              {showTutorial && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
                >
                  <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-10 relative">
                    <button 
                      onClick={() => setShowTutorial(false)}
                      className="absolute top-6 left-6 text-slate-400 hover:text-slate-600"
                    >
                      <RotateCcw size={20} />
                    </button>
                    <h3 className="text-3xl font-black mb-6 text-slate-800">حول اختبار سترووب</h3>
                    <div className="space-y-6 text-slate-600 leading-relaxed text-lg">
                      <p>
                        يعد <span className="font-bold text-indigo-600">اختبار سترووب</span> أحد أكثر الاختبارات النفسية العصبية شهرةً، حيث يقيس <span className="font-bold">المرونة المعرفية</span> والقدرة على <span className="font-bold text-rose-500">كف الاستجابة</span> التلقائية.
                      </p>
                      <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                        <ul className="space-y-4">
                          <li className="flex gap-3">
                            <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center font-bold text-sm shrink-0">1</span>
                            <span>يظهر التداخل عندما يتعارض اسم اللون مع لون الحبر المستخدم (مثلاً كلمة "أحمر" مكتوبة بحبر أزرق).</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center font-bold text-sm shrink-0">2</span>
                            <span>يتطلب الاختبار من الدماغ بذل مجهود إضافي لتثبيط القراءة التلقائية للكلمة وتسمية اللون بدلاً منها.</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center font-bold text-sm shrink-0">3</span>
                            <span>تُستخدم النتائج سريرياً لتقييم الوظائف التنفيذية، الانتباه الانتقائي، وتشخيص بعض الاضطرابات المعرفية.</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowTutorial(false)}
                      className="mt-8 w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg"
                    >
                      فهمت، لنبدأ بالبيانات
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">الاسم الأول</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 p-4 rounded-lg border border-slate-100 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder:text-slate-300"
                    value={participant.firstName}
                    onChange={e => setParticipant({...participant, firstName: e.target.value})}
                    placeholder="مثال: أحمد"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">اللقب</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 p-4 rounded-lg border border-slate-100 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder:text-slate-300"
                    value={participant.lastName}
                    onChange={e => setParticipant({...participant, lastName: e.target.value})}
                    placeholder="مثال: العتيبي"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">تاريخ الميلاد</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 p-4 rounded-lg border border-slate-100 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                    value={participant.birthDate}
                    onChange={e => setParticipant({...participant, birthDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">العمر (محسوب تلقائياً)</label>
                  <div className="w-full bg-slate-100 p-4 rounded-lg border border-slate-100 font-bold text-indigo-600">
                    {participant.age || 'يرجى تحديد تاريخ الميلاد'}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">تاريخ الاختبار</label>
                  <input 
                    type="date" 
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full bg-slate-50 p-4 rounded-lg border border-slate-100 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                    value={participant.testDate}
                    onChange={e => setParticipant({...participant, testDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="mt-12">
                <button 
                  onClick={() => setStage('ready')}
                  disabled={!participant.firstName || !participant.lastName}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-4 px-6 rounded-lg shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-3 text-lg"
                >
                  <Play size={20} fill="currentColor" /> الانتقال إلى التعليمات
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {stage === 'ready' && (
            <motion.div 
              key="ready"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center max-w-3xl mx-auto w-full"
            >
              <div className="bg-white border border-slate-200 border-r-4 border-r-indigo-500 p-12 rounded-xl shadow-sm mb-10 text-right">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-2xl shadow-md">
                    {currentTest}
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-800">
                      {currentTest === 1 && "اختبار البطاقة أ: القراءة"}
                      {currentTest === 2 && "اختبار البطاقة ب: القراءة مع الألوان"}
                      {currentTest === 3 && "اختبار البطاقة ج: التسمية"}
                      {currentTest === 4 && "اختبار البطاقة ب: التداخل (لون الحبر)"}
                    </h2>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-widest mt-1">Stroop Phase Guidelines</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-8 rounded-lg border border-slate-100 text-slate-700 text-xl leading-relaxed mb-8">
                  {currentTest === 1 && "اقرأ الكلمات سطراً بسطر من اليمين لليسار، بصوت عالٍ، في أسرع وقت ممكن."}
                  {currentTest === 2 && "اقرأ الكلمات المكتوبة، متجاهلاً لون الحبر الذي كتبت به."}
                  {currentTest === 3 && "سمّ ألوان المستطيلات التي تظهر أمامك سطراً بسطر."}
                  {currentTest === 4 && "سمّ لون الحبر الذي كتبت به الكلمات، متجاهلاً الكلمة المكتوبة."}
                </div>

                <div className="flex items-center gap-6 text-slate-500 font-bold p-4 bg-slate-50 rounded-lg border border-slate-100 inline-flex">
                  <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
                    <Timer size={20} className="text-indigo-500" />
                    <span>الوقت: 45 ثانية</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span>الحالة: جاهز للبدء</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => startTest(false)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 px-16 rounded-lg shadow-xl shadow-indigo-100 hover:shadow-2xl transition-all transform hover:-translate-y-1 text-2xl flex items-center gap-4 mx-auto"
                >
                  ابدأ الاختبار الزمني <Play size={24} fill="currentColor" />
                </button>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <button 
                    onClick={() => startTest(true)}
                    className="bg-white hover:bg-slate-50 text-indigo-600 py-4 rounded-xl font-bold border border-slate-200 shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={18} /> وضع التدريب
                  </button>

                  <div className="relative group">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm group-hover:border-indigo-300 transition-all">
                      <div className="flex items-center gap-2 mb-3 text-slate-700 font-bold">
                        <BrainCircuit size={18} className="text-indigo-500" />
                        <span>محاكاة الذكاء الاصطناعي</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {SIMULATION_PROFILES.map(profile => (
                          <button
                            key={profile.id}
                            onClick={() => startTest(false, profile)}
                            className="text-[10px] bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 p-2 rounded border border-slate-100 font-bold transition-all text-center"
                            title={profile.description}
                          >
                            {profile.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {stage === 'testing' && (
            <motion.div 
              key="testing"
              className="flex flex-col gap-8 max-w-5xl mx-auto w-full"
            >
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-r-4 border-r-indigo-500">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">مرحلة الاختبار</p>
                  <div className="flex items-center justify-between">
                    <h3 className="text-3xl font-bold text-slate-800">{currentTest} <span className="text-slate-300 text-lg">/ 4</span></h3>
                    <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full transition-all" style={{ width: `${(currentTest/4)*100}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">الترددات (ت)</span>
                      <h3 className="text-3xl font-bold text-indigo-600">{(results[`test${currentTest}` as keyof typeof results] as TestResult).frequency}</h3>
                    </div>
                    <div className="h-8 w-px bg-slate-100 mx-2"></div>
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">الأخطاء (خ)</span>
                      <h3 className="text-3xl font-bold text-rose-500">{(results[`test${currentTest}` as keyof typeof results] as TestResult).errors}</h3>
                    </div>
                  </div>
                </div>

                <div className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all ${timeLeft <= 10 && !isPracticeMode ? 'border-rose-200 bg-rose-50' : ''}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${timeLeft <= 10 && !isPracticeMode ? 'text-rose-500' : 'text-slate-500'}`}>الوقت المتبقي</p>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-3xl font-bold tabular-nums ${timeLeft <= 10 && !isPracticeMode ? 'text-rose-600' : 'text-slate-800'}`}>
                      {isPracticeMode ? "∞" : timeLeft}
                    </h3>
                    <Timer size={24} className={timeLeft <= 10 && !isPracticeMode ? 'text-rose-500 animate-pulse' : 'text-slate-300'} />
                  </div>
                </div>
              </div>

              <div className="bg-white p-16 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
                {isPracticeMode && (
                  <div className="absolute top-4 right-4 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest z-50">
                    وضع التدريب
                  </div>
                )}
                <div className="grid grid-cols-8 gap-4 opacity-[0.03] pointer-events-none absolute inset-0 p-12 scale-110">
                  {Array.from({length: 80}).map((_, i) => (
                    <div key={i} className="h-6 bg-slate-800 rounded-sm"></div>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {simulationLoading ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center gap-4"
                    >
                      <Wand2 size={48} className="text-indigo-500 animate-bounce" />
                      <p className="text-indigo-600 font-bold">جاري تحضير المحاكاة بواسطة الذكاء الاصطناعي...</p>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key={currentStepIndex}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.1 }}
                      className="text-center z-10"
                    >
                      {testSteps[currentStepIndex].word === 'rectangle' ? (
                         <div 
                          className="w-64 h-24 rounded-sm shadow-md border-8 border-white"
                          style={{ backgroundColor: ColorMap[testSteps[currentStepIndex].color] }}
                         />
                      ) : (
                        <span 
                          className="text-8xl font-black tracking-tight transition-colors"
                          style={{ color: currentTest === 1 ? '#1E293B' : ColorMap[testSteps[currentStepIndex].color] }}
                        >
                          {testSteps[currentStepIndex].word}
                        </span>
                      )}
                      <div className="mt-10 px-6 py-2 bg-slate-50 border border-slate-100 rounded-full text-slate-400 font-bold text-sm tracking-widest uppercase">
                        التالي: {testSteps[currentStepIndex+1]?.word === 'rectangle' ? 'شكل' : testSteps[currentStepIndex+1]?.word || 'نهاية'}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Controls for Examiner */}
              <div className="grid grid-cols-2 gap-8">
                <button 
                  onClick={markError}
                  className="bg-white hover:bg-rose-50 text-rose-600 py-8 rounded-xl font-bold border border-slate-200 shadow-sm transition-all active:scale-95 flex flex-col items-center gap-2 group"
                >
                  <AlertCircle size={40} className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm uppercase tracking-widest mt-1">خطأ (خ)</span>
                </button>
                <button 
                  onClick={markCorrect}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white py-8 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95 flex flex-col items-center gap-2"
                >
                  <CheckCircle2 size={40} />
                  <span className="text-sm uppercase tracking-widest mt-1">إجابة صحيحة (ت)</span>
                </button>
              </div>
            </motion.div>
          )}

          {stage === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col max-w-5xl mx-auto w-full overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">سجل الجلسات</h2>
                  <p className="text-slate-500 text-sm font-medium">عرض وإدارة نتائج الاختبارات السابقة</p>
                </div>
                <button 
                  onClick={() => setStage('info')}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-all font-bold text-sm"
                >
                  <ArrowRight size={16} /> العودة للرئيسية
                </button>
              </div>

              <div className="p-8">
                {historyItems.length === 0 ? (
                  <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <History size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-bold">لا يوجد سجل جلسات حتى الآن</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {historyItems.map((item) => (
                      <div key={item.id} className="bg-white p-6 rounded-xl border border-slate-100 flex items-center justify-between hover:border-indigo-200 transition-colors group shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors font-bold">
                            {item.isSimulation ? <BrainCircuit size={20} /> : item.participant.firstName[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-800">{item.participant.firstName} {item.participant.lastName}</h4>
                              {item.isSimulation && (
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded uppercase tracking-widest">
                                  محاكاة: {item.profileName}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 font-medium">
                              {item.participant.age} سنة • {item.participant.testDate}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-12">
                          <div className="text-center">
                            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">تداخل</span>
                            <span className="text-xl font-black text-indigo-600">{item.results.interferenceScore}</span>
                          </div>
                          <div className="text-center">
                            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">تاريخ التنفيذ</span>
                            <span className="text-sm font-bold text-slate-600">
                              {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('ar-EG') : 'قيد المعالجة'}
                            </span>
                          </div>
                          <button 
                            onClick={() => {
                              setParticipant(item.participant);
                              setResults(item.results);
                              setNotes(item.notes || '');
                              setExaminerObservations(item.examinerObservations || '');
                              setStage('summary');
                            }}
                            className="text-indigo-600 font-bold text-sm bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-all"
                          >
                            عرض التفاصيل
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {stage === 'summary' && (
            <motion.div 
              key="summary"
              ref={summaryRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col max-w-5xl mx-auto w-full overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">نتائج التقييم النهائي</h2>
                  <p className="text-slate-500 text-sm font-medium">المفحوص: {participant.firstName} {participant.lastName} • {participant.testDate}</p>
                </div>
                <button 
                  onClick={resetAll}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-all font-bold text-sm"
                >
                  <RotateCcw size={16} /> جلسة جديدة
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="overflow-hidden border border-slate-100 rounded-xl">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider">نوع الاختبار</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">الترددات (ت)</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">الأخطاء (خ)</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">النتيجة النهائية (ت + 2خ)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[1, 2, 3, 4].map((num) => {
                        const res = results[`test${num}` as keyof typeof results] as TestResult;
                        const titles = ["القراءة (أ)", "القراءة (ب)", "التسمية (ج)", "التداخل (ب)"];
                        return (
                          <tr key={num} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-700">{titles[num-1]}</td>
                            <td className="px-6 py-4 text-center font-black text-slate-800 text-lg">{res.frequency}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full font-bold">{res.errors}</span>
                            </td>
                            <td className="px-6 py-4 text-center text-indigo-600 font-black text-xl">
                              {calculateFinalResult(res)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                      <TrendingUp size={18} className="text-indigo-500" />
                      الأداء عبر البطاقات
                    </h3>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748B', fontSize: 12, fontWeight: 700 }}
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748B', fontSize: 12 }} 
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: '#F1F5F9' }}
                          />
                          <Bar dataKey="frequency" name="الترددات" radius={[4, 4, 0, 0]} barSize={32}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill="#4F46E5" />
                            ))}
                          </Bar>
                          <Bar dataKey="errors" name="الأخطاء" fill="#F43F5E" radius={[4, 4, 0, 0]} barSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                      <MessageSquare size={18} className="text-indigo-500" />
                      ملاحظات المحلل السريري
                    </h3>
                    <textarea
                      placeholder="أضف ملاحظاتك أو انطباعاتك المهنية حول سلوك المفحوص واستجابته..."
                      className="w-full h-[240px] bg-slate-50 border border-slate-100 rounded-lg p-4 outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none font-medium text-slate-700"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <div className="mt-4 flex justify-end">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">يتم حفظ الملاحظات تلقائياً مع الجلسة عند الانتهاء</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <FileText size={18} className="text-indigo-500" />
                    ملاحظات الفاحص والتدريب
                  </h3>
                  <textarea
                    placeholder="سجل أي ملاحظات بخصوص عملية التدريب أو الأداء الملحوظ أثناء الجلسة..."
                    className="w-full h-[160px] bg-slate-50 border border-slate-100 rounded-lg p-4 outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none font-medium text-slate-700"
                    value={examinerObservations}
                    onChange={(e) => setExaminerObservations(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-indigo-600 rounded-xl p-8 text-white shadow-lg shadow-indigo-100 flex items-center justify-between border-r-8 border-indigo-400">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/10 p-4 rounded-lg">
                        <TrendingUp size={32} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold tracking-tight">قيمة التداخل (Interference)</h3>
                        <p className="text-xs opacity-70 mt-1 uppercase tracking-widest font-medium">Test 3 - Test 4</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-6xl font-black leading-none">{results.interferenceScore}</span>
                      <span className="block text-xs font-bold opacity-70 mt-1">كف الاستجابة</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-center">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                       <ClipboardCheck size={20} className="text-indigo-500" />
                       ملاحظات التصحيح
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 font-medium border border-slate-100">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>الترددات (ت): الإجابات الصحيحة في 45 ثانية.</span>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 font-medium border border-slate-100">
                        <AlertCircle size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                        <span>النتيجة النهائية = ت + 2خ.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row gap-4 justify-center items-center">
                <button 
                  onClick={handleDownloadPDF}
                  disabled={isExporting}
                  className="w-full max-w-sm py-4 bg-indigo-600 text-white rounded-lg font-bold shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isExporting ? (
                     <> جاري التحميل... </>
                  ) : (
                     <> <FileText size={20} /> تحميل ملف PDF </>
                  )}
                </button>
                <button 
                  onClick={() => window.print()}
                  className="w-full max-w-sm py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                >
                  <ClipboardCheck size={20} /> طباعة التقرير
                </button>
                <button 
                  onClick={async () => {
                    const text = `
تقرير اختبار سترووب (Stroop Test)
--------------------------------
بيانات المشارك:
- الاسم: ${participant.firstName} ${participant.lastName}
- العمر: ${participant.age}
- التاريخ: ${participant.testDate}

النتائج (الترددات ت | الأخطاء خ | النتيجة النهائية):
1. القراءة (أ): ${results.test1.frequency} | ${results.test1.errors} | ${calculateFinalResult(results.test1)}
2. القراءة (ب): ${results.test2.frequency} | ${results.test2.errors} | ${calculateFinalResult(results.test2)}
3. التسمية (ج): ${results.test3.frequency} | ${results.test3.errors} | ${calculateFinalResult(results.test3)}
4. التداخل (ب): ${results.test4.frequency} | ${results.test4.errors} | ${calculateFinalResult(results.test4)}

قيمة التداخل النهائية: ${results.interferenceScore}
--------------------------------
تم التوليد بواسطة تطبيق اختبار سترووب الرقمي.
                    `.trim();

                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: 'نتائج اختبار سترووب',
                          text: text,
                        });
                      } catch (err) {
                        console.error('Error sharing:', err);
                      }
                    } else {
                      await navigator.clipboard.writeText(text);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  className="w-full max-w-sm py-4 bg-indigo-600 text-white rounded-lg font-bold shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <> <CheckCircle2 size={20} /> تم النسخ! </>
                  ) : (
                    <> {navigator.share ? <Share2 size={20} /> : <Copy size={20} />} مشاركة النتائج </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      {/* Footer / Credits */}
      <footer className="mt-auto py-12 px-8 border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-right">
          <div className="flex flex-col gap-1">
            <p className="text-slate-800 font-black text-lg">إعداد وبرمجة: دكتور. أحمد حمدي عاشور الغول</p>
            <p className="text-slate-500 text-sm font-bold">دكتوراه في علم النفس التربوي وخبير مايكروسوفت لتكنولوجيا المعلومات</p>
            {user?.email === 'ashoorgool2003@gmail.com' && (
              <a 
                href="https://console.firebase.google.com/project/annular-hexagon-481017-v4/firestore/databases/ai-studio-741bc19d-4ec4-4aab-9038-c49ad720f53a/data"
                target="_blank"
                rel="noreferrer"
                className="mt-2 text-indigo-600 hover:underline font-bold text-xs flex items-center gap-1 justify-center md:justify-start"
              >
                الدخول إلى قاعدة البيانات (Firebase Console) <ArrowRight size={12} />
              </a>
            )}
          </div>
          <div className="flex gap-4 opacity-50">
            <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
              <Cpu size={20} />
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
              <ClipboardCheck size={20} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

