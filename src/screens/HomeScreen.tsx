import { AppIcon } from '../components/Icon';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Card,
  GhostButton,
  IconBubble,
  IconName,
  Loader,
  Meta,
  Screen,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { sectionColors, spacing } from '../theme/colors';
import type { Palette } from '../theme/colors';
import { useColors } from '../theme/ThemeContext';
import { useLayout } from '../theme/useLayout';
import { formatDate } from '../utils/id';

function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, logout } = useAuth();
  const { data, loading, refresh, syncStatus, syncMessage } = useData();
  const { s } = useLayout();
  const navigation =
    useNavigation<
      CompositeNavigationProp<
        BottomTabNavigationProp<MainTabParamList>,
        NativeStackNavigationProp<RootStackParamList>
      >
    >();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      // DataContext falls back to the cache and flags offline; nothing else to do.
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You will need your password or fingerprint to sign back in.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void logout() },
    ]);

  const stats = useMemo(() => {
    const openProjects = data.projects.filter((p) => p.status === 'In Progress');
    const activeTasks = data.tasks.filter((t) => t.active_status === 'active');
    const activeExpenses = data.expenses.filter((e) => e.active_code === 'active');
    const latest = <T extends { updated_at: string }>(list: T[]) =>
      [...list].sort((a, b) =>
        (b.updated_at || '').localeCompare(a.updated_at || ''),
      )[0];
    return {
      projects: openProjects.length,
      tasks: activeTasks.length,
      expenses: activeExpenses.length,
      lastProject: latest(data.projects),
      lastTask: latest(data.tasks),
      lastExpense: latest(data.expenses),
    };
  }, [data]);

  if (loading) return <Loader />;

  return (
    <Screen
      tab
      scroll
      syncStatus={syncStatus}
      syncMessage={syncMessage}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.silver}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.hello, { fontSize: s(14) }]}>{greeting()} 👋</Text>
          <Text
            numberOfLines={1}
            style={[styles.name, { fontSize: s(30) }]}
          >
            {user?.display_name}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => navigation.navigate('Settings')}
            hitSlop={8}
            style={({ pressed }) => [styles.logout, pressed && { opacity: 0.6 }]}
          >
            <AppIcon name="cog" size={26} color={colors.silver} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log out"
            onPress={confirmLogout}
            hitSlop={8}
            style={({ pressed }) => [styles.logout, pressed && { opacity: 0.6 }]}
          >
            <AppIcon name="log-out-outline" size={26} color={colors.silver} />
          </Pressable>
        </View>
      </View>

      <GhostButton
        icon="scale-balance"
        label="Who owes whom"
        onPress={() => navigation.navigate('Balances')}
      />
      <GhostButton
        icon="trash-outline"
        label="Recently deleted"
        onPress={() => navigation.navigate('RecentlyDeleted')}
      />

      <HomeCard
        icon="briefcase"
        color={sectionColors.projects}
        label="Projects in progress"
        value={stats.projects}
        footer={
          stats.lastProject
            ? `Last: ${stats.lastProject.client_name} (${formatDate(stats.lastProject.updated_at)})`
            : 'Nothing yet'
        }
        onPress={() => navigation.navigate('Projects')}
      />
      <HomeCard
        icon="wallet"
        color={sectionColors.expenses}
        label="Active expenses"
        value={stats.expenses}
        footer={
          stats.lastExpense
            ? `Last: ${stats.lastExpense.title} (${formatDate(stats.lastExpense.updated_at)})`
            : 'Nothing yet'
        }
        onPress={() => navigation.navigate('Expenses')}
      />
      <HomeCard
        icon="checkbox"
        color={sectionColors.tasks}
        label="Active tasks"
        value={stats.tasks}
        footer={
          stats.lastTask
            ? `Last: ${stats.lastTask.task_name} (${formatDate(stats.lastTask.updated_at)})`
            : 'Nothing yet'
        }
        onPress={() => navigation.navigate('Tasks')}
      />
    </Screen>
  );
}

function HomeCard({
  icon,
  color,
  label,
  value,
  footer,
  onPress,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: number;
  footer: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { s } = useLayout();
  return (
    <Card accent={color} onPress={onPress}>
      <View style={styles.cardRow}>
        <IconBubble name={icon} color={color} size={s(52)} />
        <View style={styles.cardText}>
          <Text style={styles.cardLabel}>{label}</Text>
          <Text style={[styles.cardValue, { color, fontSize: s(40) }]}>{value}</Text>
        </View>
        <AppIcon name="chevron-forward" size={22} color={colors.textDim} />
      </View>
      <Meta>{footer}</Meta>
    </Card>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerText: { flex: 1, paddingRight: spacing.sm },
  hello: { color: colors.textMuted },
  name: { color: colors.text, fontWeight: '800', marginTop: 2 },
  logout: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardText: { flex: 1, minWidth: 0 },
  cardLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardValue: { fontWeight: '800', marginTop: 2 },
});
}
