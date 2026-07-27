import React, { useEffect, useRef } from 'react';
import { Animated, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily, fontWeight } from '../constants/fonts';
import * as Haptics from 'expo-haptics';
import { translateUiText } from '../i18n/uiTranslation';

const TimelineDate = ({ month, day, year }) => (
    <View style={styles.dateCard}>
        <Text style={styles.dateMonth}>{month}</Text>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateYear}>{year}</Text>
    </View>
);

const JournalOnboardingScreen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const entrance = useRef(new Animated.Value(0)).current;
    const eventAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;
    const timelineRef = useRef(null);
    const eventLayoutsRef = useRef([]);
    const viewportHeightRef = useRef(0);
    const scrollOffsetRef = useRef(0);
    const scrollFrameRef = useRef(null);

    const scrollSlowlyToEvent = (index) => {
        const layout = eventLayoutsRef.current[index];
        if (!layout || !viewportHeightRef.current || !timelineRef.current) return;

        const target = Math.max(0, layout.y + layout.height - viewportHeightRef.current + 18);
        const start = scrollOffsetRef.current;
        const distance = target - start;
        if (distance <= 2) return;

        if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
        const startedAt = Date.now();
        const duration = 760;

        const step = () => {
            const progress = Math.min(1, (Date.now() - startedAt) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const nextOffset = start + (distance * eased);
            timelineRef.current?.scrollTo({ y: nextOffset, animated: false });
            scrollOffsetRef.current = nextOffset;
            if (progress < 1) scrollFrameRef.current = requestAnimationFrame(step);
        };

        scrollFrameRef.current = requestAnimationFrame(step);
    };

    useEffect(() => {
        Animated.timing(entrance, { toValue: 1, duration: 450, useNativeDriver: true }).start();
        const eventDelay = 300;

        Animated.stagger(
            eventDelay,
            eventAnims.map((anim) => Animated.spring(anim, {
                toValue: 1,
                friction: 9,
                tension: 58,
                useNativeDriver: true,
            })),
        ).start();

        const hapticTimers = eventAnims.map((_, index) => setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            scrollSlowlyToEvent(index);
        }, 320 + (index * eventDelay)));

        return () => {
            hapticTimers.forEach(clearTimeout);
            if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
        };
    }, [entrance, eventAnims]);

    const eventStyle = (index) => ({
        opacity: eventAnims[index],
        transform: [{
            translateY: eventAnims[index].interpolate({
                inputRange: [0, 1],
                outputRange: [42, 0],
            }),
        }],
    });

    const finish = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onComplete?.();
    };

    return (
        <LinearGradient colors={['#F9DCEB', '#FFF8FB', '#F6DDF4']} style={styles.container}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View style={[styles.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 14 }]}>
                <Animated.View style={[styles.intro, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}> 
                    <Text style={styles.title}>{translateUiText("Save your story")}<Text style={styles.heart}>♥</Text></Text>
                </Animated.View>

                <ScrollView
                    ref={timelineRef}
                    style={styles.timeline}
                    contentContainerStyle={styles.timelineContent}
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onLayout={(event) => { viewportHeightRef.current = event.nativeEvent.layout.height; }}
                    onScroll={(event) => { scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}
                >
                    <Animated.View onLayout={(event) => { eventLayoutsRef.current[0] = event.nativeEvent.layout; }} style={[styles.timelineRow, eventStyle(0)]}>
                        <TimelineDate month="Feb" day="18" year="2024" />
                        <View style={[styles.milestoneCard, styles.metEvent]}>
                            <Text style={styles.milestoneEmoji}>👋</Text>
                            <View style={styles.milestoneCopy}>
                                <Text style={styles.cardTitle}>{translateUiText("We Met")}</Text>
                                <Text style={styles.cardMeta}>{translateUiText("A simple hello started our story.")}</Text>
                            </View>
                        </View>
                    </Animated.View>

                    <Animated.View onLayout={(event) => { eventLayoutsRef.current[1] = event.nativeEvent.layout; }} style={[styles.timelineRow, eventStyle(1)]}>
                        <TimelineDate month="Mar" day="09" year="2024" />
                        <View style={[styles.milestoneCard, styles.firstDateEvent]}>
                            <Text style={styles.milestoneEmoji}>☕</Text>
                            <View style={styles.milestoneCopy}>
                                <Text style={styles.cardTitle}>{translateUiText("Our First Date")}</Text>
                                <Text style={styles.cardMeta}>{translateUiText("Coffee, nervous smiles, and hours of conversation.")}</Text>
                            </View>
                        </View>
                    </Animated.View>

                    <Animated.View onLayout={(event) => { eventLayoutsRef.current[2] = event.nativeEvent.layout; }} style={[styles.timelineRow, eventStyle(2)]}>
                        <TimelineDate month="Sep" day="21" year="2024" />
                        <View style={styles.photoCard}>
                            <Image source={require('../../assets/onbording/roadtrip.png')} style={styles.memoryPhoto} resizeMode="cover" />
                            <View style={styles.photoBadges}><Text style={styles.photoBadge}>▣ 5</Text></View>
                            <View style={styles.photoCopy}>
                                <Text style={styles.photoTitle}>{translateUiText("Weekend Getaway")}</Text>
                                <Text style={styles.cardBody} numberOfLines={1}>{translateUiText("Our first road trip. Still one of our favorites.")}</Text>
                            </View>
                        </View>
                    </Animated.View>

                    <Animated.View onLayout={(event) => { eventLayoutsRef.current[3] = event.nativeEvent.layout; }} style={[styles.timelineRow, eventStyle(3)]}>
                        <TimelineDate month="Aug" day="16" year="2025" />
                        <View style={[styles.milestoneCard, styles.movedInEvent]}>
                            <Text style={styles.milestoneEmoji}>🏡</Text>
                            <View style={styles.milestoneCopy}>
                                <Text style={styles.cardTitle}>{translateUiText("Moved In Together")}</Text>
                                <Text style={styles.cardMeta}>{translateUiText("Our first place, finally feeling like home.")}</Text>
                            </View>
                        </View>
                    </Animated.View>

                    <Animated.View onLayout={(event) => { eventLayoutsRef.current[4] = event.nativeEvent.layout; }} style={eventStyle(4)}>
                        <View style={styles.timelineRow}>
                            <TimelineDate month="Apr" day="18" year="2026" />
                            <View style={[styles.milestoneCard, styles.officialCard]}>
                                <Text style={styles.milestoneEmoji}>💍</Text>
                                <View style={styles.milestoneCopy}>
                                    <Text style={styles.cardTitle}>{translateUiText("Engaged")}</Text>
                                    <Text style={styles.cardMeta}>{translateUiText("The easiest “Yes” of our lives.")}</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.storyEnding}>
                            <View style={styles.storyLine} />
                            <Text style={styles.storyHeart}>♥</Text>
                            <Text style={styles.continuesText}>{translateUiText("The story continues…")}</Text>
                            <View style={styles.storyLine} />
                        </View>
                    </Animated.View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity onPress={finish} activeOpacity={0.86} style={styles.buttonShadow}>
                        <LinearGradient colors={['#FF72AD', '#FF477C']} style={styles.continueButton}>
                            <Text style={styles.continueText}>{translateUiText("Continue")}</Text><Text style={styles.continueArrow}>→</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <View style={styles.progress}>
                        <View style={[styles.dot, styles.dotActive]} />
                        <View style={styles.dot} />
                        <View style={styles.dot} />
                        <View style={styles.dot} />
                    </View>
                </View>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 }, page: { flex: 1, paddingHorizontal: 18 },
    intro: { paddingHorizontal: 6, paddingTop: 18, paddingBottom: 18 },
    title: { color: '#2E1E3C', fontFamily: fontFamily.extraBold, fontWeight: fontWeight('700'), fontSize: 32, lineHeight: 37 }, heart: { color: '#FF4F83' },
    timeline: { flex: 1 }, timelineContent: { paddingVertical: 4, paddingBottom: 16, gap: 14 }, timelineRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    dateCard: { width: 54, paddingVertical: 6, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.76)', alignItems: 'center', borderWidth: 1, borderColor: '#F3DCE8' },
    dateMonth: { color: '#9B7F92', fontFamily: fontFamily.medium, fontSize: 11 }, dateDay: { color: '#36263C', fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 25 }, dateYear: { color: '#A38F9F', fontSize: 11 },
    milestoneCard: { flex: 1, minHeight: 76, overflow: 'hidden', borderRadius: 18, paddingLeft: 15, paddingRight: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#9D4D78', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
    metEvent: { backgroundColor: '#F3D4E2' }, firstDateEvent: { backgroundColor: '#EFDFC7' }, movedInEvent: { backgroundColor: '#D8E5DF' },
    milestoneEmoji: { width: 34, textAlign: 'center', fontSize: 25 }, milestoneCopy: { flex: 1, minWidth: 0, paddingHorizontal: 9 }, cardTitle: { color: '#38253C', fontFamily: fontFamily.bold, fontSize: 14 }, cardMeta: { marginTop: 4, color: '#95788C', fontFamily: fontFamily.medium, fontSize: 10 },
    officialCard: { backgroundColor: '#DDD5EF' }, storyEnding: { marginLeft: 64, paddingTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, storyLine: { width: 24, height: 1, backgroundColor: '#DFAFC7' }, storyHeart: { color: '#E26498', fontSize: 11 }, continuesText: { color: '#B65A86', fontFamily: fontFamily.bold, fontSize: 11, fontStyle: 'italic' },
    photoCard: { flex: 1, overflow: 'hidden', borderRadius: 18, backgroundColor: '#DCCFE4', borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#9D4D78', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 5 }, memoryPhoto: { width: '100%', height: 148, backgroundColor: '#F8C7DA' },
    photoBadges: { position: 'absolute', right: 8, top: 118, flexDirection: 'row', gap: 5 }, photoBadge: { overflow: 'hidden', color: '#FFFFFF', backgroundColor: 'rgba(46,30,60,0.76)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, fontFamily: fontFamily.bold, fontSize: 10 },
    photoCopy: { paddingHorizontal: 11, paddingVertical: 9 }, photoTitle: { color: '#38253C', fontFamily: fontFamily.bold, fontSize: 13 }, cardBody: { marginTop: 3, color: '#735F78', fontFamily: fontFamily.regular, fontSize: 10, lineHeight: 13 },
    footer: { paddingTop: 10 }, buttonShadow: { shadowColor: '#E83C78', shadowOpacity: 0.24, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
    continueButton: { height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }, continueText: { color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: 17 }, continueArrow: { color: '#FFFFFF', fontSize: 20 },
    progress: { paddingTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 6 }, dot: { width: 18, height: 4, borderRadius: 2, backgroundColor: '#E6C7D9' }, dotActive: { width: 34, backgroundColor: '#FF5D91' },
});

export default JournalOnboardingScreen;
