/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TouchableOpacity, View } from 'react-native';
import TopicQuestionsSummaryScreen from '../TopicQuestionsSummaryScreen';
import { QuestionsV2Api } from '../../api/questionsV2Api';
import { QuestionReportCache } from '../../services/questionReportCache';

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock('react-native-linear-gradient', () => ({ children }) => children);
jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null }));
jest.mock('lucide-react-native', () => ({
    ChevronRight: () => null,
    MessageCircle: () => null,
    Sparkles: () => null,
}));
jest.mock('../../components/chat/VoiceBubble', () => () => null);
jest.mock('../../i18n/uiTranslation', () => ({ translateUiText: text => text }));
jest.mock('../../api/questionsV2Api', () => ({ QuestionsV2Api: { getSetReport: jest.fn() } }));
jest.mock('../../services/questionReportCache', () => ({
    QuestionReportCache: { get: jest.fn(), set: jest.fn() },
    mergeQuestionReportWithLocalAnswers: cached => cached,
}));

test.each([
    ['deep', 'Tap to answer', 'My favorite memory', 'Discuss in chat'],
    ['voicerecord', 'Tap to record', 'https://example.com/answer.m4a', 'Discuss in chat'],
    ['takephoto', 'Tap to take photo', 'https://example.com/answer.jpg', 'Open this memory'],
    ['wouldyourather', 'Tap to answer', 'Option A', 'Discuss in chat'],
    ['thisorthat', 'Tap to answer', 'This', 'Discuss in chat'],
    ['likelyto', 'Tap to answer', 'you', 'Discuss in chat'],
])('%s keeps answering separate from opening the partner conversation', async (format, answerLabel, partnerAnswer, chatLabel) => {
    const item = {
        questionId: 'question-1',
        prompt: 'What reminds you of us?',
        userAnswer: null,
        partnerAnswer,
        chatId: 'chat-1',
    };
    const report = { items: [item], summary: { bothAnswered: 0 } };
    QuestionReportCache.get.mockReturnValue(report);
    QuestionsV2Api.getSetReport.mockResolvedValue({ success: true, data: report });
    const onAnswerQuestion = jest.fn();
    const onOpenQuestionChat = jest.fn();
    let renderer;

    await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
            <TopicQuestionsSummaryScreen
                topic="memories"
                selectedSet={{ setId: 'set-1', format }}
                userId="user-1"
                hasPartner
                onAnswerQuestion={onAnswerQuestion}
                onOpenQuestionChat={onOpenQuestionChat}
            />,
        );
    });

    const findAction = label => renderer.root.findAllByType(TouchableOpacity)
        .find(button => button.props.accessibilityLabel === label);

    await ReactTestRenderer.act(() => findAction(answerLabel).props.onPress());
    expect(onAnswerQuestion).toHaveBeenCalledWith(item);
    expect(onOpenQuestionChat).not.toHaveBeenCalled();

    await ReactTestRenderer.act(() => findAction(chatLabel).props.onPress());
    expect(onOpenQuestionChat).toHaveBeenCalledWith(item);
    expect(onAnswerQuestion).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(() => renderer.unmount());
});

test.each([
    ['you', 'you', ['ME', 'ME']],
    ['partner', 'partner', ['You', 'You']],
    ['you', { value: 'partner' }, ['ME', 'You']],
    [{ value: 'partner' }, 'you', ['You', 'ME']],
])('Likely To shows ME / You from each answerer’s perspective (%j, %j)', async (userAnswer, partnerAnswer, expectedLabels) => {
    const report = {
        items: [{ questionId: 'likely-1', prompt: 'Who is more likely to plan a trip?', userAnswer, partnerAnswer }],
        summary: { bothAnswered: 1 },
    };
    QuestionReportCache.get.mockReturnValue(report);
    QuestionsV2Api.getSetReport.mockResolvedValue({ success: true, data: report });
    let renderer;

    await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
            <TopicQuestionsSummaryScreen
                topic="travel"
                selectedSet={{ setId: 'set-1', format: 'likelyto' }}
                userId="user-1"
                hasPartner
            />,
        );
    });

    const labels = renderer.root.findAllByType(Text)
        .map(node => node.props.children)
        .filter(text => text === 'ME' || text === 'You');
    expect(labels).toEqual([expectedLabels[1], expectedLabels[0]]);
    const visibleText = renderer.root.findAllByType(Text).map(node => node.props.children);
    expect(visibleText).not.toContain('you');
    expect(visibleText).not.toContain('partner');

    await ReactTestRenderer.act(() => renderer.unmount());
});

test.each([
    [1, 1],
    [10, 10],
    [1, 2],
    [9, 10],
    [8, 3],
    [5, null],
    [null, 6],
])('slider shows each available rating (%s, %s) after measuring the track', async (userAnswer, partnerAnswer) => {
    const report = {
        items: [{ questionId: 'rating-1', prompt: 'How connected do you feel?', minValue: 1, maxValue: 10, userAnswer, partnerAnswer }],
        summary: { bothAnswered: userAnswer !== null && partnerAnswer !== null ? 1 : 0 },
    };
    QuestionReportCache.get.mockReturnValue(report);
    QuestionsV2Api.getSetReport.mockResolvedValue({ success: true, data: report });
    let renderer;

    await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
            <TopicQuestionsSummaryScreen
                topic="relationship"
                selectedSet={{ setId: 'set-1', format: 'slider' }}
                userId="user-1"
                userName="You"
                partnerName="Partner"
                hasPartner
            />,
        );
    });

    await ReactTestRenderer.act(() => {
        renderer.root.findByProps({ testID: 'slider-plot-rating-1' }).props.onLayout({
            nativeEvent: { layout: { width: 232 } },
        });
    });

    [['You', userAnswer], ['Partner', partnerAnswer]].forEach(([name, value]) => {
        const badges = renderer.root.findAll(node => node.props.accessibilityLabel === `${name}: ${value}`);
        expect(badges.length > 0).toBe(value !== null);
    });
    const visibleText = renderer.root.findAllByType(Text).map(node => node.props.children);
    const markers = renderer.root.findAllByType(View).filter(node => node.props.testID?.startsWith('rating-marker-'));
    const matching = userAnswer !== null && userAnswer === partnerAnswer;
    expect(markers.map(marker => marker.props.testID)).toEqual(
        matching
            ? ['rating-marker-shared']
            : [userAnswer !== null && 'rating-marker-user', partnerAnswer !== null && 'rating-marker-partner'].filter(Boolean),
    );
    expect(visibleText.filter(value => typeof value === 'number')).toHaveLength(10);
    for (let tick = 1; tick <= 10; tick++) {
        expect(visibleText).toContain(tick);
    }

    await ReactTestRenderer.act(() => renderer.unmount());
});

test.each([
    {
        format: 'wouldyourather',
        userAnswer: 'B',
        partnerAnswer: { value: 'A' },
        optionItems: [{ value: 'A', label: 'A beach holiday' }, { value: 'B', label: 'A mountain escape' }],
        options: ['Old option A', 'Old option B'],
        expectedLabels: ['A mountain escape', 'A beach holiday'],
    },
    {
        format: 'thisorthat',
        userAnswer: { value: 0 },
        partnerAnswer: 1,
        options: [{ value: 0, label: 'Coffee' }, { value: 1, label: 'Tea' }],
        expectedLabels: ['Coffee', 'Tea'],
    },
    {
        format: 'thisorthat',
        userAnswer: 'An older answer',
        partnerAnswer: 'Tea',
        options: ['Coffee', 'Tea'],
        expectedLabels: ['An older answer', 'Tea'],
    },
])('$format displays selected option labels and preserves answers missing from the options', async ({
    format, userAnswer, partnerAnswer, optionItems, options, expectedLabels,
}) => {
    const report = {
        items: [{ questionId: 'question-1', prompt: 'Which would you pick?', userAnswer, partnerAnswer, optionItems, options }],
        summary: { bothAnswered: 1, matched: 0 },
    };
    QuestionReportCache.get.mockReturnValue(report);
    QuestionsV2Api.getSetReport.mockResolvedValue({ success: true, data: report });
    let renderer;

    await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
            <TopicQuestionsSummaryScreen
                topic="travel"
                selectedSet={{ setId: 'set-1', format }}
                userId="user-1"
                hasPartner
            />,
        );
    });

    const visibleText = renderer.root.findAllByType(Text).map(node => node.props.children);
    expectedLabels.forEach(label => expect(visibleText).toContain(label));

    await ReactTestRenderer.act(() => renderer.unmount());
});
