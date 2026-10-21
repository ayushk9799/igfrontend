import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, Clock, Crown } from 'lucide-react-native';
import BirdArt from './BirdArt';
import LettersSheet from './LettersSheet';
import { PremiumBirdContent } from './PremiumBirdSheet';
import { fontFamily } from '../../constants/fonts';
import { translateUiTemplate, translateUiText } from '../../i18n/uiTranslation';
import { LETTER_BIRDS, formatArrival, formatTravelTime, getLetterBird } from '../../utils/letters';

// Narrow enough that a third card peeks in, hinting the row scrolls.
const CARD_WIDTH = 148;
const CARD_GAP = 12;

// Bird choice and the Premium upsell share one sheet; `mode` picks which body shows.
const BirdPickerSheet = ({
    mode,
    birdId,
    partnerName,
    hasPremiumAccess,
    sending,
    onClose,
    onHeightChange,
    onSelectBird,
    onSend,
    onUpgrade,
    onUseFreeBird,
}) => {
    const visible = mode === 'birds' || mode === 'premium';
    const bird = getLetterBird(birdId);
    // Recomputed each time the sheet opens so the arrival time is never stale.
    const arrival = useMemo(
        () => (visible ? formatArrival(new Date(Date.now() + bird.travelMs)) : ''),
        [bird.travelMs, visible],
    );
    const carouselRef = useRef(null);
    const showingBirds = mode === 'birds';
    // Read through a ref so tapping a card doesn't re-run the scroll below.
    const birdIdRef = useRef(birdId);
    birdIdRef.current = birdId;

    // Bring the chosen bird into view when the picker opens, e.g. a Falcon picked last time.
    useEffect(() => {
        if (!showingBirds) return;
        const index = LETTER_BIRDS.findIndex((option) => option.id === birdIdRef.current);
        carouselRef.current?.scrollTo({ x: Math.max(0, index - 1) * (CARD_WIDTH + CARD_GAP), animated: false });
    }, [showingBirds]);

    return (
        <LettersSheet visible={visible} onClose={sending ? undefined : onClose} onHeightChange={onHeightChange} dimBackdrop={false}>
            {mode === 'premium' ? (
                <PremiumBirdContent onUpgrade={onUpgrade} onUseFreeBird={onUseFreeBird} />
            ) : (
                <>
                    <View style={styles.heading}>
                        <Text style={styles.title} accessibilityRole="header">{translateUiText('Who carries it?')}</Text>
                        <Text style={styles.subtitle}>{translateUiText('Slower = sweeter')}</Text>
                    </View>

                    <ScrollView
                        ref={carouselRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        decelerationRate="fast"
                        snapToInterval={CARD_WIDTH + CARD_GAP}
                        snapToAlignment="start"
                        style={styles.carousel}
                        contentContainerStyle={styles.carouselContent}
                        accessibilityRole="radiogroup"
                    >
                        {LETTER_BIRDS.map((option) => {
                            const selected = option.id === birdId;
                            const locked = option.premium && !hasPremiumAccess;
                            return (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[styles.card, selected && styles.cardSelected]}
                                    onPress={() => onSelectBird(option.id)}
                                    disabled={sending}
                                    activeOpacity={0.85}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: selected, disabled: sending }}
                                    accessibilityLabel={`${translateUiText(option.name)}, ${formatTravelTime(option.travelMs)}${locked ? `, ${translateUiText('Premium')}` : ''}`}
                                >
                                    <View style={[styles.tile, { backgroundColor: option.tint }]}>
                                        <BirdArt bird={option.id} size={78} />
                                        {option.premium ? (
                                            <View style={[styles.tag, styles.premiumTag]}>
                                                <Crown size={11} color="#8A5A00" strokeWidth={2.4} />
                                                <Text style={styles.premiumTagText}>{translateUiText('Premium')}</Text>
                                            </View>
                                        ) : (
                                            <View style={[styles.tag, styles.freeTag]}>
                                                <Text style={styles.freeTagText}>{translateUiText('Free')}</Text>
                                            </View>
                                        )}
                                        {selected ? (
                                            <View style={styles.check}>
                                                <Check size={14} color="#FFFFFF" strokeWidth={3} />
                                            </View>
                                        ) : null}
                                    </View>
                                    <Text style={styles.name} numberOfLines={1}>{translateUiText(option.name)}</Text>
                                    <View style={styles.timeLine}>
                                        <Clock size={13} color={option.ink} strokeWidth={2.4} />
                                        <Text style={[styles.time, { color: option.ink }]}>{formatTravelTime(option.travelMs)}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.eta}>
                        <Clock size={18} color="#6E6080" strokeWidth={2} />
                        <Text style={styles.etaText}>
                            {translateUiTemplate('{{0}} can open it {{1}}', [partnerName, arrival])}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.send, sending && styles.sendBusy]}
                        onPress={() => onSend(bird.id)}
                        disabled={sending}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: sending, busy: sending }}
                    >
                        {sending ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.sendText}>
                                {translateUiTemplate('Send with {{0}}', [translateUiText(bird.name)])}
                            </Text>
                        )}
                    </TouchableOpacity>
                </>
            )}
        </LettersSheet>
    );
};

const styles = StyleSheet.create({
    heading: {
        gap: 2,
    },
    title: {
        fontFamily: fontFamily.extraBold,
        fontSize: 22,
        color: '#2E1E3C',
    },
    subtitle: {
        fontFamily: fontFamily.bold,
        fontSize: 13,
        color: '#6E6080',
    },
    carousel: {
        // Let the cards scroll edge to edge past the sheet's side padding.
        marginHorizontal: -24,
        flexGrow: 0,
    },
    carouselContent: {
        paddingHorizontal: 24,
        paddingVertical: 4,
        gap: CARD_GAP,
    },
    card: {
        width: CARD_WIDTH,
        padding: 8,
        paddingBottom: 12,
        gap: 4,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: '#FAE8FF',
        backgroundColor: '#FFFFFF',
    },
    cardSelected: {
        borderColor: '#D23F66',
        backgroundColor: '#FFF6F8',
    },
    tile: {
        height: 112,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    tag: {
        position: 'absolute',
        top: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
    },
    premiumTag: {
        backgroundColor: '#FFF1D6',
    },
    premiumTagText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 11,
        color: '#8A5A00',
    },
    freeTag: {
        backgroundColor: '#E4F6EA',
    },
    freeTagText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 11,
        color: '#1F6B3A',
    },
    check: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#D23F66',
        alignItems: 'center',
        justifyContent: 'center',
    },
    name: {
        fontFamily: fontFamily.extraBold,
        fontSize: 16,
        color: '#2E1E3C',
        paddingHorizontal: 4,
    },
    timeLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 4,
    },
    time: {
        fontFamily: fontFamily.extraBold,
        fontSize: 13,
    },
    eta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    etaText: {
        flex: 1,
        fontFamily: fontFamily.bold,
        fontSize: 13,
        color: '#4B3D5C',
    },
    send: {
        height: 56,
        borderRadius: 28,
        backgroundColor: '#D23F66',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBusy: {
        opacity: 0.7,
    },
    sendText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 17,
        color: '#FFFFFF',
    },
});

export default BirdPickerSheet;
