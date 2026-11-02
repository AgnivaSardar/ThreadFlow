import React from 'react';
import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { useAuthStore } from '../features/auth/authStore';

// Helper component for direct magic link URLs: /magic-link/:token
const MagicLinkHandler: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { loginWithMagicLink } = useAuthStore();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (token) {
      loginWithMagicLink(token).catch((err) => {
        setError(err.message || 'Magic link failed');
      });
    }
  }, [token, loginWithMagicLink]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md bg-slate-900 border border-red-800/60 p-6 rounded-2xl text-center">
          <h3 className="text-red-400 font-bold mb-2">Authentication Failed</h3>
          <p className="text-xs text-slate-400 mb-4">{error}</p>
          <a
            href="/login"
            className="inline-block py-2 px-4 bg-sky-400 text-slate-950 rounded-lg text-xs font-bold"
          >
            Return to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="flex items-center gap-3 text-slate-400 text-sm">
        <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <span>Authenticating via secure magic link...</span>
      </div>
    </div>
  );
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/magic-link/:token',
    element: <MagicLinkHandler />,
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);
