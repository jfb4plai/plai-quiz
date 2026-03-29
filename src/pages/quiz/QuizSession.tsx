import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Quiz, Question, SessionMode, FeedbackMode, Session } from '../../types';

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function QuizSession() {
  const { id } = useParams();
  const { user } = useAuth();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [session, setSession] = useState<Session | null>(null);

  // Session config
  const [mode, setMode] = useState<SessionMode>('digital');
  const [shuffle, setShuffle] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(true);
  const [tiersTemps, setTiersTemps] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);
  const [tts, setTts] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMode>('immediate');

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: q } = await supabase.from('quiz_quizzes').select('*').eq('id', id).single();
      if (q) {
        setQuiz(q);
        if (q.profile === 'fondamental') setHideTimer(true);
      }
      const { data: qs } = await supabase.from('quiz_questions').select('*').eq('quiz_id', id).order('position');
      if (qs) setQuestions(qs);
    })();
  }, [id, user]);

  async function launch() {
    if (!quiz || !user) return;
    const code = generateCode();
    const settings = {
      shuffle, shuffleAnswers, tiersTemps, hideTimer, tts,
      noRanking: true,
      feedback,
      font: 'system' as const,
      fontSize: 'normal' as const,
      spacing: 'normal' as const,
      contrast: 'normal' as const,
    };

    const { data, error } = await supabase
      .from('quiz_sessions')
      .insert({
        quiz_id: quiz.id,
        teacher_id: user.id,
        code,
        mode,
        settings,
        status: 'active',
      })
      .select()
      .single();

    if (!error && data) setSession(data);
  }

  async function closeSession() {
    if (!session) return;
    await supabase
      .from('quiz_sessions')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', session.id);
    setSession(prev => prev ? { ...prev, status: 'closed' } : null);
  }

  const playUrl = session ? `${window.location.origin}/play/${session.code}` : '';

  if (!quiz) {
    return <main className="max-w-3xl mx-auto px-6 py-16 text-center text-gray-400">Chargement...</main>;
  }

  // Session is active — show projection screen
  if (session && session.status === 'active') {
    return (
      <main className="max-w-2xl mx-auto px-6 py-10 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{quiz.title}</h1>
        <p className="text-sm text-gray-500 mb-8">{questions.length} questions &middot; {mode === 'digital' ? 'Mode digital' : 'Mode papier'}</p>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm mb-8">
          {mode === 'digital' ? (
            <>
              <p className="text-sm text-gray-500 mb-4">Scannez le QR code ou entrez le code :</p>
              <div className="flex flex-col items-center gap-6">
                <QRCodeSVG value={playUrl} size={200} />
                <div className="text-5xl font-mono font-bold text-indigo-600 tracking-widest">
                  {session.code}
                </div>
                <p className="text-xs text-gray-400 break-all">{playUrl}</p>
              </div>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-gray-700 mb-4">Mode papier (Plickers)</p>
              <p className="text-sm text-gray-500">
                Projetez les questions et notez les réponses des élèves manuellement.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Code session : <span className="font-mono font-bold text-indigo-600">{session.code}</span>
              </p>
            </>
          )}
        </div>

        <button
          onClick={closeSession}
          className="px-5 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition"
        >
          Fermer la session
        </button>
      </main>
    );
  }

  // Session closed
  if (session && session.status === 'closed') {
    return (
      <main className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-5xl mb-4">✅</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Session terminée</h1>
        <p className="text-sm text-gray-500 mb-6">Code : {session.code}</p>
        <a
          href={`/${quiz.id}/dashboard`}
          className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition"
        >
          Voir les résultats
        </a>
      </main>
    );
  }

  // Config screen
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{quiz.title}</h1>
      <p className="text-sm text-gray-500 mb-8">{questions.length} questions &middot; {quiz.profile}</p>

      {/* Mode */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Mode de jeu</h2>
        <div className="flex gap-3">
          {([
            { value: 'digital' as const, label: '📱 Digital', desc: 'QR code + appareils élèves' },
            { value: 'paper' as const, label: '🃏 Papier', desc: 'Style Plickers — cartes papier' },
          ]).map(m => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`flex-1 p-4 rounded-xl border-2 text-left transition ${
                mode === m.value
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-semibold text-sm">{m.label}</p>
              <p className="text-xs text-gray-500 mt-1">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Options de session</h2>

        <div className="space-y-3">
          {[
            { label: 'Mélanger les questions', checked: shuffle, set: setShuffle },
            { label: 'Mélanger les réponses', checked: shuffleAnswers, set: setShuffleAnswers },
            { label: '⏱️ Tiers-temps (+33% durée)', checked: tiersTemps, set: setTiersTemps },
            { label: '🚫 Masquer le chrono (élève)', checked: hideTimer, set: setHideTimer },
            { label: '🔊 Lecture vocale des questions', checked: tts, set: setTts },
          ].map(opt => (
            <label key={opt.label} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={opt.checked}
                onChange={e => opt.set(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Feedback</label>
          <select
            value={feedback}
            onChange={e => setFeedback(e.target.value as FeedbackMode)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="immediate">Immédiat (correct/incorrect + explication)</option>
            <option value="result-only">Résultat seul (correct/incorrect)</option>
            <option value="none">Aucun (résultats à la fin)</option>
          </select>
        </div>
      </div>

      {/* Launch */}
      <div className="text-center">
        <button
          onClick={launch}
          className="px-8 py-3 rounded-xl bg-green-600 text-white font-bold text-lg hover:bg-green-700 transition shadow-md"
        >
          ▶ Lancer la session
        </button>
      </div>
    </main>
  );
}
