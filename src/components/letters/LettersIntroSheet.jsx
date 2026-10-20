import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BirdArt from './BirdArt';
import LettersSheet from './LettersSheet';
import { fontFamily } from '../../constants/fonts';
import { translateUiTemplate, translateUiText } from '../../i18n/uiTranslation';
import { LETTER_BIRDS, formatTravelTime } from '../../utils/letters';

const STEP_COLORS = [
    { background: '#FFE4EA', text: '#B0274F' },
    { background: '#EFE6FB', text: '#5B3A9E' },
    { background: '#E3F0FB', text: '#2F5E96' },
];

const LettersIntroSheet = ({ visible, partnerName, onClose, onWrite }) => {
    const steps = [
        translateUiTemplate('Write {{0}} a letter', [partnerName]),
        translateUiText('Pick a bird. Its speed decides when it lands.'),
        translateUiText('You both watch it fly. It stays sealed until it arrives.'),
    ];

    return (
        <LettersSheet visible={visible} onClose={onClose}>
            <View style={styles.lineup}>
                {LETTER_BIRDS.map((bird) => (
                    <View key={bird.id} style={styles.lineupItem}>
                        <BirdArt bird={bird.id} size={66} />
                        <Text style={styles.lineupTime}>{formatTravelTime(bird.travelMs)}</Text>
                    </View>
                ))}
            </View>
            <View style={styles.heading}>
                <Text style={styles.title} accessibilityRole="header">{translateUiText('Letters that take their time')}</Text>
                <Text style={styles.subtitle}>{translateUiText('The wait is part of the gift.')}</Text>
            </View>
            <View style={styles.steps}>
                {steps.map((step, index) => (
                    <View key={step} style={styles.step}>
                        <View style={[styles.stepNumber, { backgroundColor: STEP_COLORS[index].background }]}>
                            <Text style={[styles.stepNumberText, { color: STEP_COLORS[index].text }]}>{index + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step}</Text>
                    </View>
                ))}
            </View>
            <TouchableOpacity style={styles.primary} activeOpacity={0.85} onPress={onWrite} accessibilityRole="button">
                <Text style={styles.primaryText}>{translateUiText('Write my first letter')}</Text>
            </TouchableOpacity>
        </LettersSheet>
    );
};

const styles = StyleSheet.create({
    lineup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 24,
        backgroundColor: '#FFF6F6',
    },
    lineupItem: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
    },
    lineupTime: {
        fontFamily: fontFamily.extraBold,
        fontSize: 11,
        color: '#4B3D5C',
    },
    heading: {
        alignItems: 'center',
        gap: 6,
    },
    title: {
        fontFamily: fontFamily.extraBold,
        fontSize: 24,
        color: '#2E1E3C',
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: fontFamily.bold,
        fontSize: 15,
        color: '#5A4C6B',
        textAlign: 'center',
    },
    steps: {
        gap: 14,
    },
    step: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    stepNumber: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumberText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 15,
    },
    stepText: {
        flex: 1,
        fontFamily: fontFamily.bold,
        fontSize: 15,
        color: '#2E1E3C',
    },
    primary: {
        height: 56,
        borderRadius: 28,
        backgroundColor: '#D23F66',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 17,
        color: '#FFFFFF',
    },
});

export default LettersIntroSheet;
