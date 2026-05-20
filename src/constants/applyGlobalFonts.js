import { StyleSheet, Text, TextInput } from 'react-native';
import { fontFamily, fontWeight as platformFontWeight } from './fonts';

const defaultTextStyle = {
    fontFamily: fontFamily.regular,
};

const textStyleKeys = new Set([
    'color',
    'fontSize',
    'fontStyle',
    'fontWeight',
    'letterSpacing',
    'lineHeight',
    'textAlign',
    'textDecorationLine',
    'textTransform',
]);

const getFontFamilyForWeight = (weight) => {
    const numericWeight = Number(weight);

    if (numericWeight >= 800) {
        return fontFamily.extraBold;
    }

    if (numericWeight >= 700 || weight === 'bold') {
        return fontFamily.bold;
    }

    if (numericWeight >= 500) {
        return fontFamily.medium;
    }

    return fontFamily.regular;
};

const isTextStyle = (style) => (
    style
    && typeof style === 'object'
    && !Array.isArray(style)
    && Object.keys(style).some((key) => textStyleKeys.has(key))
);

const withNunitoFont = (style) => {
    if (!isTextStyle(style) || style.fontFamily) {
        return style;
    }

    const requestedWeight = style.fontWeight || '400';

    return {
        ...style,
        fontFamily: getFontFamilyForWeight(requestedWeight),
        fontWeight: platformFontWeight(requestedWeight),
    };
};

const applyDefaultStyle = (Component) => {
    Component.defaultProps = Component.defaultProps || {};
    Component.defaultProps.style = [defaultTextStyle, Component.defaultProps.style];
};

applyDefaultStyle(Text);
applyDefaultStyle(TextInput);

const originalCreate = StyleSheet.create;

StyleSheet.create = (styles) => {
    const stylesWithFonts = Object.keys(styles).reduce((acc, key) => {
        acc[key] = withNunitoFont(styles[key]);
        return acc;
    }, {});

    return originalCreate(stylesWithFonts);
};
