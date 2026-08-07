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

import { QuestionContentCache } from '../questionContentCache';

describe('QuestionContentCache', () => {
    beforeEach(() => {
        mockValues.clear();
    });

    test('stores set responses separately for each user', () => {
        const response = { success: true, data: { sets: [{ setId: 'set-1' }] } };

        QuestionContentCache.setSets({ topicId: 'future', userId: 'user-1', response });

        expect(QuestionContentCache.getSets({ topicId: 'future', userId: 'user-1' }))
            .toEqual(response);
        expect(QuestionContentCache.getSets({ topicId: 'future', userId: 'user-2' }))
            .toBeNull();
    });

    test('stores question pages independently by cursor', () => {
        const firstPage = { success: true, data: { questions: [{ questionId: 'q1' }] } };
        const secondPage = { success: true, data: { questions: [{ questionId: 'q2' }] } };
        const base = { topicId: 'future', setId: 'set-1', userId: 'user-1', limit: 10 };

        QuestionContentCache.setQuestions({ ...base, cursor: 0, response: firstPage });
        QuestionContentCache.setQuestions({ ...base, cursor: 10, response: secondPage });

        expect(QuestionContentCache.getQuestions({ ...base, cursor: 0 })).toEqual(firstPage);
        expect(QuestionContentCache.getQuestions({ ...base, cursor: 10 })).toEqual(secondPage);
    });

    test('keeps a locally completed set completed across re-entry', () => {
        const response = {
            success: true,
            data: {
                sets: [{
                    setId: 'set-1',
                    progress: { completedAt: null, percentComplete: 80 },
                }],
            },
        };
        QuestionContentCache.setSets({ topicId: 'future', userId: 'user-1', response });

        QuestionContentCache.markSetCompleted({
            topicId: 'future',
            setId: 'set-1',
            userId: 'user-1',
            completedAt: '2026-08-07T12:00:00.000Z',
        });

        expect(QuestionContentCache.getSets({ topicId: 'future', userId: 'user-1' }))
            .toEqual({
                success: true,
                data: {
                    sets: [{
                        setId: 'set-1',
                        progress: {
                            completedAt: '2026-08-07T12:00:00.000Z',
                            percentComplete: 100,
                        },
                    }],
                },
            });
    });

    test('does not let an older set refresh erase local completion', () => {
        const params = { topicId: 'future', userId: 'user-1' };
        QuestionContentCache.setSets({
            ...params,
            response: {
                success: true,
                data: { sets: [{ setId: 'set-1', progress: { completedAt: null } }] },
            },
        });
        QuestionContentCache.markSetCompleted({
            ...params,
            setId: 'set-1',
            completedAt: '2026-08-07T12:00:00.000Z',
        });

        QuestionContentCache.setSets({
            ...params,
            response: {
                success: true,
                data: { sets: [{ setId: 'set-1', progress: { completedAt: null } }] },
            },
        });

        expect(QuestionContentCache.getSets(params).data.sets[0].progress).toEqual({
            completedAt: '2026-08-07T12:00:00.000Z',
            percentComplete: 100,
        });
    });
});
