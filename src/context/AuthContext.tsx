import * as LocalAuthentication from 'expo-local-authentication';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '../services/api';
import { registerForPush } from '../services/notifications';
import {
  clearSession,
  getBioEnabled,
  loadSession,
  saveSession,
  setBioEnabled,
} from '../services/session';
import { Contributor } from '../types/models';

type AuthContextValue = {
  user: Contributor | null;
  loading: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  refreshUser: (next: Contributor) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Contributor | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        try {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          setBiometricAvailable(hasHardware && enrolled);
        } catch {
          setBiometricAvailable(false);
        }

        const bio = await getBioEnabled();
        setBiometricEnabledState(bio);
        // Keep session for later biometric unlock; do not auto-login.
        await loadSession();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistSession = async (
    next: Contributor,
    token: string,
    enableBio: boolean,
  ) => {
    api.setToken(token);
    await saveSession({ token, user: next });
    if (enableBio) {
      await setBioEnabled(true);
      setBiometricEnabledState(true);
    }
    setUser(next);
    registerForPush().catch(() => undefined);
  };

  const login = useCallback(
    async (identifier: string, password: string) => {
      const result = await api.login(identifier.trim(), password);
      let bioOk = false;
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        bioOk = hasHardware && enrolled;
      } catch {
        bioOk = false;
      }
      await persistSession(result.user, result.token, bioOk);
    },
    [],
  );

  const logout = useCallback(async () => {
    api.setToken('');
    await clearSession();
    setBiometricEnabledState(false);
    setUser(null);
  }, []);

  const unlockWithBiometrics = useCallback(async () => {
    const saved = await loadSession();
    if (!saved) return false;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock NiHao',
        cancelLabel: 'Use password',
        disableDeviceFallback: true,
      });
      if (!result.success) return false;
    } catch {
      return false;
    }

    api.setToken(saved.token);
    setUser(saved.user);
    registerForPush().catch(() => undefined);
    return true;
  }, []);

  const refreshUser = useCallback(async (next: Contributor) => {
    const current = await loadSession();
    if (!current) return;
    await saveSession({ token: current.token, user: next });
    setUser(next);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      biometricAvailable,
      biometricEnabled,
      login,
      logout,
      unlockWithBiometrics,
      refreshUser,
    }),
    [
      user,
      loading,
      biometricAvailable,
      biometricEnabled,
      login,
      logout,
      unlockWithBiometrics,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
