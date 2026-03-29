-- ============================================
-- PLAI-Quiz — Schéma Supabase
-- Préfixe quiz_ pour éviter tout conflit
-- À exécuter dans Supabase → SQL Editor
-- ============================================

-- Profils enseignants (extension de auth.users)
CREATE TABLE public.quiz_teachers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  school TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quiz sauvegardés
CREATE TABLE public.quiz_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.quiz_teachers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  profile TEXT NOT NULL CHECK (profile IN ('fondamental', 'secondaire')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Questions d'un quiz
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quiz_quizzes(id) ON DELETE CASCADE,
  position INT NOT NULL,
  question TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  wrong1 TEXT NOT NULL,
  wrong2 TEXT,
  wrong3 TEXT,
  duration INT NOT NULL DEFAULT 30,
  image_url TEXT,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sessions de jeu
CREATE TABLE public.quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quiz_quizzes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.quiz_teachers(id) ON DELETE CASCADE,
  code CHAR(6) NOT NULL UNIQUE,
  mode TEXT NOT NULL CHECK (mode IN ('digital', 'paper')),
  settings JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- Réponses des élèves
CREATE TABLE public.quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  given_answer TEXT,
  is_correct BOOLEAN NOT NULL,
  time_used INT,
  sos BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_quiz_quizzes_teacher ON public.quiz_quizzes(teacher_id);
CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions(quiz_id, position);
CREATE INDEX idx_quiz_sessions_code ON public.quiz_sessions(code);
CREATE INDEX idx_quiz_responses_session ON public.quiz_responses(session_id);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE public.quiz_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;

-- Teachers : son propre profil
CREATE POLICY quiz_teachers_own ON public.quiz_teachers
  FOR ALL USING (id = auth.uid());

-- Quizzes : ses propres quiz
CREATE POLICY quiz_quizzes_own ON public.quiz_quizzes
  FOR ALL USING (teacher_id = auth.uid());

-- Questions : via le quiz du teacher
CREATE POLICY quiz_questions_own ON public.quiz_questions
  FOR ALL USING (
    quiz_id IN (SELECT id FROM public.quiz_quizzes WHERE teacher_id = auth.uid())
  );

-- Sessions : le teacher gère ses sessions
CREATE POLICY quiz_sessions_own ON public.quiz_sessions
  FOR ALL USING (teacher_id = auth.uid());

-- Sessions : les élèves (anon) peuvent LIRE une session active
CREATE POLICY quiz_sessions_student_read ON public.quiz_sessions
  FOR SELECT USING (status IN ('waiting', 'active'));

-- Questions : les élèves (anon) peuvent lire les questions d'une session active
CREATE POLICY quiz_questions_student_read ON public.quiz_questions
  FOR SELECT USING (
    quiz_id IN (SELECT quiz_id FROM public.quiz_sessions WHERE status IN ('waiting', 'active'))
  );

-- Responses : les élèves (anon) peuvent INSÉRER leurs réponses
CREATE POLICY quiz_responses_student_insert ON public.quiz_responses
  FOR INSERT WITH CHECK (
    session_id IN (SELECT id FROM public.quiz_sessions WHERE status = 'active')
  );

-- Responses : le teacher peut tout lire sur ses sessions
CREATE POLICY quiz_responses_teacher_read ON public.quiz_responses
  FOR SELECT USING (
    session_id IN (SELECT id FROM public.quiz_sessions WHERE teacher_id = auth.uid())
  );
