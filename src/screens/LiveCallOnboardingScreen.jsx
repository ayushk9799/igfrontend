import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { fontFamily, fontWeight } from '../constants/fonts';

const LiveCallOnboardingScreen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const entrance = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(entrance, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
        }).start();
    }, [entrance]);

    const finish = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onComplete?.();
    };

    return (
        <LinearGradient
            colors={['#F9DFEA', '#FFF8F7', '#F8E6F5']}
            locations={[0, 0.58, 1]}
            style={styles.container}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View
                style={[
                    styles.page,
                    {
                        paddingTop: insets.top + 8,
                        paddingBottom: insets.bottom + 12,
                    },
                ]}
            >
                <Animated.View
                    style={[
                        styles.content,
                        {
                            opacity: entrance,
                            transform: [{
                                translateY: entrance.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [18, 0],
                                }),
                            }],
                        },
                    ]}
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>Never miss{'\n'}their face</Text>
                       
                    </View>

                    <View style={styles.callVisual}>
                        <Image
                            source={require('../../assets/onbording/live-call-visual.png')}
                            resizeMode="contain"
                            style={styles.callVisualImage}
                        />
                    </View>

                    <View style={styles.progress}>
                        <View style={styles.dot} />
                        <View style={styles.dot} />
                        <View style={[styles.dot, styles.dotActive]} />
                        <View style={styles.dot} />
                    </View>
                </Animated.View>

                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Keep going"
                    activeOpacity={0.86}
                    onPress={finish}
                    style={styles.buttonShadow}
                >
                    <LinearGradient
                        colors={['#FF5F62', '#F72F78']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.continueButton}
                    >
                        <Text style={styles.continueText}>Keep going</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    page: {
        flex: 1,
        paddingHorizontal: 18,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        minHeight: 0,
    },
    header: {
        width: '100%',
        alignItems: 'flex-start',
    },
    title: {
        color: '#071552',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 31,
        lineHeight: 37,
        textAlign: 'left',
    },
    subtitle: {
        color: '#071552',
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        fontSize: 16,
        lineHeight: 21,
        textAlign: 'left',
        marginTop: 7,
    },
    callVisual: {
        flex: 1,
        width: '100%',
        minHeight: 0,
        marginTop: 10,
        marginBottom: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    callVisualImage: {
        width: '100%',
        height: '100%',
    },
    progress: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 9,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#DCCFE6',
    },
    dotActive: {
        backgroundColor: '#F85B88',
    },
    buttonShadow: {
        marginTop: 6,
        borderRadius: 30,
        shadowColor: '#E52C6E',
        shadowOpacity: 0.26,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 7 },
        elevation: 6,
    },
    continueButton: {
        height: 58,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 19,
    },
});

export default LiveCallOnboardingScreen;
