import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Image,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const LiveCallOnboardingScreen = ({ onComplete }) => {
    const entrance = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(entrance, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
        }).start();
    }, [entrance]);

    const finish = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onComplete?.();
    };

    return (
        <View style={styles.container}>
            <StatusBar hidden />
            <Animated.View
                style={[
                    styles.preview,
                    {
                        opacity: entrance,
                        transform: [{
                            scale: entrance.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1.015, 1],
                            }),
                        }],
                    },
                ]}
            >
                <Image
                    source={require('../../assets/onbording/live-call-onboarding.png')}
                    resizeMode="cover"
                    style={StyleSheet.absoluteFillObject}
                />
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Keep going"
                    activeOpacity={0.82}
                    onPress={finish}
                    style={styles.continueButton}
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF7FA',
    },
    preview: {
        flex: 1,
        overflow: 'hidden',
    },
    continueButton: {
        position: 'absolute',
        left: '10%',
        right: '10%',
        bottom: '3.4%',
        height: '7.7%',
        borderRadius: 999,
    },
});

export default LiveCallOnboardingScreen;
