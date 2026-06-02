/**
 * Phase 4 / Round AS (AE519) â€” Tamagui stripped; uses plain RN primitives.
 * Will be retired entirely when the Aether mobile surface ships.
 *
 * Explore tab â€” near-me discovery.
 *
 * [S-D2] replaces the V.UX.27 web-link stub (three buttons that opened
 * https://travelsuperapp.local/...) with a real near-me surface. Calls
 * `useNearMeControllerNearMe` (V.UX.7 spontaneous-improviser composite)
 * with the device's current geolocation; renders the up-to-5 nearest
 * places with category, distance, walking-route summary, ambient
 * weather, and a one-line safety chip.
 *
 * Geolocation is requested on mount via `useGeolocation`; on denial we
 * fall back to NYC (Times Square) so the screen demos meaningfully on
 * simulators / new installs.
 *
 * Closes the Z1 mobile-audit Explore-10% ship-blocker.
 *
 * Installed by [S-D2] of the S-series real-functionality closeout.
 */
import {
  ScrollView,
  RefreshControl,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'expo-router';
import {
  useNearMeControllerNearMe,
  type NearMeNowResponseDto,
  type NearMePlaceDto,
} from '@app/sdk';
import { DEFAULT_CENTER, useGeolocation } from '../../lib/use-geolocation';
import { useOnlineStatus } from '../../lib/use-online-status';

/** Phase 4 feature flag (mirror of web NEXT_PUBLIC_FEATURE_AETHER_PHASE1).
 *  Gates the Aether preview entry points. */
const AETHER_ENABLED = process.env.EXPO_PUBLIC_FEATURE_AETHER_PHASE1 === '1';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function ExploreScreen() {
  const online = useOnlineStatus();
  const geo = useGeolocation();
  const [body, setBody] = useState<NearMeNowResponseDto | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const near = useNearMeControllerNearMe({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        setBody(response.data as NearMeNowResponseDto);
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} - ${e.message ?? 'Could not load near-me.'}`,
        );
      },
    },
  });

  // Re-fetch whenever the device coordinates change (granted / relocate).
  useEffect(() => {
    if (!online) return;
    near.mutate({ data: { center: geo.center, radiusKm: 3 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.center.lat, geo.center.lng, online]);

  const usingFallback =
    geo.status === 'denied' ||
    geo.status === 'unavailable' ||
    (!geo.isReal && geo.center.lat === DEFAULT_CENTER.lat && geo.center.lng === DEFAULT_CENTER.lng);

  const places = useMemo(() => body?.places ?? [], [body]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl
          refreshing={near.isPending}
          onRefresh={() => {
            void geo.relocate();
          }}
        />
      }
    >
      <View style={styles.container}>
        <Text style={styles.h4}>Explore</Text>
        <Text style={styles.muted}>
          Up to 5 nearest places + walking routes + today's weather + a safety chip.
        </Text>

        {AETHER_ENABLED ? (
          <View style={styles.aetherSection}>
            <Text style={styles.aetherSectionLabel}>Aether preview</Text>
            <Link href="/aether/drift" asChild>
              <TouchableOpacity style={styles.aetherBanner}>
                <Text style={styles.aetherBannerText}>Drift — the home field</Text>
                <Text style={styles.aetherBannerArrow}>{'->'}</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/aether/atlas" asChild>
              <TouchableOpacity style={styles.aetherBanner}>
                <Text style={styles.aetherBannerText}>Atlas — the trip studio</Text>
                <Text style={styles.aetherBannerArrow}>{'->'}</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/aether/compass" asChild>
              <TouchableOpacity style={styles.aetherBanner}>
                <Text style={styles.aetherBannerText}>Compass — the rose</Text>
                <Text style={styles.aetherBannerArrow}>{'->'}</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/aether/vault" asChild>
              <TouchableOpacity style={styles.aetherBanner}>
                <Text style={styles.aetherBannerText}>Vault — price glyphs</Text>
                <Text style={styles.aetherBannerArrow}>{'->'}</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/aether/lumen" asChild>
              <TouchableOpacity style={styles.aetherBanner}>
                <Text style={styles.aetherBannerText}>Lumen — the photo cloud</Text>
                <Text style={styles.aetherBannerArrow}>{'->'}</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/aether/echo" asChild>
              <TouchableOpacity style={styles.aetherBanner}>
                <Text style={styles.aetherBannerText}>Echo — the feed</Text>
                <Text style={styles.aetherBannerArrow}>{'->'}</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/aether/continuum" asChild>
              <TouchableOpacity style={styles.aetherBanner}>
                <Text style={styles.aetherBannerText}>Continuum — handoff sigil</Text>
                <Text style={styles.aetherBannerArrow}>{'->'}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        ) : null}

        <View style={styles.row}>
          <TouchableOpacity style={styles.button} onPress={() => void geo.relocate()}>
            <Text style={styles.buttonText}>
              {geo.status === 'pending' ? '[loc] Locating...' : '[loc] Re-locate'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.mutedSmall}>
            {geo.center.lat.toFixed(3)}, {geo.center.lng.toFixed(3)}
          </Text>
          {usingFallback ? <Text style={styles.warningSmall}>using NYC fallback</Text> : null}
        </View>

        {!online ? (
          <View style={styles.card}>
            <Text style={styles.muted}>
              Offline - showing the last loaded results. Reconnect to refresh.
            </Text>
          </View>
        ) : null}

        {errorMsg ? (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {body ? <NearMeMeta body={body} /> : null}

        {near.isPending && places.length === 0 ? (
          <View style={styles.spinnerWrap}>
            <ActivityIndicator />
          </View>
        ) : places.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>
              No places within 3 km. Move the radius (coming in the next slice) or try a different
              location.
            </Text>
          </View>
        ) : (
          <View style={styles.placeList}>
            {places.map((p) => (
              <PlaceRow key={p.id} place={p} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function NearMeMeta({ body }: { body: NearMeNowResponseDto }) {
  const weather = body.weather as unknown as {
    summary?: string;
    maxTempC?: number;
    minTempC?: number;
  };
  const safety = body.safety as unknown as { tier?: string; summary?: string };
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaCard}>
        <Text style={styles.mutedSmall}>
          [wx]{' '}
          {weather.summary ??
            `${Math.round(weather.maxTempC ?? 0)}deg / ${Math.round(weather.minTempC ?? 0)}deg`}
        </Text>
      </View>
      <View style={styles.metaCard}>
        <Text style={styles.mutedSmall}>
          [sf] {safety.tier ?? 'unknown'} - {safety.summary ?? 'no safety data'}
        </Text>
      </View>
    </View>
  );
}

function PlaceRow({ place: p }: { place: NearMePlaceDto }) {
  const distanceLabel =
    p.distanceMeters < 1000
      ? `${Math.round(p.distanceMeters)} m`
      : `${(p.distanceMeters / 1000).toFixed(1)} km`;
  const walking = p.routes.find((r) => r.mode === 'walk');
  return (
    <View style={styles.card}>
      <View style={styles.placeStack}>
        <Text style={styles.placeName}>{p.name}</Text>
        <Text style={styles.mutedSmall}>
          {p.category} - {distanceLabel} away
          {walking ? ` - [walk] ${formatDuration(walking.durationSeconds)}` : ''}
        </Text>
      </View>
    </View>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 12,
    padding: 16,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600',
  },
  muted: {
    color: '#666',
    fontSize: 14,
  },
  mutedSmall: {
    color: '#666',
    fontSize: 12,
  },
  warningSmall: {
    color: '#cc6600',
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#eee',
    borderRadius: 6,
  },
  buttonText: {
    fontSize: 13,
    color: '#111',
  },
  card: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  cardError: {
    borderColor: '#cc3333',
  },
  errorText: {
    color: '#cc3333',
    fontSize: 14,
  },
  spinnerWrap: {
    alignItems: 'center',
    padding: 16,
  },
  placeList: {
    flexDirection: 'column',
    gap: 8,
  },
  placeStack: {
    flexDirection: 'column',
    gap: 4,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaCard: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  aetherSection: {
    flexDirection: 'column',
    gap: 6,
  },
  aetherSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#6E7B5C',
  },
  aetherBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1A1714',
  },
  aetherBannerText: {
    color: '#E8B777',
    fontSize: 14,
    fontWeight: '600',
  },
  aetherBannerArrow: {
    color: '#C2614A',
    fontSize: 16,
    fontWeight: '700',
  },
});
