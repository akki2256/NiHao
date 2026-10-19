import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import {
  Chip,
  Field,
  PrimaryButton,
  Screen,
  Subtitle,
  Title,
} from '../components/ui';
import { useData } from '../context/DataContext';
import { RootStackParamList } from '../navigation/types';
import { taskStatusColor } from '../theme/status';
import { TaskStatus } from '../types/models';

const STATUSES: TaskStatus[] = ['Open', 'In Progress', 'Complete'];

export function TaskFormScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'TaskForm'>>();
  const navigation = useNavigation();
  const { saveTask } = useData();
  const existing = route.params?.task;

  const [task_name, setName] = useState(existing?.task_name || '');
  const [task_description, setDescription] = useState(
    existing?.task_description || '',
  );
  const [status, setStatus] = useState<TaskStatus>(existing?.status || 'Open');
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    if (busy) return;
    if (!task_name.trim()) {
      Alert.alert('Task name required');
      return;
    }
    try {
      setBusy(true);
      await saveTask({
        ...existing,
        task_name: task_name.trim(),
        task_description,
        status,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Title>{existing ? 'Edit task' : 'New task'}</Title>
      <Subtitle>Company-wide unbillable item</Subtitle>
      <Field label="Task name" icon="flag-outline" value={task_name} onChangeText={setName} />
      <Field
        label="Description"
        icon="document-text-outline"
        value={task_description}
        onChangeText={setDescription}
        multiline
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {STATUSES.map((s) => (
          <Chip
            key={s}
            label={s}
            color={taskStatusColor(s)}
            active={status === s}
            onPress={() => setStatus(s)}
          />
        ))}
      </View>
      <PrimaryButton icon="save-outline" label={busy ? 'Saving…' : 'Save'} onPress={onSave} loading={busy} />
    </Screen>
  );
}
