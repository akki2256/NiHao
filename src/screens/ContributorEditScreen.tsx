import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Field, PrimaryButton, Screen, Subtitle, Title } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export function ContributorEditScreen() {
  const { user, refreshUser } = useAuth();
  const navigation = useNavigation();
  const [display_name, setName] = useState(user?.display_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    if (!user || busy) return;
    try {
      setBusy(true);
      const next = await api.updateContributorProfile(
        {
          display_name: display_name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        },
        password,
      );
      await refreshUser(next);
      Alert.alert('Saved', 'Profile updated');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Title>My profile</Title>
      <Subtitle>@{user?.username}</Subtitle>
      <Field label="Display name" icon="person-outline" value={display_name} onChangeText={setName} />
      <Field
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        label="Phone"
        icon="call-outline"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <Field
        label="New password (optional)"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <PrimaryButton icon="save-outline" label={busy ? 'Saving…' : 'Save'} onPress={onSave} loading={busy} />
    </Screen>
  );
}
