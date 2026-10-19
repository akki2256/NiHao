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
  ProgressBar,
  Screen,
  Stat,
  StatusBadge,
  Subtitle,
  Title,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { summarizeBilling } from '../domain/billing';
import { fromPaise, projectShares, shareOf } from '../domain/shares';
import { RootStackParamList } from '../navigation/types';
import { sectionColors, spacing } from '../theme/colors';
import type { Palette } from '../theme/colors';
import { useColors } from '../theme/ThemeContext';
import { projectStatusColor } from '../theme/status';
import { formatDate, formatMoney } from '../utils/id';

/** Parse a user-typed amount. Returns null when empty or not a finite, non-negative number. */
function parseAmount(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, '');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function ProjectDetailScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const route = useRoute<RouteProp<RootStackParamList, 'ProjectDetail'>>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { data, addProjectComment, addPayment, saveBilling, voidPayment, setActive, syncStatus, syncMessage } =
    useData();
  const [comment, setComment] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [quoted, setQuoted] = useState('');
  const [finalAmt, setFinalAmt] = useState('');
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [busy, setBusy] = useState<'billing' | 'payment' | 'comment' | 'void' | 'delete' | null>(
    null,
  );

  const projectId = route.params.projectId;
  const project = data.projects.find((p) => p.project_id === projectId);
  const billing = data.project_billing.find((b) => b.project_id === projectId);

  const comments = useMemo(
    () =>
      data.project_comments
        .filter((c) => c.project_id === projectId && c.active_code === 'active')
        .sort((a, b) => b.added_date.localeCompare(a.added_date)),
    [data.project_comments, projectId],
  );
  const payments = useMemo(
    () =>
      data.project_payments
        .filter((p) => p.project_id === projectId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.project_payments, projectId],
  );
  const summary = useMemo(
    () => summarizeBilling(billing, payments),
    [billing, payments],
  );
  const shares = useMemo(() => {
    const members = data.project_contributors
      .filter((row) => row.project_id === projectId && row.active_status !== 'inactive')
      .map((row) => row.contributor_id);
    return projectShares(
      billing,
      payments,
      members,
      data.settlements.filter((row) => row.project_id === projectId && !row.expense_id),
    );
  }, [billing, data.project_contributors, data.settlements, payments, projectId]);

  const nameOf = (id: string) =>
    data.contributors.find((c) => c.contributor_id === id)?.display_name || id;

  /** Runs a write with a busy flag (blocks double taps) and a user-visible error. */
  const run = async (
    kind: NonNullable<typeof busy>,
    failTitle: string,
    action: () => Promise<void>,
  ) => {
    if (busy) return;
    try {
      setBusy(kind);
      await action();
    } catch (e) {
      Alert.alert(failTitle, e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (!project) {
    return (
      <Screen>
        <Title>Project not found</Title>
      </Screen>
    );
  }

  const statusColor = projectStatusColor(project.status);
  const percent = Math.round(summary.progress * 100);

  const onSaveBilling = () => {
    if (!billing) return;
    const q = parseAmount(quoted);
    const f = parseAmount(finalAmt);
    if ((quoted.trim() !== '' && q === null) || (finalAmt.trim() !== '' && f === null)) {
      Alert.alert('Check the amounts', 'Enter valid numbers (0 or more).');
      return;
    }
    if (q === null && f === null) {
      Alert.alert('Nothing to save', 'Enter a quoted or final amount first.');
      return;
    }
    void run('billing', 'Could not save billing', async () => {
      await saveBilling({
        ...billing,
        quoted_amount: q ?? billing.quoted_amount,
        final_amount: f ?? billing.final_amount,
      });
      setQuoted('');
      setFinalAmt('');
    });
  };

  const onRecordPayment = () => {
    const amount = parseAmount(paymentAmount);
    if (amount === null || amount <= 0) {
      Alert.alert('Enter an amount', 'Payment must be a number greater than 0.');
      return;
    }
    void run('payment', 'Could not record payment', async () => {
      await addPayment(project.project_id, amount);
      setPaymentAmount('');
    });
  };

  const onPostComment = () => {
    const text = comment.trim();
    if (!text) return;
    void run('comment', 'Could not post comment', async () => {
      await addProjectComment(project.project_id, text);
      setComment('');
    });
  };

  return (
    <Screen scroll syncStatus={syncStatus} syncMessage={syncMessage}>
      <View style={styles.top}>
        <IconBubble name="briefcase" color={statusColor} size={52} />
        <View style={styles.topText}>
          <Title>{project.client_name}</Title>
          <Subtitle>{project.project_type || 'General'}</Subtitle>
        </View>
      </View>
      <View style={styles.badges}>
        <StatusBadge label={project.status} color={statusColor} />
        {summary.billed > 0 && summary.pending === 0 ? (
          <StatusBadge label="Fully paid" color={colors.success} icon="checkmark-circle" />
        ) : null}
      </View>
      <GhostButton
        icon="create-outline"
        label="Edit project"
        onPress={() => navigation.navigate('ProjectForm', { project })}
      />
      <GhostButton
        icon="hand-coin"
        label="Log a transfer for this project"
        onPress={() => navigation.navigate('Balances', { projectId: project.project_id })}
      />

      <Card accent={sectionColors.team}>
        <SectionTitle icon="scale-balance" label="Your share" />
        {shares.memberIds.length === 0 ? (
          <Meta>Add people on this project to split the bill.</Meta>
        ) : (
          <>
            <View style={styles.statRow}>
              <Stat label="Your bill share" value={formatMoney(fromPaise(shareOf(shares.billShares, user?.contributor_id || '')))} />
              <Stat
                label="Your cash share"
                value={formatMoney(fromPaise(shareOf(shares.receivedShares, user?.contributor_id || '')))}
                align="right"
              />
            </View>
            <Meta>
              {shares.gst
                ? `Bill after GST ${formatMoney(fromPaise(shares.billNetPaise))} · GST set aside ${formatMoney(fromPaise(shares.billGstPaise))}`
                : 'No GST on this project'}
            </Meta>
            {shareOf(shares.gstHeld, user?.contributor_id || '') > 0 ? (
              <Meta>
                You are holding {formatMoney(fromPaise(shareOf(shares.gstHeld, user?.contributor_id || '')))} GST. It is not shared.
              </Meta>
            ) : null}
            {shares.edges.filter((edge) => edge.fromId === user?.contributor_id || edge.toId === user?.contributor_id).length === 0 ? (
              <Meta>You are settled with the team on this project.</Meta>
            ) : (
              shares.edges
                .filter((edge) => edge.fromId === user?.contributor_id || edge.toId === user?.contributor_id)
                .map((edge) => (
                  <Meta key={`${edge.fromId}-${edge.toId}`}>
                    {edge.fromId === user?.contributor_id
                      ? `You owe ${nameOf(edge.toId)} ${formatMoney(fromPaise(edge.paise))}`
                      : `${nameOf(edge.fromId)} owes you ${formatMoney(fromPaise(edge.paise))}`}
                  </Meta>
                ))
            )}
          </>
        )}
      </Card>

      <Card>
        <SectionTitle icon="person-circle-outline" label="Contact" />
        <Meta>
          {project.phone || '—'} · {project.email || '—'}
        </Meta>
        <Meta>{project.address || 'No address'}</Meta>
        <Meta>
          Started {formatDate(project.started_date)}
          {project.completed_date
            ? ` · Completed ${formatDate(project.completed_date)}`
            : ''}
        </Meta>
      </Card>

      <Card accent={sectionColors.billing}>
        <SectionTitle icon="receipt-outline" label="Billing" />
        {billing ? (
          <>
            <View style={styles.statRow}>
              <Stat label="Quoted" value={formatMoney(summary.quoted)} />
              <Stat label="Final" value={formatMoney(billing.final_amount)} align="right" />
            </View>
            <View style={[styles.statRow, { marginTop: spacing.sm + 4 }]}>
              <Stat
                label="Received"
                value={formatMoney(summary.received)}
                color={sectionColors.billing}
              />
              <Stat
                label="Pending"
                value={formatMoney(summary.pending)}
                color={summary.pending > 0 ? sectionColors.pending : colors.success}
                align="right"
              />
            </View>
            <View style={styles.progressRow}>
              <View style={styles.flex}>
                <ProgressBar progress={summary.progress} color={sectionColors.billing} />
              </View>
              <Text style={styles.percent}>{percent}%</Text>
            </View>
            <Meta>GST included: {billing.gst_included}</Meta>

            <View style={styles.formGap} />
            <Field
              label="Update quoted (₹)"
              icon="pricetag-outline"
              value={quoted}
              onChangeText={setQuoted}
              keyboardType="numeric"
              placeholder={String(billing.quoted_amount)}
            />
            <Field
              label="Update final (₹)"
              icon="checkmark-done-outline"
              value={finalAmt}
              onChangeText={setFinalAmt}
              keyboardType="numeric"
              placeholder={String(billing.final_amount)}
            />
            <PrimaryButton
              icon="save-outline"
              label="Save billing"
              loading={busy === 'billing'}
              disabled={busy !== null}
              onPress={onSaveBilling}
            />
          </>
        ) : (
          <Meta>No billing row for this project</Meta>
        )}
      </Card>

      <Card accent={sectionColors.expenses}>
        <SectionTitle icon="cash-outline" label="Payments" />
        <Field
          label="Amount received (₹)"
          icon="add-circle-outline"
          value={paymentAmount}
          onChangeText={setPaymentAmount}
          keyboardType="numeric"
          placeholder="10000"
        />
        <PrimaryButton
          icon="checkmark-circle-outline"
          label="Record payment"
          loading={busy === 'payment'}
          disabled={busy !== null}
          onPress={onRecordPayment}
        />
        {payments.length === 0 ? (
          <Meta>No payments recorded yet</Meta>
        ) : (
          payments.map((p) => (
            <View key={p.payment_id} style={styles.paymentBlock}>
              <View style={styles.paymentRow}>
                <AppIcon
                  name={p.voided === 'yes' ? 'close-circle' : 'arrow-down-circle'}
                  size={22}
                  color={p.voided === 'yes' ? colors.danger : sectionColors.billing}
                />
                <View style={styles.flex}>
                  <Text
                    style={[
                      styles.paymentAmount,
                      p.voided === 'yes' && { color: colors.textMuted, textDecorationLine: 'line-through' },
                    ]}
                  >
                    {formatMoney(p.amount)}
                  </Text>
                  <Meta>
                    {formatDate(p.date)} · {nameOf(p.received_by)}
                    {p.voided === 'yes' ? ` · voided (${p.void_reason || 'no reason'})` : ''}
                  </Meta>
                </View>
              </View>
              {p.voided === 'yes' ? null : voidingId === p.payment_id ? (
                <View style={styles.voidBox}>
                  <Field
                    label="Why is this payment wrong?"
                    icon="alert-circle-outline"
                    value={voidReason}
                    onChangeText={setVoidReason}
                  />
                  <PrimaryButton
                    icon="close-circle-outline"
                    label="Confirm void"
                    loading={busy === 'void'}
                    disabled={busy !== null}
                    onPress={() => {
                      const reason = voidReason.trim();
                      if (reason.length < 3) {
                        Alert.alert('Add a reason', 'Say briefly why this payment should be voided.');
                        return;
                      }
                      void run('void', 'Could not void payment', async () => {
                        await voidPayment(p.payment_id, reason);
                        setVoidingId(null);
                        setVoidReason('');
                      });
                    }}
                  />
                </View>
              ) : (
                <GhostButton
                  icon="close-circle-outline"
                  color={colors.danger}
                  label="Void payment"
                  onPress={() => {
                    setVoidingId(p.payment_id);
                    setVoidReason('');
                  }}
                />
              )}
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle icon="chatbubbles-outline" label="Comments" />
        <Field
          label="New comment"
          icon="create-outline"
          value={comment}
          onChangeText={setComment}
          multiline
        />
        <PrimaryButton
          icon="send"
          label="Post comment"
          loading={busy === 'comment'}
          disabled={busy !== null}
          onPress={onPostComment}
        />
        {comments.map((c) => (
          <View key={c.comment_id} style={styles.comment}>
            <Text style={styles.commentText}>{c.comment}</Text>
            <Meta>
              {nameOf(c.added_by)} · {formatDate(c.added_date)}
            </Meta>
          </View>
        ))}
      </Card>

      <GhostButton
        icon="trash-outline"
        color={colors.danger}
        label="Delete project"
        onPress={() =>
          Alert.alert(
            'Delete this project?',
            'It moves to Recently deleted. You can restore it. Payments stay on record.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () =>
                  void run('delete', 'Could not delete', async () => {
                    await setActive('projects', project.project_id, false, Number(project.version || 0));
                    navigation.goBack();
                  }),
              },
            ],
          )
        }
      />
    </Screen>
  );
}

function SectionTitle({
  icon,
  label,
}: {
  icon: string;
  label: string;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.sectionTitle}>
      <AppIcon name={icon} size={20} color={colors.silver} />
      <Text style={styles.sectionTitleText}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topText: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm + 2,
  },
  sectionTitleText: { color: colors.text, fontSize: 17, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.md,
  },
  percent: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  formGap: { height: spacing.md },
  paymentBlock: { marginTop: spacing.md },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  voidBox: { marginTop: spacing.sm },
  paymentAmount: { color: colors.text, fontSize: 16, fontWeight: '700' },
  comment: { marginTop: spacing.md },
  commentText: { color: colors.text, fontSize: 15 },
});
}
