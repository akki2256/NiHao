import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  Card,
  GhostButton,
  IconBubble,
  Meta,
  Screen,
  StatusBadge,
  Subtitle,
  Title,
} from '../components/ui';
import { useData } from '../context/DataContext';
import { RootStackParamList } from '../navigation/types';
import { sectionColors } from '../theme/colors';
import type { Palette } from '../theme/colors';
import { useColors } from '../theme/ThemeContext';
import { formatDate, formatMoney } from '../utils/id';

export function ExpenseDetailScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const route = useRoute<RouteProp<RootStackParamList, 'ExpenseDetail'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, setActive, syncStatus, syncMessage } = useData();

  const expense = data.expenses.find(
    (e) => e.expense_id === route.params.expenseId,
  );
  const nameOf = (id: string) =>
    data.contributors.find((c) => c.contributor_id === id)?.display_name || id;

  if (!expense) {
    return (
      <Screen>
        <Title>Expense not found</Title>
      </Screen>
    );
  }

  const recurring = expense.recurring_status === 'yes';

  return (
    <Screen scroll syncStatus={syncStatus} syncMessage={syncMessage}>
      <View style={styles.top}>
        <IconBubble
          name={recurring ? 'repeat' : 'receipt'}
          color={sectionColors.expenses}
          size={52}
        />
        <View style={styles.topText}>
          <Title>{expense.title}</Title>
          <Subtitle>{formatMoney(expense.amount)}</Subtitle>
        </View>
      </View>
      <View style={styles.badges}>
        <StatusBadge
          label={recurring ? `Recurring · ${expense.frequency}` : 'One-time'}
          color={recurring ? sectionColors.tasks : colors.textMuted}
          icon={recurring ? 'repeat' : 'flash'}
        />
      </View>
      <GhostButton
        icon="create-outline"
        color={sectionColors.expenses}
        label="Edit expense"
        onPress={() => navigation.navigate('ExpenseForm', { expense })}
      />
      <Card>
        <Text style={styles.body}>{expense.notes || 'No notes'}</Text>
        <Meta>Date {formatDate(expense.expense_date)}</Meta>
        <Meta>Paid by {nameOf(expense.paid_by)}</Meta>
      </Card>
      <GhostButton
        icon="trash-outline"
        color={colors.danger}
        label="Delete expense"
        onPress={() =>
          Alert.alert('Delete this expense?', 'You can restore it from Recently deleted.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                setActive('expenses', expense.expense_id, false, Number(expense.version || 0))
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
});
}
