const mockValues = new Map();

jest.mock('../../utils/authStorage', () => ({
    storage: {
        getString: jest.fn((key) => mockValues.get(key)),
        set: jest.fn((key, value) => mockValues.set(key, value)),
        delete: jest.fn((key) => mockValues.delete(key)),
    },
}));

jest.mock('../../i18n/uiTranslation', () => ({
    getContentLanguage: jest.fn(() => 'en'),
}));

import {
    mergeQuestionReportWithLocalAnswers,
    QuestionReportCache,
} from '../questionReportCache';

describe('QuestionReportCache', () => {
    beforeEach(() => mockValues.clear());

    test('merges current user answers with cached partner answers', () => {
        const merged = mergeQuestionReportWithLocalAnswers(
            {
                format: 'thisorthat',
                items: [{ questionId: 'q1', userAnswer: null, partnerAnswer: 'Tea' }],
            },
            {
                format: 'thisorthat',
                items: [{ questionId: 'q1', userAnswer: 'Tea', hasLocalUserAnswer: true }],
            },
        );

        expect(merged.items[0].userAnswer).toBe('Tea');
        expect(merged.items[0].partnerAnswer).toBe('Tea');
        expect(merged.summary.matched).toBe(1);
    });

    test('patches a cached answer without removing partner data', () => {
        const params = { topicId: 'future', setId: 'set-1', userId: 'user-1' };
        QuestionReportCache.set({
            ...params,
            report: {
                format: 'deep',
                items: [{ questionId: 'q1', userAnswer: null, partnerAnswer: 'Hello' }],
            },
        });

        QuestionReportCache.patchUserAnswer({ ...params, questionId: 'q1', answer: 'Hi' });

        expect(QuestionReportCache.get(params).items[0]).toMatchObject({
            userAnswer: 'Hi',
            partnerAnswer: 'Hello',
        });
    });

    test('keeps only the twenty most recently stored reports per user', () => {
        for (let index = 0; index < 21; index += 1) {
            QuestionReportCache.set({
                topicId: 'future',
                setId: `set-${index}`,
                userId: 'user-1',
                report: { format: 'deep', items: [] },
            });
        }

        expect(QuestionReportCache.get({ topicId: 'future', setId: 'set-0', userId: 'user-1' }))
            .toBeNull();
        expect(QuestionReportCache.get({ topicId: 'future', setId: 'set-20', userId: 'user-1' }))
            .not.toBeNull();
    });
});
