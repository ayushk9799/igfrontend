import React, { useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Svg, {
    ClipPath,
    Defs,
    Path,
    Rect,
} from 'react-native-svg';

import { fontFamily } from '../constants/fonts';
import { spacing } from '../theme';

const HEART_PATH =
    'M12 21.2C11.4 20.7 10.5 19.9 9.4 18.9C5.2 15.2 2 12.2 2 8.2C2 5.2 4.2 3 7.2 3C9.1 3 10.8 3.9 12 5.3C13.2 3.9 14.9 3 16.8 3C19.8 3 22 5.2 22 8.2C22 12.2 18.8 15.2 14.6 18.9C13.5 19.9 12.6 20.7 12 21.2Z';

const STATE_LABELS = {
    full: 'Both completed',
    protected: 'Streak protected',
    half: 'One partner completed',
    missed: 'Missed',
    'today-empty': 'Not completed yet',
    future: 'Upcoming',
};

const MiniHeart = ({
    state,
    youComplete,
    partnerComplete,
    id,
}) => {
    const leftClipId = `${id}-left`;
    const rightClipId = `${id}-right`;

    if (state === 'half') {
        return (
            <Svg width={28} height={28} viewBox="0 0 24 24">
                <Defs>
                    <ClipPath id={leftClipId}>
                        <Rect x="0" y="0" width="12" height="24" />
                    </ClipPath>
                    <ClipPath id={rightClipId}>
                        <Rect x="12" y="0" width="12" height="24" />
                    </ClipPath>
                </Defs>
                <Path
                    d={HEART_PATH}
                    clipPath={`url(#${leftClipId})`}
                    fill={youComplete ? '#F44778' : '#E4DEE8'}
                />
                <Path
                    d={HEART_PATH}
                    clipPath={`url(#${rightClipId})`}
                    fill={partnerComplete ? '#F44778' : '#E4DEE8'}
                />
                <Path
                    d={HEART_PATH}
                    fill="none"
                    stroke="#CFC5D2"
                    strokeWidth={0.55}
                />
            </Svg>
        );
    }

    const fill = state === 'full'
        ? '#F44778'
        : state === 'protected'
            ? '#F3B43F'
        : state === 'missed'
            ? '#D8D1DB'
            : '#FFFFFF';
    const stroke = state === 'today-empty'
        ? '#F44778'
        : state === 'future'
            ? '#D8D1DB'
            : fill;

    return (
        <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path
                d={HEART_PATH}
                fill={fill}
                stroke={stroke}
                strokeWidth={state === 'future' || state === 'today-empty' ? 1.35 : 0.4}
            />
        </Svg>
    );
};

export default function WeeklyStreakStrip({
    week,
    currentStreak = 0,
    variant = 'card',
}) {
    const isBare = variant === 'bare';
    const todayScale = useRef(new Animated.Value(1)).current;
    const todayState = week?.days?.find(day => day.isToday)?.state;

    const days = useMemo(() => week?.days || [], [week?.days]);

    useEffect(() => {
        if (!todayState) return undefined;

        todayScale.setValue(0.86);
        const pulse = Animated.spring(todayScale, {
            toValue: 1,
            friction: 5,
            tension: 95,
            useNativeDriver: true,
        });
        pulse.start();
        return () => pulse.stop();
    }, [todayScale, todayState]);

    const todayScaleStyle = useMemo(
        () => ({ transform: [{ scale: todayScale }] }),
        [todayScale],
    );

    if (days.length !== 7) return null;

    return (
        <View style={[styles.card, isBare && styles.bare]}>
            {!isBare && (
                <View style={styles.header}>
                    <Text style={styles.title}>This week</Text>
                    <Text style={styles.streakText}>
                        {currentStreak > 0
                            ? `${currentStreak}-day streak`
                            : 'Start your streak'}
                    </Text>
                </View>
            )}

            <View style={styles.daysRow}>
                {days.map(day => {
                    const heart = (
                        <View
                            style={[
                                styles.heartCell,
                                day.isToday && styles.todayHeartCell,
                                isBare && day.isToday && styles.bareTodayHeartCell,
                            ]}
                        >
                            <MiniHeart
                                state={day.state}
                                youComplete={day.youComplete}
                                partnerComplete={day.partnerComplete}
                                id={`week-heart-${day.date.replace(/-/g, '')}`}
                            />
                        </View>
                    );

                    return (
                        <View
                            key={day.date}
                            style={styles.day}
                            accessible
                            accessibilityLabel={`${day.label}, ${STATE_LABELS[day.state] || day.state}`}
                        >
                            {!isBare && (
                                <Text
                                    style={[
                                        styles.dayLabel,
                                        day.isToday && styles.todayDayLabel,
                                    ]}
                                >
                                    {day.label}
                                </Text>
                            )}
                            {day.isToday ? (
                                <Animated.View
                                    style={todayScaleStyle}
                                >
                                    {heart}
                                </Animated.View>
                            ) : heart}
                            {isBare && (
                                <Text
                                    style={[
                                        styles.dayLabel,
                                        styles.bareDayLabel,
                                        day.isToday && styles.todayDayLabel,
                                    ]}
                                >
                                    {day.label}
                                </Text>
                            )}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        width: '100%',
        maxWidth: 360,
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.lg,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.88)',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        shadowColor: '#E89AB6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.11,
        shadowRadius: 18,
        elevation: 0,
    },
    bare: {
        marginBottom: spacing.sm,
        paddingHorizontal: 0,
        paddingTop: 0,
        paddingBottom: 0,
        borderRadius: 0,
        backgroundColor: 'transparent',
        borderWidth: 0,
        shadowOpacity: 0,
        elevation: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
        paddingHorizontal: spacing.xs,
    },
    title: {
        fontFamily: fontFamily.extraBold,
        fontSize: 17,
        fontWeight: '800',
        color: '#21184F',
    },
    streakText: {
        fontFamily: fontFamily.bold,
        fontSize: 13,
        fontWeight: '700',
        color: '#F44778',
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    day: {
        flex: 1,
        alignItems: 'center',
    },
    dayLabel: {
        marginBottom: spacing.sm,
        fontFamily: fontFamily.bold,
        fontSize: 12,
        fontWeight: '700',
        color: '#8C829C',
    },
    todayDayLabel: {
        color: '#F44778',
    },
    heartCell: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    todayHeartCell: {
        backgroundColor: '#FFF0F5',
        borderWidth: 1.5,
        borderColor: '#F8A3BC',
    },
    bareTodayHeartCell: {
        backgroundColor: 'transparent',
        borderWidth: 0,
    },
    bareDayLabel: {
        marginTop: spacing.xs,
        marginBottom: 0,
    },
});
