import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Question, Response as QuizResponse } from '../../types';

type StudentResult = {
  name: string;
  answers: QuizResponse[];
  correct: number;
  total: number;
  percent: number;
  sosCount: number;
};

type QuestionStat = {
  question: Question;
  correctCount: number;
  totalAnswers: number;
  percent: number;
};

export default function QuizResults() {
  const { code } = useParams();

  const [session, setSession] = useState<{ id: string; quiz_id: string; code: string; mode: string } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'students' | 'questions'>('students');

  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data: sess } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('code', code)
        .single();

      if (!sess) { setLoading(false); return; }
      setSession(sess);

      const [{ data: qs }, { data: rs }] = await Promise.all([
        supabase.from('quiz_questions').select('*').eq('quiz_id', sess.quiz_id).order('position'),
        supabase.from('quiz_responses').select('*').eq('session_id', sess.id).order('created_at'),
      ]);

      if (qs) setQuestions(qs);
      if (rs) setResponses(rs);
      setLoading(false);
    })();
  }, [code]);

  if (loading) {
    return <main className="max-w-4xl mx-auto px-6 py-16 text-center text-gray-400">Chargement...</main>;
  }

  if (!session) {
    return <main className="max-w-4xl mx-auto px-6 py-16 text-center text-gray-500">Session introuvable.</main>;
  }

  // Build student results
  const studentMap = new Map<string, QuizResponse[]>();
  responses.forEach(r => {
    const arr = studentMap.get(r.student_name) ?? [];
    arr.push(r);
    studentMap.set(r.student_name, arr);
  });

  const students: StudentResult[] = Array.from(studentMap.entries()).map(([name, answers]) => {
    const correct = answers.filter(a => a.is_correct).length;
    const total = answers.length;
    return {
      name,
      answers,
      correct,
      total,
      percent: total > 0 ? Math.round((correct / total) * 100) : 0,
      sosCount: answers.filter(a => a.sos).length,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Build question stats
  const questionStats: QuestionStat[] = questions.map(q => {
    const qResponses = responses.filter(r => r.question_id === q.id);
    const correctCount = qResponses.filter(r => r.is_correct).length;
    return {
      question: q,
      correctCount,
      totalAnswers: qResponses.length,
      percent: qResponses.length > 0 ? Math.round((correctCount / qResponses.length) * 100) : 0,
    };
  });

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link
          to={`/${session.quiz_id}/dashboard`}
          className="text-sm text-indigo-600 hover:text-indigo-800 mb-1 inline-block"
        >
          &larr; Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Session {session.code}</h1>
        <p className="text-sm text-gray-500">
          {students.length} élève{students.length !== 1 ? 's' : ''} &middot; {responses.length} réponses
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView('students')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            view === 'students' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-400'
          }`}
        >
          👤 Par élève
        </button>
        <button
          onClick={() => setView('questions')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            view === 'questions' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-400'
          }`}
        >
          📋 Par question
        </button>
        <button
          onClick={() => window.print()}
          className="ml-auto px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm font-semibold hover:border-gray-400 transition"
        >
          🖨️ Imprimer
        </button>
      </div>

      {/* By student */}
      {view === 'students' && (
        <div className="space-y-3">
          {students.length === 0 ? (
            <p className="text-center text-gray-400 py-10">Aucune réponse reçue.</p>
          ) : (
            students.map(s => (
              <div key={s.name} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-800">{s.name}</span>
                    {s.sosCount > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        🙋 {s.sosCount} SOS
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${
                      s.percent >= 70 ? 'text-green-600' : s.percent >= 40 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {s.correct}/{s.total} ({s.percent}%)
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {questions.map((q, qi) => {
                    const resp = s.answers.find(a => a.question_id === q.id);
                    if (!resp) return <div key={qi} className="w-7 h-7 rounded bg-gray-100" />;
                    return (
                      <div
                        key={qi}
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold ${
                          resp.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        }`}
                        title={`Q${qi + 1}: ${resp.is_correct ? 'Correct' : 'Incorrect'} — ${resp.given_answer ?? '(pas de réponse)'}`}
                      >
                        {qi + 1}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* By question */}
      {view === 'questions' && (
        <div className="space-y-3">
          {questionStats.map((qs, i) => (
            <div
              key={qs.question.id}
              className={`bg-white border rounded-xl p-5 shadow-sm ${
                qs.percent < 50 ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-600">Q{i + 1}</span>
                <span className={`text-sm font-bold ${
                  qs.percent >= 70 ? 'text-green-600' : qs.percent >= 40 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {qs.correctCount}/{qs.totalAnswers} ({qs.percent}%)
                </span>
              </div>
              <p className="text-sm text-gray-800 font-medium mb-2">{qs.question.question}</p>

              {/* Bar */}
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${qs.percent >= 70 ? 'bg-green-500' : qs.percent >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${qs.percent}%` }}
                />
              </div>

              {qs.percent < 50 && (
                <p className="text-xs text-red-600 mt-2 font-semibold">
                  ⚠️ Question faible — à retravailler
                </p>
              )}

              <p className="text-xs text-gray-400 mt-1">
                Bonne réponse : {qs.question.correct_answer}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
