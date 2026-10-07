import { type Place } from '@tmh/shared';
import { Pressable, View } from 'react-native';
import { BottomSheet, Icon, Text } from '@/components';
import { usePlaces } from '@/lib/queries';
import { makeStyles } from '@/theme';

export interface PlaceSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  selectedId?: string | null;
  /** Shown but not selectable (e.g. the other end of the trip). */
  disabledId?: string | null;
  onSelect: (place: Place) => void;
}

/** Bottom sheet with the named Kigali places and their landmarks. */
export function PlaceSheet({ visible, onClose, title, subtitle, selectedId, disabledId, onSelect }: PlaceSheetProps) {
  const s = useStyles();
  const { data: places = [] } = usePlaces();
  const sorted = [...places].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle ?? 'Named pickup points with a landmark everyone knows'}>
      <View>
        {sorted.map((p, i) => {
          const selected = p.id === selectedId;
          const disabled = p.id === disabledId;
          return (
            <Pressable
              key={p.id}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              onPress={() => {
                onSelect(p);
                onClose();
              }}
              style={({ pressed }) => [s.row, i < sorted.length - 1 ? s.divider : null, pressed ? s.pressed : null, disabled ? s.disabled : null]}
              testID={`place-${p.id}`}
            >
              <View style={[s.pin, selected ? s.pinSelected : null]}>
                <Icon name={selected ? 'location' : 'location-outline'} size={18} color={selected ? 'onPrimary' : 'primary'} />
              </View>
              <View style={s.texts}>
                <Text variant="bodyStrong">{p.name}</Text>
                <Text variant="caption" numberOfLines={1}>
                  {p.landmark}
                </Text>
              </View>
              {selected ? <Icon name="checkmark-circle" size={22} color="primary" /> : disabled ? <Text variant="caption">Other end</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: t.colors.line },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  pin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: t.colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSelected: { backgroundColor: t.colors.primary },
  texts: { flex: 1, gap: 1 },
}));
