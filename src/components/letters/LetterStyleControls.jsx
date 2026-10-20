import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { LETTER_PAPERS, LETTER_TEXT_SIZES } from './LetterPaper';
import { fontFamily } from '../../constants/fonts';
import { translateUiText } from '../../i18n/uiTranslation';

const SIZE_GLYPHS = { small: 14, medium: 18, large: 23 };

// Tiny preview of what's printed on each sheet.
const SwatchPattern = ({ pattern, color, margin }) => {
    if (pattern === 'lined') {
        return (
            <>
                <View style={[styles.patternMargin, { backgroundColor: margin }]} />
                {[9, 17, 25].map((top) => (
                    <View key={top} style={[styles.patternRow, { top, backgroundColor: color }]} />
                ))}
            </>
        );
    }
    return null;
};

const LetterStyleControls = ({ sizeId, paperId, onSizeChange, onPaperChange, floating = false }) => (
    <View style={[styles.bar, floating && styles.barFloating]}>
        <View style={styles.sizes} accessibilityRole="radiogroup" accessibilityLabel={translateUiText('Text size')}>
            {LETTER_TEXT_SIZES.map((size) => {
                const selected = size.id === sizeId;
                return (
                    <TouchableOpacity
                        key={size.id}
                        style={[styles.sizeButton, selected && styles.sizeButtonSelected]}
                        onPress={() => onSizeChange(size.id)}
                        activeOpacity={0.8}
                        accessibilityRole="radio"
                        accessibilityLabel={translateUiText(size.label)}
                        accessibilityState={{ checked: selected }}
                    >
                        <Text
                            style={[
                                styles.sizeGlyph,
                                { fontSize: SIZE_GLYPHS[size.id] },
                                selected && styles.sizeGlyphSelected,
                            ]}
                        >
                            A
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>

        <View style={styles.divider} />

        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.papersScroll}
            contentContainerStyle={styles.papers}
            keyboardShouldPersistTaps="handled"
            accessibilityRole="radiogroup"
            accessibilityLabel={translateUiText('Paper')}
        >
            {LETTER_PAPERS.map((paper) => {
                const selected = paper.id === paperId;
                return (
                    <TouchableOpacity
                        key={paper.id}
                        style={[styles.swatchRing, selected && styles.swatchRingSelected]}
                        onPress={() => onPaperChange(paper.id)}
                        activeOpacity={0.8}
                        accessibilityRole="radio"
                        accessibilityLabel={translateUiText(paper.label)}
                        accessibilityState={{ checked: selected }}
                    >
                        <View style={[styles.swatch, { backgroundColor: paper.stops[1], borderColor: paper.edge }]}>
                            <SwatchPattern pattern={paper.pattern} color={paper.rule} margin={paper.margin} />
                            {selected ? (
                                <View style={styles.swatchCheck}>
                                    <Check size={12} color={paper.ink} strokeWidth={3} />
                                </View>
                            ) : null}
                        </View>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    </View>
);

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#F5E1FD',
        backgroundColor: '#FFFFFF',
    },
    barFloating: {
        shadowColor: '#2E1E3C',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 14,
        elevation: 8,
    },
    sizes: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    sizeButton: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sizeButtonSelected: {
        backgroundColor: '#FDE7EC',
    },
    sizeGlyph: {
        fontFamily: fontFamily.extraBold,
        color: '#6E6080',
    },
    sizeGlyphSelected: {
        color: '#D23F66',
    },
    divider: {
        width: 1,
        height: 28,
        backgroundColor: '#F1E3F5',
    },
    papersScroll: {
        flex: 1,
        marginLeft: 8,
    },
    papers: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingRight: 2,
    },
    swatchRing: {
        padding: 2,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    swatchRingSelected: {
        borderColor: '#D23F66',
    },
    swatch: {
        width: 30,
        height: 34,
        borderRadius: 8,
        borderWidth: 1,
        overflow: 'hidden',
    },
    patternRow: {
        position: 'absolute',
        left: 3,
        right: 3,
        height: 1.5,
    },
    patternMargin: {
        position: 'absolute',
        left: 7,
        top: 3,
        bottom: 3,
        width: 1,
    },
    swatchCheck: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default LetterStyleControls;
