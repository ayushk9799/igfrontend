/**
 * LoveNest - A Romantic Couples App
 * @format
 */

import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { SocketProvider } from './src/context/SocketContext';
import { CallProvider } from './src/calling/CallContext';
import CallOverlay from './src/calling/CallOverlay';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/theme';

function App() {
    return (
        <Provider store={store}>
            <SafeAreaProvider>
                <KeyboardProvider statusBarTranslucent>
                    <SocketProvider>
                        <CallProvider>
                            <StatusBar
                                barStyle="dark-content"
                                backgroundColor="transparent"
                                translucent
                            />
                            <View style={styles.container}>
                                <AppNavigator />
                                <CallOverlay />
                            </View>
                        </CallProvider>
                    </SocketProvider>
                </KeyboardProvider>
            </SafeAreaProvider>
        </Provider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
});

export default App;
