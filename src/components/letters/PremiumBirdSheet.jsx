import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Clock, Heart, Zap } from 'lucide-react-native';
import BirdArt from './BirdArt';
import LettersSheet from './LettersSheet';
import { fontFamily } from '../../constants/fonts';
import { translateUiText } from '../../i18n/uiTranslation';

const PERKS = [
    { key: 'falcon', Icon: Zap, color: '#9A4716', background: '#FCEBDD', label: 'Falcon lands in 45 minutes' },
    { key: 'swallow', Icon: Clock, color: '#2F5E96', background: '#E3F0FB', label: 'Swallow lands in 3 hours' },
    { key: 'couple', Icon: Heart, color: '#B0274F', background: '#FFE4EA', label: 'One plan covers you both' },
];

// The upsell body alone, so another sheet can switch to it without stacking modals.
export const PremiumBirdContent = ({ onUpgrade, onUseFreeBird }) => (
    <>
        <View style={styles.hero}>
            <BirdArt bird="swallow" size={124} />
            <BirdArt bird="falcon" size={134} />
        </View>
        <View style={styles.heading}>
            <Text style={styles.title} accessibilityRole="header">{translateUiText('Faster birds are Premium')}</Text>
            <Text style={styles.subtitle}>{translateUiText("For the days a letter really can't wait.")}</Text>
        </View>
        <View style={styles.perks}>
            {PERKS.map(({ key, Icon, color, background, label }) => (
                <View key={key} style={styles.perk}>
                    <View style={[styles.perkIcon, { backgroundColor: background }]}>
                        <Icon size={18} color={color} strokeWidth={2.4} />
                    </View>
                    <Text style={styles.perkText}>{translateUiText(label)}</Text>
                </View>
            ))}
        </View>
        <View style={styles.actions}>
            <TouchableOpacity style={styles.primary} activeOpacity={0.85} onPress={onUpgrade} accessibilityRole="button">
                <Text style={styles.primaryText}>{translateUiText('Unlock faster birds')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} activeOpacity={0.7} onPress={onUseFreeBird} accessibilityRole="button">
                <Text style={styles.secondaryText}>{translateUiText('Send with Pigeon instead')}</Text>
            </TouchableOpacity>
        </View>
    </>
);

const PremiumBirdSheet = ({ visible, onClose, onUpgrade, onUseFreeBird }) => (
    <LettersSheet visible={visible} onClose={onClose}>
        <PremiumBirdContent onUpgrade={onUpgrade} onUseFreeBird={onUseFreeBird} />
    </LettersSheet>
);

const styles = StyleSheet.create({
    hero: {
        height: 150,
        borderRadius: 24,
        backgroundColor: '#FFF1D6',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
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
    perks: {
        gap: 12,
    },
    perk: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    perkIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    perkText: {
        flex: 1,
        fontFamily: fontFamily.bold,
        fontSize: 15,
        color: '#2E1E3C',
    },
    actions: {
        gap: 4,
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
    secondary: {
        height: 46,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 15,
        color: '#4B3D5C',
    },
});

export default PremiumBirdSheet;
