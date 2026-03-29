import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Quiz, Session } from '../../types';

type SessionWithStats = Session & { responseCount: number; studentCount: number };

export default function QuizDashboard() {
  const { id } = useParams();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: q } = await supabase.from('quiz_quizzes').select('*').eq('id', id).single();
      if (q) setQuiz(q);

      const { data: sess } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('quiz_id', id)
        .order('created_at', { ascending: false });

      if (sess) {
        // Get stats for each session
        const withStats: SessionWithStats[] = await Promise.all(
          sess.map(async (s) => {
            const { count } = await supabase
              .from('quiz_responses')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', s.id);

            const { data: students } = await supabase
              .from('quiz_responses')
              .select('student_name')
              .eq('session_id', s.id);

            const uniqueStudents = new Set(students?.map(r => r.student_name) ?? []);

            return { ...s, responseCount: count ?? 0, studentCount: uniqueStudents.size };
          })
        );
        setSessions(withStats);
      }

      setLoading(false);
    })();
  }, [id, user]);

  if (loading) {
    return <main className="max-w-4xl mx-auto px-6 py-16 text-center text-gray-400">Chargement...</main>;
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800 mb-1 inline-block">&larr; Mes quiz</Link>
          <h1 className="text-2xl font-bold text-gray-900">{quiz?.title}</h1>
          <p className="text-sm text-gray-500">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          to={`/${id}/session`}
          className="px-5 py-2.5 rounded-lg bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition"
        >
          ▶ Nouvelle session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400">Aucune session lancée pour ce quiz.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <Link
              key={s.id}
              to={`/session/${s.code}/results`}
              className="block bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-indigo-600">{s.code}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      s.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {s.status === 'active' ? '🟢 En cours' : '⚫ Terminée'}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      s.mode === 'digital' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {s.mode === 'digital' ? '📱 Digital' : '🃏 Papier'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(s.created_at).toLocaleDateString('fr-BE')} à {new Date(s.created_at).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">{s.studentCount} élève{s.studentCount !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-gray-400">{s.responseCount} réponses</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
