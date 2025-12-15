import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 50 },    // Ramp up to 50 users
        { duration: '1m', target: 100 },    // Ramp up to 100 users
        { duration: '30s', target: 300 },   // Ramp up to 300 users
        { duration: '2m', target: 300 },    // Sustain at 300 users
        { duration: '30s', target: 0 },     // Ramp down
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'],
        'http_req_duration{name:01_Login_UserA}': ['p(95)<2000'],
        'http_req_duration{name:02_Login_UserB}': ['p(95)<2000'],
        'http_req_duration{name:03_UserA_Create_Tweet}': ['p(95)<2000'],
        'http_req_duration{name:04_UserB_Follow_UserA}': ['p(95)<1000'],
        'http_req_duration{name:05_UserB_Like_Tweet}': ['p(95)<500'],
        'http_req_duration{name:06_Get_Notifications}': ['p(95)<1000'],
        'http_req_duration{name:07_Get_Notifications_Page2}': ['p(95)<1000'],
        'http_req_duration{name:08_Get_Unseen_Count}': ['p(95)<500'],
        'http_req_duration{name:09_Mark_Single_Seen}': ['p(95)<500'],
        'http_req_duration{name:10_Mark_All_Seen}': ['p(95)<500'],
    },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'http://localhost:3000';

/**
 * Helper function to create and login a user
 * Returns { accessToken, userId, username } or null on failure
 */
function createAndLoginUser(userLabel, tagName) {
    const resCreateUser = http.post(`${STRESS_TEST_URL}/test/users`);

    if (!check(resCreateUser, { [`${userLabel} Created 201`]: (r) => r.status === 201 })) {
        console.error(`Setup Failed (Create ${userLabel}): ${resCreateUser.body}`);
        return null;
    }

    const userData = resCreateUser.json('data');
    const userEmail = userData.email;
    const userPassword = userData.password;
    const username = userData.username; // Get username from /test/users response

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

    if (!check(resLogin, { [`${userLabel} Login 200`]: (r) => r.status === 200 })) {
        console.error(`Setup Failed (Login ${userLabel}): ${resLogin.body}`);
        return null;
    }

    return {
        accessToken: resLogin.json('data.accessToken'),
        username: username, // Use username from /test/users response
    };
}

export default function () {
    // ─────────────────────────────────────────────────────────────────────────────
    // SETUP: Create and login User A (will receive notifications)
    // ─────────────────────────────────────────────────────────────────────────────
    const userA = createAndLoginUser('UserA', '01_Login_UserA');
    if (!userA) return;

    const authParamsA = {
        headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'web',
            Authorization: `Bearer ${userA.accessToken}`,
        },
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // SETUP: Create and login User B (will trigger notifications for User A)
    // ─────────────────────────────────────────────────────────────────────────────
    const userB = createAndLoginUser('UserB', '02_Login_UserB');
    if (!userB) return;

    const authParamsB = {
        headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'web',
            Authorization: `Bearer ${userB.accessToken}`,
        },
    };

    sleep(0.2);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 1: User A creates a tweet (so User B can like it)
    // ─────────────────────────────────────────────────────────────────────────────
    const uniqueContent = `Notification Test Tweet ${__VU}-${__ITER} - ${Date.now()}`;

    const createPayload = JSON.stringify({
        content: uniqueContent,
    });

    const resCreateTweet = http.post(`${STRESS_TEST_URL}/tweets`, createPayload, {
        ...authParamsA,
        tags: { name: '03_UserA_Create_Tweet' },
    });

    if (!check(resCreateTweet, { 'UserA Create Tweet 201': (r) => r.status === 201 })) {
        console.error(`UserA Create Tweet Failed: ${resCreateTweet.body}`);
        return;
    }

    const tweetId = resCreateTweet.json('data.id');

    sleep(0.2);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 2: User B follows User A (triggers FOLLOW notification)
    // ─────────────────────────────────────────────────────────────────────────────
    group('Trigger Notifications', function () {
        const resFollow = http.post(
            `${STRESS_TEST_URL}/users/${userA.username}/following`,
            null,
            { ...authParamsB, tags: { name: '04_UserB_Follow_UserA' } }
        );

        check(resFollow, {
            'UserB Follow UserA 2xx': (r) => r.status >= 200 && r.status < 300,
        });

        sleep(0.1);

        // ───────────────────────────────────────────────────────────────────────────
        // STEP 3: User B likes User A's tweet (triggers LIKE notification)
        // ───────────────────────────────────────────────────────────────────────────
        const resLike = http.post(
            `${STRESS_TEST_URL}/tweets/${tweetId}/like`,
            null,
            { ...authParamsB, tags: { name: '05_UserB_Like_Tweet' } }
        );

        check(resLike, {
            'UserB Like Tweet 2xx': (r) => r.status >= 200 && r.status < 300,
        });
    });

    // Small delay to allow notifications to be processed
    sleep(0.3);

    // ─────────────────────────────────────────────────────────────────────────────
    // User A: Test Notification Endpoints
    // ─────────────────────────────────────────────────────────────────────────────
    group('Notification Endpoints', function () {
        // ───────────────────────────────────────────────────────────────────────────
        // STEP 4: GET /notifications (first page)
        // ───────────────────────────────────────────────────────────────────────────
        const resNotifications = http.get(
            `${STRESS_TEST_URL}/notifications?limit=20`,
            { ...authParamsA, tags: { name: '06_Get_Notifications' } }
        );

        const notificationsOk = check(resNotifications, {
            'Get Notifications 200': (r) => r.status === 200,
        });

        if (!notificationsOk) {
            console.error(`Get Notifications Failed: ${resNotifications.body}`);
            return;
        }

        // Get a notification ID for single mark-as-seen test
        let notificationId = null;
        let cursor = null;
        try {
            const body = resNotifications.json();
            if (body.items && body.items.length > 0) {
                notificationId = body.items[0].id;
            }
            if (body.pagination && body.pagination.nextCursor) {
                cursor = body.pagination.nextCursor;
            }
        } catch {
            // No notifications available
        }

        sleep(0.1);

        // ───────────────────────────────────────────────────────────────────────────
        // STEP 5: GET /notifications (pagination - second page if cursor exists)
        // ───────────────────────────────────────────────────────────────────────────
        if (cursor) {
            const resNotificationsPage2 = http.get(
                `${STRESS_TEST_URL}/notifications?limit=20&cursor=${encodeURIComponent(cursor)}`,
                { ...authParamsA, tags: { name: '07_Get_Notifications_Page2' } }
            );

            check(resNotificationsPage2, {
                'Get Notifications Page2 200': (r) => r.status === 200,
            });
        } else {
            // Make a request with different limit to ensure consistent load
            const resNotificationsPage2 = http.get(
                `${STRESS_TEST_URL}/notifications?limit=10`,
                { ...authParamsA, tags: { name: '07_Get_Notifications_Page2' } }
            );

            check(resNotificationsPage2, {
                'Get Notifications Page2 200': (r) => r.status === 200,
            });
        }

        sleep(0.1);

        // ───────────────────────────────────────────────────────────────────────────
        // STEP 6: GET /notifications/count
        // ───────────────────────────────────────────────────────────────────────────
        const resCount = http.get(
            `${STRESS_TEST_URL}/notifications/count`,
            { ...authParamsA, tags: { name: '08_Get_Unseen_Count' } }
        );

        check(resCount, {
            'Get Unseen Count 200': (r) => r.status === 200,
        });

        sleep(0.1);

        // ───────────────────────────────────────────────────────────────────────────
        // STEP 7: PATCH /notifications/:notificationId/seen (mark single as seen)
        // ───────────────────────────────────────────────────────────────────────────
        if (notificationId) {
            const resMarkSingleSeen = http.patch(
                `${STRESS_TEST_URL}/notifications/${notificationId}/seen`,
                null,
                { ...authParamsA, tags: { name: '09_Mark_Single_Seen' } }
            );

            check(resMarkSingleSeen, {
                'Mark Single Seen 200': (r) => r.status === 200,
            });
        }
        // Skip if no notification ID available (no notifications triggered yet)

        sleep(0.1);

        // ───────────────────────────────────────────────────────────────────────────
        // STEP 8: PATCH /notifications/seen (mark all as seen)
        // ───────────────────────────────────────────────────────────────────────────
        const resMarkAllSeen = http.patch(
            `${STRESS_TEST_URL}/notifications/seen`,
            null,
            { ...authParamsA, tags: { name: '10_Mark_All_Seen' } }
        );

        check(resMarkAllSeen, {
            'Mark All Seen 200': (r) => r.status === 200,
        });
    });

    sleep(0.1);
}
