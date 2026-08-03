/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TextInput, TouchableOpacity } from 'react-native';
import ChatInput from '../ChatInput';

jest.mock('../../../i18n/uiTranslation', () => ({
    translateUiTemplate: (_template, values) => `Message ${values[0]}...`,
    translateUiText: text => text,
}));

describe('ChatInput', () => {
    it('clears the controlled input immediately after sending', async () => {
        const onSend = jest.fn();
        let renderer;

        await ReactTestRenderer.act(() => {
            renderer = ReactTestRenderer.create(<ChatInput onSend={onSend} />);
        });

        await ReactTestRenderer.act(() => {
            renderer.root.findByType(TextInput).props.onChangeText('  Hello  ');
        });

        expect(renderer.root.findByType(TextInput).props.value).toBe('  Hello  ');

        await ReactTestRenderer.act(() => {
            renderer.root.findByType(TouchableOpacity).props.onPress();
        });

        expect(onSend).toHaveBeenCalledWith('Hello');
        expect(renderer.root.findByType(TextInput).props.value).toBe('');

        await ReactTestRenderer.act(() => renderer.unmount());
    });
});
