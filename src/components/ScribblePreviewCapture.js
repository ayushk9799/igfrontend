// ScribblePreviewCapture Component
// A wrapper that can capture its contents and save to widget storage
import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { NativeModules, Platform } from 'react-native';
import { spacing } from '../theme';

const { width } = Dimensions.get('window');
const SCRIBBLE_CANVAS_SIZE = width - spacing.xl * 2;

const { ScribbleWidgetBridge } = NativeModules;

/**
 * ScribblePreviewCapture - Renders scribble and provides capture functionality
 * Use ref.capture() to capture and save to widget
 */
const ScribblePreviewCapture = forwardRef(({ paths, fromUserName, timestamp, style }, ref) => {
    const viewRef = useRef(null);

    // Expose capture method to parent
    useImperativeHandle(ref, () => ({
        capture: async () => {
            if (!viewRef.current) return false;

            try {
                // Capture the view as PNG
                const uri = await captureRef(viewRef, {
                    format: 'png',
                    quality: 1,
                    result: 'tmpfile',
                });

                console.log('📸 Scribble captured:', uri);

                // Save to App Group
                if (Platform.OS === 'ios' && ScribbleWidgetBridge) {
                    await ScribbleWidgetBridge.saveScribbleImage(uri, {
                        senderName: fromUserName || 'Your Love',
                        timestamp: timestamp || new Date().toISOString(),
                    });
                    console.log('✅ Saved to App Group');

                    // Trigger widget refresh
                    await ScribbleWidgetBridge.refreshWidget();
                    console.log('🔄 Widget refreshed');

                    return true;
                }
                return false;
            } catch (error) {
                console.error('❌ Capture error:', error);
                return false;
            }
        },
    }));

    // Auto-capture on mount/update if paths exist
    useEffect(() => {
        const timer = setTimeout(() => {
            if (paths && paths.length > 0 && viewRef.current) {
                // Delay to ensure render is complete
                ref?.current?.capture?.();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [paths, ref]);

    if (!paths || paths.length === 0) {
        return null;
    }

    return (
        <View
            ref={viewRef}
            style={[styles.container, style]}
            collapsable={false} // Required for view-shot
        >
            <Svg
                width={SCRIBBLE_CANVAS_SIZE}
                height={SCRIBBLE_CANVAS_SIZE}
                viewBox={`0 0 ${SCRIBBLE_CANVAS_SIZE} ${SCRIBBLE_CANVAS_SIZE}`}
                style={styles.svg}
            >
                {paths.map((path, index) => (
                    <Path
                        key={`widget-path-${index}`}
                        d={path.d}
                        stroke={path.color}
                        strokeWidth={path.strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ))}
            </Svg>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1A1A2E', // Dark background matching app theme
        aspectRatio: 1,
        overflow: 'hidden',
    },
    svg: {
        width: '100%',
        height: '100%',
    },
});

export default ScribblePreviewCapture;
