import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { translateUiText } from '../../i18n/uiTranslation';

// Shared sheet with optional dimming behind its content.
const LettersSheet = ({ visible, onClose, onHeightChange, dimBackdrop = true, children }) => {
    const insets = useSafeAreaInsets();
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.root}>
                <Pressable
                    style={[styles.backdrop, dimBackdrop && styles.dimBackdrop]}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel={translateUiText('Close')}
                />
                <View
                    style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
                    onLayout={onHeightChange ? event => onHeightChange(event.nativeEvent.layout.height) : undefined}
                >
                    <View style={styles.handle} />
                    {children}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    dimBackdrop: {
        backgroundColor: 'rgba(46,30,60,0.45)',
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingTop: 12,
        paddingHorizontal: 24,
        gap: 18,
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#E5DAEE',
    },
});

export default LettersSheet;
