import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';

/**
 * Names the screens already use (Ionicons-style) mapped to filled Material
 * Community glyphs. Unknown names fall back to the name itself so a direct
 * Material name such as "cog" still works.
 */
const MAP: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  'checkmark-done-circle-outline': 'check-circle',
  'archive-outline': 'archive',
  'arrow-undo': 'undo',
  'create-outline': 'pencil',
  'trash-outline': 'trash-can',
  'chatbubbles-outline': 'chat',
  send: 'send',
  briefcase: 'briefcase',
  'briefcase-outline': 'briefcase-outline',
  'checkbox-outline': 'checkbox-blank-outline',
  'people-outline': 'account-group-outline',
  'wallet-outline': 'wallet-outline',
  'checkmark-circle': 'check-circle',
  'person-circle-outline': 'account-circle',
  'person-circle': 'account-circle',
  'receipt-outline': 'receipt',
  'pricetag-outline': 'tag',
  'checkmark-done-outline': 'check-all',
  'checkmark-done': 'check-all',
  'save-outline': 'content-save',
  'cash-outline': 'cash',
  'add-circle-outline': 'plus-circle',
  'add-circle': 'plus-circle',
  'checkmark-circle-outline': 'check-circle-outline',
  'close-circle-outline': 'close-circle-outline',
  'alert-circle-outline': 'alert-circle',
  'alert-circle': 'alert-circle',
  'close-circle': 'close-circle',
  'arrow-down-circle': 'arrow-down-circle',
  'log-out-outline': 'logout',
  'chevron-forward': 'chevron-right',
  people: 'account-group',
  person: 'account',
  'person-outline': 'account-outline',
  star: 'star',
  'mail-outline': 'email-outline',
  'call-outline': 'phone',
  wallet: 'wallet',
  checkbox: 'checkbox-marked',
  'happy-outline': 'emoticon-happy-outline',
  flag: 'flag',
  'flag-outline': 'flag-outline',
  'stats-chart': 'chart-bar',
  'rocket-outline': 'rocket-launch',
  'cloud-done': 'cloud-check',
  sync: 'sync',
  'cloud-offline': 'cloud-off-outline',
  'lock-closed-outline': 'lock',
  'log-in-outline': 'login',
  'finger-print': 'fingerprint',
  'document-text-outline': 'file-document-outline',
  'calendar-outline': 'calendar',
  flash: 'flash',
  'flash-outline': 'flash',
  repeat: 'repeat',
  'location-outline': 'map-marker',
  'file-tray-outline': 'tray-arrow-down',
  cog: 'cog',
  sunny: 'white-balance-sunny',
  moon: 'moon-waning-crescent',
  'scale-balance': 'scale-balance',
  'hand-coin': 'hand-coin',
  home: 'home',
  'home-outline': 'home-outline',
};

export type IconName = string;

export function AppIcon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color: string;
}) {
  const glyph = MAP[name] ?? (name as React.ComponentProps<typeof MaterialCommunityIcons>['name']);
  return <MaterialCommunityIcons name={glyph} size={size} color={color} />;
}
