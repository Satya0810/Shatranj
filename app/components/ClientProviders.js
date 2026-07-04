'use client';

import { AuthProvider } from './AuthContext';
import AuthModal from './AuthModal';
import { GoogleOAuthProvider } from '@react-oauth/google';

export default function ClientProviders({ children }) {
  const envClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientId = envClientId ? envClientId.trim() : 'dummy-client-id';

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        {children}
        <AuthModal />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
