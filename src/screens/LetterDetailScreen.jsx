import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Lock } from 'lucide-react-native';
import BirdArt from '../components/letters/BirdArt';
import { fetchLetter, markLetterRead, recallLetter } from '../api/lettersApi';
import useLetterEvents from '../hooks/useLetterEvents';
import { fontFamily } from '../constants/fonts';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import { trackEvent } from '../utils/analytics';
import {
    curvePath,
    flownCurvePath,
    formatArrival,
    formatTimeLeft,
    formatTravelTime,
    getClockOffsetMs,
    getLetterBird,
    getLiveProgress,
    getTimeLeftMs,
    pointOnCurve,
} from '../utils/letters';

const TICK_MS = 30 * 1000;
const HERO_HEIGHT = 236;

const Header = ({ title, subtitle, onBack }) => (
    <View style={styles.header}>
        <TouchableOpacity
            style={styles.iconButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={translateUiText('Back')}
        >
            <ChevronLeft size={22} color="#2E1E3C" strokeWidth={2.2} />
        </TouchableOpacity>
        <View style={styles.headerText}>
            <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
    </View>
);

const FlightHero = ({ letter, bird, progress, width, partnerName }) => {
    const heroWidth = width - 40;
    const from = { x: 36, y: 200 };
    const control = { x: heroWidth / 2, y: 40 };
    const to = { x: heroWidth - 36, y: 200 };
    const birdPoint = pointOnCurve(from, control, to, progress);
    const isOutgoing = letter.direction === 'outgoing';

    return (
        <View style={[styles.hero, { backgroundColor: bird.tint }]}>
            <Svg width={heroWidth} height={HERO_HEIGHT}>
                <Path d={curvePath(from, control, to)} stroke="#A9C2DE" strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" fill="none" />
                <Path d={flownCurvePath(from, control, to, progress)} stroke={bird.route} strokeWidth={4} strokeLinecap="round" fill="none" />
                <Circle cx={from.x} cy={from.y} r={9} fill="#FFFFFF" stroke={isOutgoing ? '#D23F66' : '#2E1E3C'} strokeWidth={4} />
                <Circle cx={to.x} cy={to.y} r={9} fill="#FFFFFF" stroke={isOutgoing ? '#2E1E3C' : '#D23F66'} strokeWidth={4} />
            </Svg>
            <Text style={[styles.heroLabel, styles.heroLabelLeft]} numberOfLines={1}>{isOutgoing ? translateUiText('You') : partnerName}</Text>
            <Text style={[styles.heroLabel, styles.heroLabelRight]} numberOfLines={1}>{isOutgoing ? partnerName : translateUiText('You')}</Text>
            <View pointerEvents="none" style={[styles.heroBird, { left: birdPoint.x - 60, top: birdPoint.y - 74 }]}>
                <BirdArt bird={bird.id} size={120} />
            </View>
        </View>
    );
};

const LetterDetailScreen = ({
    letterId,
    partnerName = 'Your partner',
    onBack,
    onReply,
}) => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const [letter, setLetter] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [clockOffsetMs, setClockOffsetMs] = useState(0);
    const [nowMs, setNowMs] = useState(Date.now());
    const [opening, setOpening] = useState(false);
    const [recalling, setRecalling] = useState(false);

    const load = useCallback(async () => {
        if (!letterId) return;
        try {
            const data = await fetchLetter(letterId);
            const offset = getClockOffsetMs(data.serverNow);
            setClockOffsetMs(offset);
            setNowMs(Date.now() + offset);
            setLetter(data.letter);
            setError(null);
        } catch (loadError) {
            setError(loadError.status === 404
                ? translateUiText('This letter is no longer here.')
                : (loadError.message || translateUiText('Could not load this letter')));
        } finally {
            setLoading(false);
        }
    }, [letterId]);

    useEffect(() => {
        setLoading(true);
        setLetter(null);
        load();
    }, [load]);

    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now() + clockOffsetMs), TICK_MS);
        return () => clearInterval(timer);
    }, [clockOffsetMs]);

    // Refetch right after landing so the recipient gets the text.
    useEffect(() => {
        if (letter?.status !== 'flying') return undefined;
        const wait = Math.max(1000, new Date(letter.deliverAt).getTime() - (Date.now() + clockOffsetMs) + 1500);
        const timer = setTimeout(load, Math.min(wait, 2 ** 31 - 1));
        return () => clearTimeout(timer);
    }, [letter, clockOffsetMs, load]);

    useLetterEvents((eventName, payload) => {
        if (String(payload?.letterId) === String(letterId)) load();
    });

    const handleOpen = async () => {
        setOpening(true);
        try {
            const data = await markLetterRead(letter.id);
            setLetter(data.letter);
            trackEvent('letter_opened', { bird: letter.bird });
        } catch (openError) {
            Alert.alert(translateUiText('Could not open the letter'), openError.message || translateUiText('Please try again.'));
        } finally {
            setOpening(false);
        }
    };

    const handleRecall = () => {
        Alert.alert(
            translateUiText('Call your bird back?'),
            translateUiTemplate("{{0}} won't get this letter.", [partnerName]),
            [
                { text: translateUiText('Keep flying'), style: 'cancel' },
                {
                    text: translateUiText('Call it back'),
                    style: 'destructive',
                    onPress: async () => {
                        setRecalling(true);
                        try {
                            const data = await recallLetter(letter.id);
                            setLetter(data.letter);
                            trackEvent('letter_recalled', { bird: letter.bird });
                        } catch (recallError) {
                            Alert.alert(translateUiText('Too late'), recallError.message || translateUiText('This bird has already landed'));
                            load();
                        } finally {
                            setRecalling(false);
                        }
                    },
                },
            ],
        );
    };

    if (loading || error || !letter) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Header title={translateUiText('Letter')} onBack={onBack} />
                <View style={styles.centered}>
                    {loading ? <ActivityIndicator color="#D23F66" /> : (
                        <>
                            <Text style={styles.message}>{error}</Text>
                            <TouchableOpacity style={styles.secondaryButton} onPress={onBack} accessibilityRole="button">
                                <Text style={styles.secondaryButtonText}>{translateUiText('Back to letters')}</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        );
    }

    const bird = getLetterBird(letter.bird);
    const birdName = translateUiText(bird.name);
    const isOutgoing = letter.direction === 'outgoing';
    const title = isOutgoing
        ? translateUiTemplate('Letter to {{0}}', [partnerName])
        : translateUiTemplate('From {{0}}', [partnerName]);
    const now = new Date(nowMs);

    if (letter.status === 'recalled') {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Header title={title} onBack={onBack} />
                <View style={styles.centered}>
                    <BirdArt bird={bird.id} size={140} sleeping />
                    <Text style={styles.landTitle}>{translateUiText('Bird called back')}</Text>
                    <Text style={styles.message}>{translateUiTemplate('{{0}} never saw this letter.', [partnerName])}</Text>
                </View>
            </View>
        );
    }

    if (letter.status === 'flying') {
        const progress = getLiveProgress(letter, nowMs);
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <Header
                    title={title}
                    subtitle={translateUiTemplate('Sent {{0}}', [formatArrival(letter.sentAt, now)])}
                    onBack={onBack}
                />
                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
                    <FlightHero letter={letter} bird={bird} progress={progress} width={width} partnerName={partnerName} />
                    <View style={styles.countdownRow}>
                        <View>
                            <Text style={styles.countdownLabel}>
                                {isOutgoing
                                    ? translateUiTemplate('Your {{0}} lands in', [birdName])
                                    : translateUiText('Lands in')}
                            </Text>
                            <Text style={styles.countdown}>{formatTimeLeft(getTimeLeftMs(letter, nowMs))}</Text>
                        </View>
                        <View style={styles.arrival}>
                            <Text style={styles.arrivalLabel}>{translateUiText('Arrives')}</Text>
                            <Text style={styles.arrivalValue}>{formatArrival(letter.deliverAt, now)}</Text>
                        </View>
                    </View>
                    <View style={[styles.track, { backgroundColor: bird.tint }]}>
                        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: bird.route }]} />
                    </View>
                    <Text style={styles.trackCaption}>
                        {translateUiTemplate('{{0}}% of the way', [Math.round(progress * 100)])}
                    </Text>

                    <View style={styles.sealed}>
                        <View style={styles.sealedRow}>
                            <Lock size={16} color="#4B3D5C" strokeWidth={2.2} />
                            <Text style={styles.sealedTitle}>
                                {isOutgoing
                                    ? translateUiTemplate('Sealed. {{0}} can open it when it lands.', [partnerName])
                                    : translateUiText('Sealed until it lands. No peeking!')}
                            </Text>
                        </View>
                        {isOutgoing && letter.body ? (
                            <Text style={styles.sealedPreview} numberOfLines={3}>“{letter.body}”</Text>
                        ) : null}
                    </View>

                    <View style={styles.actions}>
                        {isOutgoing ? (
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={handleRecall}
                                disabled={recalling}
                                accessibilityRole="button"
                            >
                                <Text style={styles.secondaryButtonText}>{translateUiText('Call bird back')}</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.secondaryButton} onPress={onReply} accessibilityRole="button">
                                <Text style={styles.secondaryButtonText}>{translateUiText('Send a bird back')}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.darkButton} onPress={onBack} accessibilityRole="button">
                            <Text style={styles.darkButtonText}>{translateUiText('See on map')}</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        );
    }

    // Delivered. The recipient gets a landing moment before the first open.
    if (!isOutgoing && !letter.readAt) {
        return (
            <View style={[styles.container, styles.landing, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
                <Header title="" onBack={onBack} />
                <View style={styles.landingBody}>
                    <View style={styles.landingHalo}>
                        <BirdArt bird={bird.id} size={210} />
                    </View>
                    <Text style={styles.landEyebrow}>{translateUiText('JUST LANDED')}</Text>
                    <Text style={styles.landTitle}>{translateUiText('Your letter is here')}</Text>
                    <Text style={styles.message}>
                        {letter.route?.distanceKm
                            ? translateUiTemplate("{{0}}'s {{1}} flew {{2}} km to bring you this.", [partnerName, birdName, letter.route.distanceKm.toLocaleString()])
                            : translateUiTemplate("{{0}}'s {{1}} flew all the way to bring you this.", [partnerName, birdName])}
                    </Text>
                </View>
                <View style={styles.landingActions}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleOpen}
                        disabled={opening}
                        accessibilityRole="button"
                        accessibilityState={{ busy: opening }}
                    >
                        {opening
                            ? <ActivityIndicator color="#FFFFFF" />
                            : <Text style={styles.primaryButtonText}>{translateUiText('Open letter')}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.textButton} onPress={onBack} accessibilityRole="button">
                        <Text style={styles.textButtonText}>{translateUiText('Save it for later')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const flightMs = new Date(letter.deliverAt).getTime() - new Date(letter.sentAt).getTime();
    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Header
                title={title}
                subtitle={translateUiTemplate('Landed {{0}}', [formatArrival(letter.deliveredAt || letter.deliverAt, now)])}
                onBack={onBack}
            />
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
                <View style={styles.letterPaper}>
                    <View style={[styles.stamp, { backgroundColor: bird.tint }]}>
                        <BirdArt bird={bird.id} size={44} />
                        <Text style={[styles.stampText, { color: bird.ink }]}>{birdName.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.letterBody} selectable>{letter.body}</Text>
                </View>

                <View style={styles.journey}>
                    <Text style={styles.journeyTitle}>{translateUiText('THE JOURNEY')}</Text>
                    <View style={styles.journeyStats}>
                        <View style={styles.journeyStat}>
                            <Text style={styles.journeyValue}>{formatTravelTime(flightMs)}</Text>
                            <Text style={styles.journeyLabel}>{translateUiText('In the sky')}</Text>
                        </View>
                        {letter.route?.distanceKm ? (
                            <View style={styles.journeyStat}>
                                <Text style={styles.journeyValue}>{letter.route.distanceKm.toLocaleString()} km</Text>
                                <Text style={styles.journeyLabel}>{translateUiText('Distance flown')}</Text>
                            </View>
                        ) : null}
                        <View style={styles.journeyStat}>
                            <Text style={styles.journeyValue}>{birdName}</Text>
                            <Text style={styles.journeyLabel}>{translateUiText('Carried by')}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={onBack} accessibilityRole="button">
                        <Text style={styles.secondaryButtonText}>{translateUiText('Back to letters')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primaryButtonFlex} onPress={onReply} accessibilityRole="button">
                        <Text style={styles.primaryButtonText}>{translateUiText('Reply by bird')}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF6F6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#F5E1FD',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 20,
        color: '#2E1E3C',
    },
    headerSubtitle: {
        fontFamily: fontFamily.bold,
        fontSize: 13,
        color: '#5A4C6B',
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 4,
        gap: 16,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 12,
    },
    message: {
        fontFamily: fontFamily.bold,
        fontSize: 15,
        lineHeight: 22,
        color: '#4B3D5C',
        textAlign: 'center',
    },
    hero: {
        height: HERO_HEIGHT,
        borderRadius: 26,
        overflow: 'hidden',
    },
    heroLabel: {
        position: 'absolute',
        bottom: 6,
        width: 72,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
        fontSize: 13,
        color: '#2E1E3C',
    },
    heroLabelLeft: {
        left: 6,
    },
    heroLabelRight: {
        right: 6,
    },
    heroBird: {
        position: 'absolute',
    },
    countdownRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    countdownLabel: {
        fontFamily: fontFamily.extraBold,
        fontSize: 13,
        color: '#5A4C6B',
    },
    countdown: {
        fontFamily: fontFamily.extraBold,
        fontSize: 34,
        color: '#2E1E3C',
    },
    arrival: {
        alignItems: 'flex-end',
    },
    arrivalLabel: {
        fontFamily: fontFamily.bold,
        fontSize: 12,
        color: '#6E6080',
    },
    arrivalValue: {
        fontFamily: fontFamily.extraBold,
        fontSize: 16,
        color: '#2E1E3C',
    },
    track: {
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
    },
    fill: {
        height: 10,
        borderRadius: 5,
    },
    trackCaption: {
        marginTop: -8,
        alignSelf: 'flex-end',
        fontFamily: fontFamily.bold,
        fontSize: 12,
        color: '#6E6080',
    },
    sealed: {
        gap: 8,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1E3D3',
        backgroundColor: '#FFFDF8',
    },
    sealedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sealedTitle: {
        flex: 1,
        fontFamily: fontFamily.extraBold,
        fontSize: 13,
        color: '#4B3D5C',
    },
    sealedPreview: {
        fontFamily: fontFamily.bold,
        fontSize: 14,
        lineHeight: 20,
        color: '#5A4C6B',
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    secondaryButton: {
        flex: 1,
        height: 52,
        paddingHorizontal: 16,
        borderRadius: 26,
        borderWidth: 2,
        borderColor: '#F0D6E0',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 15,
        color: '#2E1E3C',
    },
    darkButton: {
        flex: 1,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#2E1E3C',
        alignItems: 'center',
        justifyContent: 'center',
    },
    darkButtonText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 15,
        color: '#FFFFFF',
    },
    landing: {
        backgroundColor: '#FFE4EA',
    },
    landingBody: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        gap: 10,
    },
    landingHalo: {
        width: 270,
        height: 270,
        borderRadius: 135,
        backgroundColor: 'rgba(255,255,255,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    landEyebrow: {
        fontFamily: fontFamily.extraBold,
        fontSize: 14,
        letterSpacing: 0.8,
        color: '#B0274F',
    },
    landTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 28,
        color: '#2E1E3C',
        textAlign: 'center',
    },
    landingActions: {
        paddingHorizontal: 28,
        gap: 6,
    },
    primaryButton: {
        height: 56,
        borderRadius: 28,
        backgroundColor: '#D23F66',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonFlex: {
        flex: 1,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#D23F66',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 16,
        color: '#FFFFFF',
    },
    textButton: {
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textButtonText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 15,
        color: '#4B3D5C',
    },
    letterPaper: {
        minHeight: 280,
        paddingTop: 26,
        paddingHorizontal: 22,
        paddingBottom: 24,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#F1E3D3',
        backgroundColor: '#FFFDF8',
        shadowColor: '#785028',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 2,
    },
    stamp: {
        position: 'absolute',
        top: -10,
        right: 18,
        width: 64,
        height: 76,
        borderRadius: 6,
        borderWidth: 3,
        borderStyle: 'dashed',
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '6deg' }],
    },
    stampText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 9,
    },
    letterBody: {
        paddingRight: 56,
        fontFamily: fontFamily.medium,
        fontSize: 17,
        lineHeight: 28,
        color: '#3A2A4A',
    },
    journey: {
        gap: 12,
        padding: 16,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#FAE8FF',
        backgroundColor: '#FFFFFF',
    },
    journeyTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 13,
        letterSpacing: 0.5,
        color: '#6E6080',
    },
    journeyStats: {
        flexDirection: 'row',
        gap: 10,
    },
    journeyStat: {
        flex: 1,
        gap: 2,
    },
    journeyValue: {
        fontFamily: fontFamily.extraBold,
        fontSize: 16,
        color: '#2E1E3C',
    },
    journeyLabel: {
        fontFamily: fontFamily.bold,
        fontSize: 12,
        color: '#6E6080',
    },
});

export default LetterDetailScreen;
