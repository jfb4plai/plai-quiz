// ===== PLAI-Quiz Types =====

export type QuizProfile = 'fondamental' | 'secondaire';
export type SessionMode = 'digital' | 'paper';
export type SessionStatus = 'waiting' | 'active' | 'closed';
export type FeedbackMode = 'immediate' | 'result-only' | 'none';

export type Quiz = {
  id: string;
  teacher_id: string;
  title: string;
  profile: QuizProfile;
  created_at: string;
  updated_at: string;
};

export type Question = {
  id: string;
  quiz_id: string;
  position: number;
  question: string;
  correct_answer: string;
  wrong1: string;
  wrong2: string | null;
  wrong3: string | null;
  duration: number;
  image_url: string | null;
  feedback: string | null;
};

export type SessionSettings = {
  shuffle: boolean;
  shuffleAnswers: boolean;
  tiersTemps: boolean;
  hideTimer: boolean;
  tts: boolean;
  noRanking: boolean;
  feedback: FeedbackMode;
  font: 'system' | 'opendyslexic' | 'luciole';
  fontSize: 'normal' | 'large' | 'xlarge';
  spacing: 'normal' | 'large';
  contrast: 'normal' | 'high';
};

export type Session = {
  id: string;
  quiz_id: string;
  teacher_id: string;
  code: string;
  mode: SessionMode;
  settings: SessionSettings;
  status: SessionStatus;
  created_at: string;
  closed_at: string | null;
};

export type Response = {
  id: string;
  session_id: string;
  student_name: string;
  question_id: string;
  given_answer: string | null;
  is_correct: boolean;
  time_used: number | null;
  sos: boolean;
  created_at: string;
};
