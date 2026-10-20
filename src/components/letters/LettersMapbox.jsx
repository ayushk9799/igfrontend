import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import BirdArt from './BirdArt';
import {
    LETTERS_DARK_MAP_ATMOSPHERE,
    LETTERS_MAP_ATMOSPHERE,
    MAPBOX_ACCESS_TOKEN,
} from '../../constants/maps';
import { fontFamily } from '../../constants/fonts';
import { translateUiTemplate, translateUiText } from '../../i18n/uiTranslation';
import {
    buildGeoCurve,
    formatTimeLeft,
    getLetterBird,
    getLetterRouteColor,
    getLiveProgress,
    getTimeLeftMs,
    spreadNearbyPins,
    splitGeoCurve,
    LETTER_MAP_ROUTE_COLORS,
} from '../../utils/letters';

Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

const MAX_BIRDS_ON_MAP = 4;
const ROUTE_BEND = { outgoing: 0.22, incoming: -0.22 };
const MAP_STYLE_URL = 'mapbox://styles/mapbox/standard';
// Night mode keeps the horizon visible; day mode focuses on the letter route.
const GLOBE_ZOOM = 0.8;
const NIGHT_GLOBE_ZOOM = 1.65;
const FLY_IN_MS = 1800;

const toPosition = ({ latitude, longitude }) => [longitude, latitude];

const lineFeature = (id, points, color) => ({
    type: 'Feature',
    id,
    properties: { color },
    geometry: { type: 'LineString', coordinates: points.map(toPosition) },
});

const getBounds = (points) => {
    const lngs = points.map((point) => point.longitude);
    const lats = points.map((point) => point.latitude);
    return {
        ne: [Math.max(...lngs), Math.max(...lats)],
        sw: [Math.min(...lngs), Math.min(...lats)],
    };
};

const PinMarker = ({ coordinate, label, ringColor, approximate = false }) => (
    <Mapbox.MarkerView coordinate={toPosition(coordinate)} anchor={{ x: 0.5, y: 1 }} allowOverlap>
        <View style={styles.pin} pointerEvents="none">
            <Text style={styles.pinLabel} numberOfLines={1}>{label}</Text>
            <View style={[styles.pinDot, { borderColor: ringColor }, approximate && styles.pinDotApprox]} />
        </View>
    </Mapbox.MarkerView>
);

const BirdMarker = ({ coordinate, bird, routeColor, timeLeft, onPress }) => (
    <Mapbox.MarkerView coordinate={toPosition(coordinate)} anchor={{ x: 0.5, y: 0.35 }} allowOverlap>
        <Pressable
            style={styles.birdWrap}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${translateUiText(bird.name)}, ${timeLeft}`}
        >
            <View style={[styles.birdMarker, { borderColor: routeColor }]}>
                <BirdArt bird={bird.id} size={44} />
            </View>
            <View style={[styles.timeChip, { backgroundColor: bird.route }]}>
                <Text style={styles.timeChipText}>{timeLeft}</Text>
            </View>
        </Pressable>
    </Mapbox.MarkerView>
);

const LettersMapbox = ({
    you,
    partner,
    youApprox = false,
    partnerApprox = false,
    letters = [],
    nowMs,
    partnerName,
    topInset = 0,
    bottomInset = 0,
    isDark = false,
    showPartner = true,
    showUserLocation = false,
    focusLocation,
    onBirdPress,
}) => {
    const cameraRef = useRef(null);
    const mapLoadedRef = useRef(false);
    const initialDarkMode = useRef(isDark).current;
    const mapStyleConfig = useMemo(() => ({
        lightPreset: isDark ? 'night' : 'day',
    }), [isDark]);
    const pins = useMemo(() => spreadNearbyPins(you, partner), [you, partner]);
    const routes = useMemo(() => ({
        outgoing: buildGeoCurve(pins.you, pins.partner, ROUTE_BEND.outgoing),
        incoming: buildGeoCurve(pins.partner, pins.you, ROUTE_BEND.incoming),
    }), [pins]);

    const flights = useMemo(() => letters
        .filter((letter) => letter.status === 'flying')
        .slice(0, MAX_BIRDS_ON_MAP)
        .map((letter) => {
            const direction = letter.direction === 'outgoing' ? 'outgoing' : 'incoming';
            const { position, flown } = splitGeoCurve(routes[direction], getLiveProgress(letter, nowMs));
            return {
                letter,
                direction,
                bird: getLetterBird(letter.bird),
                routeColor: getLetterRouteColor(letter.bird, isDark),
                position,
                flown,
                timeLeft: formatTimeLeft(getTimeLeftMs(letter, nowMs)),
            };
        }), [letters, routes, nowMs, isDark]);

    const routeShapes = useMemo(() => {
        const directionsInFlight = new Set(flights.map((flight) => flight.direction));
        const routeColors = LETTER_MAP_ROUTE_COLORS[isDark ? 'dark' : 'light'];
        return {
            type: 'FeatureCollection',
            features: (showPartner ? ['outgoing', 'incoming'] : [])
                .filter((direction) => directionsInFlight.has(direction) || (direction === 'outgoing' && flights.length === 0))
                .map((direction) => lineFeature(`route-${direction}`, routes[direction], routeColors[direction])),
        };
    }, [flights, routes, showPartner, isDark]);

    const trailShapes = useMemo(() => ({
        type: 'FeatureCollection',
        features: flights
            .filter(({ flown }) => flown.length > 1)
            .map(({ letter, routeColor, flown }) => lineFeature(`trail-${letter.id}`, flown, routeColor)),
    }), [flights]);

    const fitBothCities = useCallback((duration) => {
        const { ne, sw } = getBounds([pins.you, pins.partner, ...routes.outgoing, ...routes.incoming]);
        cameraRef.current?.fitBounds(ne, sw, [topInset + 90, 70, bottomInset + 70, 70], duration);
    }, [pins, routes, topInset, bottomInset]);

    const frameMap = useCallback((duration) => {
        // Changing day/night lighting should not move the map.
        if (!initialDarkMode) {
            fitBothCities(duration);
            return;
        }
        cameraRef.current?.setCamera({
            centerCoordinate: toPosition({
                latitude: (pins.you.latitude + pins.partner.latitude) / 2,
                longitude: (pins.you.longitude + pins.partner.longitude) / 2,
            }),
            zoomLevel: NIGHT_GLOBE_ZOOM,
            pitch: 0,
            heading: 0,
            padding: {
                paddingTop: topInset + 80,
                paddingBottom: bottomInset + 24,
                paddingLeft: 0,
                paddingRight: 0,
            },
            animationMode: 'easeTo',
            animationDuration: duration,
        });
    }, [initialDarkMode, fitBothCities, pins, topInset, bottomInset]);

    useEffect(() => {
        if (mapLoadedRef.current) frameMap(600);
    }, [frameMap]);

    const focusCurrentLocation = useCallback(() => {
        if (!focusLocation) return false;
        cameraRef.current?.setCamera({
            centerCoordinate: toPosition(focusLocation),
            zoomLevel: 14,
            pitch: 0,
            heading: 0,
            padding: { paddingTop: topInset + 80, paddingBottom: bottomInset + 24, paddingLeft: 24, paddingRight: 24 },
            animationMode: 'easeTo',
            animationDuration: 700,
        });
        return true;
    }, [focusLocation, topInset, bottomInset]);

    useEffect(() => {
        if (mapLoadedRef.current) focusCurrentLocation();
    }, [focusCurrentLocation]);

    const handleMapLoaded = useCallback(() => {
        // Style reloads should not reset a camera the user has moved.
        if (mapLoadedRef.current) return;
        mapLoadedRef.current = true;
        if (!focusCurrentLocation()) frameMap(FLY_IN_MS);
    }, [frameMap, focusCurrentLocation]);

    return (
        <Mapbox.MapView
            style={[StyleSheet.absoluteFill, styles.map, isDark && styles.mapDark]}
            styleURL={MAP_STYLE_URL}
            projection="globe"
            onDidFinishLoadingMap={handleMapLoaded}
            rotateEnabled={false}
            pitchEnabled={false}
            compassEnabled={false}
            scaleBarEnabled={false}
            logoPosition={{ bottom: bottomInset + 8, left: 12 }}
            attributionPosition={{ bottom: bottomInset + 8, right: 12 }}
        >
            <Mapbox.StyleImport id="basemap" existing config={mapStyleConfig} />
            <Mapbox.Atmosphere style={isDark ? LETTERS_DARK_MAP_ATMOSPHERE : LETTERS_MAP_ATMOSPHERE} />
            {showUserLocation ? <Mapbox.LocationPuck visible /> : null}
            <Mapbox.Camera
                ref={cameraRef}
                defaultSettings={{
                    centerCoordinate: toPosition({
                        latitude: (pins.you.latitude + pins.partner.latitude) / 2,
                        longitude: (pins.you.longitude + pins.partner.longitude) / 2,
                    }),
                    zoomLevel: initialDarkMode ? NIGHT_GLOBE_ZOOM : GLOBE_ZOOM,
                }}
            />
            <Mapbox.ShapeSource id="letters-routes" shape={routeShapes}>
                <Mapbox.LineLayer
                    id="letters-routes-line"
                    slot="top"
                    style={lineStyles.route}
                />
            </Mapbox.ShapeSource>
            <Mapbox.ShapeSource id="letters-trails" shape={trailShapes}>
                <Mapbox.LineLayer
                    id="letters-trails-line"
                    slot="top"
                    aboveLayerID="letters-routes-line"
                    style={lineStyles.trail}
                />
            </Mapbox.ShapeSource>
            <PinMarker
                coordinate={pins.you}
                label={youApprox ? translateUiTemplate('{{0}} · location off', [translateUiText('You')]) : translateUiText('You')}
                ringColor="#D23F66"
                approximate={youApprox}
            />
            {showPartner ? (
                <PinMarker
                    coordinate={pins.partner}
                    label={partnerApprox ? translateUiTemplate('{{0}} · location off', [partnerName]) : partnerName}
                    ringColor="#2E1E3C"
                    approximate={partnerApprox}
                />
            ) : null}
            {flights.map(({ letter, bird, routeColor, position, timeLeft }) => (
                <BirdMarker
                    key={`bird-${letter.id}`}
                    coordinate={position}
                    bird={bird}
                    routeColor={routeColor}
                    timeLeft={timeLeft}
                    onPress={() => onBirdPress?.(letter.id)}
                />
            ))}
        </Mapbox.MapView>
    );
};

// Mapbox layer styles; colours come from each line's feature.
const lineStyles = {
    // Standard's night lighting must not dim the letter overlays.
    route: { lineColor: ['get', 'color'], lineWidth: 3, lineDasharray: [0.7, 3.3], lineCap: 'round', lineEmissiveStrength: 1 },
    trail: { lineColor: ['get', 'color'], lineWidth: 4, lineCap: 'round', lineEmissiveStrength: 1 },
};

const styles = StyleSheet.create({
    // Same as the map's land colour, shown while tiles load.
    map: {
        backgroundColor: '#F6EEDF',
    },
    mapDark: {
        backgroundColor: '#031729',
    },
    pin: {
        alignItems: 'center',
    },
    pinLabel: {
        maxWidth: 160,
        marginBottom: 6,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 15,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        color: '#2E1E3C',
        fontFamily: fontFamily.extraBold,
        fontSize: 13,
    },
    pinDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 4,
        backgroundColor: '#FFFFFF',
    },
    pinDotApprox: {
        borderStyle: 'dashed',
        opacity: 0.75,
    },
    birdWrap: {
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingBottom: 4,
    },
    birdMarker: {
        width: 54,
        height: 54,
        borderRadius: 27,
        borderWidth: 3,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeChip: {
        marginTop: 4,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        minWidth: 64,
        alignItems: 'center',
    },
    timeChipText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
        fontSize: 12,
    },
});

export default LettersMapbox;
