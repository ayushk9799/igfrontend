import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const clampProgress = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const CircularProgressRing = ({
    progress = 0,
    color,
    trackColor = 'rgba(255,255,255,0.58)',
    size = 40,
    strokeWidth = 5,
    children,
    style,
}) => {
    const normalizedProgress = clampProgress(progress);
    const center = size / 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - normalizedProgress / 100);

    return (
        <View style={[styles.container, { width: size, height: size }, style]}>
            <Svg
                width={size}
                height={size}
                style={styles.ring}
                pointerEvents="none"
            >
                <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={trackColor}
                    strokeWidth={strokeWidth}
                />
                {normalizedProgress > 0 ? (
                    <Circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={dashOffset}
                        transform={`rotate(-90 ${center} ${center})`}
                    />
                ) : null}
            </Svg>
            <View style={styles.content}>{children}</View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    ring: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CircularProgressRing;
