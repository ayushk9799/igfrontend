import { Platform } from 'react-native';

export const fontFamily = {
    regular: Platform.select({ ios: 'Nunito-Regular', android: 'Nunito-Regular', default: 'Nunito-Regular' }),
    medium: Platform.select({ ios: 'Nunito-Medium', android: 'Nunito-Medium', default: 'Nunito-Medium' }),
    bold: Platform.select({ ios: 'Nunito-Bold', android: 'Nunito-Bold', default: 'Nunito-Bold' }),
    extraBold: Platform.select({ ios: 'Nunito-ExtraBold', android: 'Nunito-ExtraBold', default: 'Nunito-ExtraBold' }),
};

export const fontWeight = (weight) => Platform.select({
    ios: weight,
    android: '400',
    default: weight,
});
