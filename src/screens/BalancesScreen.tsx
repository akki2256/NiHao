import { RouteProp, useRoute } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Chip, Field, GhostButton, Meta, PrimaryButton, Screen, Title } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { companyBalances, fromPaise } from '../domain/shares';
import { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme/ThemeContext';
import { formatMoney } from '../utils/id';

type LinkKind = 'none' | 'project' | 'expense';

export function BalancesScreen() {
  const colors = useColors();
  const route = useRoute<RouteProp<RootStackParamList, 'Balances'>>();
  const { user } = useAuth();
  const { data, addSettlement, voidSettlement, syncStatus, syncMessage } = useData();
  const presetProject = route.params?.projectId || '';

  const [showForm, setShowForm] = useState(!!presetProject);
  const [fromId, setFromId] = useState(user?.contributor_id || '');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [link, setLink] = useState<LinkKind>(presetProject ? 'project' : 'none');
  const [projectId, setProjectId] = useState(presetProject);
  const [expenseId, setExpenseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const people = data.contributors.filter((c) => c.active_code === 'active');
  const projects = data.projects.filter((p) => p.active_code !== 'inactive');
  const expenses = data.expenses.filter((e) => e.active_code !== 'inactive');
  const nameOf = (id: string) =>
    data.contributors.find((c) => c.contributor_id === id)?.display_name || 'Someone';

  const edges = useMemo(() => companyBalances(data), [data]);
  const mine = edges.filter((edge) => edge.fromId === user?.contributor_id || edge.toId === user?.contributor_id);
  const rows = mine.length ? mine : edges;

  const transfers = data.settlements
    .filter((row) => row.voided !== 'yes')
    .slice()
    .reverse();

  const onSave = async () => {
    if (busy) return;
    const value = Number(amount);
    if (!fromId || !toId || fromId === toId) {
      Alert.alert('Choose two different people');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Enter an amount');
      return;
    }
    if (link === 'project' && !projectId) {
      Alert.alert('Choose a project');
      return;
    }
    if (link === 'expense' && !expenseId) {
      Alert.alert('Choose an expense');
      return;
    }
    try {
      setBusy(true);
      await addSettlement({
        fromId,
        toId,
        amount: value,
        date,
        projectId: link === 'project' ? projectId : '',
        expenseId: link === 'expense' ? expenseId : '',
        note: note.trim(),
      });
      setAmount('');
      setNote('');
      setShowForm(false);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const onVoid = async (settlementId: string) => {
    const reason = voidReason.trim();
    if (!reason) {
      Alert.alert('Add a reason', 'Say why this transfer should be voided.');
      return;
    }
    try {
      await voidSettlement(settlementId, reason);
      setVoidingId(null);
      setVoidReason('');
    } catch (e) {
      Alert.alert('Could not void', e instanceof Error ? e.message : 'Try again');
    }
  };

  return (
    <Screen scroll syncStatus={syncStatus} syncMessage={syncMessage}>
      <Title>Balances</Title>
      <Text style={{ color: colors.textMuted, marginBottom: 12 }}>
        Company-wide. A project debt and an expense debt between the same two people are added together.
      </Text>

      {rows.length === 0 ? (
        <Text style={{ color: colors.text, marginBottom: 16 }}>Everyone is settled.</Text>
      ) : (
        rows.map((edge) => {
          const youOwe = edge.fromId === user?.contributor_id;
          const youAreOwed = edge.toId === user?.contributor_id;
          const line = youOwe
            ? `You owe ${nameOf(edge.toId)}`
            : youAreOwed
              ? `${nameOf(edge.fromId)} owes you`
              : `${nameOf(edge.fromId)} owes ${nameOf(edge.toId)}`;
          return (
            <View key={`${edge.fromId}-${edge.toId}`} style={{ marginBottom: 10 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{line}</Text>
              <Text style={{ color: youOwe ? colors.danger : colors.success, fontSize: 18, fontWeight: '800' }}>
                {formatMoney(fromPaise(edge.paise))}
              </Text>
            </View>
          );
        })
      )}

      <GhostButton
        icon="hand-coin"
        label={showForm ? 'Hide transfer form' : 'Log a transfer'}
        onPress={() => setShowForm((open) => !open)}
      />

      {showForm ? (
        <View>
          <Text style={{ color: colors.textMuted, marginTop: 8, marginBottom: 6 }}>From</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {people.map((person) => (
              <Chip
                key={person.contributor_id}
                label={person.display_name}
                active={fromId === person.contributor_id}
                onPress={() => setFromId(person.contributor_id)}
              />
            ))}
          </View>
          <Text style={{ color: colors.textMuted, marginBottom: 6 }}>To</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {people.map((person) => (
              <Chip
                key={person.contributor_id}
                label={person.display_name}
                active={toId === person.contributor_id}
                onPress={() => setToId(person.contributor_id)}
              />
            ))}
          </View>
          <Field label="Amount (₹)" icon="cash-outline" value={amount} onChangeText={setAmount} keyboardType="numeric" />
          <Field label="Date (YYYY-MM-DD)" icon="calendar-outline" value={date} onChangeText={setDate} />
          <Field label="Note" icon="document-text-outline" value={note} onChangeText={setNote} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Chip label="Whole company" active={link === 'none'} onPress={() => setLink('none')} />
            <Chip label="One project" active={link === 'project'} onPress={() => setLink('project')} />
            <Chip label="One expense" active={link === 'expense'} onPress={() => setLink('expense')} />
          </View>
          {link === 'project' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {projects.map((project) => (
                <Chip
                  key={project.project_id}
                  label={project.client_name}
                  active={projectId === project.project_id}
                  onPress={() => setProjectId(project.project_id)}
                />
              ))}
            </View>
          ) : null}
          {link === 'expense' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {expenses.map((expense) => (
                <Chip
                  key={expense.expense_id}
                  label={expense.title}
                  active={expenseId === expense.expense_id}
                  onPress={() => setExpenseId(expense.expense_id)}
                />
              ))}
            </View>
          ) : null}
          <PrimaryButton icon="content-save" label={busy ? 'Saving…' : 'Save transfer'} onPress={onSave} loading={busy} />
        </View>
      ) : null}

      {transfers.length ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>Transfers</Text>
          {transfers.map((row) => (
            <View key={row.settlement_id} style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.text }}>
                {nameOf(row.from_contributor_id)} paid {nameOf(row.to_contributor_id)} {formatMoney(row.amount)}
              </Text>
              <Meta>
                {row.date}
                {row.project_id ? ` · ${projects.find((p) => p.project_id === row.project_id)?.client_name || 'Project'}` : ''}
                {row.expense_id ? ` · ${expenses.find((e) => e.expense_id === row.expense_id)?.title || 'Expense'}` : ''}
                {!row.project_id && !row.expense_id ? ' · Company balance' : ''}
              </Meta>
              {voidingId === row.settlement_id ? (
                <>
                  <Field label="Reason" value={voidReason} onChangeText={setVoidReason} />
                  <PrimaryButton label="Void this transfer" onPress={() => onVoid(row.settlement_id)} />
                </>
              ) : (
                <GhostButton
                  icon="close-circle-outline"
                  label="Void"
                  color={colors.danger}
                  onPress={() => {
                    setVoidingId(row.settlement_id);
                    setVoidReason('');
                  }}
                />
              )}
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
