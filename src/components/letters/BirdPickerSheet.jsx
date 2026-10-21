import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Clock, Crown } from 'lucide-react-native';
import BirdArt from './BirdArt';
import LettersSheet from './LettersSheet';
import { PremiumBirdContent } from './PremiumBirdSheet';
import { fontFamily } from '../../constants/fonts';
import { translateUiTemplate, translateUiText } from '../../i18n/uiTranslation';
import { LETTER_BIRDS, formatArrival, formatTravelTime, getLetterBird } from '../../utils/letters';

// Bird choice and the Premium upsell share one sheet; `mode` picks which body shows.
const BirdPickerSheet = ({
    mode,
    birdId,
    partnerName,
    hasPremiumAccess,
    sending,
    onClose,
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

    return (
        <LettersSheet visible={visible} onClose={sending ? undefined : onClose}>
            {mode === 'premium' ? (
                <PremiumBirdContent onUpgrade={onUpgrade} onUseFreeBird={onUseFreeBird} />
            ) : (
                <>
                    <View style={styles.heading}>
                        <Text style={styles.title} accessibilityRole="header">{translateUiText('Who carries it?')}</Text>
                        <Text style={styles.subtitle}>{translateUiText('Slower = sweeter')}</Text>
                    </View>

                    <View style={styles.list} accessibilityRole="radiogroup">
                        {LETTER_BIRDS.map((option) => {
                            const selected = option.id === birdId;
                            const locked = option.premium && !hasPremiumAccess;
                            return (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[styles.row, selected && styles.rowSelected]}
                                    onPress={() => onSelectBird(option.id)}
                                    disabled={sending}
                                    activeOpacity={0.85}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: selected, disabled: sending }}
                                    accessibilityLabel={`${translateUiText(option.name)}, ${formatTravelTime(option.travelMs)}${locked ? `, ${translateUiText('Premium')}` : ''}`}
                                >
                                    <View style={[styles.tile, { backgroundColor: option.tint }]}>
                                        <BirdArt bird={option.id} size={42} />
                                    </View>
                                    <View style={styles.rowText}>
                                        <View style={styles.nameLine}>
                                            <Text style={styles.name}>{translateUiText(option.name)}</Text>
                                            {option.premium ? (
                                                <View style={styles.premiumTag}>
                                                    <Crown size={11} color="#8A5A00" strokeWidth={2.4} />
                                                    <Text style={styles.premiumTagText}>{translateUiText('Premium')}</Text>
                                                </View>
                                            ) : (
                                                <View style={styles.freeTag}>
                                                    <Text style={styles.freeTagText}>{translateUiText('Free')}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={[styles.time, { color: option.ink }]}>{formatTravelTime(option.travelMs)}</Text>
                                    </View>
                                    <View style={[styles.radio, selected && styles.radioSelected]}>
                                        {selected ? <View style={styles.radioDot} /> : null}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

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
    list: {
        gap: 10,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#FAE8FF',
        backgroundColor: '#FFFFFF',
    },
    rowSelected: {
        borderColor: '#D23F66',
        backgroundColor: '#FFF6F8',
    },
    tile: {
        width: 52,
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowText: {
        flex: 1,
        gap: 2,
    },
    nameLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    name: {
        fontFamily: fontFamily.extraBold,
        fontSize: 16,
        color: '#2E1E3C',
    },
    time: {
        fontFamily: fontFamily.extraBold,
        fontSize: 13,
    },
    premiumTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
        backgroundColor: '#FFF1D6',
    },
    premiumTagText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 11,
        color: '#8A5A00',
    },
    freeTag: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
        backgroundColor: '#E4F6EA',
    },
    freeTagText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 11,
        color: '#1F6B3A',
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#D8C9E6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelected: {
        borderColor: '#D23F66',
    },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#D23F66',
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
