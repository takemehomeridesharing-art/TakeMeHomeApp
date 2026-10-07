import { type ReactElement, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles } from '@/theme';
import { Header, type HeaderProps } from './Header';

/** Bottom space to leave under content on tab screens so the floating pill nav doesn't cover it. */
export const TAB_BAR_SPACE = 104;

export interface ScreenProps {
  children?: ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Renders a standard `<Header>` with these props. */
  header?: HeaderProps;
  /** Fully custom header node (instead of `header`). */
  headerNode?: ReactNode;
  /** Sticky footer (e.g. the primary CTA), kept above the keyboard and the home indicator. */
  footer?: ReactNode;
  /** Horizontal content padding (default 20). */
  padding?: number;
  /** Leave room for the floating tab bar (tab screens). */
  tabBarSpace?: boolean;
  /** Skip the top safe-area inset (e.g. content starts with a full-bleed map). */
  edgeToEdgeTop?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Background colour override (default `bg`). */
  background?: string;
  testID?: string;
}

/** Page scaffold: safe area + app background + optional header, scroll, sticky footer and keyboard handling. */
export function Screen({
  children,
  scroll = true,
  header,
  headerNode,
  footer,
  padding = 20,
  tabBarSpace = false,
  edgeToEdgeTop = false,
  refreshControl,
  contentStyle,
  background,
  testID,
}: ScreenProps) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const bottomPad = (tabBarSpace ? TAB_BAR_SPACE : 0) + (footer ? 16 : Math.max(insets.bottom, 16) + 8);
  const content = [{ paddingHorizontal: padding, paddingBottom: bottomPad }, contentStyle];

  return (
    <View testID={testID} style={[s.root, { paddingTop: edgeToEdgeTop ? 0 : insets.top }, background ? { backgroundColor: background } : null]}>
      {headerNode ?? (header ? <Header {...header} /> : null)}
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={s.flex}
            contentContainerStyle={[s.scrollContent, content]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[s.flex, content]}>{children}</View>
        )}
        {footer ? <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + (tabBarSpace ? TAB_BAR_SPACE : 0) }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: t.colors.bg, gap: 10 },
}));
