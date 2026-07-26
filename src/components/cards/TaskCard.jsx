import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { fontFamily } from '../../constants/fonts';

import LikelyToCard from './LikelyToCard';
import NeverHaveIEverCard from './NeverHaveIEverCard';
import TakePhotoCard from './TakePhotoCard';
import DeepCard from './DeepCard';
import SliderCard from './SliderCard';
import VoiceRecordCard from './VoiceRecordCard';
import ChoiceQuestionCard from './ChoiceQuestionCard';
import PremiumLockOverlay from './PremiumLockOverlay';
import { categoryConfig, defaultConfig } from './categoryConfig';
import { spacing } from '../../theme';

/**
 * PremiumLockedCard - Shown inside the card when locked for non-premium users.
 * Displays the question, a lock icon, and an unlock button. Tap navigates to premium screen.
 */
const PremiumLockedCard = ({ task, onNavigateToPremium }) => {
    const config = categoryConfig[task.category] || defaultConfig;

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={onNavigateToPremium} style={{ flex: 1 }}>
            <LinearGradient colors={config.bgGradient} style={lockedStyles.cardContainer}>
                <View style={lockedStyles.content}>
                    {/* Category Badge */}
                    <View style={lockedStyles.topRow}>
                        <View style={lockedStyles.categoryBadge}>
                            <Text style={lockedStyles.categoryText}>{config.label}</Text>
                        </View>
                    </View>

                    {/* Question text (visible but dimmed) */}
                    <View style={lockedStyles.questionSection}>
                        <Text style={lockedStyles.questionText} numberOfLines={4}>
                            {task.taskstatement}
                        </Text>
                    </View>

                    {/* Lock Icon */}
                    <View style={lockedStyles.lockSection}>
                        <View style={lockedStyles.lockCircle}>
                            <LinearGradient
                                colors={['#FFD700', '#FFA500']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
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
                                <Circle cx={12} cy={16} r={1.5} fill="#FFA500" />
                            </Svg>
                        </View>

                        <Text style={lockedStyles.premiumTitle}>Premium Only</Text>
                        <Text style={lockedStyles.premiumSubtitle}>
                            Upgrade to unlock unlimited questions
                        </Text>
                    </View>

                    {/* Unlock Button */}
                    <TouchableOpacity
                        style={lockedStyles.unlockButton}
                        onPress={onNavigateToPremium}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={['#FFD700', '#FFA500']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={lockedStyles.unlockButtonContent}>
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                                <Path
                                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                    fill="#FFFFFF"
                                />
                            </Svg>
                            <Text style={lockedStyles.unlockButtonText}>Unlock Now</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

const lockedStyles = StyleSheet.create({
    cardContainer: {
        flex: 1,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 6,
        borderColor: 'rgba(255, 255, 255, 0.20)',
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    categoryBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    categoryText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
        fontFamily: fontFamily.bold,
    },
    questionSection: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.sm,
    },
    questionText: {
        fontSize: 26,
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.5)',
        fontStyle: 'italic',
        lineHeight: 34,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
    },
    lockSection: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    lockCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        marginBottom: 12,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 8,
    },
    premiumTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFD700',
        marginBottom: 4,
        textShadowColor: 'rgba(255, 215, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
        fontFamily: fontFamily.extraBold,
    },
    premiumSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.75)',
        textAlign: 'center',
        fontFamily: fontFamily.medium,
    },
    unlockButton: {
        borderRadius: 24,
        overflow: 'hidden',
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 32,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    unlockButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    unlockButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
        fontFamily: fontFamily.bold,
    },
});

/**
 * TaskCard - Routes to the appropriate card component based on task category.
 * If the card is locked (premium restriction), renders PremiumLockedCard instead.
 */
const TaskCard = React.memo(({
    task,
    index,
    displayIndex,
    totalCards,
    partnerName,
    userName,
    userAvatar,
    partnerAvatar,
    userId,
    partnerId,
    hasPartner = false,
    onLinkPartner,
    onSubmit,
    onSkip,
    isLastCard,
    onAnswerSubmit,
    isAnswered = false,
    previousAnswer = null,
    autoAdvanceOnSubmit = true,
    isLocked = false,
    showAlreadyAnsweredOverlay = true,
    onNavigateToPremium = () => { },
}) => {
    if (!task) return null;

    // Debug: Log the category being received

    const commonProps = {
        task,
        index,
        displayIndex,
        totalCards,
        partnerName,
        userName,
        userAvatar,
        partnerAvatar,
        userId,
        partnerId,
        hasPartner,
        onLinkPartner,
        onSubmit,
        onSkip,
        isLastCard,
        onAnswerSubmit,
        isAnswered,
        previousAnswer,
        autoAdvanceOnSubmit,
        isLocked: false,
        showAlreadyAnsweredOverlay,
        onNavigateToPremium,
    };

    let card;
    if (task.category === 'likelyto') {
        card = <LikelyToCard {...commonProps} />;
    } else if (task.category === 'neverhaveiever') {
        card = <NeverHaveIEverCard {...commonProps} />;
    } else if (task.category === 'takephoto') {
        card = <TakePhotoCard {...commonProps} />;
    } else if (task.category === 'slider') {
        card = <SliderCard {...commonProps} />;
    } else if (task.category === 'voicerecord') {
        card = <VoiceRecordCard {...commonProps} />;
    } else if (task.category === 'wouldyourather' || task.category === 'thisorthat') {
        card = <ChoiceQuestionCard {...commonProps} />;
    } else {
        card = <DeepCard {...commonProps} />;
    }

    // If locked, render the real card with PremiumLockOverlay on top
    if (isLocked) {
        return (
            <View style={{ flex: 1 }}>
                {card}
                <PremiumLockOverlay
                    onPress={onNavigateToPremium}
                    questionText={task.taskstatement}
                />
            </View>
        );
    }

    return card;
});

export default TaskCard;
