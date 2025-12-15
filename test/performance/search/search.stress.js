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
        'http_req_duration{name:02_Search_Suggestions}': ['p(95)<1500'],
        'http_req_duration{name:03_Search_Suggestions_Hashtag}': ['p(95)<1500'],
        'http_req_duration{name:04_Search_Tweets}': ['p(95)<2000'],
        'http_req_duration{name:05_Search_Tweets_Page2}': ['p(95)<2000'],
        'http_req_duration{name:06_Search_Users}': ['p(95)<2000'],
        'http_req_duration{name:07_Search_Users_Page2}': ['p(95)<2000'],
        'http_req_duration{name:08_User_Suggestions}': ['p(95)<1500'],
    },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'http://localhost:3000';

// Sample search queries to use
const SEARCH_QUERIES = [
    'hello',
    'test',
    'user',
    'tweet',
    'world',
    'stress',
    'search',
    'random',
];

const HASHTAG_QUERIES = [
    '#trending',
    '#news',
    '#tech',
    '#hello',
    '#test',
];

/**
 * Get a random search query
 */
function getRandomQuery() {
    return SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
}

/**
 * Get a random hashtag query
 */
function getRandomHashtagQuery() {
    return HASHTAG_QUERIES[Math.floor(Math.random() * HASHTAG_QUERIES.length)];
}

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

    const searchQuery = getRandomQuery();
    const hashtagQuery = getRandomHashtagQuery();

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 1: GET /search/suggestions (regular query)
    // ─────────────────────────────────────────────────────────────────────────────
    group('Search Suggestions', function () {
        const resSuggestions = http.get(
            `${STRESS_TEST_URL}/search/suggestions?query=${encodeURIComponent(searchQuery)}`,
            {
                headers: authHeaders,
                tags: { name: '02_Search_Suggestions' },
            }
        );

        const suggestionsOk = check(resSuggestions, {
            'Search Suggestions 200': (r) => r.status === 200,
        });

        if (!suggestionsOk) {
            console.error(`Search Suggestions Failed [VU:${__VU}]: ${resSuggestions.status} - ${resSuggestions.body}`);
        }

        sleep(0.2);

        // ───────────────────────────────────────────────────────────────────────────
        // STEP 2: GET /search/suggestions (hashtag query)
        // ───────────────────────────────────────────────────────────────────────────
        const resSuggestionsHashtag = http.get(
            `${STRESS_TEST_URL}/search/suggestions?query=${encodeURIComponent(hashtagQuery)}`,
            {
                headers: authHeaders,
                tags: { name: '03_Search_Suggestions_Hashtag' },
            }
        );

        const suggestionsHashtagOk = check(resSuggestionsHashtag, {
            'Search Suggestions Hashtag 200': (r) => r.status === 200,
        });

        if (!suggestionsHashtagOk) {
            console.error(`Search Suggestions Hashtag Failed [VU:${__VU}]: ${resSuggestionsHashtag.status} - ${resSuggestionsHashtag.body}`);
        }
    });

    sleep(0.3);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 3: GET /search/tweets (first page)
    // ─────────────────────────────────────────────────────────────────────────────
    group('Search Tweets', function () {
        const resTweets = http.get(
            `${STRESS_TEST_URL}/search/tweets?query=${encodeURIComponent(searchQuery)}&limit=20`,
            {
                headers: authHeaders,
                tags: { name: '04_Search_Tweets' },
            }
        );

        const tweetsOk = check(resTweets, {
            'Search Tweets 200': (r) => r.status === 200,
        });

        if (!tweetsOk) {
            console.error(`Search Tweets Failed [VU:${__VU}]: ${resTweets.status} - ${resTweets.body}`);
            return;
        }

        sleep(0.2);

        // ───────────────────────────────────────────────────────────────────────────
        // STEP 4: GET /search/tweets (pagination - second page)
        // ───────────────────────────────────────────────────────────────────────────
        let cursor = null;
        try {
            const body = resTweets.json();
            if (body.pagination && body.pagination.nextCursor) {
                cursor = body.pagination.nextCursor;
            }
        } catch {
            // No cursor available
        }

        if (cursor) {
            const resTweetsPage2 = http.get(
                `${STRESS_TEST_URL}/search/tweets?query=${encodeURIComponent(searchQuery)}&limit=20&cursor=${encodeURIComponent(cursor)}`,
                {
                    headers: authHeaders,
                    tags: { name: '05_Search_Tweets_Page2' },
                }
            );

            check(resTweetsPage2, {
                'Search Tweets Page2 200': (r) => r.status === 200,
            });
        } else {
            // Make another request with different limit for consistent load
            const resTweetsPage2 = http.get(
                `${STRESS_TEST_URL}/search/tweets?query=${encodeURIComponent(searchQuery)}&limit=10`,
                {
                    headers: authHeaders,
                    tags: { name: '05_Search_Tweets_Page2' },
                }
            );

            check(resTweetsPage2, {
                'Search Tweets Page2 200': (r) => r.status === 200,
            });
        }
    });

    sleep(0.3);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 5: GET /search/users (first page)
    // ─────────────────────────────────────────────────────────────────────────────
    group('Search Users', function () {
        const resUsers = http.get(
            `${STRESS_TEST_URL}/search/users?query=${encodeURIComponent(searchQuery)}&limit=20`,
            {
                headers: authHeaders,
                tags: { name: '06_Search_Users' },
            }
        );

        const usersOk = check(resUsers, {
            'Search Users 200': (r) => r.status === 200,
        });

        if (!usersOk) {
            console.error(`Search Users Failed [VU:${__VU}]: ${resUsers.status} - ${resUsers.body}`);
            return;
        }

        sleep(0.2);

        // ───────────────────────────────────────────────────────────────────────────
        // STEP 6: GET /search/users (pagination - second page)
        // ───────────────────────────────────────────────────────────────────────────
        let cursor = null;
        try {
            const body = resUsers.json();
            if (body.pagination && body.pagination.nextCursor) {
                cursor = body.pagination.nextCursor;
            }
        } catch {
            // No cursor available
        }

        if (cursor) {
            const resUsersPage2 = http.get(
                `${STRESS_TEST_URL}/search/users?query=${encodeURIComponent(searchQuery)}&limit=20&cursor=${encodeURIComponent(cursor)}`,
                {
                    headers: authHeaders,
                    tags: { name: '07_Search_Users_Page2' },
                }
            );

            check(resUsersPage2, {
                'Search Users Page2 200': (r) => r.status === 200,
            });
        } else {
            // Make another request with different limit for consistent load
            const resUsersPage2 = http.get(
                `${STRESS_TEST_URL}/search/users?query=${encodeURIComponent(searchQuery)}&limit=10`,
                {
                    headers: authHeaders,
                    tags: { name: '07_Search_Users_Page2' },
                }
            );

            check(resUsersPage2, {
                'Search Users Page2 200': (r) => r.status === 200,
            });
        }
    });

    sleep(0.3);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 7: GET /search/users/suggestions (for mentions)
    // ─────────────────────────────────────────────────────────────────────────────
    group('User Suggestions', function () {
        const resUserSuggestions = http.get(
            `${STRESS_TEST_URL}/search/users/suggestions?query=${encodeURIComponent(searchQuery)}`,
            {
                headers: authHeaders,
                tags: { name: '08_User_Suggestions' },
            }
        );

        const userSuggestionsOk = check(resUserSuggestions, {
            'User Suggestions 200': (r) => r.status === 200,
        });

        if (!userSuggestionsOk) {
            console.error(`User Suggestions Failed [VU:${__VU}]: ${resUserSuggestions.status} - ${resUserSuggestions.body}`);
        }
    });

    sleep(0.1);
}
