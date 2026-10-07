import { type ReactNode } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, Icon, Text, type IconName } from '@/components';
import { makeStyles } from '@/theme';

export interface ConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  icon?: IconName;
  /** `primary` (indigo) or `danger` (coral — cancel / no-show only). */
  tone?: 'primary' | 'danger';
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  /** Extra content under the body (e.g. a refund breakdown). */
  children?: ReactNode;
  testID?: string;
}

/** A bottom-sheet confirmation: icon, title, explanation, confirm + "not now". */
export function ConfirmSheet({
  visible,
  onClose,
  title,
  body,
  icon = 'help-circle',
  tone = 'primary',
  confirmLabel,
  cancelLabel = 'Not now',
  onConfirm,
  loading,
  children,
  testID,
}: ConfirmSheetProps) {
  const s = useStyles();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      dismissible={!loading}
      footer={
        <>
          <Button label={confirmLabel} variant={tone === 'danger' ? 'danger' : 'primary'} size="lg" block loading={loading} onPress={onConfirm} testID={testID ? `${testID}-confirm` : undefined} />
          <Button label={cancelLabel} variant="ghost" block onPress={onClose} disabled={loading} />
        </>
      }
    >
      <View style={s.wrap} testID={testID}>
        <View style={[s.circle, tone === 'danger' ? s.circleDanger : null]}>
          <Icon name={icon} size={28} color={tone === 'danger' ? 'coral' : 'primary'} />
        </View>
        <Text variant="h2" align="center">
          {title}
        </Text>
        {body ? (
          <Text variant="body" color="ink2" align="center">
            {body}
          </Text>
        ) : null}
        {children}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { alignItems: 'stretch', gap: 10, paddingTop: 4 },
  circle: { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  circleDanger: { backgroundColor: t.colors.coralWash },
}));
