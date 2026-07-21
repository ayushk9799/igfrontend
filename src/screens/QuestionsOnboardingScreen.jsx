import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOPIC_CATEGORIES } from '../constants/Categories';
import { fontFamily, fontWeight } from '../constants/fonts';
import * as Haptics from 'expo-haptics';

const CONNECTION_TOPICS = Object.values(TOPIC_CATEGORIES);

const QuestionsOnboardingScreen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const cardAnims = useRef(CONNECTION_TOPICS.map(() => new Animated.Value(0))).current;
    const scrollRef = useRef(null);
    const cardLayoutsRef = useRef([]);
    const viewportHeightRef = useRef(0);
    const scrollOffsetRef = useRef(0);
    const scrollFrameRef = useRef(null);

    const scrollSlowlyToCard = (index) => {
        const layout = cardLayoutsRef.current[index];
        if (!layout || !viewportHeightRef.current || !scrollRef.current) return;

        const target = Math.max(0, layout.y + layout.height - viewportHeightRef.current + 18);
        const start = scrollOffsetRef.current;
        const distance = target - start;
        if (distance <= 2) return;

        if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
        const startedAt = Date.now();
        const duration = 820;

        const step = () => {
            const progress = Math.min(1, (Date.now() - startedAt) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const nextOffset = start + (distance * eased);
            scrollRef.current?.scrollTo({ y: nextOffset, animated: false });
            scrollOffsetRef.current = nextOffset;
            if (progress < 1) scrollFrameRef.current = requestAnimationFrame(step);
        };

        scrollFrameRef.current = requestAnimationFrame(step);
    };

    useEffect(() => {
        const cardDelay = 260;
        Animated.stagger(
            cardDelay,
            cardAnims.map((anim) => Animated.spring(anim, {
                toValue: 1,
                friction: 9,
                tension: 56,
                useNativeDriver: true,
            })),
        ).start();

        const scrollTimers = cardAnims.map((_, index) => setTimeout(() => {
            scrollSlowlyToCard(index);
        }, 360 + (index * cardDelay)));

        return () => {
            scrollTimers.forEach(clearTimeout);
            if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
        };
    }, [cardAnims]);

    const cardStyle = (index) => ({
        opacity: cardAnims[index],
        transform: [{
            translateY: cardAnims[index].interpolate({
                inputRange: [0, 1],
                outputRange: [44, 0],
            }),
        }],
    });

    const finish = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onComplete?.();
    };

    return (
        <LinearGradient colors={['#F8D9EC', '#FFF8FB', '#EADFFB']} style={styles.container}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View style={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 14 }]}>
                <View style={styles.titleBlock}>
                    <Text style={styles.title}>Deepen your connection</Text>
                    <Text style={styles.subtitle}>There’s always something new to discover together.</Text>
                </View>

                <ScrollView
                    ref={scrollRef}
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onLayout={(event) => { viewportHeightRef.current = event.nativeEvent.layout.height; }}
                    onScroll={(event) => { scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}
                >
                    {CONNECTION_TOPICS.map((topic, index) => (
                        <Animated.View
                            key={topic.id}
                            onLayout={(event) => { cardLayoutsRef.current[index] = event.nativeEvent.layout; }}
                            style={cardStyle(index)}
                        >
                            <LinearGradient
                                colors={topic.gradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.topicCard}
                            >
                                {topic.image ? (
                                    <Image source={topic.image} style={styles.topicImage} />
                                ) : (
                                    <View style={styles.topicEmojiBadge}>
                                        <Text style={styles.topicEmoji}>{topic.emoji}</Text>
                                    </View>
                                )}
                                <View style={styles.topicCopy}>
                                    <Text style={[styles.topicTitle, { color: topic.textColor }]} numberOfLines={1}>{topic.title}</Text>
                                    <Text style={[styles.topicSubtitle, { color: topic.textColor }]} numberOfLines={2}>{topic.subtitle}</Text>
                                </View>
                            </LinearGradient>
                        </Animated.View>
                    ))}
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity onPress={finish} activeOpacity={0.86} style={styles.buttonShadow}>
                        <LinearGradient colors={['#FF6B9C', '#E94D91']} style={styles.continueButton}>
                            <Text style={styles.continueText}>Continue</Text>
                            <Text style={styles.continueArrow}>→</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <View style={styles.progress}><View style={styles.dot} /><View style={[styles.dot, styles.dotActive]} /></View>
                </View>
            </View>
        </LinearGradient>
    );
};

const cardShadow = Platform.select({
    ios: { shadowColor: '#C084FC', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 14 },
    android: { elevation: 5 },
});

const styles = StyleSheet.create({
    container: { flex: 1 },
    page: { flex: 1, paddingHorizontal: 20 },
    titleBlock: { paddingTop: 10, paddingBottom: 16 },
    title: { color: '#2E1E3C', fontSize: 32, lineHeight: 37, fontWeight: fontWeight('700'), fontFamily: fontFamily.extraBold },
    subtitle: { marginTop: 6, color: '#766F9B', fontSize: 13, lineHeight: 18, fontWeight: fontWeight('700'), fontFamily: fontFamily.bold },
    scroll: { flex: 1 },
    scrollContent: { gap: 12, paddingTop: 4, paddingBottom: 20 },
    topicCard: { height: 92, borderRadius: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.78)', ...cardShadow },
    topicImage: { width: 72, height: 72, resizeMode: 'contain', marginLeft: 8, marginRight: 12 },
    topicEmojiBadge: { width: 58, height: 58, borderRadius: 29, marginLeft: 16, marginRight: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.45)' },
    topicEmoji: { fontSize: 28, lineHeight: 34 },
    topicCopy: { flexShrink: 1, flexGrow: 1, minWidth: 0, paddingRight: 18 },
    topicTitle: { fontSize: 16, lineHeight: 20, fontWeight: fontWeight('900'), fontFamily: fontFamily.extraBold },
    topicSubtitle: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight('700'), marginTop: 4, opacity: 0.85, fontFamily: fontFamily.bold },
    footer: { paddingTop: 10 },
    buttonShadow: { shadowColor: '#E83C78', shadowOpacity: 0.24, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
    continueButton: { height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
    continueText: { color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: 17 },
    continueArrow: { color: '#FFFFFF', fontSize: 20 },
    progress: { paddingTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 6 },
    dot: { width: 18, height: 4, borderRadius: 2, backgroundColor: '#E6C7D9' },
    dotActive: { width: 34, backgroundColor: '#FF5D91' },
});

export default QuestionsOnboardingScreen;
