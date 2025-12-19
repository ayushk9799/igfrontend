// Conversations Screen - Chat list
import React, { useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    Animated,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';

const { width } = Dimensions.get('window');

// Chat preview card
const ChatCard = ({ name, emoji, lastMessage, time, unread, onPress, delay = 0 }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    friction: 8,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();
    }, []);

    return (
        <Animated.View
            style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
            }}
        >
            <TouchableOpacity style={styles.chatCard} onPress={onPress} activeOpacity={0.8}>
                <View style={styles.avatarContainer}>
                    <LinearGradient
                        colors={[colors.primary + '30', colors.secondary + '20']}
                        style={styles.avatar}
                    >
                        <Text style={styles.avatarEmoji}>{emoji}</Text>
                    </LinearGradient>
                    {unread > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{unread}</Text>
                        </View>
                    )}
                </View>
                <View style={styles.chatContent}>
                    <View style={styles.chatHeader}>
                        <Text style={styles.chatName}>{name}</Text>
                        <Text style={styles.chatTime}>{time}</Text>
                    </View>
                    <Text style={styles.chatMessage} numberOfLines={1}>
                        {lastMessage}
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export const ConversationsScreen = ({ partnerName = 'Emma', onChatPress }) => {
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, []);

    // Mock conversations data
    const conversations = [
        {
            id: '1',
            name: partnerName,
            emoji: '💕',
            lastMessage: 'I love you! See you tonight 💖',
            time: '2m',
            unread: 2,
        },
    ];

    return (
        <GradientBackground variant="warm">
            <ScrollView
                style={styles.container}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top + spacing.lg, paddingBottom: 100 }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                    <Text style={styles.title}>Messages</Text>
                    <Text style={styles.subtitle}>Stay connected with your love</Text>
                </Animated.View>

                {/* Chat List */}
                <View style={styles.chatList}>
                    {conversations.map((chat, index) => (
                        <ChatCard
                            key={chat.id}
                            {...chat}
                            delay={index * 100}
                            onPress={() => onChatPress?.(chat)}
                        />
                    ))}
                </View>

                {/* Empty State if no conversations */}
                {conversations.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>💬</Text>
                        <Text style={styles.emptyTitle}>No messages yet</Text>
                        <Text style={styles.emptySubtitle}>
                            Connect with your partner to start chatting
                        </Text>
                    </View>
                )}
            </ScrollView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
    },
    header: {
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    chatList: {
        gap: spacing.md,
    },
    chatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarEmoji: {
        fontSize: 28,
    },
    unreadBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    chatContent: {
        flex: 1,
        marginLeft: spacing.md,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    chatName: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    chatTime: {
        fontSize: 12,
        color: colors.textMuted,
    },
    chatMessage: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing['3xl'],
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    emptySubtitle: {
        fontSize: 15,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});

export default ConversationsScreen;
