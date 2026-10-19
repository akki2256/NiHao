import { AppIcon } from '../components/Icon';
import React, { useState, useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  EmptyState,
  GhostButton,
  Loader,
  Screen,
  Subtitle,
  Title,
} from '../components/ui';
import { useData } from '../context/DataContext';
import { sectionColors } from '../theme/colors';
import type { Palette } from '../theme/colors';
import { useColors } from '../theme/ThemeContext';
import { formatDate } from '../utils/id';

type DeletedRow = {
  sheet: 'projects' | 'tasks' | 'expenses';
  id: string;
  title: string;
  detail: string;
  version: number;
};

export function RecentlyDeletedScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, loading, setActive, syncStatus, syncMessage } = useData();
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows: DeletedRow[] = [
    ...data.projects
      .filter((p) => p.active_code === 'inactive')
      .map((p) => ({
        sheet: 'projects' as const,
        id: p.project_id,
        title: p.client_name,
        detail: `Project · deleted ${formatDate(p.updated_at)}`,
        version: Number(p.version || 0),
      })),
    ...data.tasks
      .filter((t) => t.active_status === 'inactive')
      .map((t) => ({
        sheet: 'tasks' as const,
        id: t.task_id,
        title: t.task_name,
        detail: `Task · deleted ${formatDate(t.updated_at)}`,
        version: Number(t.version || 0),
      })),
    ...data.expenses
      .filter((e) => e.active_code === 'inactive')
      .map((e) => ({
        sheet: 'expenses' as const,
        id: e.expense_id,
        title: e.title,
        detail: `Expense · deleted ${formatDate(e.updated_at)}`,
        version: Number(e.version || 0),
      })),
  ];

  const restore = (row: DeletedRow) => {
    Alert.alert('Restore this?', `"${row.title}" will show up in its list again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: () => {
          setBusyId(row.id);
          setActive(row.sheet, row.id, true, row.version)
            .catch((error: unknown) => {
              Alert.alert(
                'Could not restore',
                error instanceof Error ? error.message : 'Please try again.',
              );
            })
            .finally(() => setBusyId(null));
        },
      },
    ]);
  };

  if (loading) return <Loader />;

  return (
    <Screen scroll syncStatus={syncStatus} syncMessage={syncMessage}>
      <Title>Recently deleted</Title>
      <Subtitle>Nothing here is gone for good. Restore puts it back.</Subtitle>
      {rows.length === 0 ? (
        <EmptyState icon="checkmark-done-circle-outline" text="Nothing in the bin." />
      ) : (
        rows.map((row) => (
          <Card key={`${row.sheet}:${row.id}`}>
            <View style={styles.row}>
              <AppIcon name="archive-outline" size={22} color={sectionColors.pending} />
              <View style={styles.text}>
                <Text style={styles.title}>{row.title}</Text>
                <Text style={styles.detail}>{row.detail}</Text>
              </View>
            </View>
            <GhostButton
              icon="arrow-undo"
              color={colors.success}
              label={busyId === row.id ? 'Restoring…' : 'Restore'}
              onPress={() => restore(row)}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  detail: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
}
