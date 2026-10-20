import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, PenLine } from 'lucide-react-native';
import BirdArt from '../components/letters/BirdArt';
import LetterRow from '../components/letters/LetterRow';
import LettersIntroSheet from '../components/letters/LettersIntroSheet';
import LettersMap from '../components/letters/LettersMap';
import LettersMapbox from '../components/letters/LettersMapbox';
import { fetchLetterMap, fetchLetters } from '../api/lettersApi';
import useLetterEvents from '../hooks/useLetterEvents';
import { fontFamily } from '../constants/fonts';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import { trackEvent } from '../utils/analytics';
import {
    getClockOffsetMs,
    hasSeenLettersIntro,
    cacheMapPoints,
    getCachedMapPoints,
    markLettersIntroSeen,
    resolveMapPins,
} from '../utils/letters';

const TICK_MS = 30 * 1000;
const PANEL_COLLAPSED_HEIGHT = 200;

const LettersScreen = ({
    userId,
    partnerName = 'Your partner',
    hasPartner = false,
    onLinkPartner,
    onWriteLetter,
    onOpenLetter,
}) => {
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const [letters, setLetters] = useState([]);
    const [counts, setCounts] = useState({ flying: 0, delivered: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [clockOffsetMs, setClockOffsetMs] = useState(0);
    const [nowMs, setNowMs] = useState(Date.now());
    const [introVisible, setIntroVisible] = useState(false);
    const [mapPoints, setMapPoints] = useState(() => getCachedMapPoints(userId));
    // False until the first map answer, so the drawn map never flashes first.
    const [mapChecked, setMapChecked] = useState(false);
    const requestRef = useRef(0);

    const tabBarSpace = insets.bottom + 84;
    const snapPoints = useMemo(() => [PANEL_COLLAPSED_HEIGHT, '72%'], []);

    const loadLetters = useCallback(async () => {
        if (!hasPartner) {
            setLoading(false);
            return;
        }
        const requestId = ++requestRef.current;
        try {
            const data = await fetchLetters({ limit: 30 });
            if (requestId !== requestRef.current) return;
            const offset = getClockOffsetMs(data.serverNow);
            setClockOffsetMs(offset);
            setNowMs(Date.now() + offset);
            setLetters(data.letters || []);
            setCounts(data.counts || { flying: 0, delivered: 0 });
            setError(null);
        } catch (loadError) {
            if (requestId !== requestRef.current) return;
            setError(loadError.message || translateUiText('Could not load your letters'));
        } finally {
            if (requestId === requestRef.current) setLoading(false);
        }
    }, [hasPartner]);

    const loadMap = useCallback(async () => {
        if (!hasPartner) {
            setMapChecked(true);
            return;
        }
        try {
            const points = await fetchLetterMap();
            setMapPoints(points);
            cacheMapPoints(userId, points);
        } catch {
            // Keep the cached cities; the drawn map is the fallback when there are none.
        } finally {
            setMapChecked(true);
        }
    }, [hasPartner, userId]);

    useEffect(() => {
        loadLetters();
    }, [loadLetters]);

    useEffect(() => {
        loadMap();
    }, [loadMap]);

    useEffect(() => {
        if (hasPartner && !hasSeenLettersIntro(userId)) setIntroVisible(true);
    }, [hasPartner, userId]);

    // Move the birds along, and refetch the moment the next one is due to land.
    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now() + clockOffsetMs), TICK_MS);
        return () => clearInterval(timer);
    }, [clockOffsetMs]);

    const nextLandingMs = useMemo(() => letters
        .filter((letter) => letter.status === 'flying')
        .map((letter) => new Date(letter.deliverAt).getTime())
        .sort((a, b) => a - b)[0], [letters]);

    useEffect(() => {
        if (!nextLandingMs) return undefined;
        const wait = Math.max(1000, nextLandingMs - (Date.now() + clockOffsetMs) + 1500);
        const timer = setTimeout(loadLetters, Math.min(wait, 2 ** 31 - 1));
        return () => clearTimeout(timer);
    }, [nextLandingMs, clockOffsetMs, loadLetters]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                loadLetters();
                loadMap();
            }
        });
        return () => subscription.remove();
    }, [loadLetters, loadMap]);

    useLetterEvents(() => {
        loadLetters();
    });

    const flyingLetters = useMemo(() => letters.filter((letter) => letter.status === 'flying'), [letters]);
    const distanceKm = useMemo(
        () => mapPoints?.distanceKm
            ?? letters.find((letter) => Number.isFinite(letter.route?.distanceKm))?.route.distanceKm
            ?? null,
        [letters, mapPoints],
    );
    // The real map needs at least one shared city; a hidden partner gets a stand-in pin.
    const mapPins = useMemo(
        () => resolveMapPins(mapPoints?.you || null, mapPoints?.partner || null),
        [mapPoints],
    );
    const showRealMap = hasPartner && !!mapPins;
    const waitingForMap = hasPartner && !mapPins && !mapChecked;

    const handleWrite = useCallback((source) => {
        trackEvent('letters_write_open', { source });
        onWriteLetter?.();
    }, [onWriteLetter]);

    const closeIntro = useCallback(() => {
        markLettersIntroSeen(userId);
        setIntroVisible(false);
    }, [userId]);

    const renderPanelHeader = () => (
        <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>
                {flyingLetters.length > 0 ? translateUiText('In the sky') : translateUiText('Delivered letters')}
            </Text>
            <Text style={styles.panelCount}>
                {translateUiTemplate('{{0}} flying · {{1}} delivered', [counts.flying, counts.delivered])}
            </Text>
        </View>
    );

    const renderPanelEmpty = () => {
        if (loading) return <ActivityIndicator style={styles.panelLoading} color="#D23F66" />;
        if (error) {
            return (
                <View style={styles.panelMessage}>
                    <Text style={styles.panelMessageText}>{error}</Text>
                    <TouchableOpacity onPress={loadLetters} style={styles.retry} accessibilityRole="button">
                        <Text style={styles.retryText}>{translateUiText('Try again')}</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return (
            <View style={styles.panelMessage}>
                <Text style={styles.panelMessageText}>{translateUiText('Your letters will collect here.')}</Text>
            </View>
        );
    };

    const showEmptyCard = hasPartner && !loading && !error && flyingLetters.length === 0;

    return (
        <View style={styles.container}>
            {showRealMap ? (
                <LettersMapbox
                    you={mapPins.you}
                    partner={mapPins.partner}
                    youApprox={mapPins.youApprox}
                    partnerApprox={mapPins.partnerApprox}
                    letters={letters}
                    nowMs={nowMs}
                    partnerName={partnerName}
                    topInset={insets.top}
                    bottomInset={tabBarSpace + PANEL_COLLAPSED_HEIGHT}
                    onBirdPress={onOpenLetter}
                />
            ) : waitingForMap ? (
                <View style={[StyleSheet.absoluteFill, styles.mapPlaceholder]} />
            ) : (
                <LettersMap
                    width={width}
                    height={height}
                    letters={hasPartner ? letters : []}
                    nowMs={nowMs}
                    partnerName={partnerName}
                    onBirdPress={onOpenLetter}
                />
            )}

            <View style={[styles.header, { top: insets.top + 10 }]} pointerEvents="box-none">
                <View style={styles.titleCard}>
                    <Text style={styles.title} accessibilityRole="header">{translateUiText('Letters')}</Text>
                    {distanceKm ? (
                        <Text style={styles.titleMeta}>
                            {translateUiTemplate('{{0}} km between you', [distanceKm.toLocaleString()])}
                        </Text>
                    ) : null}
                </View>
                <View style={styles.privacyChip}>
                    <MapPin size={14} color="#4B3D5C" strokeWidth={2.2} />
                    <Text style={styles.privacyText}>{translateUiText('City-level only')}</Text>
                </View>
            </View>

            {!hasPartner ? (
                <View style={[styles.centerCard, { top: height * 0.28 }]}>
                    <BirdArt bird="penguin" size={110} sleeping />
                    <Text style={styles.centerTitle}>{translateUiText('Letters need two')}</Text>
                    <Text style={styles.centerBody}>{translateUiText('Connect with your partner to start sending letters by bird.')}</Text>
                    <TouchableOpacity style={styles.centerButton} onPress={onLinkPartner} activeOpacity={0.85} accessibilityRole="button">
                        <Text style={styles.centerButtonText}>{translateUiText('Connect partner')}</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {showEmptyCard ? (
                <View style={[styles.centerCard, { top: height * 0.28 }]}>
                    <BirdArt bird="penguin" size={110} sleeping />
                    <Text style={styles.centerTitle}>{translateUiText('No birds in the sky')}</Text>
                    <Text style={styles.centerBody}>
                        {translateUiTemplate("Write {{0}} a letter and pick a bird. You'll both watch it fly across the map.", [partnerName])}
                    </Text>
                    <TouchableOpacity style={styles.centerButton} onPress={() => handleWrite('empty_state')} activeOpacity={0.85} accessibilityRole="button">
                        <PenLine size={20} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.centerButtonText}>{translateUiText('Write a letter')}</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {hasPartner && !showEmptyCard ? (
                <TouchableOpacity
                    style={[styles.fab, { bottom: tabBarSpace + PANEL_COLLAPSED_HEIGHT + 16 }]}
                    onPress={() => handleWrite('fab')}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                >
                    <PenLine size={22} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.fabText}>{translateUiText('Write a letter')}</Text>
                </TouchableOpacity>
            ) : null}

            {hasPartner ? (
                <BottomSheet
                    index={0}
                    snapPoints={snapPoints}
                    bottomInset={tabBarSpace}
                    enableDynamicSizing={false}
                    backgroundStyle={styles.panelBackground}
                    handleIndicatorStyle={styles.panelHandle}
                    style={styles.panelShadow}
                >
                    <BottomSheetFlatList
                        data={letters}
                        keyExtractor={(letter) => letter.id}
                        ListHeaderComponent={renderPanelHeader}
                        ListEmptyComponent={renderPanelEmpty}
                        contentContainerStyle={styles.panelContent}
                        renderItem={({ item }) => (
                            <LetterRow
                                letter={item}
                                partnerName={partnerName}
                                nowMs={nowMs}
                                onPress={onOpenLetter}
                            />
                        )}
                    />
                </BottomSheet>
            ) : null}

            <LettersIntroSheet
                visible={introVisible}
                partnerName={partnerName}
                onClose={closeIntro}
                onWrite={() => {
                    closeIntro();
                    handleWrite('intro');
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#D6E8F5',
    },
    mapPlaceholder: {
        backgroundColor: '#F6EEDF',
    },
    header: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    titleCard: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.94)',
        shadowColor: '#2E1E3C',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 3,
    },
    title: {
        fontFamily: fontFamily.extraBold,
        fontSize: 26,
        color: '#2E1E3C',
    },
    titleMeta: {
        fontFamily: fontFamily.bold,
        fontSize: 13,
        color: '#5A4C6B',
    },
    privacyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.94)',
    },
    privacyText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 12,
        color: '#4B3D5C',
    },
    centerCard: {
        position: 'absolute',
        left: 32,
        right: 32,
        alignItems: 'center',
        gap: 10,
        paddingTop: 20,
        paddingBottom: 22,
        paddingHorizontal: 22,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        shadowColor: '#2E1E3C',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.14,
        shadowRadius: 24,
        elevation: 6,
    },
    centerTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 21,
        color: '#2E1E3C',
        textAlign: 'center',
    },
    centerBody: {
        fontFamily: fontFamily.bold,
        fontSize: 14,
        lineHeight: 20,
        color: '#5A4C6B',
        textAlign: 'center',
    },
    centerButton: {
        marginTop: 6,
        height: 52,
        paddingHorizontal: 24,
        borderRadius: 26,
        backgroundColor: '#D23F66',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    centerButtonText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 16,
        color: '#FFFFFF',
    },
    fab: {
        position: 'absolute',
        right: 16,
        height: 56,
        paddingLeft: 18,
        paddingRight: 22,
        borderRadius: 28,
        backgroundColor: '#D23F66',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#D23F66',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 6,
    },
    fabText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 16,
        color: '#FFFFFF',
    },
    panelShadow: {
        shadowColor: '#2E1E3C',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    panelBackground: {
        borderRadius: 30,
        backgroundColor: '#FFFFFF',
    },
    panelHandle: {
        width: 40,
        backgroundColor: '#E5DAEE',
    },
    panelContent: {
        paddingHorizontal: 18,
        paddingBottom: 24,
    },
    panelHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingTop: 2,
        paddingBottom: 8,
    },
    panelTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 17,
        color: '#2E1E3C',
    },
    panelCount: {
        fontFamily: fontFamily.bold,
        fontSize: 13,
        color: '#5A4C6B',
    },
    panelLoading: {
        marginTop: 24,
    },
    panelMessage: {
        alignItems: 'center',
        paddingVertical: 16,
        gap: 10,
    },
    panelMessageText: {
        fontFamily: fontFamily.bold,
        fontSize: 14,
        color: '#5A4C6B',
        textAlign: 'center',
    },
    retry: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 18,
        backgroundColor: '#FFE4EA',
    },
    retryText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 14,
        color: '#B0274F',
    },
});

export default LettersScreen;
