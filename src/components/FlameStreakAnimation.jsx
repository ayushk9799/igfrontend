import React, { useState } from 'react';
import {
    StyleSheet,
    View,
} from 'react-native';
import LottieView from 'lottie-react-native';

const FlameStreakAnimation = ({
    width = 180,
    height = 180,
    fallback = null,
    style,
}) => {
    const [hasFailed, setHasFailed] = useState(false);

    if (hasFailed) {
        return fallback;
    }

    return (
        <View
            pointerEvents="none"
            style={[styles.container, { width, height }, style]}
        >
            <LottieView
                source={require('../../assets/animations/fire-animation.json')}
                autoPlay
                loop
                resizeMode="contain"
                renderMode="AUTOMATIC"
                cacheComposition
                onAnimationFailure={() => setHasFailed(true)}
                style={StyleSheet.absoluteFillObject}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default FlameStreakAnimation;
