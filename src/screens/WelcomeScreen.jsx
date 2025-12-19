// Welcome Screen - Light & Elegant
// Clean, modern onboarding with subtle animations
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientBackground from '../components/GradientBackground';
import Button from '../components/Button';
import AnimatedHeart from '../components/AnimatedHeart';
import { colors, spacing, borderRadius, timing } from '../theme';

const { height, width } = Dimensions.get('window');

// Animated Feature Card
const FeatureCard = ({ feature, index, anim }) => {
    const translateY = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [30, 0],
    });

    return (
        <Animated.View
            style={{
                opacity: anim,
                transform: [{ translateY }],
            }}
        >
            <View style={styles.featureItem}>
                <View style={[styles.featureIconBg, { backgroundColor: feature.bgColor }]}>
                    <Text style={styles.featureEmoji}>{feature.emoji}</Text>
                </View>
                <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDesc}>{feature.desc}</Text>
                </View>
            </View>
        </Animated.View>
    );
};

export const WelcomeScreen = ({
    onGetStarted = () => { },
    onLogin = () => { },
}) => {
    // Simplified animations for faster navigation
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const logoScale = useRef(new Animated.Value(1)).current;
    const insets = useSafeAreaInsets();
    const featureAnims = [
        useRef(new Animated.Value(1)).current,
        useRef(new Animated.Value(1)).current,
        useRef(new Animated.Value(1)).current,
    ];

    const features = [
        { emoji: '😊', title: 'Share Mood', desc: 'Let them know how you feel', bgColor: colors.primarySoft },
        { emoji: '✏️', title: 'Send Scribbles', desc: 'Draw love notes together', bgColor: colors.secondarySoft },
        { emoji: '💬', title: 'Daily Questions', desc: 'Connect deeper every day', bgColor: colors.accentSoft },
    ];

    return (
        <GradientBackground variant="warm">
            <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
                {/* Hero Section */}
                <Animated.View
                    style={[
                        styles.heroSection,
                        {
                            opacity: fadeAnim,
                            transform: [
                                { scale: logoScale },
                            ],
                        }
                    ]}
                >
                    <AnimatedHeart size={100} pulse />

                    <View style={styles.brandContainer}>
                        <Text style={styles.appName}>LoveNest</Text>
                        <View style={styles.taglineContainer}>
                            <LinearGradient
                                colors={['#F97068', '#F4A261']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.taglineBadge}
                            >
                                <Text style={styles.taglineBadgeText}>FOR COUPLES</Text>
                            </LinearGradient>
                        </View>
                        <Text style={styles.tagline}>
                            Stay connected with your love,{'\n'}wherever you are
                        </Text>
                    </View>
                </Animated.View>

                {/* Features Section */}
                <View style={styles.featuresSection}>
                    {features.map((feature, index) => (
                        <FeatureCard
                            key={feature.title}
                            feature={feature}
                            index={index}
                            anim={featureAnims[index]}
                        />
                    ))}
                </View>

                {/* CTA Section */}
                <Animated.View style={[styles.ctaSection, { opacity: fadeAnim }]}>
                    <Button
                        title="Get Started"
                        onPress={onGetStarted}
                        variant="primary"
                        size="xl"
                        fullWidth
                    />
                </Animated.View>
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.xl,
        justifyContent: 'space-between',
    },
    heroSection: {
        alignItems: 'center',
        paddingTop: spacing.xl,
    },
    brandContainer: {
        alignItems: 'center',
        marginTop: spacing['2xl'],
    },
    appName: {
        fontSize: 44,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -2,
    },
    taglineContainer: {
        marginTop: spacing.md,
    },
    taglineBadge: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs + 2,
        borderRadius: borderRadius.full,
    },
    taglineBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 2,
    },
    tagline: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.lg,
        lineHeight: 26,
    },
    featuresSection: {
        gap: spacing.md,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.borderLight,
        gap: spacing.lg,
    },
    featureIconBg: {
        width: 56,
        height: 56,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureEmoji: {
        fontSize: 26,
    },
    featureContent: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 2,
    },
    featureDesc: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    ctaSection: {
        gap: spacing.md,
    },
    loginButton: {
        alignSelf: 'center',
    },
});

export default WelcomeScreen;
