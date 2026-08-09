jest.mock('../../constants/Api', () => ({ API_BASE: 'https://example.test' }));
jest.mock('../../utils/apiFetch', () => ({ apiFetch: jest.fn() }));

import { QuestionsV2Api } from '../questionsV2Api';
import { apiFetch } from '../../utils/apiFetch';

const successfulResponse = (data = {}) => ({
    ok: true,
    json: jest.fn().mockResolvedValue({ success: true, data }),
});

describe('QuestionsV2Api.submitAnswer', () => {
    beforeEach(() => {
        apiFetch.mockReset();
        apiFetch.mockResolvedValue(successfulResponse());
    });

    test('sends answerSessionId for a new-client set opening', async () => {
        await QuestionsV2Api.submitAnswer({
            userId: 'user-1',
            topicId: 'future',
            setId: 'set-1',
            questionId: 'q1',
            answer: 'Yes',
            answerSessionId: 'question-set-session-123',
        });

        const [, options] = apiFetch.mock.calls[0];
        expect(JSON.parse(options.body)).toMatchObject({
            questionId: 'q1',
            answerSessionId: 'question-set-session-123',
        });
    });

    test('omits answerSessionId for a legacy-compatible request', async () => {
        await QuestionsV2Api.submitAnswer({
            userId: 'user-1',
            topicId: 'future',
            setId: 'set-1',
            questionId: 'q1',
            answer: 'Yes',
        });

        const [, options] = apiFetch.mock.calls[0];
        expect(JSON.parse(options.body)).not.toHaveProperty('answerSessionId');
    });
});
