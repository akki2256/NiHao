import { AppIcon } from '../components/Icon';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  Field,
  GhostButton,
  IconBubble,
  Meta,
  PrimaryButton,
  Screen,
  StatusBadge,
  Subtitle,
  Title,
} from '../components/ui';
import { useData } from '../context/DataContext';
import { RootStackParamList } from '../navigation/types';
import { sectionColors, spacing } from '../theme/colors';
import type { Palette } from '../theme/colors';
import { useColors } from '../theme/ThemeContext';
import { taskStatusColor } from '../theme/status';
import { formatDate } from '../utils/id';

export function TaskDetailScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const route = useRoute<RouteProp<RootStackParamList, 'TaskDetail'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, addTaskComment, setActive, syncStatus, syncMessage } = useData();
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const task = data.tasks.find((t) => t.task_id === route.params.taskId);
  const comments = useMemo(
    () =>
      data.task_comments
        .filter(
          (c) => c.task_id === route.params.taskId && c.active_code === 'active',
        )
        .sort((a, b) => b.added_date.localeCompare(a.added_date)),
    [data.task_comments, route.params.taskId],
  );

  const nameOf = (id: string) =>
    data.contributors.find((c) => c.contributor_id === id)?.display_name || id;

  if (!task) {
    return (
      <Screen>
        <Title>Task not found</Title>
      </Screen>
    );
  }

  const color = taskStatusColor(task.status);

  const onPost = async () => {
    const text = comment.trim();
    if (!text || posting) return;
    try {
      setPosting(true);
      await addTaskComment(task.task_id, text);
      setComment('');
    } catch (e) {
      Alert.alert('Could not post comment', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <Screen scroll syncStatus={syncStatus} syncMessage={syncMessage}>
      <View style={styles.top}>
        <IconBubble
          name={task.status === 'Complete' ? 'checkmark-done' : 'flag'}
          color={color}
          size={52}
        />
        <View style={styles.topText}>
          <Title>{task.task_name}</Title>
          <Subtitle>Company task</Subtitle>
        </View>
      </View>
      <View style={styles.badges}>
        <StatusBadge label={task.status} color={color} />
      </View>
      <GhostButton
        icon="create-outline"
        color={sectionColors.tasks}
        label="Edit task"
        onPress={() => navigation.navigate('TaskForm', { task })}
      />
      <Card>
        <Text style={styles.body}>{task.task_description || 'No description'}</Text>
        <Meta>
          Created by {nameOf(task.created_by)} · {formatDate(task.created_date)}
        </Meta>
      </Card>
      <Card>
        <View style={styles.sectionTitle}>
          <AppIcon name="chatbubbles-outline" size={20} color={colors.silver} />
          <Text style={styles.sectionTitleText}>Comments</Text>
        </View>
        <Field
          label="New comment"
          icon="create-outline"
          value={comment}
          onChangeText={setComment}
          multiline
        />
        <PrimaryButton icon="send" label="Post comment" loading={posting} onPress={onPost} />
        {comments.map((c) => (
          <View key={c.comment_id} style={styles.comment}>
            <Text style={styles.body}>{c.comment}</Text>
            <Meta>
              {nameOf(c.added_by)} · {formatDate(c.added_date)}
            </Meta>
          </View>
        ))}
      </Card>
      <GhostButton
        icon="trash-outline"
        color={colors.danger}
        label="Delete task"
        onPress={() =>
          Alert.alert('Delete this task?', 'You can restore it from Recently deleted.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                setActive('tasks', task.task_id, false, Number(task.version || 0))
                  .then(() => navigation.goBack())
                  .catch((error: unknown) =>
                    Alert.alert(
                      'Could not delete',
                      error instanceof Error ? error.message : 'Please try again.',
                    ),
                  );
              },
            },
          ])
        }
      />
    </Screen>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topText: { flex: 1 },
  badges: { flexDirection: 'row', gap: 8 },
  body: { color: colors.text, fontSize: 15 },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm + 2,
  },
  sectionTitleText: { color: colors.text, fontSize: 17, fontWeight: '700' },
  comment: { marginTop: spacing.md },
});
}
