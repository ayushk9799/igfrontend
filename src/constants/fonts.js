import { Platform } from 'react-native';

export const fontFamily = {
    regular: Platform.select({ ios: 'Nunito-Regular', android: 'Nunito', default: 'Nunito' }),
    medium: Platform.select({ ios: 'Nunito-Medium', android: 'Nunito', default: 'Nunito' }),
    bold: Platform.select({ ios: 'Nunito-Bold', android: 'Nunito', default: 'Nunito' }),
    extraBold: Platform.select({ ios: 'Nunito-ExtraBold', android: 'Nunito', default: 'Nunito' }),
};

export const fontWeight = (weight) => Platform.select({
    ios: '400',
    android: weight,
    default: weight,
});
