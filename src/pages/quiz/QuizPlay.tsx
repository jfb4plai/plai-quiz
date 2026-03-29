import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Question, Session, SessionSettings } from '../../types';

type Answer = {
  questionId: string;
  questionText: string;
  given: string;
  correct: string;
  isCorrect: boolean;
  timeUsed: number;
  sos: boolean;
};

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function speak(text: string) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

export default function QuizPlay() {
  const { code } = useParams();

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState('');

  // Student state
  const [studentName, setStudentName] = useState('');
  const [phase, setPhase] = useState<'loading' | 'name' | 'quiz' | 'results'>('loading');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [sosQuestions, setSosQuestions] = useState<number[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [answered, setAnswered] = useState(false);

  // Timer
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Accessibility
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [font, setFont] = useState<'system' | 'opendyslexic' | 'luciole'>('system');
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [showA11y, setShowA11y] = useState(false);

  const settings: SessionSettings = session?.settings ?? {
    shuffle: false, shuffleAnswers: true, tiersTemps: false,
    hideTimer: false, tts: false, noRanking: true, feedback: 'immediate',
    font: 'system', fontSize: 'normal', spacing: 'normal', contrast: 'normal',
  };

  // Load session + questions
  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data: sess } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('code', code)
        .in('status', ['waiting', 'active'])
        .single();

      if (!sess) {
        setError('Session introuvable ou terminée.');
        setPhase('loading');
        return;
      }
      setSession(sess);

      const { data: qs } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', sess.quiz_id)
        .order('position');

      if (!qs || qs.length === 0) {
        setError('Aucune question trouvée.');
        return;
      }

      const ordered = sess.settings?.shuffle ? shuffleArray(qs) : qs;
      setQuestions(ordered);
      setPhase('name');

      // Apply session accessibility defaults
      if (sess.settings?.font) setFont(sess.settings.font);
      if (sess.settings?.fontSize) setFontSize(sess.settings.fontSize);
      if (sess.settings?.tts) setTtsEnabled(true);
    })();
  }, [code]);

  // Timer tick
  useEffect(() => {
    if (phase !== 'quiz' || answered) return;
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentIndex, phase, answered]);

  const currentQ = questions[currentIndex];
  const total = questions.length;

  function startQuiz() {
    if (!studentName.trim()) return;
    setStartTime(Date.now());
    setPhase('quiz');
    startQuestion(0);
  }

  function startQuestion(idx: number) {
    setCurrentIndex(idx);
    setAnswered(false);
    const q = questions[idx];
    if (!q) return;

    let dur = q.duration;
    if (settings.tiersTemps) dur = Math.ceil(dur * 1.33);
    setTimeLeft(dur);

    if (ttsEnabled || settings.tts) {
      speak(q.question);
    }
  }

  function handleTimeout() {
    if (answered) return;
    setAnswered(true);
    const q = currentQ;
    const answer: Answer = {
      questionId: q.id,
      questionText: q.question,
      given: '(temps écoulé)',
      correct: q.correct_answer,
      isCorrect: false,
      timeUsed: q.duration,
      sos: sosQuestions.includes(currentIndex),
    };
    setAnswers(prev => [...prev, answer]);
    saveResponse(answer);
  }

  const handleAnswer = useCallback((givenText: string, isCorrect: boolean) => {
    if (answered) return;
    setAnswered(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const q = currentQ;
    let dur = q.duration;
    if (settings.tiersTemps) dur = Math.ceil(dur * 1.33);
    const timeUsed = dur - timeLeft;

    const answer: Answer = {
      questionId: q.id,
      questionText: q.question,
      given: givenText,
      correct: q.correct_answer,
      isCorrect,
      timeUsed,
      sos: sosQuestions.includes(currentIndex),
    };
    setAnswers(prev => [...prev, answer]);
    saveResponse(answer);

    if (ttsEnabled || settings.tts) {
      speak(isCorrect ? 'Correct !' : `Incorrect. La bonne réponse était : ${q.correct_answer}`);
    }
  }, [answered, currentQ, timeLeft, settings, ttsEnabled, sosQuestions, currentIndex]);

  async function saveResponse(answer: Answer) {
    if (!session) return;
    await supabase.from('quiz_responses').insert({
      session_id: session.id,
      student_name: studentName.trim(),
      question_id: answer.questionId,
      given_answer: answer.given,
      is_correct: answer.isCorrect,
      time_used: answer.timeUsed,
      sos: answer.sos,
    });
  }

  function nextQuestion() {
    const next = currentIndex + 1;
    if (next >= total) {
      setPhase('results');
      speechSynthesis.cancel();
    } else {
      startQuestion(next);
    }
  }

  function handleSos() {
    setSosQuestions(prev => [...prev, currentIndex]);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== 'quiz') return;
      const keys: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 };
      const idx = keys[e.key.toLowerCase()];
      if (idx !== undefined && !answered) {
        const btns = document.querySelectorAll<HTMLButtonElement>('.answer-btn:not(:disabled)');
        btns[idx]?.click();
      }
      if (e.key === 'Enter' && answered) {
        nextQuestion();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, answered, currentIndex]);

  // Font class
  const fontClass = font === 'opendyslexic' ? 'font-opendyslexic' : font === 'luciole' ? 'font-luciole' : '';
  const sizeClass = fontSize === 'large' ? 'text-[22px]' : fontSize === 'xlarge' ? 'text-[26px]' : 'text-[18px]';

  // Build answer options for current question
  function getShuffledAnswers() {
    if (!currentQ) return [];
    const opts = [
      { text: currentQ.correct_answer, isCorrect: true },
      { text: currentQ.wrong1, isCorrect: false },
      ...(currentQ.wrong2 ? [{ text: currentQ.wrong2, isCorrect: false }] : []),
      ...(currentQ.wrong3 ? [{ text: currentQ.wrong3, isCorrect: false }] : []),
    ];
    return settings.shuffleAnswers ? shuffleArray(opts) : opts;
  }

  // ===== RENDER =====

  // Error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <p className="text-5xl mb-4">😕</p>
          <p className="text-lg text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  // Loading
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-lg">Chargement...</p>
      </div>
    );
  }

  // Name entry
  if (phase === 'name') {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 p-6 ${fontClass} ${sizeClass}`}>
        <div className="text-center w-full max-w-md">
          <p className="text-5xl mb-4">🎯</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">PLAI-Quiz</h1>
          <p className="text-sm text-gray-500 mb-8">Session : {code}</p>

          <input
            type="text"
            value={studentName}
            onChange={e => setStudentName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startQuiz()}
            className="w-full px-6 py-4 border-2 border-gray-300 rounded-xl text-lg text-center focus:outline-none focus:border-indigo-500 mb-4"
            placeholder="Ton prénom"
            maxLength={30}
            autoFocus
          />

          <button
            onClick={startQuiz}
            disabled={!studentName.trim()}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            C'est parti !
          </button>

          <button
            onClick={() => setShowA11y(!showA11y)}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600"
          >
            ⚙️ Accessibilité
          </button>

          {showA11y && (
            <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4 text-left text-sm space-y-3">
              <div>
                <label className="text-xs text-gray-500">Police</label>
                <select value={font} onChange={e => setFont(e.target.value as typeof font)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm">
                  <option value="system">Par défaut</option>
                  <option value="opendyslexic">OpenDyslexic</option>
                  <option value="luciole">Luciole (malvoyance)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Taille</label>
                <select value={fontSize} onChange={e => setFontSize(e.target.value as typeof fontSize)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm">
                  <option value="normal">Normal</option>
                  <option value="large">Grand</option>
                  <option value="xlarge">Très grand</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={ttsEnabled} onChange={e => setTtsEnabled(e.target.checked)} className="accent-indigo-600" />
                <span>🔊 Lecture vocale</span>
              </label>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Quiz
  if (phase === 'quiz' && currentQ) {
    const answerOpts = getShuffledAnswers();
    const letters = ['A', 'B', 'C', 'D'];
    const lastAnswer = answered ? answers[answers.length - 1] : null;

    return (
      <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 ${fontClass} ${sizeClass}`}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-indigo-600">{currentIndex + 1}/{total}</span>
          <div className="flex gap-1 flex-1 mx-4">
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full ${
                i < currentIndex ? (answers[i]?.isCorrect ? 'bg-green-500' : 'bg-red-400') :
                i === currentIndex ? 'bg-indigo-500' : 'bg-gray-200'
              }`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTtsEnabled(!ttsEnabled)} className={`text-lg ${ttsEnabled ? 'text-indigo-600' : 'text-gray-300'}`} title="Lecture vocale">
              🔊
            </button>
          </div>
        </div>

        {/* Timer */}
        {!settings.hideTimer && (
          <div className={`text-center text-3xl font-bold font-mono py-3 ${
            timeLeft <= 5 ? 'text-red-500 animate-pulse' :
            timeLeft <= Math.floor((currentQ.duration * (settings.tiersTemps ? 1.33 : 1)) * 0.3) ? 'text-amber-500' :
            'text-gray-700'
          }`}>
            {timeLeft}s
          </div>
        )}

        {/* Question */}
        <div className="max-w-2xl mx-auto px-4 py-6">
          {currentQ.image_url && (
            <img src={currentQ.image_url} alt="" className="max-w-full max-h-64 mx-auto rounded-xl mb-4" />
          )}

          <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-md p-6 mb-6">
            <p className="text-xl font-semibold text-center leading-relaxed">
              {currentQ.question}
            </p>
          </div>

          {/* Answers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {answerOpts.map((opt, i) => {
              let btnClass = 'bg-white border-2 border-gray-200 hover:border-indigo-400';
              if (answered) {
                if (opt.isCorrect) btnClass = 'bg-green-50 border-2 border-green-500';
                else if (opt.text === lastAnswer?.given && !opt.isCorrect) btnClass = 'bg-red-50 border-2 border-red-400';
                else btnClass = 'bg-white border-2 border-gray-200 opacity-60';
              }

              return (
                <button
                  key={i}
                  className={`answer-btn p-4 rounded-xl text-left flex items-center gap-3 transition ${btnClass}`}
                  onClick={() => handleAnswer(opt.text, opt.isCorrect)}
                  disabled={answered}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    answered && opt.isCorrect ? 'bg-green-500 text-white' :
                    answered && opt.text === lastAnswer?.given && !opt.isCorrect ? 'bg-red-400 text-white' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {letters[i]}
                  </span>
                  <span className="text-sm font-medium">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {answered && settings.feedback !== 'none' && (
            <div className={`mt-4 p-4 rounded-xl ${lastAnswer?.isCorrect ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'}`}>
              <p className="font-semibold text-sm">
                {lastAnswer?.isCorrect ? '✅ Correct !' : `❌ Incorrect. La bonne réponse : ${currentQ.correct_answer}`}
              </p>
              {settings.feedback === 'immediate' && currentQ.feedback && (
                <p className="text-sm text-gray-600 mt-2">{currentQ.feedback}</p>
              )}
            </div>
          )}

          {/* Next */}
          {answered && (
            <div className="text-center mt-6">
              <button
                onClick={nextQuestion}
                className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition"
              >
                {currentIndex + 1 >= total ? 'Voir les résultats' : 'Question suivante →'}
              </button>
            </div>
          )}
        </div>

        {/* SOS */}
        <button
          onClick={handleSos}
          className={`fixed bottom-4 right-4 w-14 h-14 rounded-full shadow-lg text-2xl flex items-center justify-center transition ${
            sosQuestions.includes(currentIndex) ? 'bg-green-500 text-white' : 'bg-amber-400 text-white hover:scale-110'
          }`}
          title="J'ai besoin d'aide"
        >
          {sosQuestions.includes(currentIndex) ? '✓' : '?'}
        </button>
      </div>
    );
  }

  // Results
  if (phase === 'results') {
    const correct = answers.filter(a => a.isCorrect).length;
    const percent = Math.round((correct / total) * 100);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;

    return (
      <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 ${fontClass} ${sizeClass}`}>
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Résultats</h1>
            <p className="text-gray-500">{studentName}</p>
          </div>

          {/* Score */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center mb-6">
            <div className={`w-32 h-32 mx-auto rounded-full border-[6px] flex flex-col items-center justify-center ${
              percent >= 70 ? 'border-green-500 text-green-600' :
              percent >= 40 ? 'border-amber-500 text-amber-600' :
              'border-red-500 text-red-600'
            }`}>
              <span className="text-4xl font-bold">{correct}</span>
              <span className="text-sm text-gray-400">/ {total}</span>
            </div>
            <p className="mt-3 text-lg font-semibold">{percent}%</p>
            <p className="text-sm text-gray-400">Temps : {min}min {sec}s</p>
          </div>

          {/* Detail */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-semibold text-gray-500">#</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-500">Question</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-500">Ta réponse</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-500">Bonne réponse</th>
                </tr>
              </thead>
              <tbody>
                {answers.map((a, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${a.isCorrect ? '' : 'bg-red-50/50'}`}>
                    <td className="px-4 py-2 font-bold text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2">{a.questionText}</td>
                    <td className={`px-4 py-2 font-medium ${a.isCorrect ? 'text-green-600' : 'text-red-500'}`}>{a.given}</td>
                    <td className="px-4 py-2 text-gray-600">{a.correct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SOS */}
          {sosQuestions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-sm font-semibold text-amber-800">
                🙋 SOS demandé aux questions : {sosQuestions.map(q => q + 1).join(', ')}
              </p>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition"
            >
              🖨️ Imprimer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
