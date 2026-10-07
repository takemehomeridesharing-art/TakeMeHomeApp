# Take Me Home — mobile UI kit

Import from `@/components` (barrel) — except `TripMap` (`@/components/TripMap`) and the app-level
`RealtimeBridge` / `MomoPrompt` (mounted once in `app/_layout.tsx`). Live gallery: open `/dev/kit`
in a dev build (works signed in or out).

Rules: colours come from the theme (`useTheme()` / `makeStyles((t) => …)` in `src/theme`), never hex.
Money is always `formatRwf(x)` from `@tmh/shared` (`RWF 1,250`), shown in Archivo (`variant="money"`
or `t.fonts.heading*`), amber-ish (`accentInk` on light washes). Coral is for SOS / errors / report only.
Words: "contribution", "cost share", "request to join" — never "fare", "earnings", "book".

## Primitives

| Component | Props (one line) |
|---|---|
| `Text` | `variant?: display\|h1\|h2\|h3\|body\|bodyStrong\|caption\|label\|money`, `color?: ColorToken`, `align?`, + RN `TextProps` |
| `Icon` | `name: IconName` (Ionicons), `size?`, `color?: ColorToken \| string` |
| `Button` | `label`, `onPress?`, `variant?: primary\|secondary\|ghost\|danger`, `size?: sm\|md\|lg`, `loading?`, `disabled?`, `icon?`, `iconRight?`, `block?`, `haptic?`, `style?`, `testID?` |
| `Card` | `variant?: elevated\|outlined\|tinted`, `padding?` (16), `onPress?`, `style?`, children |
| `Chip` | `label`, `selected?`, `onPress?`, `icon?`, `disabled?` — selectable filter/tag chip |
| `Badge` | `kind: womenOnly\|ev\|primary\|success\|warning\|danger\|neutral`, `label?`, `icon?` — `womenOnly`/`ev` have default label+icon |
| `Avatar` | `name`, `photoUrl?` (stored path, resolved with `assetUrl`), `size?` (40), `ring?` — initials fallback |
| `Stars` | `value` (0–5, halves), `onChange?` (input mode), `size?`, `showValue?`, `count?` |
| `StatChip` | `label`, `value`, `icon?`, `tone?: neutral\|primary\|accent\|success` |
| `SegmentedControl<T>` | `options: {value,label,icon?}[]`, `value`, `onChange`, `testID?` — e.g. Passenger/Driver |
| `ListRow` | `title`, `subtitle?`, `icon?`, `iconColor?`, `right?`, `onPress?`, `divider?` — settings-style row |
| `Wordmark` | `size?` — "Take Me Home" logo lockup |

## Layout & feedback

| Component | Props (one line) |
|---|---|
| `Screen` | `header?: HeaderProps`, `headerNode?`, `footer?` (sticky CTA), `scroll?` (true), `padding?` (20), `tabBarSpace?` (tab screens!), `edgeToEdgeTop?`, `refreshControl?`, `contentStyle?`, `background?` |
| `Header` | `title?`, `subtitle?`, `back?`, `onBack?` (default `router.back()`), `right?` |
| `HeaderIconButton` | `icon`, `onPress`, `accessibilityLabel`, `badge?` (amber dot) — round white button (also over maps) |
| `BottomSheet` | `visible`, `onClose`, `title?`, `subtitle?`, `footer?`, `dismissible?` (true), `maxHeightRatio?` (0.9), children — drag handle, backdrop, slide-up |
| `PillTabBar` | Expo Router `tabBar` renderer — uses each tab's `title` + `tabBarIcon`; hides `href: null` tabs |
| `EmptyState` | `icon`, `title`, `body?`, `action?: {label, onPress, icon?}` |
| `LoadingState` | `label?`, `fill?` (true) |
| `ErrorState` | `error?: unknown \| string`, `title?`, `onRetry?`, `fill?` |
| `toast` / `ToastHost` | `toast.show({title, message?, tone?: info\|success\|error, icon?, onPress?, duration?})`, `toast.success(t, m?)`, `toast.error(t, m?)` |
| `TAB_BAR_SPACE` | px to leave under content on tab screens (`Screen tabBarSpace` does it for you) |

## Forms

| Component | Props (one line) |
|---|---|
| `Input` | `label?`, `hint?`, `error?`, `icon?`, `left?`, `right?`, `containerStyle?`, + `TextInputProps` (ref forwarded) |
| `PhoneInput` | `value` (9 local digits), `onChangeText(localDigits)`, + Input props — `+250` prefix & flag. Helpers: `toE164`, `fromE164`, `isValidLocalPhone`, `normalizeLocalPhone` |
| `OtpInput` | `value`, `onChangeText`, `onComplete?`, `length?` (6), `error?`, `autoFocus?`, `disabled?` |

## Domain

| Component | Props (one line) |
|---|---|
| `CarIllustration` | `color?` (vehicle colour name: Silver/White/Black/Grey/Blue/Red/Green/… or hex), `width?` (240; h = w×5/12), `shadow?` — side-view car; `carColorHex(name)` |
| `FareBreakdownCard` | `segmentKm`, `seatsOffered`, `costShare`, `bookingFee`, `total`, `isEV?`, `showNote?` (true), `title?` — amber top border + no-profit note |
| `StopList` | `stops: {id, cumulativeKm, place:{name, landmark?}}[]` (a `TripStop[]` fits), `boardStopId?`, `alightStopId?`, `onSelectBoard?`, `onSelectAlight?`, `compact?`, `kmFromBoard?` |
| `Ticket` | `from`, `to`, `fromLandmark?`, `toLandmark?`, `departureTime` (ISO), `tripCode`, `stats?: {label,value,icon?,tone?}[]`, `status?` node, children — assumes it sits on the `bg` colour (notches) |
| `TwoTripMeter` | `used`, `limit?` (`MAX_TRIPS_PER_DAY`), `dayLabel?` ("today") — "1 of 2 trips today", Out/Back segments |
| `VerificationChips` | `chips: VerificationChips` (from `PublicUser.verification`), `show?: key[]`, `hideNone?` |
| `TripMap` (`@/components/TripMap`) | `places?`, `routeStops?`, `pins?: {id, lat, lng, title, fromAmount?}[]`, `onPinPress?(id)`, `boardPlaceId?`, `alightPlaceId?`, `height?` (240), `insetTop?`/`insetBottom?` (keep room for overlays), `interactive?`, `style?` — native: react-native-maps + OSM tiles; web: SVG schematic |

## App-level (already mounted in `app/_layout.tsx`)

- `RealtimeBridge` — connects the socket while signed in; invalidates queries on events; notification → toast (tap opens `href`).
- `MomoPrompt` — DEV-only simulated MTN MoMo USSD dialog for `momo:prompt` → `POST /dev/momo/:providerRef/respond`.
  Screens never mock payments themselves: call `usePayRequest()`, then watch `usePayment(id)` (polls while `initiated`).

## Non-UI building blocks (in `src/lib`, `src/stores`)

- `@/lib/api` — `api.get/post/patch/delete<T>(path, body?, { query, schema, auth })`, `ApiError {status, code, message, details}`, `errorMessage(e)`, `API_URL`, **`assetUrl(path)`** (use for every stored image/document path).
- `@/lib/queries` — `qk` key factory + a typed hook per endpoint (`useTrip(id)`, `useJoinTrip()`, …). Mutations take path params in their variables, e.g. `useAcceptRequest().mutate(requestId)`.
- `@/lib/socket` — `useSocketEvent(event, handler)` (typed with `ServerToClientEvents`), `useSocketConnected()`.
- `@/lib/format` — `formatDeparture(iso)` → `Tomorrow · 07:30`, `formatDay`, `formatRelative`, `routeLabel(stops)`, `initials`, `formatPhone`.
- `@/stores/session` — `useSession` (zustand): `token`, `me`, `mode`, `signIn`, `signOut`, `setMode`, `setMe`, `refreshMe`.
