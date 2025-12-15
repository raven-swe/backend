import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 20 },   // Ramp up to 20 users
        { duration: '1m', target: 50 },    // Ramp up to 50 users
        { duration: '30s', target: 100 },  // Ramp up to 100 users
        { duration: '1m', target: 100 },   // Stay at 100 users
        { duration: '30s', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'],
        'http_req_duration{name:01_Login_Action}': ['p(95)<2000'],
        'http_req_duration{name:02_Create_Tweet_For_Timeline}': ['p(95)<2000'],
        'http_req_duration{name:03_Get_Following_Timeline}': ['p(95)<1000'],
        'http_req_duration{name:04_Get_Following_Pagination}': ['p(95)<1000'],
        'http_req_duration{name:05_Get_ForYou_Timeline}': ['p(95)<1000'],
        'http_req_duration{name:06_Get_ForYou_Pagination}': ['p(95)<1000'],
    },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'http://localhost:3000';

export default function () {
    // ─────────────────────────────────────────────────────────────────────────────
    // SETUP: Create a test user
    // ─────────────────────────────────────────────────────────────────────────────
    const resCreateUser = http.post(`${STRESS_TEST_URL}/test/users`);

    if (!check(resCreateUser, { 'User Created 201': (r) => r.status === 201 })) {
        console.error(`Setup Failed (Create User): ${resCreateUser.body}`);
        return;
    }

    const userData = resCreateUser.json('data');
    const userEmail = userData.email;
    const userPassword = userData.password;

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 1: Login
    // ─────────────────────────────────────────────────────────────────────────────
    const loginPayload = JSON.stringify({
        identifier: userEmail,
        password: userPassword,
    });

    const loginParams = {
        headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'web',
        },
        tags: { name: '01_Login_Action' },
    };

    const resLogin = http.post(`${STRESS_TEST_URL}/auth/login`, loginPayload, loginParams);

    if (!check(resLogin, { 'Login 200': (r) => r.status === 200 })) {
        console.error(`Setup Failed (Login): ${resLogin.body}`);
        return;
    }

    const accessToken = resLogin.json('data.accessToken');

    const authParams = {
        headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'web',
            Authorization: `Bearer ${accessToken}`,
        },
    };

    sleep(0.3);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 2: Create a tweet so the timeline has content
    // ─────────────────────────────────────────────────────────────────────────────
    const uniqueContent = `Timeline Stress Test Tweet ${__VU}-${__ITER} - ${Date.now()}`;

    const createPayload = JSON.stringify({
        content: uniqueContent,
    });

    const resCreateTweet = http.post(`${STRESS_TEST_URL}/tweets`, createPayload, {
        ...authParams,
        tags: { name: '02_Create_Tweet_For_Timeline' },
    });

    if (!check(resCreateTweet, { 'Create Tweet 201': (r) => r.status === 201 })) {
        console.error(`Create Tweet Failed: ${resCreateTweet.body}`);
        return;
    }

    sleep(0.3);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 3: Get Following Timeline (first page)
    // ─────────────────────────────────────────────────────────────────────────────
    group('Following Timeline', function () {
        const resFollowingTimeline = http.get(
            `${STRESS_TEST_URL}/timeline/following?limit=20`,
            { ...authParams, tags: { name: '03_Get_Following_Timeline' } }
        );

        const followingTimelineOk = check(resFollowingTimeline, {
            'Get Following Timeline 200': (r) => r.status === 200
        });

        if (!followingTimelineOk) {
            console.error(`Get Following Timeline Failed: ${resFollowingTimeline.body}`);
            return;
        }

        // Get cursor for pagination test if available
        let followingCursor = null;
        try {
            const followingBody = resFollowingTimeline.json();
            if (followingBody.pagination && followingBody.pagination.nextCursor) {
                followingCursor = followingBody.pagination.nextCursor;
            }
        } catch {
            // No cursor available
        }

        sleep(0.2);

        // ───────────────────────────────────────────────────────────────────────────
        // STEP 4: Get Following Timeline (pagination - second page if cursor exists)
        // ───────────────────────────────────────────────────────────────────────────
        if (followingCursor) {
            const resFollowingPagination = http.get(
                `${STRESS_TEST_URL}/timeline/following?limit=20&cursor=${encodeURIComponent(followingCursor)}`,
                { ...authParams, tags: { name: '04_Get_Following_Pagination' } }
            );

            check(resFollowingPagination, {
                'Get Following Pagination 200': (r) => r.status === 200,
            });

            if (resFollowingPagination.status !== 200) {
                console.error(`Get Following Pagination Failed: ${resFollowingPagination.body}`);
            }
        } else {
            // Make a request anyway to ensure thresholds are met with consistent load
            const resFollowingPagination = http.get(
                `${STRESS_TEST_URL}/timeline/following?limit=10`,
                { ...authParams, tags: { name: '04_Get_Following_Pagination' } }
            );

            check(resFollowingPagination, {
                'Get Following Pagination 200': (r) => r.status === 200,
            });
        }
    });

    sleep(0.3);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 5: Get For You Timeline (first page)
    // ─────────────────────────────────────────────────────────────────────────────
    group('For You Timeline', function () {
        const resForYouTimeline = http.get(
            `${STRESS_TEST_URL}/timeline/for-you?limit=20`,
            { ...authParams, tags: { name: '05_Get_ForYou_Timeline' } }
        );

        const forYouTimelineOk = check(resForYouTimeline, {
            'Get ForYou Timeline 200': (r) => r.status === 200,
        });

        if (!forYouTimelineOk) {
            console.error(`Get ForYou Timeline Failed: ${resForYouTimeline.body}`);
            return;
        }

        // Get cursor for pagination test if available
        let forYouCursor = null;
        try {
            const forYouBody = resForYouTimeline.json();
            if (forYouBody.pagination && forYouBody.pagination.nextCursor) {
                forYouCursor = forYouBody.pagination.nextCursor;
            }
        } catch {
            // No cursor available
        }

        sleep(0.2);

        // ───────────────────────────────────────────────────────────────────────────
        // STEP 6: Get For You Timeline (pagination - second page if cursor exists)
        // ───────────────────────────────────────────────────────────────────────────
        if (forYouCursor) {
            const resForYouPagination = http.get(
                `${STRESS_TEST_URL}/timeline/for-you?limit=20&cursor=${encodeURIComponent(forYouCursor)}`,
                { ...authParams, tags: { name: '06_Get_ForYou_Pagination' } }
            );

            check(resForYouPagination, {
                'Get ForYou Pagination 200': (r) => r.status === 200,
            });

            if (resForYouPagination.status !== 200) {
                console.error(`Get ForYou Pagination Failed: ${resForYouPagination.body}`);
            }
        } else {
            // Make a request anyway to ensure thresholds are met with consistent load
            const resForYouPagination = http.get(
                `${STRESS_TEST_URL}/timeline/for-you?limit=10`,
                { ...authParams, tags: { name: '06_Get_ForYou_Pagination' } }
            );

            check(resForYouPagination, {
                'Get ForYou Pagination 200': (r) => r.status === 200,
            });
        }
    });

    sleep(0.1);
}
