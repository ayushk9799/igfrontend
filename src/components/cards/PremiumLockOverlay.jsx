import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

/**
 * PremiumLockOverlay - Shared premium restriction overlay for all card types
 * Features: SVG lock with golden glow, semi-transparent backdrop (question visible),
 * golden gradient unlock button, sparkle accents
 */
const PremiumLockOverlay = ({ onPress, questionText }) => {
    return (
        <TouchableOpacity
            style={styles.overlay}
            activeOpacity={0.95}
            onPress={onPress}
        >
            {/* Subtle gradient overlay instead of flat black */}
            <LinearGradient
                colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.65)']}
                locations={[0, 0.5, 1]}
                style={styles.gradientOverlay}
            />

            <View style={styles.content}>
                {/* Sparkle accent - top left */}
                <Text style={styles.sparkleTopLeft}>✦</Text>

                {/* Lock Icon with Glow Ring */}
                <View style={styles.lockContainer}>
                    {/* Outer glow ring */}
                    <View style={styles.glowRing}>
                        <LinearGradient
                            colors={['rgba(255, 215, 0, 0.25)', 'rgba(255, 165, 0, 0.08)']}
                            style={styles.glowRingGradient}
                        />
                    </View>
                    {/* Inner circle with lock */}
                    <View style={styles.lockCircle}>
                        <LinearGradient
                            colors={['#FFD700', '#FFA500']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.lockCircleGradient}
                        />
                        <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z"
                                fill="#FFFFFF"
                            />
                            <Path
                                d="M7 11V7a5 5 0 0110 0v4"
                                stroke="#FFFFFF"
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            {/* Keyhole */}
                            <Circle cx={12} cy={16} r={1.5} fill="#FFA500" />
                            <Path
                                d="M12 17.5V19"
                                stroke="#FFA500"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                            />
                        </Svg>
                    </View>
                </View>

                {/* Sparkle accent - right */}
                <Text style={styles.sparkleRight}>✦</Text>

                {/* Title */}
                <Text style={styles.title}>Premium Only</Text>

                {/* Question preview (visible through overlay) */}
                {questionText ? (
                    <View style={styles.questionPreview}>
                        <Text style={styles.questionText} numberOfLines={3}>
                            "{questionText}"
                        </Text>
                    </View>
                ) : null}

                {/* Subtitle */}
                <Text style={styles.subtitle}>
                    Upgrade to unlock unlimited questions
                </Text>

                {/* Unlock Button with gradient */}
                <TouchableOpacity
                    style={styles.unlockButtonWrapper}
                    onPress={onPress}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={['#FFD700', '#FFA500']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.unlockButton}
                    >
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                            <Path
                                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                fill="#FFFFFF"
                            />
                        </Svg>
                        <Text style={styles.unlockButtonText}>Unlock Now</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 28,
        zIndex: 100,
        overflow: 'hidden',
    },
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 32,
        zIndex: 1,
    },
    // Sparkle accents
    sparkleTopLeft: {
        position: 'absolute',
        top: -60,
        left: -10,
        fontSize: 16,
        color: 'rgba(255, 215, 0, 0.6)',
    },
    sparkleRight: {
        position: 'absolute',
        top: 20,
        right: -8,
        fontSize: 12,
        color: 'rgba(255, 215, 0, 0.5)',
    },
    // Lock icon with glow
    lockContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    glowRing: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        overflow: 'hidden',
    },
    glowRingGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    lockCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
    },
    lockCircleGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    // Title
    title: {
        fontSize: 26,
        fontWeight: '900',
        color: '#FFD700',
        marginBottom: 8,
        textShadowColor: 'rgba(255, 215, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
        letterSpacing: 0.5,
    },
    // Question preview
    questionPreview: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        maxWidth: '100%',
    },
    questionText: {
        fontSize: 16,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.85)',
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 22,
    },
    // Subtitle
    subtitle: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.85)',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    // Unlock button
    unlockButtonWrapper: {
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    unlockButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 36,
        borderRadius: 28,
    },
    unlockButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
});

export default PremiumLockOverlay;
