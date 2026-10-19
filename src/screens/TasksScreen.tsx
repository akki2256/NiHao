import { AppIcon } from '../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  EmptyState,
  GhostButton,
  IconBubble,
  Loader,
  Meta,
  Screen,
  ScreenHeader,
  StatusBadge,
  useListPadding,
} from '../components/ui';
import { useData } from '../context/DataContext';
import { RootStackParamList } from '../navigation/types';
import { sectionColors } from '../theme/colors';
import type { Palette } from '../theme/colors';
import { useColors } from '../theme/ThemeContext';
import { taskStatusColor } from '../theme/status';
import { formatDate } from '../utils/id';

export function TasksScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, loading, syncStatus, syncMessage } = useData();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const listPadding = useListPadding(true);

  const tasks = useMemo(
    () =>
      [...data.tasks]
        .filter((t) => t.active_status === 'active')
        .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')),
    [data.tasks],
  );

  if (loading) return <Loader />;

  return (
    <Screen tab syncStatus={syncStatus} syncMessage={syncMessage}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.task_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={listPadding}
        ListHeaderComponent={
          <View>
            <ScreenHeader
              icon="checkbox"
              color={sectionColors.tasks}
              title="Tasks"
              subtitle="Company unbillable work"
            />
            <GhostButton
              icon="add-circle"
              color={sectionColors.tasks}
              label="Add task"
              onPress={() => navigation.navigate('TaskForm', {})}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="happy-outline" text="No tasks yet. Enjoy the calm!" />
        }
        renderItem={({ item }) => {
          const color = taskStatusColor(item.status);
          return (
            <Card
              accent={color}
              onPress={() =>
                navigation.navigate('TaskDetail', { taskId: item.task_id })
              }
            >
              <View style={styles.row}>
                <IconBubble
                  name={item.status === 'Complete' ? 'checkmark-done' : 'flag'}
                  color={color}
                  size={40}
                />
                <View style={styles.text}>
                  <Text numberOfLines={2} style={styles.title}>
                    {item.task_name}
                  </Text>
                  <Meta>Updated {formatDate(item.updated_at)}</Meta>
                </View>
                <AppIcon name="chevron-forward" size={20} color={colors.textDim} />
              </View>
              <View style={styles.badge}>
                <StatusBadge label={item.status || 'Unknown'} color={color} />
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  badge: { marginTop: 10 },
});
}
