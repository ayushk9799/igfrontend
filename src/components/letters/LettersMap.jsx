import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import BirdArt from './BirdArt';
import { fontFamily } from '../../constants/fonts';
import { translateUiText } from '../../i18n/uiTranslation';
import {
    curvePath,
    flownCurvePath,
    formatTimeLeft,
    getLetterBird,
    getLetterRouteColor,
    getLiveProgress,
    getTimeLeftMs,
    pointOnCurve,
    LETTER_MAP_ROUTE_COLORS,
} from '../../utils/letters';

const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;
const MARKER_SIZE = 54;
const MAX_BIRDS_ON_MAP = 4;
const LIGHT_COLORS = {
    sea: '#D6E8F5', land: '#F6EEDF', river: '#DCE9F2', park: '#E8F0DA',
    trees: '#C9D9B5', cloud: '#FFFFFF',
};
const DARK_COLORS = {
    sea: '#091D38', land: '#303D49', river: '#223951', park: '#263D3B',
    trees: '#496655', cloud: '#5A687C',
};

// Pin positions are fixed on the illustration; real distance only shows as text.
export const getMapGeometry = (width, height) => {
    const sx = width / DESIGN_WIDTH;
    const sy = height / DESIGN_HEIGHT;
    const p = (x, y) => ({ x: x * sx, y: y * sy });
    const you = p(100, 200);
    const partner = p(280, 440);
    return {
        sx,
        sy,
        you,
        partner,
        outgoing: { from: you, control: p(330, 230), to: partner },
        incoming: { from: partner, control: p(60, 420), to: you },
    };
};

const Pin = ({ point, label, ringColor, labelAbove }) => (
    <View
        pointerEvents="none"
        style={[styles.pinWrap, { left: point.x - 80, top: labelAbove ? point.y - 47 : point.y - 11 }]}
    >
        {labelAbove ? <Text style={styles.pinLabel} numberOfLines={1}>{label}</Text> : null}
        <View style={[styles.pinDot, { borderColor: ringColor }]} />
        {!labelAbove ? <Text style={[styles.pinLabel, styles.pinLabelBelow]} numberOfLines={1}>{label}</Text> : null}
    </View>
);

const LettersMap = ({
    width,
    height,
    letters = [],
    nowMs,
    partnerName,
    isDark = false,
    onBirdPress,
}) => {
    const mapColors = isDark ? DARK_COLORS : LIGHT_COLORS;
    const routeColors = LETTER_MAP_ROUTE_COLORS[isDark ? 'dark' : 'light'];
    const geometry = useMemo(() => getMapGeometry(width, height), [width, height]);

    const flights = useMemo(() => letters
        .filter((letter) => letter.status === 'flying')
        .slice(0, MAX_BIRDS_ON_MAP)
        .map((letter, index) => {
            const curve = letter.direction === 'outgoing' ? geometry.outgoing : geometry.incoming;
            const progress = getLiveProgress(letter, nowMs);
            // Nudge birds that share a route so they don't sit on top of each other.
            const offset = index * 6;
            const point = pointOnCurve(curve.from, curve.control, curve.to, progress);
            return {
                letter,
                bird: getLetterBird(letter.bird),
                routeColor: getLetterRouteColor(letter.bird, isDark),
                curve,
                progress,
                point: { x: point.x + offset, y: point.y - offset },
                timeLeft: formatTimeLeft(getTimeLeftMs(letter, nowMs)),
            };
        }), [letters, geometry, nowMs, isDark]);

    const hasOutgoing = flights.some((flight) => flight.letter.direction === 'outgoing');
    const hasIncoming = flights.some((flight) => flight.letter.direction === 'incoming');
    const { sx, sy, outgoing, incoming } = geometry;

    return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: mapColors.sea }]}>
            <Svg width={width} height={height} pointerEvents="none">
                <G scaleX={sx} scaleY={sy}>
                    <Path
                        d="M30 0 L390 0 L390 560 C360 590 330 640 290 660 C250 680 230 620 200 600 C160 575 120 590 90 550 C60 510 40 470 30 420 C20 370 40 330 24 280 C8 220 30 140 30 0Z"
                        fill={mapColors.land}
                    />
                    <Path d="M0 640 C30 630 50 660 60 700 C70 740 40 780 0 790Z" fill={mapColors.land} />
                    <Path d="M60 120 C120 160 160 120 210 170 C260 220 300 200 360 250" stroke={mapColors.river} strokeWidth={6} strokeLinecap="round" fill="none" />
                    <Circle cx={320} cy={120} r={34} fill={mapColors.park} />
                    <Circle cx={70} cy={330} r={26} fill={mapColors.park} />
                    <Circle cx={210} cy={530} r={22} fill={mapColors.park} />
                    <Circle cx={340} cy={420} r={18} fill={mapColors.park} />
                    <Path d="M226 160 q6 -14 12 0 M240 166 q6 -14 12 0" stroke={mapColors.trees} strokeWidth={3} strokeLinecap="round" fill="none" />
                    <Path d="M178 250 h30 a12 12 0 0 0 0 -24 a16 16 0 0 0 -30 -4 a10 10 0 0 0 0 28z" fill={mapColors.cloud} opacity={0.9} />
                    <Path d="M300 520 h26 a10 10 0 0 0 0 -20 a14 14 0 0 0 -26 -3 a9 9 0 0 0 0 23z" fill={mapColors.cloud} opacity={0.9} />
                </G>
                <Path
                    d={curvePath(outgoing.from, outgoing.control, outgoing.to)}
                    stroke={hasOutgoing || isDark ? routeColors.outgoing : '#C3CEE0'}
                    strokeWidth={3}
                    strokeDasharray="2 9"
                    strokeLinecap="round"
                    fill="none"
                />
                {hasIncoming ? (
                    <Path
                        d={curvePath(incoming.from, incoming.control, incoming.to)}
                        stroke={routeColors.incoming}
                        strokeWidth={3}
                        strokeDasharray="2 9"
                        strokeLinecap="round"
                        fill="none"
                    />
                ) : null}
                {flights.map(({ letter, routeColor, curve, progress }) => (
                    <Path
                        key={`trail-${letter.id}`}
                        d={flownCurvePath(curve.from, curve.control, curve.to, progress)}
                        stroke={routeColor}
                        strokeWidth={4}
                        strokeLinecap="round"
                        fill="none"
                    />
                ))}
            </Svg>

            <Pin point={geometry.you} label={translateUiText('You')} ringColor="#D23F66" labelAbove />
            <Pin point={geometry.partner} label={partnerName} ringColor="#2E1E3C" labelAbove={false} />

            {flights.map(({ letter, bird, routeColor, point, timeLeft }) => (
                <TouchableOpacity
                    key={`bird-${letter.id}`}
                    activeOpacity={0.85}
                    onPress={() => onBirdPress?.(letter.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${translateUiText(bird.name)}, ${timeLeft}`}
                    style={[styles.birdWrap, { left: point.x - MARKER_SIZE / 2, top: point.y - MARKER_SIZE / 2 }]}
                >
                    <View style={[styles.birdMarker, { borderColor: routeColor }]}>
                        <BirdArt bird={bird.id} size={44} />
                    </View>
                    <View style={[styles.timeChip, { backgroundColor: bird.route }]}>
                        <Text style={styles.timeChipText}>{timeLeft}</Text>
                    </View>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    pinWrap: {
        position: 'absolute',
        width: 160,
        alignItems: 'center',
    },
    pinDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 4,
        backgroundColor: '#FFFFFF',
    },
    pinLabel: {
        maxWidth: 160,
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 15,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        color: '#2E1E3C',
        fontFamily: fontFamily.extraBold,
        fontSize: 13,
    },
    pinLabelBelow: {
        marginTop: 8,
        marginBottom: 0,
    },
    birdWrap: {
        position: 'absolute',
        width: MARKER_SIZE,
        alignItems: 'center',
    },
    birdMarker: {
        width: MARKER_SIZE,
        height: MARKER_SIZE,
        borderRadius: MARKER_SIZE / 2,
        borderWidth: 3,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#2E1E3C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
        elevation: 4,
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

export default LettersMap;
