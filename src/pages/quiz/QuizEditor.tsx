import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Question, QuizProfile } from '../../types';

type EditableQuestion = Omit<Question, 'id' | 'quiz_id' | 'created_at'> & { id?: string };

export default function QuizEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isNew = !id;

  const [title, setTitle] = useState('');
  const [profile, setProfile] = useState<QuizProfile>('fondamental');
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [csvText, setCsvText] = useState('');

  // Load existing quiz
  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: quiz } = await supabase.from('quiz_quizzes').select('*').eq('id', id).single();
      if (quiz) {
        setTitle(quiz.title);
        setProfile(quiz.profile);
      }
      const { data: qs } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', id)
        .order('position');
      if (qs) setQuestions(qs);
    })();
  }, [id, user]);

  // CSV import
  function importCSV(text: string) {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const imported: EditableQuestion[] = lines.map((line, i) => {
      const parts = line.split(';');
      return {
        position: questions.length + i + 1,
        question: parts[0]?.trim() || '',
        correct_answer: parts[1]?.trim() || '',
        wrong1: parts[2]?.trim() || '',
        wrong2: parts[3]?.trim() || null,
        wrong3: parts[4]?.trim() || null,
        duration: parseInt(parts[5]) || (profile === 'fondamental' ? 35 : 25),
        image_url: parts[6]?.trim() || null,
        feedback: parts[7]?.trim() || null,
      };
    }).filter(q => q.question && q.correct_answer);

    setQuestions(prev => [...prev, ...imported]);
    setCsvText('');
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) importCSV(ev.target.result as string);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }

  function addEmptyQuestion() {
    setQuestions(prev => [...prev, {
      position: prev.length + 1,
      question: '',
      correct_answer: '',
      wrong1: '',
      wrong2: '',
      wrong3: '',
      duration: profile === 'fondamental' ? 35 : 25,
      image_url: null,
      feedback: null,
    }]);
  }

  function updateQuestion(index: number, field: keyof EditableQuestion, value: string | number | null) {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, [field]: value } : q));
  }

  function removeQuestion(index: number) {
    setQuestions(prev => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, position: i + 1 })));
  }

  function moveQuestion(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const arr = [...questions];
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    setQuestions(arr.map((q, i) => ({ ...q, position: i + 1 })));
  }

  async function save() {
    if (!title.trim() || questions.length === 0 || !user) return;
    setSaving(true);

    let quizId = id;

    if (isNew) {
      const { data, error } = await supabase
        .from('quiz_quizzes')
        .insert({ teacher_id: user.id, title: title.trim(), profile })
        .select('id')
        .single();
      if (error || !data) { setSaving(false); return; }
      quizId = data.id;
    } else {
      await supabase
        .from('quiz_quizzes')
        .update({ title: title.trim(), profile, updated_at: new Date().toISOString() })
        .eq('id', id);
      // Delete old questions then re-insert
      await supabase.from('quiz_questions').delete().eq('quiz_id', id);
    }

    const rows = questions.map((q, i) => ({
      quiz_id: quizId,
      position: i + 1,
      question: q.question,
      correct_answer: q.correct_answer,
      wrong1: q.wrong1,
      wrong2: q.wrong2 || null,
      wrong3: q.wrong3 || null,
      duration: q.duration,
      image_url: q.image_url || null,
      feedback: q.feedback || null,
    }));

    await supabase.from('quiz_questions').insert(rows);
    setSaving(false);
    navigate('/');
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isNew ? 'Nouveau quiz' : 'Modifier le quiz'}
      </h1>

      {/* Meta */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="quiz-title" className="block text-sm font-semibold text-gray-700 mb-1">
              Titre du quiz
            </label>
            <input
              id="quiz-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ex. : Les fractions en P4"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Profil</label>
            <div className="flex gap-2">
              {(['fondamental', 'secondaire'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setProfile(p)}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold border-2 transition ${
                    profile === p
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {p === 'fondamental' ? '🏫 Fondamental' : '🎓 Secondaire'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Import CSV */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Importer des questions</h2>

        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Fichier CSV (format Live Quiz)</label>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileImport}
            className="text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>

        <div className="text-center text-xs text-gray-400 my-2">— ou coller le CSV —</div>

        <textarea
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500 font-mono"
          placeholder="Question;BonneReponse;Fausse1;Fausse2;Fausse3;Duree;Image"
        />
        {csvText.trim() && (
          <button
            onClick={() => importCSV(csvText)}
            className="mt-2 px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
          >
            Importer
          </button>
        )}

        <p className="text-xs text-gray-400 mt-2">
          Format : Question;BonneReponse;Fausse1;Fausse2;Fausse3;Duree;Image (séparateur ;)
        </p>
      </div>

      {/* Questions */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Questions ({questions.length})
          </h2>
          <button
            onClick={addEmptyQuestion}
            className="text-sm text-indigo-600 font-semibold hover:text-indigo-800 transition"
          >
            + Ajouter
          </button>
        </div>

        {questions.length === 0 ? (
          <div className="text-center py-10 bg-white border border-dashed border-gray-300 rounded-xl">
            <p className="text-gray-400 text-sm">Importez un CSV ou ajoutez des questions manuellement.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-indigo-600">Q{i + 1}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveQuestion(i, -1)} className="text-gray-400 hover:text-gray-600 text-sm px-1" title="Monter">↑</button>
                    <button onClick={() => moveQuestion(i, 1)} className="text-gray-400 hover:text-gray-600 text-sm px-1" title="Descendre">↓</button>
                    <button onClick={() => removeQuestion(i)} className="text-gray-400 hover:text-red-500 text-sm px-1" title="Supprimer">×</button>
                  </div>
                </div>

                <input
                  type="text"
                  value={q.question}
                  onChange={e => updateQuestion(i, 'question', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:outline-none focus:border-indigo-500"
                  placeholder="Texte de la question"
                />

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    value={q.correct_answer}
                    onChange={e => updateQuestion(i, 'correct_answer', e.target.value)}
                    className="px-3 py-2 border-2 border-green-300 bg-green-50 rounded-lg text-sm focus:outline-none focus:border-green-500"
                    placeholder="✅ Bonne réponse"
                  />
                  <input
                    type="text"
                    value={q.wrong1}
                    onChange={e => updateQuestion(i, 'wrong1', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="❌ Mauvaise 1"
                  />
                  <input
                    type="text"
                    value={q.wrong2 ?? ''}
                    onChange={e => updateQuestion(i, 'wrong2', e.target.value || null)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="❌ Mauvaise 2 (optionnel)"
                  />
                  <input
                    type="text"
                    value={q.wrong3 ?? ''}
                    onChange={e => updateQuestion(i, 'wrong3', e.target.value || null)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="❌ Mauvaise 3 (optionnel)"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Durée (s)</label>
                    <input
                      type="number"
                      value={q.duration}
                      onChange={e => updateQuestion(i, 'duration', parseInt(e.target.value) || 30)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                      min={5}
                      max={120}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Image URL</label>
                    <input
                      type="text"
                      value={q.image_url ?? ''}
                      onChange={e => updateQuestion(i, 'image_url', e.target.value || null)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Feedback</label>
                    <input
                      type="text"
                      value={q.feedback ?? ''}
                      onChange={e => updateQuestion(i, 'feedback', e.target.value || null)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                      placeholder="Explication..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-600 font-semibold text-sm hover:border-gray-400 transition"
        >
          Annuler
        </button>
        <button
          onClick={save}
          disabled={saving || !title.trim() || questions.length === 0}
          className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : isNew ? 'Créer le quiz' : 'Enregistrer'}
        </button>
      </div>
    </main>
  );
}
