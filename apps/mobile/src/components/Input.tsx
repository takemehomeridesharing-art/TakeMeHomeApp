import { forwardRef, useState, type ReactNode } from 'react';
import { TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { makeStyles, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  /** Helper text under the field. */
  hint?: string;
  /** Error text (turns the border coral and replaces the hint). */
  error?: string | null;
  /** Leading icon. */
  icon?: IconName;
  /** Leading node (e.g. a country prefix); rendered after `icon`. */
  left?: ReactNode;
  /** Trailing node (e.g. a clear button). */
  right?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

/** Labelled text field with focus ring, hint and error. Forwards the TextInput ref. */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, hint, error, icon, left, right, containerStyle, style, onFocus, onBlur, editable = true, ...rest },
  ref,
) {
  const s = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.wrap, containerStyle]}>
      {label ? (
        <Text variant="caption" color="ink" style={s.label}>
          {label}
        </Text>
      ) : null}
      <View style={[s.field, focused ? s.focused : null, error ? s.errored : null, !editable ? s.readonly : null]}>
        {icon ? <Icon name={icon} size={18} color={focused ? 'primary' : 'ink2'} /> : null}
        {left}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.primary}
          editable={editable}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[s.input, style]}
        />
        {right}
      </View>
      {error ? (
        <Text variant="caption" color="coral">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles((t) => ({
  wrap: { gap: 6 },
  label: { fontFamily: t.fonts.bodySemiBold },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
  },
  focused: { borderColor: t.colors.primary },
  errored: { borderColor: t.colors.coral },
  readonly: { backgroundColor: t.colors.bg },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    fontFamily: t.fonts.body,
    fontSize: 16,
    color: t.colors.ink,
    paddingVertical: 12,
    outlineStyle: 'none',
  } as object,
}));
