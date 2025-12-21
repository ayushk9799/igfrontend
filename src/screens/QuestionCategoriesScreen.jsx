// Question Categories/Aggregate Screen
// Shows all question types before diving into specific questions
import React, { useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Animated,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';

const { width } = Dimensions.get('window');

// Category configurations with unique colors and icons
const categoryConfig = {
    comparison: {
        id: 'comparison',
        title: 'Who is more likely...',
        subtitle: 'Compare yourselves playfully',
        emoji: '⚖️',
        color: '#FF6B9D',
        gradient: ['#FF6B9D', '#FF8FAB'],
        bgGradient: ['#FFF0F5', '#FFE4EC'],
        description: 'Fun comparisons to discover who does what better!',
        icon: 'comparison',
        questionCount: 12,
    },
    knowledge: {
        id: 'knowledge',
        title: 'How well do you know me...',
        subtitle: 'Test your connection',
        emoji: '🧠',
        color: '#5BB5A6',
        gradient: ['#5BB5A6', '#8DD5C7'],
        bgGradient: ['#E8F8F5', '#D0F0EA'],
        description: 'Questions to see how much you really know each other.',
        icon: 'knowledge',
        questionCount: 15,
    },
    agreement: {
        id: 'agreement',
        title: 'Can we match answers...',
        subtitle: 'Think alike challenge',
        emoji: '🎯',
        color: '#BF5AF2',
        gradient: ['#BF5AF2', '#D38DF8'],
        bgGradient: ['#F8F0FF', '#EEE0FF'],
        description: 'Answer separately and see if your minds are in sync!',
        icon: 'agreement',
        questionCount: 10,
    },
    confessions: {
        id: 'confessions',
        title: 'Never have I ever...',
        subtitle: 'Reveal your secrets',
        emoji: '🤫',
        color: '#F4A261',
        gradient: ['#F4A261', '#FFD093'],
        bgGradient: ['#FFF8F0', '#FFF0E0'],
        description: 'Confess and discover hidden truths about each other.',
        icon: 'confessions',
        questionCount: 18,
    },
};

// Animated Category Card Component
const CategoryCard = ({ category, index, onPress }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                delay: index * 100,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                delay: index * 100,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, [scaleAnim, fadeAnim, index]);

    const handlePress = () => {
        // Subtle press animation
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 6,
                useNativeDriver: true,
            }),
        ]).start();
        onPress(category);
    };

    return (
        <Animated.View
            style={[
                styles.cardWrapper,
                {
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }],
                },
            ]}
        >
            <TouchableOpacity
                style={styles.categoryCard}
                onPress={handlePress}
                activeOpacity={0.9}
            >
                {/* Background Gradient */}
                <LinearGradient
                    colors={category.bgGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardGradient}
                />

                {/* Decorative Circle */}
                <View style={[styles.decorativeCircle, { backgroundColor: category.color + '15' }]} />

                {/* Content */}
                <View style={styles.cardContent}>
                    {/* Icon Container */}
                    <View style={[styles.iconContainer, { backgroundColor: category.color + '20' }]}>
                        <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                    </View>

                    {/* Text Content */}
                    <View style={styles.textContainer}>
                        <Text style={styles.cardTitle}>{category.title}</Text>
                        <Text style={styles.cardSubtitle}>{category.subtitle}</Text>
                    </View>

                    {/* Arrow Indicator */}
                    <View style={[styles.arrowContainer, { backgroundColor: category.color }]}>
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M9 18l6-6-6-6"
                                stroke="#FFFFFF"
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </View>
                </View>

                {/* Progress/Count Indicator */}
                <View style={styles.countBadge}>
                    <Text style={[styles.countText, { color: category.color }]}>
                        {category.questionCount} questions
                    </Text>
                </View>

                {/* Bottom Border Accent */}
                <View style={[styles.bottomAccent, { backgroundColor: category.color }]} />
            </TouchableOpacity>
        </Animated.View>
    );
};

// Header Stats Component
const HeaderStats = ({ partnerName, streak }) => (
    <View style={styles.statsContainer}>
        <View style={styles.statItem}>
            <Text style={styles.statValue}>🔥 {streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
            <Text style={styles.statValue}>💕 {partnerName}</Text>
            <Text style={styles.statLabel}>Playing with</Text>
        </View>
    </View>
);

export const QuestionCategoriesScreen = ({
    partnerName = 'Your Love',
    streak = 7,
    onSelectCategory = () => { },
    onBack = () => { },
}) => {
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 10,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim]);

    const categories = Object.values(categoryConfig);

    return (
        <GradientBackground variant="warm">
            <ScrollView
                style={styles.container}
                contentContainerStyle={[
                    styles.contentContainer,
                    {
                        paddingTop: insets.top + spacing.lg,
                        paddingBottom: insets.bottom + spacing['3xl'],
                    },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Animated.View
                    style={[
                        styles.header,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M15 18l-6-6 6-6"
                                stroke={colors.text}
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>Daily Questions</Text>
                        <Text style={styles.headerSubtitle}>Choose a category to play</Text>
                    </View>
                </Animated.View>

                {/* Stats Bar */}
                <Animated.View
                    style={{
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    }}
                >
                    <HeaderStats partnerName={partnerName} streak={streak} />
                </Animated.View>

                {/* Section Title */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Question Categories</Text>
                    <View style={styles.sectionBadge}>
                        <Text style={styles.sectionBadgeText}>4 types</Text>
                    </View>
                </View>

                {/* Categories Grid */}
                <View style={styles.categoriesContainer}>
                    {categories.map((category, index) => (
                        <CategoryCard
                            key={category.id}
                            category={category}
                            index={index}
                            onPress={onSelectCategory}
                        />
                    ))}
                </View>

                {/* Bottom Tip */}
                <View style={styles.tipContainer}>
                    <View style={styles.tipIcon}>
                        <Text style={{ fontSize: 18 }}>💡</Text>
                    </View>
                    <Text style={styles.tipText}>
                        Answer questions separately, then reveal each other's answers!
                    </Text>
                </View>
            </ScrollView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    headerContent: {
        marginLeft: spacing.md,
        flex: 1,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing['2xl'],
        borderWidth: 1,
        borderColor: colors.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: colors.textMuted,
        fontWeight: '500',
    },
    statDivider: {
        width: 1,
        height: '80%',
        backgroundColor: colors.borderLight,
        marginHorizontal: spacing.lg,
        alignSelf: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    sectionBadge: {
        backgroundColor: colors.primarySoft,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
    },
    sectionBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    categoriesContainer: {
        gap: spacing.md,
    },
    cardWrapper: {
        marginBottom: spacing.sm,
    },
    categoryCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.borderLight,
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 6,
    },
    cardGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: borderRadius['2xl'],
    },
    decorativeCircle: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        right: -40,
        top: -40,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    categoryEmoji: {
        fontSize: 28,
    },
    textContainer: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    arrowContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    countBadge: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
    },
    countText: {
        fontSize: 11,
        fontWeight: '700',
    },
    bottomAccent: {
        position: 'absolute',
        bottom: 0,
        left: spacing.xl,
        right: spacing.xl,
        height: 3,
        borderRadius: 2,
    },
    tipContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginTop: spacing.xl,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    tipIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.accentSoft,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    tipText: {
        flex: 1,
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 20,
    },
});

export default QuestionCategoriesScreen;
