import React from 'react';
import {
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../theme';
import { fontFamily, fontWeight } from '../constants/fonts';

const PartnerPremiumPurchaseModal = ({ visible, partnerName, onClose }) => {
    const displayName = partnerName?.trim() || 'Your partner';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <LinearGradient
                        colors={['#FFE4F0', '#FFF8FB', '#FFFFFF']}
                        locations={[0, 0.58, 1]}
                        style={styles.cardGradient}
                    >
                        <View style={[styles.glow, styles.glowLeft]} />
                        <View style={[styles.glow, styles.glowRight]} />
                        <Text style={[styles.floatingHeart, styles.leftHeart]}>♥</Text>
                        <Text style={[styles.floatingHeart, styles.rightHeart]}>♥</Text>

                        <View style={styles.crownBadge}>
                            <Text style={styles.crown}>👑</Text>
                        </View>

                        <Image
                            source={require('../../assets/images/premium-muscot.png')}
                            style={styles.mascot}
                            resizeMode="contain"
                        />

                        <Text style={styles.eyebrow}>PENGUIN COUPLE PREMIUM</Text>
                        <Text style={styles.title}>Premium for both of you!</Text>
                        <Text style={styles.message}>
                            <Text style={styles.partnerName}>{displayName}</Text>
                            {' just purchased Premium. Everything is now unlocked for your couple.'}
                        </Text>

                        <View style={styles.unlockedPill}>
                            <View style={styles.checkCircle}>
                                <Text style={styles.check}>✓</Text>
                            </View>
                            <Text style={styles.unlockedText}>All premium features unlocked</Text>
                        </View>

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Continue with Premium"
                            onPress={onClose}
                            style={({ pressed }) => [styles.buttonWrap, pressed && styles.buttonPressed]}
                        >
                            <LinearGradient
                                colors={['#FF4F8B', '#FF83B4']}
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                style={styles.button}
                            >
                                <Text style={styles.buttonText}>Enjoy Premium</Text>
                                <Text style={styles.buttonHeart}>♥</Text>
                            </LinearGradient>
                        </Pressable>
                    </LinearGradient>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        backgroundColor: 'rgba(45, 20, 37, 0.58)',
    },
    card: {
        width: '100%',
        maxWidth: 390,
        borderRadius: 32,
        backgroundColor: '#FFFFFF',
        shadowColor: '#3C1C31',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.28,
        shadowRadius: 28,
        elevation: 18,
    },
    cardGradient: {
        alignItems: 'center',
        overflow: 'hidden',
        borderRadius: 32,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 22,
    },
    glow: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255, 117, 170, 0.13)',
    },
    glowLeft: {
        left: -72,
        top: 38,
    },
    glowRight: {
        right: -70,
        top: -58,
    },
    floatingHeart: {
        position: 'absolute',
        color: '#FF75A8',
    },
    leftHeart: {
        top: 76,
        left: 38,
        fontSize: 20,
        transform: [{ rotate: '-14deg' }],
    },
    rightHeart: {
        top: 98,
        right: 39,
        fontSize: 16,
        opacity: 0.8,
        transform: [{ rotate: '12deg' }],
    },
    crownBadge: {
        position: 'absolute',
        top: 18,
        right: 20,
        width: 42,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 21,
        backgroundColor: 'rgba(255, 255, 255, 0.82)',
    },
    crown: {
        fontSize: 23,
    },
    mascot: {
        width: 172,
        height: 154,
        marginTop: -4,
        marginBottom: 2,
    },
    eyebrow: {
        color: colors.primary,
        fontSize: 11,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        letterSpacing: 1.2,
        marginBottom: 7,
    },
    title: {
        color: '#2F2030',
        fontSize: 25,
        lineHeight: 31,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        textAlign: 'center',
    },
    message: {
        maxWidth: 310,
        color: '#746573',
        fontSize: 14,
        lineHeight: 21,
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        textAlign: 'center',
        marginTop: 9,
    },
    partnerName: {
        color: '#3B2939',
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
    },
    unlockedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'stretch',
        justifyContent: 'center',
        borderRadius: 16,
        paddingVertical: 11,
        paddingHorizontal: 14,
        marginTop: 18,
        backgroundColor: '#FFF0F6',
    },
    checkCircle: {
        width: 23,
        height: 23,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        marginRight: 8,
        backgroundColor: colors.primary,
    },
    check: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    unlockedText: {
        color: '#4A3343',
        fontSize: 13,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
    },
    buttonWrap: {
        alignSelf: 'stretch',
        marginTop: 16,
        borderRadius: 18,
        shadowColor: '#FF5C96',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.26,
        shadowRadius: 14,
        elevation: 6,
    },
    buttonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.985 }],
    },
    button: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
    },
    buttonHeart: {
        color: '#FFFFFF',
        fontSize: 16,
        marginLeft: 9,
    },
});

export default PartnerPremiumPurchaseModal;
