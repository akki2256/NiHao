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
  ProgressBar,
  Screen,
  ScreenHeader,
  Stat,
  StatusBadge,
  useListPadding,
} from '../components/ui';
import { useData } from '../context/DataContext';
import {
  BillingSummary,
  summarizeBilling,
  sumSummaries,
} from '../domain/billing';
import { RootStackParamList } from '../navigation/types';
import { sectionColors, spacing } from '../theme/colors';
import type { Palette } from '../theme/colors';
import { useColors } from '../theme/ThemeContext';
import { projectStatusColor } from '../theme/status';
import { ProjectPayment } from '../types/models';
import { formatDate, formatMoney } from '../utils/id';

export function ProjectsScreen() {
  const { data, loading, syncStatus, syncMessage } = useData();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const listPadding = useListPadding(true);

  const rows = useMemo(() => {
    const billingByProject = new Map(
      data.project_billing.map((b) => [b.project_id, b]),
    );
    const paymentsByProject = new Map<string, ProjectPayment[]>();
    for (const p of data.project_payments) {
      const list = paymentsByProject.get(p.project_id);
      if (list) list.push(p);
      else paymentsByProject.set(p.project_id, [p]);
    }
    return [...data.projects]
      .filter((project) => project.active_code !== 'inactive')
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .map((project) => ({
        project,
        summary: summarizeBilling(
          billingByProject.get(project.project_id),
          paymentsByProject.get(project.project_id) ?? [],
        ),
      }));
  }, [data.projects, data.project_billing, data.project_payments]);

  const totals = useMemo(
    () => sumSummaries(rows.map((r) => r.summary)),
    [rows],
  );

  if (loading) return <Loader />;

  return (
    <Screen tab syncStatus={syncStatus} syncMessage={syncMessage}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.project.project_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={listPadding}
        ListHeaderComponent={
          <View>
            <ScreenHeader
              icon="briefcase"
              color={sectionColors.projects}
              title="Projects"
              subtitle="Billing and payments at a glance"
            />
            <PortfolioCard
              billed={totals.billed}
              received={totals.received}
              pending={totals.pending}
            />
            <GhostButton
              icon="add-circle"
              color={sectionColors.projects}
              label="Add project"
              onPress={() => navigation.navigate('ProjectForm', {})}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="rocket-outline" text="No projects yet. Add your first one!" />
        }
        renderItem={({ item }) => (
          <ProjectCard
            name={item.project.client_name}
            type={item.project.project_type}
            status={item.project.status}
            updatedAt={item.project.updated_at}
            summary={item.summary}
            onPress={() =>
              navigation.navigate('ProjectDetail', {
                projectId: item.project.project_id,
              })
            }
          />
        )}
      />
    </Screen>
  );
}

function PortfolioCard({
  billed,
  received,
  pending,
}: {
  billed: number;
  received: number;
  pending: number;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Card style={styles.portfolio}>
      <View style={styles.portfolioTitle}>
        <AppIcon name="stats-chart" size={18} color={sectionColors.billing} />
        <Text style={styles.portfolioTitleText}>All projects</Text>
      </View>
      <View style={styles.statRow}>
        <Stat label="Billed" value={formatMoney(billed)} />
        <Stat
          label="Received"
          value={formatMoney(received)}
          color={sectionColors.billing}
          align="center"
        />
        <Stat
          label="Pending"
          value={formatMoney(pending)}
          color={pending > 0 ? sectionColors.pending : colors.success}
          align="right"
        />
      </View>
    </Card>
  );
}

function ProjectCard({
  name,
  type,
  status,
  updatedAt,
  summary,
  onPress,
}: {
  name: string;
  type: string;
  status: string;
  updatedAt: string;
  summary: BillingSummary;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const statusColor = projectStatusColor(status);
  const percent = Math.round(summary.progress * 100);
  const settled = summary.billed > 0 && summary.pending === 0;

  return (
    <Card onPress={onPress} accent={statusColor}>
      <View style={styles.cardTop}>
        <IconBubble name="briefcase" color={statusColor} size={40} />
        <View style={styles.cardTopText}>
          <Text numberOfLines={1} style={styles.cardTitle}>
            {name}
          </Text>
          <Meta>
            {type || 'General'} · Updated {formatDate(updatedAt)}
          </Meta>
        </View>
        <AppIcon name="chevron-forward" size={20} color={colors.textDim} />
      </View>

      <View style={styles.badgeRow}>
        <StatusBadge label={status || 'Unknown'} color={statusColor} />
        {settled ? (
          <StatusBadge label="Fully paid" color={colors.success} icon="checkmark-circle" />
        ) : null}
        {summary.overpaid ? (
          <StatusBadge label="Overpaid" color={colors.danger} icon="alert-circle" />
        ) : null}
      </View>

      <View style={styles.divider} />

      {summary.billed > 0 ? (
        <>
          <View style={styles.statRow}>
            <Stat label="Billed" value={formatMoney(summary.billed)} />
            <Stat
              label="Received"
              value={formatMoney(summary.received)}
              color={sectionColors.billing}
              align="center"
            />
            <Stat
              label="Pending"
              value={formatMoney(summary.pending)}
              color={summary.pending > 0 ? sectionColors.pending : colors.success}
              align="right"
            />
          </View>
          <View style={styles.progressRow}>
            <View style={styles.progressBar}>
              <ProgressBar
                progress={summary.progress}
                color={settled ? colors.success : sectionColors.billing}
              />
            </View>
            <Text style={styles.percent}>{percent}%</Text>
          </View>
        </>
      ) : (
        <View style={styles.inline}>
          <AppIcon name="receipt-outline" size={18} color={colors.textMuted} />
          <Text style={styles.inlineText}>No billing amount set yet</Text>
        </View>
      )}

      <View style={[styles.inline, { marginTop: spacing.sm }]}>
        <AppIcon name="cash-outline" size={18} color={colors.textMuted} />
        <Text style={styles.inlineText} numberOfLines={1}>
          {summary.paymentCount > 0
            ? `${summary.paymentCount} payment${summary.paymentCount === 1 ? '' : 's'} · last ${formatMoney(summary.lastPaymentAmount)} on ${formatDate(summary.lastPaymentDate)}`
            : 'No payments received yet'}
        </Text>
      </View>
    </Card>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  portfolio: { marginBottom: spacing.sm },
  portfolioTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm + 2,
  },
  portfolioTitleText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTopText: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm + 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm + 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.sm + 2,
  },
  progressBar: { flex: 1 },
  percent: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineText: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
});
}
