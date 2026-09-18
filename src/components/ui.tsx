import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, TextStyle, ViewStyle, StyleProp } from 'react-native';
import { COLORS, SPACING } from '../ui/theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Sub({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.sub, style]}>{children}</Text>;
}

export function Mono({ children, selectable = false, style }: { children: React.ReactNode; selectable?: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <Text selectable={selectable} style={[styles.mono, style]}>
      {children}
    </Text>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  mono = false,
  autoCapitalize = 'none',
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        style={[styles.input, mono && styles.mono]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textDim}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        spellCheck={false}
      />
    </View>
  );
}

export function Btn({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
}) {
  const palette =
    variant === 'ghost'
      ? styles.ghost
      : variant === 'danger'
        ? styles.danger
        : variant === 'success'
          ? styles.success
          : styles.primary;
  return (
    <Pressable style={[styles.btn, palette, (disabled || loading) && styles.btnDisabled]} onPress={onPress} disabled={disabled || loading}>
      <Text style={[styles.btnText, variant === 'ghost' && styles.btnTextGhost]}>
        {loading ? '…' : title}
      </Text>
    </Pressable>
  );
}

export function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <View style={[styles.pill, color ? { borderColor: color } : null]}>
      <Text style={[styles.pillText, color ? { color } : null]}>{children}</Text>
    </View>
  );
}

export function SectionDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  sub: { color: COLORS.textDim, fontSize: 13, lineHeight: 18, marginBottom: SPACING.md },
  mono: { fontFamily: 'monospace', color: COLORS.text, fontSize: 12 },
  label: { color: COLORS.textDim, fontSize: 12, marginBottom: 4 },
  fieldWrap: { marginBottom: SPACING.md },
  input: {
    backgroundColor: COLORS.monoBg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  btn: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnTextGhost: { color: COLORS.accent },
  primary: { backgroundColor: COLORS.accent },
  ghost: { backgroundColor: 'transparent', borderColor: COLORS.accent, borderWidth: 1 },
  danger: { backgroundColor: COLORS.danger },
  success: { backgroundColor: COLORS.mint },
  btnDisabled: { opacity: 0.45 },
  pill: {
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  pillText: { color: COLORS.textDim, fontSize: 11, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
});