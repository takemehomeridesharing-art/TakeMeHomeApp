import { type Place } from '@tmh/shared';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BottomSheet, Icon, Input, Text } from '@/components';
import { usePlaces } from '@/lib/queries';
import { makeStyles } from '@/theme';

export interface PlacePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Currently selected place id (checked). */
  selectedId?: string | null;
  /** A place id to hide (e.g. the other end of the journey). */
  excludeId?: string | null;
  onSelect: (place: Place) => void;
}

/** Bottom sheet listing the named Kigali stops with their landmarks, with a quick filter. */
export function PlacePickerSheet({ visible, onClose, title, selectedId, excludeId, onSelect }: PlacePickerSheetProps) {
  const s = useStyles();
  const { data: places = [] } = usePlaces();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...places]
      .filter((p) => p.id !== excludeId)
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.landmark.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [places, q, excludeId]);

  const close = () => {
    setQ('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close} title={title} subtitle="Named stops where drivers pick up and drop off" maxHeightRatio={0.85}>
      <Input value={q} onChangeText={setQ} placeholder="Search a stop or landmark" icon="search" autoCorrect={false} testID="place-filter" />
      <View>
        {list.map((p, i) => {
          const selected = p.id === selectedId;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`place-${p.id}`}
              onPress={() => {
                setQ('');
                onSelect(p);
              }}
              style={({ pressed }) => [s.row, i < list.length - 1 ? s.divider : null, pressed ? s.pressed : null]}
            >
              <View style={[s.pin, selected ? s.pinSelected : null]}>
                <Icon name={selected ? 'checkmark' : 'location'} size={16} color={selected ? 'onPrimary' : 'primary'} />
              </View>
              <View style={s.texts}>
                <Text variant="bodyStrong">{p.name}</Text>
                <Text variant="caption" numberOfLines={1}>
                  {p.landmark}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {list.length === 0 ? (
          <Text variant="caption" align="center" style={s.none}>
            No stop matches “{q}”.
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: t.colors.line },
  pressed: { opacity: 0.6 },
  pin: { width: 34, height: 34, borderRadius: 17, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  pinSelected: { backgroundColor: t.colors.primary },
  texts: { flex: 1, gap: 1 },
  none: { paddingVertical: 24 },
}));
