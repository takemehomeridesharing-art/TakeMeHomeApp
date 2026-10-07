/**
 * Colour tokens. Components never hard-code hex values: they read a `ColorTokens` palette from
 * the theme (`useTheme().colors` or `makeStyles`). Add `darkColors` here later and switch in
 * `ThemeProvider`.
 */
export interface ColorTokens {
  /** App background. */
  bg: string;
  /** Cards, sheets, inputs. */
  surface: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  ink2: string;
  /** Tertiary / placeholder text, disabled icons. */
  ink3: string;
  /** Hairlines and borders. */
  line: string;
  /** CTAs, active nav pill, route lines, driver pins. */
  primary: string;
  /** Pressed primary. */
  primary2: string;
  /** Text/icons on primary. */
  onPrimary: string;
  /** Chips, icon circles, selected states. */
  tint: string;
  /** Contributions/money, stars, highlights, destination pins. */
  accent: string;
  /** Text that sits on accent2 washes (darker amber, readable). */
  accentInk: string;
  /** "No-profit" notes, EV badges. */
  accent2: string;
  /** SOS, errors, report — nothing else. */
  coral: string;
  /** Light coral wash for error backgrounds. */
  coralWash: string;
  success: string;
  mint: string;
  /** Modal backdrop. */
  scrim: string;
  /** Shadow colour (used in boxShadow strings). */
  shadow: string;
}

export const lightColors: ColorTokens = {
  bg: '#F7F8FC',
  surface: '#FFFFFF',
  ink: '#191C2B',
  ink2: '#5B6178',
  ink3: '#9AA0B4',
  line: '#E4E7F2',
  primary: '#4353FF',
  primary2: '#2F3BD9',
  onPrimary: '#FFFFFF',
  tint: '#EDEFFF',
  accent: '#FFB300',
  accentInk: '#8A5A00',
  accent2: '#FFF3D6',
  coral: '#FF5C45',
  coralWash: '#FFEDEA',
  success: '#12B76A',
  mint: '#E6F8F0',
  scrim: 'rgba(25,28,43,0.45)',
  shadow: 'rgba(25,28,43,0.08)',
};
