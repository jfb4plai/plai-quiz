import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Quiz } from '../../types';

export default function QuizList() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadQuizzes();
  }, [user]);

  async function loadQuizzes() {
    const { data } = await supabase
      .from('quiz_quizzes')
      .select('*')
      .eq('teacher_id', user!.id)
      .order('updated_at', { ascending: false });
    setQuizzes(data ?? []);
    setLoading(false);
  }

  async function deleteQuiz(id: string) {
    if (!confirm('Supprimer ce quiz et toutes ses questions ?')) return;
    await supabase.from('quiz_quizzes').delete().eq('id', id);
    setQuizzes(prev => prev.filter(q => q.id !== id));
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-16 text-center text-gray-400">
        Chargement...
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes quiz</h1>
          <p className="text-sm text-gray-500">{quizzes.length} quiz enregistré{quizzes.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          to="/new"
          className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition"
        >
          + Nouveau quiz
        </Link>
      </div>

      {quizzes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🎯</p>
          <p className="text-gray-500 mb-6">Vous n'avez pas encore de quiz.</p>
          <Link
            to="/new"
            className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition"
          >
            Créer mon premier quiz
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {quizzes.map(quiz => (
            <div
              key={quiz.id}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between gap-4 hover:shadow-md transition"
            >
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-800 truncate">{quiz.title}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    quiz.profile === 'fondamental'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {quiz.profile === 'fondamental' ? '🏫 Fondamental' : '🎓 Secondaire'}
                  </span>
                  <span className="text-xs text-gray-400">
                    Modifié le {new Date(quiz.updated_at).toLocaleDateString('fr-BE')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  to={`/${quiz.id}/session`}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition"
                  title="Lancer une session"
                >
                  ▶ Lancer
                </Link>
                <Link
                  to={`/${quiz.id}/dashboard`}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-semibold hover:border-indigo-400 hover:text-indigo-600 transition"
                  title="Résultats"
                >
                  📊
                </Link>
                <Link
                  to={`/${quiz.id}/edit`}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-semibold hover:border-indigo-400 hover:text-indigo-600 transition"
                  title="Modifier"
                >
                  ✏️
                </Link>
                <button
                  onClick={() => deleteQuiz(quiz.id)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-400 text-xs font-semibold hover:border-red-400 hover:text-red-600 transition"
                  title="Supprimer"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
