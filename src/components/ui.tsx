import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  RefreshControlProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SyncStatus } from '../domain/sync';
import { Palette, radius, spacing, tint } from '../theme/colors';
import { useColors } from '../theme/ThemeContext';
import { useLayout } from '../theme/useLayout';
import { AppIcon, IconName } from './Icon';

export type { IconName };

function useUi() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return { colors, styles };
}

/** Largest the user's system font-size setting may scale our text before layouts break. */
const MAX_FONT_SCALE = 1.3;

export function SyncBanner({
  status,
  message,
}: {
  status: SyncStatus;
  message?: string | null;
}) {
  const { colors, styles } = useUi();
  const meta = {
    synced: { icon: 'cloud-done' as IconName, color: colors.success, label: 'Synced' },
    syncing: { icon: 'sync' as IconName, color: colors.silver, label: 'Syncing' },
    offline: { icon: 'cloud-offline' as IconName, color: colors.warning, label: 'Offline' },
    error: { icon: 'alert-circle' as IconName, color: colors.danger, label: 'Not saved' },
  }[status];
  return (
    <View style={[styles.syncBanner, { backgroundColor: tint(meta.color, 0.14) }]}>
      <AppIcon name={meta.icon} size={18} color={meta.color} />
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.syncText, { color: meta.color }]}>
        {message ? `${meta.label} · ${message}` : meta.label}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                      */
/* -------------------------------------------------------------------------- */

type ScreenProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Wrap content in a keyboard-aware ScrollView (use for forms and detail pages). */
  scroll?: boolean;
  /**
   * True for screens inside the bottom tab bar that hide the navigation header.
   * They draw under the status bar (edge-to-edge), so we pad the top by the inset.
   * Stack screens have a native header that already handles the top inset.
   */
  tab?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Let a parent background (e.g. a gradient) show through. */
  transparent?: boolean;
  /** Extra style for the ScrollView content (only when `scroll`), e.g. to centre content. */
  contentStyle?: ViewStyle;
  syncStatus?: SyncStatus;
  syncMessage?: string | null;
};

/**
 * Base container for every screen. Handles, in one place:
 *  - status-bar / notch / gesture-bar safe areas
 *  - keyboard avoidance (so inputs are never covered)
 *  - page gutters and a max content width on wide screens
 */
export function Screen({
  children,
  style,
  scroll,
  tab,
  refreshControl,
  transparent,
  contentStyle,
  syncStatus,
  syncMessage,
}: ScreenProps) {
  const { colors, styles } = useUi();
  const insets = useSafeAreaInsets();
  const layout = useLayout();

  const outer: ViewStyle = {
    flex: 1,
    backgroundColor: transparent ? 'transparent' : colors.bg,
    paddingTop: tab ? insets.top : 0,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };

  const inner: ViewStyle = {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
  };

  const bottomPad = (tab ? 0 : insets.bottom) + spacing.lg;

  return (
    <View style={outer}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={[inner, style]}>
          {syncStatus ? <SyncBanner status={syncStatus} message={syncMessage} /> : null}
          {scroll ? (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={[
                { paddingBottom: bottomPad + 24 },
                contentStyle,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              refreshControl={refreshControl}
            >
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Bottom padding that FlatLists should use so the last row clears the gesture bar. */
export function useListPadding(tab = false): { paddingBottom: number } {
  const insets = useSafeAreaInsets();
  return { paddingBottom: (tab ? 0 : insets.bottom) + spacing.xl };
}

/* -------------------------------------------------------------------------- */
/* Typography and headers                                                      */
/* -------------------------------------------------------------------------- */

export function Title({ children }: { children: React.ReactNode }) {
  const { styles } = useUi();
  const { s } = useLayout();
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[styles.title, { fontSize: s(28) }]}
    >
      {children}
    </Text>
  );
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  const { styles } = useUi();
  const { s } = useLayout();
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[styles.subtitle, { fontSize: s(14) }]}
    >
      {children}
    </Text>
  );
}

export function IconBubble({
  name,
  color,
  size = 44,
}: {
  name: IconName;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2.4,
        backgroundColor: tint(color),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppIcon name={name} size={Math.round(size * 0.55)} color={color} />
    </View>
  );
}

/** Screen heading with an accent icon bubble and an optional right-hand action. */
export function ScreenHeader({
  icon,
  color,
  title,
  subtitle,
  right,
}: {
  icon: IconName;
  color: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { styles } = useUi();
  const { s } = useLayout();
  return (
    <View style={styles.headerRow}>
      <IconBubble name={icon} color={color} size={s(48)} />
      <View style={styles.headerText}>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.title, { fontSize: s(26) }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={2}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={[styles.headerSub, { fontSize: s(13) }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Meta({ children }: { children: React.ReactNode }) {
  const { styles } = useUi();
  return (
    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.meta}>
      {children}
    </Text>
  );
}

/* -------------------------------------------------------------------------- */
/* Cards, badges, progress                                                     */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  onPress,
  accent,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  /** Colours a thin stripe on the left edge. */
  accent?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { styles } = useUi();
  const accentStyle: ViewStyle | undefined = accent
    ? { borderLeftColor: accent, borderLeftWidth: 4 }
    : undefined;
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          accentStyle,
          style,
          pressed && styles.cardPressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, accentStyle, style]}>{children}</View>;
}

export function StatusBadge({
  label,
  color,
  icon,
}: {
  label: string;
  color: string;
  icon?: IconName;
}) {
  const { styles } = useUi();
  return (
    <View style={[styles.badge, { backgroundColor: tint(color, 0.18) }]}>
      {icon ? <AppIcon name={icon} size={13} color={color} /> : null}
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[styles.badgeText, { color }]}
      >
        {label}
      </Text>
    </View>
  );
}

export function ProgressBar({
  progress,
  color,
}: {
  /** 0..1 */
  progress: number;
  color: string;
}) {
  const { styles } = useUi();
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={styles.progressTrack}
    >
      <View
        style={[
          styles.progressFill,
          { width: `${pct * 100}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

/** Small label + value pair for money rows. */
export function Stat({
  label,
  value,
  color,
  align = 'left',
}: {
  label: string;
  value: string;
  color?: string;
  align?: 'left' | 'right' | 'center';
}) {
  const { colors, styles } = useUi();
  const { s } = useLayout();
  const valueColor = color ?? colors.text;
  return (
    <View style={styles.stat}>
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[styles.statLabel, { textAlign: align, fontSize: s(11) }]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[styles.statValue, { color: valueColor, textAlign: align, fontSize: s(16) }]}
      >
        {value}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons and inputs                                                          */
/* -------------------------------------------------------------------------- */

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shows a spinner and blocks further taps (prevents duplicate submissions). */
  loading?: boolean;
  icon?: IconName;
}) {
  const { colors, styles } = useUi();
  const blocked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!blocked, busy: !!loading }}
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.primaryBtn,
        (blocked || pressed) && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.buttonText} />
      ) : icon ? (
        <AppIcon name={icon} size={20} color={colors.buttonText} />
      ) : null}
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.primaryBtnText}>
        {label}
      </Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  icon,
  color,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  color?: string;
}) {
  const { colors, styles } = useUi();
  const tintColor = color ?? colors.silver;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }]}
    >
      {icon ? <AppIcon name={icon} size={20} color={tintColor} /> : null}
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[styles.ghostBtnText, { color: tintColor }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  icon,
  error,
  editable,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  icon?: IconName;
  /** Inline validation message shown under the input. */
  error?: string;
  editable?: boolean;
  maxLength?: number;
}) {
  const { colors, styles } = useUi();
  return (
    <View style={styles.fieldWrap}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.fieldLabel}>
        {label}
      </Text>
      <View
        style={[
          styles.inputRow,
          multiline && { alignItems: 'flex-start' },
          !!error && { borderColor: colors.danger },
        ]}
      >
        {icon ? (
          <View style={multiline ? { marginTop: 14 } : undefined}>
            <AppIcon name={icon} size={20} color={colors.textMuted} />
          </View>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          maxLength={maxLength}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
      </View>
      {error ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
  color,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
}) {
  const { colors, styles } = useUi();
  const activeColor = color ?? colors.silverBright;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[
        styles.chip,
        active && { backgroundColor: activeColor, borderColor: activeColor },
      ]}
    >
      {icon ? (
        <AppIcon name={icon} size={16} color={active ? '#0A0A0A' : colors.textMuted} />
      ) : null}
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[styles.chipText, active && styles.chipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                    */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  text,
  icon = 'file-tray-outline',
}: {
  text: string;
  icon?: IconName;
}) {
  const { colors, styles } = useUi();
  return (
    <View style={styles.empty}>
      <AppIcon name={icon} size={48} color={colors.textDim} />
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.emptyText}>
        {text}
      </Text>
    </View>
  );
}

export function Loader() {
  const { colors, styles } = useUi();
  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={colors.silverBright} />
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
  flex: { flex: 1 },
  title: {
    color: colors.text,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.md,
  },
  headerText: { flex: 1 },
  headerSub: { color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  stat: { flex: 1, minWidth: 0 },
  statLabel: {
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: { fontWeight: '700', marginTop: 2 },
  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.buttonBg,
    borderRadius: radius.sm,
    minHeight: 50,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.buttonText, fontWeight: '700', fontSize: 16 },
  ghostBtn: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { fontSize: 15, fontWeight: '600' },
  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: {
    color: colors.textMuted,
    marginBottom: 6,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { color: colors.textMuted, fontSize: 14 },
  chipTextActive: { color: '#0A0A0A', fontWeight: '700' },
  empty: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  emptyText: { color: colors.textDim, fontSize: 15 },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: spacing.sm,
  },
  syncText: { flex: 1, fontSize: 13, fontWeight: '700' },
  });
}
