import { type ReactNode } from 'react';
import { BottomSheet, Button, type ButtonVariant, type IconName } from '@/components';

export interface ConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  confirmLabel: string;
  confirmIcon?: IconName;
  confirmVariant?: ButtonVariant;
  cancelLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  children?: ReactNode;
  testID?: string;
}

/** A bottom-sheet confirmation (works on web, unlike `Alert.alert` with buttons). */
export function ConfirmSheet({
  visible,
  onClose,
  title,
  subtitle,
  confirmLabel,
  confirmIcon,
  confirmVariant = 'primary',
  cancelLabel = 'Not now',
  onConfirm,
  loading,
  children,
  testID,
}: ConfirmSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      dismissible={!loading}
      footer={
        <>
          <Button label={confirmLabel} icon={confirmIcon} variant={confirmVariant} size="lg" block loading={loading} onPress={onConfirm} testID={testID} />
          <Button label={cancelLabel} variant="ghost" block disabled={loading} onPress={onClose} />
        </>
      }
    >
      {children}
    </BottomSheet>
  );
}
