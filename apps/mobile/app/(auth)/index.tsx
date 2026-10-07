import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, CarIllustration, Icon, Screen, Text, Wordmark, type IconName } from '@/components';
import { makeStyles } from '@/theme';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'car-sport', title: 'Real trips, shared seats', body: 'Drivers share seats on trips they already make.' },
  { icon: 'wallet', title: 'A capped cost share', body: 'You pay a capped share of fuel and wear — never a fare.' },
  { icon: 'checkmark-done', title: 'Request, accept, pay', body: 'Request to join → driver accepts → pay with MoMo.' },
];

/** Welcome: wordmark, hero, tagline and the 3-point explainer. */
export default function Welcome() {
  const s = useStyles();
  return (
    <Screen
      footer={
        <>
          <Button label="Get started" size="lg" block iconRight="arrow-forward" onPress={() => router.push('/phone')} testID="get-started" />
          <Text variant="caption" align="center">
            Kigali · Made for Rwanda
          </Text>
        </>
      }
    >
      <View style={s.top}>
        <Wordmark />
      </View>

      <View style={s.hero}>
        <View style={s.heroBlob} />
        <View style={[s.float, s.floatRoute]}>
          <View style={s.routeDot} />
          <Text variant="caption" color="ink" style={s.floatText}>
            Kimironko → CBD
          </Text>
        </View>
        <View style={[s.float, s.floatMoney]}>
          <Icon name="leaf" size={13} color="accentInk" />
          <Text style={s.money}>RWF 610</Text>
        </View>
        <View style={s.car}>
          <CarIllustration color="White" width={260} />
        </View>
      </View>

      <Text variant="display" style={s.headline}>
        Share the ride you&apos;re already taking
      </Text>

      <View style={s.points}>
        {POINTS.map((p) => (
          <View key={p.title} style={s.point}>
            <View style={s.pointIcon}>
              <Icon name={p.icon} size={20} color="primary" />
            </View>
            <View style={s.pointText}>
              <Text variant="bodyStrong">{p.title}</Text>
              <Text variant="caption">{p.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  top: { paddingTop: 12 },
  hero: { height: 200, alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, marginBottom: 4 },
  heroBlob: { position: 'absolute', top: 10, width: 260, height: 180, borderRadius: 120, backgroundColor: t.colors.tint, transform: [{ scaleX: 1.25 }] },
  float: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: t.colors.surface, ...t.shadows.md },
  floatRoute: { top: 22, left: 8 },
  floatMoney: { top: 54, right: 8, backgroundColor: t.colors.accent2 },
  car: { zIndex: 1 },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.primary },
  floatText: { fontFamily: t.fonts.bodySemiBold },
  money: { fontFamily: t.fonts.headingHeavy, fontSize: 14, color: t.colors.accentInk },
  headline: { marginTop: 20 },
  points: { marginTop: 20, gap: 14 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pointIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, gap: 1 },
}));
