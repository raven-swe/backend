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
        'http_req_duration{name:02_Register_Device}': ['p(95)<1000'],
        'http_req_duration{name:03_Toggle_Push_Enable}': ['p(95)<1000'],
        'http_req_duration{name:04_Toggle_Push_Disable}': ['p(95)<1000'],
        'http_req_duration{name:05_Register_Second_Device}': ['p(95)<1000'],
    },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'http://localhost:3000';

/**
 * Generate a unique FCM token for testing
 */
function generateFcmToken(vuId, iteration, suffix = '') {
    return `fcm_test_token_${vuId}_${iteration}_${Date.now()}${suffix}`;
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
        'X-Client-Type': 'mobile',
        Authorization: `Bearer ${user.accessToken}`,
    };

    sleep(0.2);

    // Generate unique FCM tokens for this VU/iteration
    const fcmToken1 = generateFcmToken(__VU, __ITER, '_device1');
    const fcmToken2 = generateFcmToken(__VU, __ITER, '_device2');

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 1: Register Device (POST /devices)
    // ─────────────────────────────────────────────────────────────────────────────
    group('Device Registration', function () {
        const registerPayload = JSON.stringify({
            fcmToken: fcmToken1,
        });

        const resRegister = http.post(
            `${STRESS_TEST_URL}/devices`,
            registerPayload,
            {
                headers: authHeaders,
                tags: { name: '02_Register_Device' },
            }
        );

        const registerOk = check(resRegister, {
            'Register Device 201': (r) => r.status === 201,
        });

        if (!registerOk) {
            console.error(`Register Device Failed [VU:${__VU}]: ${resRegister.status} - ${resRegister.body}`);
        }
    });

    sleep(0.5); // Allow time for device registration to persist before toggle

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 2: Toggle Push Notifications - Enable (PUT /devices/push)
    // ─────────────────────────────────────────────────────────────────────────────
    group('Toggle Push Notifications', function () {
        const enablePayload = JSON.stringify({
            fcmToken: fcmToken1,
            enable: true,
        });

        const resEnable = http.put(
            `${STRESS_TEST_URL}/devices/push`,
            enablePayload,
            {
                headers: authHeaders,
                tags: { name: '03_Toggle_Push_Enable' },
            }
        );

        const enableOk = check(resEnable, {
            'Toggle Push Enable 200': (r) => r.status === 200,
        });

        if (!enableOk) {
            console.error(`Toggle Push Enable Failed [VU:${__VU}]: ${resEnable.status} - ${resEnable.body}`);
        }

        sleep(0.2);

        // ───────────────────────────────────────────────────────────────────────────
        // STEP 3: Toggle Push Notifications - Disable
        // ───────────────────────────────────────────────────────────────────────────
        const disablePayload = JSON.stringify({
            fcmToken: fcmToken1,
            enable: false,
        });

        const resDisable = http.put(
            `${STRESS_TEST_URL}/devices/push`,
            disablePayload,
            {
                headers: authHeaders,
                tags: { name: '04_Toggle_Push_Disable' },
            }
        );

        const disableOk = check(resDisable, {
            'Toggle Push Disable 200': (r) => r.status === 200,
        });

        if (!disableOk) {
            console.error(`Toggle Push Disable Failed [VU:${__VU}]: ${resDisable.status} - ${resDisable.body}`);
        }
    });

    sleep(0.2);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 4: Register a second device (tests multiple device registration)
    // ─────────────────────────────────────────────────────────────────────────────
    group('Second Device Registration', function () {
        const registerPayload2 = JSON.stringify({
            fcmToken: fcmToken2,
        });

        const resRegister2 = http.post(
            `${STRESS_TEST_URL}/devices`,
            registerPayload2,
            {
                headers: authHeaders,
                tags: { name: '05_Register_Second_Device' },
            }
        );

        const register2Ok = check(resRegister2, {
            'Register Second Device 201': (r) => r.status === 201,
        });

        if (!register2Ok) {
            console.error(`Register Second Device Failed [VU:${__VU}]: ${resRegister2.status} - ${resRegister2.body}`);
        }
    });

    sleep(0.1);
}
