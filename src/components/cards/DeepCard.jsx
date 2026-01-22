import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { categoryConfig, defaultConfig } from './categoryConfig';
import { cardStyles as styles } from './cardStyles';

/**
 * DeepCard - Simple text-based card for deep questions or generic categories
 */
const DeepCard = React.memo(({ task, index, totalCards, partnerName, userName, onSubmit, onSkip, isLastCard }) => {
    const config = categoryConfig[task.category] || defaultConfig;

    return (
        <LinearGradient colors={config.bgGradient} style={styles.cardInner}>
            <View style={styles.cardContent}>
                <View style={styles.topRow}>
                    <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
                        <Text>{config.emoji}</Text>
                        <Text style={{ color: config.color, fontWeight: '600' }}>{config.label}</Text>
                    </View>
                    <Text style={styles.counterText}>{index + 1}/{totalCards}</Text>
                </View>

                <View style={styles.questionSection}>
                    <Text style={styles.questionText}>{task.taskstatement}</Text>
                </View>

                {!isLastCard && (
                    <TouchableOpacity onPress={onSkip} style={styles.skipButtonInCard}>
                        <Text style={styles.skipTextInCard}>Skip →</Text>
                    </TouchableOpacity>
                )}
            </View>
        </LinearGradient>
    );
});

export default DeepCard;
