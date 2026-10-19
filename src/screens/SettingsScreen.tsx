import React from 'react';
import { View } from 'react-native';
import { Chip, Screen, Subtitle, Title } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';

export function SettingsScreen() {
  const { mode, setMode } = useTheme();

  return (
    <Screen scroll>
      <Title>Settings</Title>
      <Subtitle>Light and dark are saved on this phone. The phone’s own setting is ignored.</Subtitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip icon="sunny" label="Light" active={mode === 'light'} onPress={() => setMode('light')} />
        <Chip icon="moon" label="Dark" active={mode === 'dark'} onPress={() => setMode('dark')} />
      </View>
    </Screen>
  );
}
