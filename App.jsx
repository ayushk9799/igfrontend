/**
 * LoveNest - A Romantic Couples App
 * @format
 */

import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SocketProvider } from './src/context/SocketContext';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/theme';

function App() {
    return (
        <SafeAreaProvider>
            <KeyboardProvider>
                <SocketProvider>
                    <StatusBar
                        barStyle="light-content"
                        backgroundColor={colors.background}
                        translucent
                    />
                    <View style={styles.container}>
                        <AppNavigator />
                    </View>
                </SocketProvider>
            </KeyboardProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
});

export default App;
