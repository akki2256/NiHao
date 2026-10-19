import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { PeoplePicker } from '../components/PeoplePicker';
import {
  Chip,
  Field,
  PrimaryButton,
  Screen,
  Subtitle,
  Title,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { RootStackParamList } from '../navigation/types';
import { RecurringFrequency } from '../types/models';

const FREQ: RecurringFrequency[] = ['Daily', 'Weekly', 'Monthly', 'Yearly'];

export function ExpenseFormScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ExpenseForm'>>();
  const navigation = useNavigation();
  const { data, saveExpense } = useData();
  const { user } = useAuth();
  const existing = route.params?.expense;
  const linked = data.expense_contributors
    .filter((row) => row.expense_id === existing?.expense_id && row.active_status !== 'inactive')
    .map((row) => row.contributor_id);

  const [title, setTitle] = useState(existing?.title || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [amount, setAmount] = useState(
    existing ? String(existing.amount) : '',
  );
  const [expense_date, setDate] = useState(
    existing?.expense_date || new Date().toISOString().slice(0, 10),
  );
  const [recurring, setRecurring] = useState(existing?.recurring_status === 'yes');
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    existing?.frequency || 'Monthly',
  );
  const [people, setPeople] = useState<string[]>(
    linked.length ? linked : user?.contributor_id ? [user.contributor_id] : [],
  );
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    if (busy) return;
    if (!title.trim() || !amount) {
      Alert.alert('Title and amount required');
      return;
    }
    if (!people.length) {
      Alert.alert('Choose at least one person');
      return;
    }
    try {
      setBusy(true);
      await saveExpense({
        ...existing,
        title: title.trim(),
        notes,
        amount: Number(amount),
        expense_date,
        recurring_status: recurring ? 'yes' : 'no',
        frequency: recurring ? frequency : '',
        contributorIds: people,
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
      <Title>{existing ? 'Edit expense' : 'New expense'}</Title>
      <Subtitle>Everyone gets notified</Subtitle>
      <Field label="Title" icon="receipt-outline" value={title} onChangeText={setTitle} />
      <Field
        label="Amount (₹)"
        icon="cash-outline"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />
      <Field label="Date (YYYY-MM-DD)" icon="calendar-outline" value={expense_date} onChangeText={setDate} />
      <Field label="Notes" icon="document-text-outline" value={notes} onChangeText={setNotes} multiline />
      <PeoplePicker
        label="People sharing this expense"
        selected={people}
        onChange={setPeople}
      />
      <Subtitle>No GST. Whoever paid is owed the others’ equal shares.</Subtitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        <Chip icon="flash-outline" label="One-time" active={!recurring} onPress={() => setRecurring(false)} />
        <Chip icon="repeat" label="Recurring" active={recurring} onPress={() => setRecurring(true)} />
      </View>
      {recurring ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
          {FREQ.map((f) => (
            <Chip
              key={f}
              label={f}
              active={frequency === f}
              onPress={() => setFrequency(f)}
            />
          ))}
        </View>
      ) : null}
      <PrimaryButton icon="save-outline" label={busy ? 'Saving…' : 'Save'} onPress={onSave} loading={busy} />
    </Screen>
  );
}
