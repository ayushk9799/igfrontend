import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOPIC_CATEGORIES } from '../constants/Categories';
import { fontFamily, fontWeight } from '../constants/fonts';
import * as Haptics from 'expo-haptics';
import { translateUiText } from '../i18n/uiTranslation';
import useReducedMotion from '../hooks/useReducedMotion';

const CONNECTION_TOPICS = Object.values(TOPIC_CATEGORIES);

const QuestionsOnboardingScreen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const titleEntrance = useRef(new Animated.Value(0)).current;
    const questionsEntrance = useRef(new Animated.Value(0)).current;
    const buttonEntrance = useRef(new Animated.Value(0)).current;
    const cardAnims = useRef(CONNECTION_TOPICS.map(() => new Animated.Value(0))).current;
    const scrollRef = useRef(null);
    const cardLayoutsRef = useRef([]);
    const viewportHeightRef = useRef(0);
    const scrollOffsetRef = useRef(0);
    const scrollFrameRef = useRef(null);
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        if (reducedMotion) {
            titleEntrance.setValue(1);
            questionsEntrance.setValue(1);
            buttonEntrance.setValue(1);
            return;
        }

        Animated.stagger(110, [
            Animated.timing(titleEntrance, {
                toValue: 1,
                duration: 380,
                useNativeDriver: true,
            }),
            Animated.timing(questionsEntrance, {
                toValue: 1,
                duration: 380,
                useNativeDriver: true,
            }),
            Animated.timing(buttonEntrance, {
                toValue: 1,
                duration: 380,
                useNativeDriver: true,
            }),
        ]).start();
    }, [buttonEntrance, questionsEntrance, reducedMotion, titleEntrance]);

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
        if (reducedMotion) {
            cardAnims.forEach(anim => anim.setValue(1));
            return undefined;
        }
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
    }, [cardAnims, reducedMotion]);

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
            <View style={[styles.page, { paddingTop: insets.top + 52 }]}>
                <Animated.View
                    style={[
                        styles.titleBlock,
                        {
                            opacity: titleEntrance,
                            transform: [{
                                translateY: titleEntrance.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [18, 0],
                                }),
                            }],
                        },
                    ]}
                >
                    <Text style={styles.title}>{translateUiText("Deepen your connection")}</Text>
                    <Text style={styles.subtitle}>{translateUiText("There’s always something new to discover together.")}</Text>
                </Animated.View>

                <Animated.ScrollView
                    ref={scrollRef}
                    style={[
                        styles.scroll,
                        {
                            opacity: questionsEntrance,
                            transform: [{
                                translateY: questionsEntrance.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [18, 0],
                                }),
                            }],
                        },
                    ]}
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
                                    <Text style={[styles.topicTitle, { color: topic.textColor }]} numberOfLines={1}>{translateUiText(topic.title)}</Text>
                                    <Text style={[styles.topicSubtitle, { color: topic.textColor }]} numberOfLines={2}>{translateUiText(topic.subtitle)}</Text>
                                </View>
                            </LinearGradient>
                        </Animated.View>
                    ))}
                </Animated.ScrollView>

                <View
                    style={[
                        styles.footerArea,
                        {
                            paddingBottom: insets.bottom + 14
                                + (Platform.OS === 'android' ? 12 : 0),
                        },
                    ]}
                >
                    <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(234,223,251,0)', '#EADFFB']}
                        style={styles.footerSpread}
                    />
                    <Animated.View
                        style={[
                            styles.footer,
                            {
                                opacity: buttonEntrance,
                                transform: [{
                                    translateY: buttonEntrance.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [18, 0],
                                    }),
                                }],
                            },
                        ]}
                    >
                        <TouchableOpacity onPress={finish} activeOpacity={0.86} style={styles.buttonShadow}>
                            <LinearGradient
                                colors={['#FF5E97', '#FFA1C9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.continueButton}
                            >
                                <Text style={styles.continueText}>{translateUiText("Continue")}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </View>
        </LinearGradient>
    );
};

const cardShadow = Platform.select({
    ios: { shadowColor: '#C084FC', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 14 },
    android: { elevation: 0 },
});

const styles = StyleSheet.create({
    container: { flex: 1 },
    page: { flex: 1, paddingHorizontal: 20 },
    titleBlock: {
        width: '100%',
        alignItems: 'flex-start',
        position: 'relative',
        paddingTop: 32,
        paddingBottom: 16,
    },
    title: {
        color: '#050E3E',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 30,
        lineHeight: 35,
        letterSpacing: -0.4,
        textAlign: 'left',
    },
    subtitle: {
        maxWidth: 330,
        marginTop: 2,
        color: '#536185',
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        fontSize: 14,
        lineHeight: 19,
        textAlign: 'left',
    },
    scroll: { flex: 1 },
    scrollContent: { gap: 12, paddingTop: 4, paddingBottom: 20 },
    topicCard: { height: 92, borderRadius: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.78)', ...cardShadow },
    topicImage: { width: 72, height: 72, resizeMode: 'contain', marginLeft: 8, marginRight: 12 },
    topicEmojiBadge: { width: 58, height: 58, borderRadius: 29, marginLeft: 16, marginRight: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.45)' },
    topicEmoji: { fontSize: 28, lineHeight: 34 },
    topicCopy: { flexShrink: 1, flexGrow: 1, minWidth: 0, paddingRight: 18 },
    topicTitle: { fontSize: 16, lineHeight: 20, fontWeight: fontWeight('900'), fontFamily: fontFamily.extraBold },
    topicSubtitle: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight('700'), marginTop: 4, opacity: 0.85, fontFamily: fontFamily.bold },
    footerArea: {
        position: 'relative',
        zIndex: 3,
        marginHorizontal: -20,
        paddingHorizontal: 20,
        backgroundColor: '#EADFFB',
    },
    footerSpread: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: -40,
        height: 40,
    },
    footer: { paddingTop: 10, paddingHorizontal: 6, alignItems: 'center' },
    buttonShadow: { width: '100%', borderRadius: 24, shadowColor: '#FF5E97', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 0 },
    continueButton: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
    continueText: { color: '#FFFFFF', fontFamily: fontFamily.extraBold, fontSize: 18, fontWeight: fontWeight('800') },
});

export default QuestionsOnboardingScreen;
