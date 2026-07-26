import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { fontFamily } from '../../constants/fonts';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { translateUiText } from '../../i18n/uiTranslation';

/**
 * PremiumLockOverlay - Shared premium restriction overlay for all card types
 * Features: Crown icon with golden glow, frosted glass backdrop,
 * golden gradient unlock button, sparkle accents, reassurance text
 */
const PremiumLockOverlay = ({ onPress, questionText }) => {
    return (
        <TouchableOpacity
            style={styles.overlay}
            activeOpacity={0.97}
            onPress={onPress}
        >
            {/* Multi-stop gradient overlay for depth */}
            <LinearGradient
                colors={[
                    'rgba(0,0,0,0.15)',
                    'rgba(0,0,0,0.45)',
                    'rgba(0,0,0,0.60)',
                    'rgba(0,0,0,0.72)',
                ]}
                locations={[0, 0.35, 0.6, 1]}
                style={styles.gradientOverlay}
            />

            <View style={styles.content}>
                {/* Sparkle accents scattered */}
                <Text style={styles.sparkle1}>✦</Text>
                <Text style={styles.sparkle2}>✧</Text>
                <Text style={styles.sparkle3}>✦</Text>
                <Text style={styles.sparkle4}>✧</Text>
                <Text style={styles.sparkle5}>✦</Text>

                {/* Crown Icon with Glow */}
                <View style={styles.iconContainer}>
                    {/* Outer soft glow */}
                    <View style={styles.outerGlow}>
                        <LinearGradient
                            colors={['rgba(255, 215, 0, 0.20)', 'rgba(255, 165, 0, 0.05)', 'transparent']}
                            style={styles.outerGlowGradient}
                        />
                    </View>
                    {/* Middle glow ring */}
                    <View style={styles.middleGlow}>
                        <LinearGradient
                            colors={['rgba(255, 215, 0, 0.30)', 'rgba(255, 165, 0, 0.10)']}
                            style={styles.middleGlowGradient}
                        />
                    </View>
                    {/* Icon circle */}
                    <View style={styles.iconCircle}>
                        <LinearGradient
                            colors={['#FFE066', '#FFD700', '#FFA500']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.iconCircleGradient}
                        />
                        {/* Crown SVG */}
                        <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"
                                fill="#FFFFFF"
                            />
                            <Path
                                d="M5 19h14v2H5v-2z"
                                fill="#FFFFFF"
                                opacity={0.85}
                            />
                        </Svg>
                    </View>
                </View>

                {/* Title */}
                <Text style={styles.title}>{translateUiText("Premium Content")}</Text>

                {/* Divider line */}
                <View style={styles.divider}>
                    <LinearGradient
                        colors={['transparent', 'rgba(255, 215, 0, 0.5)', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.dividerGradient}
                    />
                </View>

                {/* Question preview (visible through overlay) */}
                {questionText ? (
                    <View style={styles.questionPreview}>
                        <Text style={styles.questionLabel}>{translateUiText("Question")}</Text>
                        <Text style={styles.questionText} numberOfLines={3}>
                            {questionText}
                        </Text>
                    </View>
                ) : null}

                {/* Subtitle */}
                <Text style={styles.subtitle}>{translateUiText("Upgrade to unlock all premium questions & features")}</Text>

                {/* Unlock Button with gradient */}
                <TouchableOpacity
                    style={styles.unlockButton}
                    onPress={onPress}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={['#FF7EB3', '#FF4B80', '#E8446D']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.unlockButtonContent}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
                            <Path
                                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                fill="#FFFFFF"
                            />
                        </Svg>
                        <Text style={styles.unlockButtonText}>{translateUiText("Unlock Premium")}</Text>
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginLeft: 6 }}>
                            <Path
                                d="M5 12h14M12 5l7 7-7 7"
                                stroke="#FFFFFF"
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </View>
                </TouchableOpacity>

                {/* Reassurance text */}
                <Text style={styles.reassurance}>{translateUiText("Cancel anytime · Covers your partner too")}</Text>
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
        paddingHorizontal: 28,
        zIndex: 1,
    },
    // Sparkle accents
    sparkle1: {
        position: 'absolute',
        top: -70,
        left: -5,
        fontSize: 18,
        color: 'rgba(255, 215, 0, 0.7)',
    },
    sparkle2: {
        position: 'absolute',
        top: -45,
        right: 5,
        fontSize: 12,
        color: 'rgba(255, 215, 0, 0.5)',
    },
    sparkle3: {
        position: 'absolute',
        top: 30,
        right: -12,
        fontSize: 14,
        color: 'rgba(255, 215, 0, 0.55)',
    },
    sparkle4: {
        position: 'absolute',
        bottom: -50,
        left: 10,
        fontSize: 10,
        color: 'rgba(255, 215, 0, 0.4)',
    },
    sparkle5: {
        position: 'absolute',
        bottom: -30,
        right: 20,
        fontSize: 16,
        color: 'rgba(255, 215, 0, 0.45)',
    },
    // Icon with layered glow
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    outerGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        overflow: 'hidden',
    },
    outerGlowGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    middleGlow: {
        position: 'absolute',
        width: 94,
        height: 94,
        borderRadius: 47,
        overflow: 'hidden',
    },
    middleGlowGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 12,
    },
    iconCircleGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    // Title
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFD700',
        marginBottom: 6,
        textShadowColor: 'rgba(255, 215, 0, 0.35)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
        letterSpacing: 0.3,
        fontFamily: fontFamily.extraBold,
    },
    // Divider
    divider: {
        width: 80,
        height: 2,
        borderRadius: 1,
        marginBottom: 14,
        overflow: 'hidden',
    },
    dividerGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    // Question preview
    questionPreview: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 20,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.15)',
        maxWidth: '100%',
    },
    questionLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(255, 215, 0, 0.7)',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 6,
        textAlign: 'center',
        fontFamily: fontFamily.bold,
    },
    questionText: {
        fontSize: 16,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.85)',
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 22,
        fontFamily: fontFamily.bold,
    },
    // Subtitle
    subtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.75)',
        textAlign: 'center',
        marginBottom: 22,
        lineHeight: 20,
        fontFamily: fontFamily.medium,
    },
    // Unlock button
    unlockButton: {
        borderRadius: 28,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 36,
        shadowColor: '#FF4B80',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
    },
    unlockButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    unlockButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '900',
        letterSpacing: 0.5,
        fontFamily: fontFamily.extraBold,
    },
    // Reassurance text
    reassurance: {
        marginTop: 14,
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.50)',
        textAlign: 'center',
        fontFamily: fontFamily.medium,
        letterSpacing: 0.3,
    },
});

export default PremiumLockOverlay;
