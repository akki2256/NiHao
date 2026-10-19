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
import { formatDate, formatMoney } from '../utils/id';

export function ExpensesScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, loading, syncStatus, syncMessage } = useData();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const listPadding = useListPadding(true);

  const expenses = useMemo(
    () =>
      [...data.expenses]
        .filter((e) => e.active_code === 'active')
        .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')),
    [data.expenses],
  );

  if (loading) return <Loader />;

  return (
    <Screen tab syncStatus={syncStatus} syncMessage={syncMessage}>
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.expense_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={listPadding}
        ListHeaderComponent={
          <View>
            <ScreenHeader
              icon="wallet"
              color={sectionColors.expenses}
              title="Expenses"
              subtitle="Company-wide spending"
            />
            <GhostButton
              icon="add-circle"
              color={sectionColors.expenses}
              label="Add expense"
              onPress={() => navigation.navigate('ExpenseForm', {})}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="cash-outline" text="No expenses yet. Wallet is happy!" />
        }
        renderItem={({ item }) => {
          const recurring = item.recurring_status === 'yes';
          return (
            <Card
              accent={sectionColors.expenses}
              onPress={() =>
                navigation.navigate('ExpenseDetail', {
                  expenseId: item.expense_id,
                })
              }
            >
              <View style={styles.row}>
                <IconBubble
                  name={recurring ? 'repeat' : 'receipt'}
                  color={sectionColors.expenses}
                  size={40}
                />
                <View style={styles.text}>
                  <Text numberOfLines={2} style={styles.title}>
                    {item.title}
                  </Text>
                  <Meta>{formatDate(item.expense_date)}</Meta>
                </View>
                <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
              </View>
              <View style={styles.badge}>
                <StatusBadge
                  label={recurring ? `Recurring · ${item.frequency}` : 'One-time'}
                  color={recurring ? sectionColors.tasks : colors.textMuted}
                  icon={recurring ? 'repeat' : 'flash'}
                />
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
  amount: {
    color: sectionColors.expenses,
    fontSize: 17,
    fontWeight: '800',
    flexShrink: 0,
  },
  badge: { marginTop: 10 },
});
}
