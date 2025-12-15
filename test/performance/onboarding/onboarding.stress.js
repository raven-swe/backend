import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 50 },    // Ramp up to 50 users
        { duration: '1m', target: 100 },    // Ramp up to 100 users
        { duration: '30s', target: 200 },   // Ramp up to 200 users
        { duration: '2m', target: 200 },    // Sustain at 200 users
        { duration: '30s', target: 0 },     // Ramp down
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'],
        'http_req_duration{name:01_Login_Action}': ['p(95)<3000'],
        'http_req_duration{name:02_Get_Follow_Suggestions}': ['p(95)<2000'],
        'http_req_duration{name:03_Get_Follow_Suggestions_With_Limit}': ['p(95)<2000'],
        'http_req_duration{name:04_Get_Username_Suggestions}': ['p(95)<1500'],
        'http_req_duration{name:05_Get_Username_Suggestions_Typed}': ['p(95)<1500'],
    },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'http://localhost:3000';

/**
 * Helper function to create and login a user
 * Returns { accessToken } or null on failure
 */
function createAndLoginUser(tagName) {
    const resCreateUser = http.post(`${STRESS_TEST_URL}/test/users`);

    if (!check(resCreateUser, { 'User Created 201': (r) => r.status === 201 })) {
        console.error(`Setup Failed (Create User): ${resCreateUser.body}`);
        return null;
    }

    const userData = resCreateUser.json('data');
    const userEmail = userData.email;
    const userPassword = userData.password;

    const loginPayload = JSON.stringify({
        identifier: userEmail,
        password: userPassword,
    });

    const loginParams = {
        headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'web',
        },
        tags: { name: tagName },
    };

    const resLogin = http.post(`${STRESS_TEST_URL}/auth/login`, loginPayload, loginParams);

    if (!check(resLogin, { 'Login 200': (r) => r.status === 200 })) {
        console.error(`Setup Failed (Login): ${resLogin.body}`);
        return null;
    }

    return {
        accessToken: resLogin.json('data.accessToken'),
    };
}

export default function () {
    // ─────────────────────────────────────────────────────────────────────────────
    // SETUP: Create and login user
    // ─────────────────────────────────────────────────────────────────────────────
    const user = createAndLoginUser('01_Login_Action');
    if (!user) return;

    const authHeaders = {
        'Content-Type': 'application/json',
        'X-Client-Type': 'web',
        Authorization: `Bearer ${user.accessToken}`,
    };

    sleep(0.2);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 1: Get Follow Suggestions (default limit)
    // ─────────────────────────────────────────────────────────────────────────────
    group('Follow Suggestions', function () {
        const resFollowSuggestions = http.get(
            `${STRESS_TEST_URL}/onboarding/follow-suggestions`,
            {
                headers: authHeaders,
                tags: { name: '02_Get_Follow_Suggestions' },
            }
        );

        const followSuggestionsOk = check(resFollowSuggestions, {
            'Get Follow Suggestions 200': (r) => r.status === 200,
        });

        if (!followSuggestionsOk) {
            console.error(`Get Follow Suggestions Failed [VU:${__VU}]: ${resFollowSuggestions.status} - ${resFollowSuggestions.body}`);
        }

        sleep(0.2);

        // ───────────────────────────────────────────────────────────────────────────
        // STEP 2: Get Follow Suggestions with custom limit
        // ───────────────────────────────────────────────────────────────────────────
        const resFollowSuggestionsLimit = http.get(
            `${STRESS_TEST_URL}/onboarding/follow-suggestions?limit=10`,
            {
                headers: authHeaders,
                tags: { name: '03_Get_Follow_Suggestions_With_Limit' },
            }
        );

        const followSuggestionsLimitOk = check(resFollowSuggestionsLimit, {
            'Get Follow Suggestions With Limit 200': (r) => r.status === 200,
        });

        if (!followSuggestionsLimitOk) {
            console.error(`Get Follow Suggestions With Limit Failed [VU:${__VU}]: ${resFollowSuggestionsLimit.status} - ${resFollowSuggestionsLimit.body}`);
        }
    });

    sleep(0.3);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 3: Get Username Suggestions (based on display name)
    // ─────────────────────────────────────────────────────────────────────────────
    group('Username Suggestions', function () {
        const resUsernameSuggestions = http.get(
            `${STRESS_TEST_URL}/onboarding/username-suggestions`,
            {
                headers: authHeaders,
                tags: { name: '04_Get_Username_Suggestions' },
            }
        );

        const usernameSuggestionsOk = check(resUsernameSuggestions, {
            'Get Username Suggestions 200': (r) => r.status === 200,
        });

        if (!usernameSuggestionsOk) {
            console.error(`Get Username Suggestions Failed [VU:${__VU}]: ${resUsernameSuggestions.status} - ${resUsernameSuggestions.body}`);
        }

        sleep(0.2);

        // ───────────────────────────────────────────────────────────────────────────
        // STEP 4: Get Username Suggestions with typed parameter
        // ───────────────────────────────────────────────────────────────────────────
        const typedInput = `user${__VU}${__ITER}`;
        const resUsernameSuggestionsTyped = http.get(
            `${STRESS_TEST_URL}/onboarding/username-suggestions?typed=${encodeURIComponent(typedInput)}`,
            {
                headers: authHeaders,
                tags: { name: '05_Get_Username_Suggestions_Typed' },
            }
        );

        const usernameSuggestionsTypedOk = check(resUsernameSuggestionsTyped, {
            'Get Username Suggestions Typed 200': (r) => r.status === 200,
        });

        if (!usernameSuggestionsTypedOk) {
            console.error(`Get Username Suggestions Typed Failed [VU:${__VU}]: ${resUsernameSuggestionsTyped.status} - ${resUsernameSuggestionsTyped.body}`);
        }
    });

    sleep(0.2);
}
