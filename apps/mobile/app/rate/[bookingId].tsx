import { RATING_TAGS, type Booking, type RatingTag } from '@tmh/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Avatar, Button, Card, Chip, ErrorState, Input, LoadingState, Screen, Stars, Text } from '@/components';
import { ErrorCard } from '@/features/passenger/ErrorCard';
import { hapticSelect, hapticSuccess } from '@/features/passenger/haptics';
import { firstName } from '@/features/passenger/labels';
import { PulseRings } from '@/features/passenger/PulseRings';
import { formatDeparture } from '@/lib/format';
import { useBooking, useRateBooking } from '@/lib/queries';
import { makeStyles } from '@/theme';

const STAR_WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Excellent'];
// Tags that make sense when a driver rates a passenger.
const PASSENGER_TAGS: RatingTag[] = ['Punctual', 'Friendly', 'Late pickup'];

/** Post-trip rating — passengers rate drivers and drivers rate passengers. */
export default function RateScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const q = useBooking(bookingId);

  if (q.isPending) {
    return (
      <Screen header={{ title: 'Rate your trip' }} scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen header={{ title: 'Rate your trip' }} scroll={false}>
        <ErrorState error={q.error} title="Couldn't load this trip" onRetry={() => void q.refetch()} />
      </Screen>
    );
  }
  return <RateView booking={q.data} />;
}

function RateView({ booking: b }: { booking: Booking }) {
  const s = useStyles();
  const rate = useRateBooking();
  const asPassenger = b.viewerRole === 'passenger';
  const other = asPassenger ? b.driver : b.passenger;
  const name = firstName(other.name);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<RatingTag[]>([]);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const tagOptions = asPassenger ? RATING_TAGS : PASSENGER_TAGS;

  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/booking/[id]', params: { id: b.id } }));

  const toggle = (tag: RatingTag) => {
    hapticSelect();
    setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));
  };

  const submit = () =>
    rate.mutate(
      { bookingId: b.id, stars, tags, comment: comment.trim() || null },
      {
        onSuccess: () => {
          hapticSuccess();
          setDone(true);
        },
      },
    );

  if (done || b.myRating) {
    const mine = b.myRating;
    return (
      <Screen header={{ title: 'Rate your trip' }} footer={<Button label="Done" size="lg" block onPress={back} testID="rate-done" />}>
        <Animated.View entering={ZoomIn.springify()} style={s.doneWrap} testID="rate-success">
          <PulseRings icon="star" tone="accent" active={false} />
          <Text variant="h1" align="center">
            {done ? `Thanks for rating ${name}` : `You rated ${name}`}
          </Text>
          {mine ? <Stars value={mine.stars} size={28} /> : <Stars value={stars} size={28} />}
          <Text variant="body" color="ink2" align="center" style={s.doneBody}>
            {b.counterpartRated || !done
              ? 'Ratings stay private until both of you have rated — then they count towards each profile.'
              : `${name} will rate you too. Ratings stay private until you both have.`}
          </Text>
        </Animated.View>
      </Screen>
    );
  }

  if (b.status !== 'completed') {
    return (
      <Screen header={{ title: 'Rate your trip' }} scroll={false}>
        <ErrorState error="You can rate once the trip is completed." title="Not yet" fill />
      </Screen>
    );
  }

  return (
    <Screen
      header={{ title: 'Rate your trip', subtitle: b.tripCode }}
      footer={
        <>
          {rate.error ? <ErrorCard error={rate.error} fallbackTitle="Couldn't send your rating" /> : null}
          <Button label={stars ? `Send ${stars}-star rating` : 'Tap the stars to rate'} size="lg" block disabled={!stars} loading={rate.isPending} onPress={submit} testID="rate-submit" />
        </>
      }
    >
      <Animated.View entering={FadeInDown.duration(300)} style={s.who}>
        <Avatar name={other.name} photoUrl={other.photoUrl} size={84} ring />
        <Text variant="h1" align="center">
          How was your trip with {name}?
        </Text>
        <Text variant="caption" align="center">
          {b.boardStop.place.name} → {b.alightStop.place.name} · {formatDeparture(b.trip.departureTime)}
        </Text>
      </Animated.View>

      <View style={s.starsWrap}>
        <Stars value={stars} onChange={(n) => {
            hapticSelect();
            setStars(n);
          }} size={44} />
        <Animated.View key={stars} entering={FadeIn.duration(180)}>
          <Text variant="h3" color={stars ? 'accentInk' : 'ink3'}>
            {stars ? STAR_WORDS[stars] : 'Tap to rate'}
          </Text>
        </Animated.View>
      </View>

      <Card style={s.card}>
        <Text variant="label">What stood out?</Text>
        <View style={s.tags}>
          {tagOptions.map((tag) => (
            <Chip key={tag} label={tag} selected={tags.includes(tag)} icon={tags.includes(tag) ? 'checkmark' : undefined} onPress={() => toggle(tag)} />
          ))}
        </View>
        <Input
          label="Anything else? (optional)"
          value={comment}
          onChangeText={setComment}
          placeholder={asPassenger ? `Say thanks to ${name}, or tell us what could be better` : `A note about ${name}`}
          multiline
          maxLength={500}
          style={s.comment}
          testID="rate-comment"
        />
      </Card>

      <Pressable onPress={() => router.push({ pathname: '/report', params: { bookingId: b.id, userId: other.id } })} accessibilityRole="link" style={s.reportLink}>
        <Text variant="bodyStrong" color="coral" align="center">
          Something went wrong? Report an issue instead
        </Text>
      </Pressable>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  who: { alignItems: 'center', gap: 8, marginTop: 8 },
  starsWrap: { alignItems: 'center', gap: 8, marginVertical: 24 },
  card: { gap: 14, marginBottom: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  comment: { minHeight: 84, textAlignVertical: 'top' },
  reportLink: { paddingVertical: 14 },
  doneWrap: { alignItems: 'center', gap: 12, paddingTop: 40 },
  doneBody: { maxWidth: 320 },
}));

