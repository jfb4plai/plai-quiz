import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import QuizList from './pages/quiz/QuizList';
import QuizEditor from './pages/quiz/QuizEditor';
import QuizSession from './pages/quiz/QuizSession';
import QuizPlay from './pages/quiz/QuizPlay';
import QuizDashboard from './pages/quiz/QuizDashboard';
import QuizResults from './pages/quiz/QuizResults';

function AppShell() {
  const { user, signOut, loading } = useAuth();
  const location = useLocation();

  // Hide navbar/footer on the student play page for a clean view
  const isPlayRoute = location.pathname.startsWith('/play/');

  if (isPlayRoute) {
    return (
      <Routes>
        <Route path="/play/:code" element={<QuizPlay />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-indigo-600">🎯 PLAI-Quiz</span>
            </Link>
            <a
              href="https://portail-plai.vercel.app"
              className="text-xs text-gray-400 hover:text-indigo-600 transition hidden sm:inline"
            >
              ← Portail PLAI
            </a>
          </div>
          <div className="flex items-center gap-3">
            {!loading && user ? (
              <>
                <span className="text-sm text-gray-500 hidden sm:inline">{user.email}</span>
                <button
                  onClick={() => signOut()}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-semibold hover:border-red-400 hover:text-red-600 transition"
                >
                  Déconnexion
                </button>
              </>
            ) : !loading ? (
              <Link
                to="/login"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
              >
                Connexion
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<ProtectedRoute><QuizList /></ProtectedRoute>} />
          <Route path="/new" element={<ProtectedRoute><QuizEditor /></ProtectedRoute>} />
          <Route path="/:id/edit" element={<ProtectedRoute><QuizEditor /></ProtectedRoute>} />
          <Route path="/:id/session" element={<ProtectedRoute><QuizSession /></ProtectedRoute>} />
          <Route path="/:id/dashboard" element={<ProtectedRoute><QuizDashboard /></ProtectedRoute>} />
          <Route path="/session/:code/results" element={<ProtectedRoute><QuizResults /></ProtectedRoute>} />
        </Routes>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 mt-auto">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-xs text-gray-400">
          <span>© 2026 PLAI</span>
          <a
            href="https://portail-plai.vercel.app"
            className="hover:text-indigo-600 transition"
          >
            Portail PLAI
          </a>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
