import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signIn, signUp, sendPasswordReset } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        setError('Email ou mot de passe incorrect.');
      } else {
        navigate('/');
      }
    } else if (mode === 'reset') {
      const { error } = await sendPasswordReset(email);
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Email envoyé ! Vérifiez votre boîte mail pour créer un nouveau mot de passe.');
      }
    } else {
      if (!displayName.trim()) {
        setError('Le nom est requis.');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, displayName.trim());
      if (error) {
        setError(error.message);
      } else {
        navigate('/');
      }
    }

    setLoading(false);
  };

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {mode === 'login' ? 'Connexion enseignant' : mode === 'reset' ? 'Mot de passe oublié' : 'Créer un compte'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {mode === 'login'
            ? 'Accédez à vos quiz et résultats.'
            : mode === 'reset'
            ? 'Entrez votre email pour recevoir un lien de réinitialisation.'
            : 'Créez votre espace PLAI pour sauvegarder vos quiz.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="displayName" className="block text-sm font-semibold text-gray-700 mb-1">
                Nom affiché
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Mme Dupont"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              placeholder="prenom.nom@ecole.be"
              required
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : mode === 'reset' ? 'Envoyer le lien' : 'Créer le compte'}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          {mode !== 'reset' && (
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }}
              className="block w-full text-sm text-indigo-600 hover:text-indigo-800"
            >
              {mode === 'login' ? 'Pas encore de compte ? Inscrivez-vous' : 'Déjà un compte ? Connectez-vous'}
            </button>
          )}
          {mode === 'login' && (
            <button
              onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
              className="block w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Mot de passe oublié ?
            </button>
          )}
          {mode === 'reset' && (
            <button
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className="block w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Retour à la connexion
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
