import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from '../utils/storage';
import { loginApi, registerApi, logoutApi, googleLoginApi, appleLoginApi, AuthUser, AuthResponse } from '../api/authApi';
import { registerUnauthenticatedCallback } from '../api/apiClient';
import { registerForPushAsync, unregisterPushAsync } from '../hooks/usePushNotifications';
import { track, consumeSignupIntent } from '../utils/analytics';

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthContextType = {
  user: AuthUser | null;   // null = not logged in
  isLoading: boolean;      // true while reading stored session on startup
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  appleLogin: (identityToken: string, nonce?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => Promise<void>;
};

// ─── Storage keys ────────────────────────────────────────────────────────────

const KEY_ACCESS  = 'accessToken';
const KEY_REFRESH = 'refreshToken';
const KEY_USER    = 'user';

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // When any authenticated request gets a 401 that survives token refresh, log out
  useEffect(() => {
    registerUnauthenticatedCallback(clearSession);
  }, []);

  // On app start: try to restore a saved session from encrypted device storage
  useEffect(() => {
    async function restoreSession() {
      try {
        const stored = await SecureStore.getItemAsync(KEY_USER);
        if (stored) {
          setUser(JSON.parse(stored) as AuthUser);
        }
      } catch {
        // Stored data was unreadable — stay logged out, it will be overwritten on next login
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  // Persist tokens + user info to encrypted storage and update state
  async function saveSession(response: AuthResponse, opts: { method: string; isNewAccount?: boolean }) {
    const { accessToken, refreshToken, ...userData } = response;
    setUser(userData); // update state immediately — drives navigation to Home
    try {
      await Promise.all([
        SecureStore.setItemAsync(KEY_ACCESS, accessToken),
        SecureStore.setItemAsync(KEY_REFRESH, refreshToken),
        SecureStore.setItemAsync(KEY_USER, JSON.stringify(userData)),
      ]);
    } catch {
      // Persistence failed — user is logged in for this session but will need
      // to sign in again after a page refresh.
    }
    // Best-effort push registration (native only; no-op on web)
    registerForPushAsync(accessToken);
    // Funnel: account_created fires for a definite new account (email register) or when the
    // user entered sign-in with onboarding signup intent (social — no isNewUser flag yet).
    const hadIntent = await consumeSignupIntent();
    if (opts.isNewAccount || hadIntent) track('account_created', { method: opts.method });
  }

  // Wipe all stored auth data and clear state
  async function clearSession() {
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_ACCESS),
      SecureStore.deleteItemAsync(KEY_REFRESH),
      SecureStore.deleteItemAsync(KEY_USER),
    ]);
    setUser(null);
  }

  async function login(email: string, password: string, rememberMe = true) {
    SecureStore.setSessionMode(!rememberMe);
    const response = await loginApi(email, password);
    await saveSession(response, { method: 'email' });
  }

  async function register(username: string, email: string, password: string) {
    const response = await registerApi(username, email, password);
    await saveSession(response, { method: 'email', isNewAccount: true });
  }

  async function googleLogin(idToken: string) {
    const response = await googleLoginApi(idToken);
    await saveSession(response, { method: 'google' });
  }

  async function appleLogin(identityToken: string, nonce?: string) {
    const response = await appleLoginApi(identityToken, nonce);
    await saveSession(response, { method: 'apple' });
  }

  async function updateUser(updates: Partial<AuthUser>) {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    try {
      await SecureStore.setItemAsync(KEY_USER, JSON.stringify(updated));
    } catch {
      // Persistence failure is non-fatal — state is already updated in memory
    }
  }

  async function logout() {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(KEY_ACCESS),
        SecureStore.getItemAsync(KEY_REFRESH),
      ]);
      if (accessToken && refreshToken) {
        // Deactivate this device's push token, then revoke the refresh token
        await unregisterPushAsync(accessToken);
        await logoutApi(accessToken, refreshToken);
      }
    } catch {
      // Server-side logout failed (token already expired, network issue, etc.)
      // Still clear locally — the user is logged out on this device
    } finally {
      await clearSession();
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, googleLogin, appleLogin, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
