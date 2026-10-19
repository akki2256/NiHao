import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useMemo } from 'react';
import { Alert, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Field, GhostButton, PrimaryButton, Screen } from '../components/ui';
import { USE_MOCK } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { spacing } from '../theme/colors';
import type { Palette } from '../theme/colors';
import { useColors } from '../theme/ThemeContext';
import { useLayout } from '../theme/useLayout';

export function LoginScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { login, biometricAvailable, biometricEnabled, unlockWithBiometrics } =
    useAuth();
  const { s } = useLayout();
  const { height } = useWindowDimensions();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Short screens (small phones, split-screen) get a smaller logo so the form stays visible.
  const shortScreen = height < 640;
  const logoSize = shortScreen ? 64 : s(96);

  const onLogin = async () => {
    if (busy) return;
    if (!identifier.trim() || !password) {
      Alert.alert('Missing details', 'Enter username/email/phone and password.');
      return;
    }
    try {
      setBusy(true);
      await login(identifier.trim(), password);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Try again with akhil / Calicon@1234';
      Alert.alert('Login failed', message);
    } finally {
      setBusy(false);
    }
  };

  const onBio = async () => {
    if (busy) return;
    try {
      setBusy(true);
      const ok = await unlockWithBiometrics();
      if (!ok) Alert.alert('Unlock failed', 'Use password to sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={colors.bg === '#0A0A0A' ? ['#000000', '#121212', '#0A0A0A'] : ['#F7F8FA', '#FFFFFF', '#EEF1F4']}
      style={styles.root}
    >
      <Screen
        tab
        scroll
        transparent
        contentStyle={styles.content}
      >
        <View style={[styles.brand, shortScreen && { marginBottom: spacing.md }]}>
          <Image
            source={require('../../assets/calicon-logo.png')}
            style={{ width: logoSize, height: logoSize, marginBottom: spacing.md }}
            resizeMode="contain"
          />
          <Text style={[styles.brandName, { fontSize: s(34) }]}>CALICON</Text>
          <Text style={styles.appName}>NiHao 👋</Text>
          <Text style={styles.tagline}>Work · Tasks · Expenses</Text>
        </View>

        <View style={styles.form}>
          <Field
            label="Username / Email / Phone"
            icon="person-outline"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="akhil"
            autoCapitalize="none"
          />
          <Field
            label="Password"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          <PrimaryButton
            icon="log-in-outline"
            label={busy ? 'Please wait…' : 'Sign in'}
            onPress={onLogin}
            loading={busy}
          />
          {biometricAvailable && biometricEnabled ? (
            <GhostButton
              icon="finger-print"
              label="Unlock with fingerprint"
              onPress={onBio}
            />
          ) : null}
          {USE_MOCK ? (
            <Text style={styles.hint}>
              Demo mode · Akhil / Chiranjeev / Manav · Calicon@1234
            </Text>
          ) : null}
        </View>
      </Screen>
    </LinearGradient>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  brandName: {
    color: colors.silverBright,
    fontWeight: '800',
    letterSpacing: 4,
  },
  appName: {
    color: colors.textMuted,
    marginTop: 6,
    fontSize: 16,
    letterSpacing: 2,
  },
  tagline: { color: colors.textMuted, marginTop: 8, fontSize: 13 },
  form: { marginTop: spacing.md },
  hint: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    fontSize: 12,
    lineHeight: 18,
  },
});
}
