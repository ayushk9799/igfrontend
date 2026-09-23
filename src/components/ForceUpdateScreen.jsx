import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/**
 * Penguin Couple Force Update Loading Screen
 * Displays BootSplash background (#F8DDF4), centered Penguin logo with breathing pulse animation,
 * and a smooth spinner with "Updating..." text during active download.
 */
export function ForceUpdateScreen({ status, progress = 0 }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isUpdating = status === 'UPDATING' || progress > 0;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8DDF4" />
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Image
          source={require('../../assets/bootsplash/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {isUpdating && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#FF7597" />
          <Text style={styles.updatingText}>Updating...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8DDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 140,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updatingText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#B04B6D',
    letterSpacing: 0.3,
  },
});

export default ForceUpdateScreen;
