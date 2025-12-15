import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  
    { duration: '1m', target: 50 },   
    { duration: '30s', target: 500 },
    { duration: '1m', target: 700 }, 
    { duration: '30s', target: 0 },
  ],    
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:01_Login_Action}': ['p(95)<1800'],
    'http_req_duration{name:02_Update_Email}': ['p(95)<800'],
    'http_req_duration{name:03_Get_Email_OTP}': ['p(95)<100'],
    'http_req_duration{name:04_Verify_New_Email}': ['p(95)<800'],
    'http_req_duration{name:05_Get_Me_Settings}': ['p(95)<100'],
  },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'https://test.api.raven.cmp27.space'; 

export function setup() {
    
    const resCreate = http.post(
        `${STRESS_TEST_URL}/test/users`, 
    );

    if (!check(resCreate, { 'User Created 201': (r) => r.status === 201 })) {
        console.error(`Failed to create user: ${resCreate.body}`);
        return;
    }

    const userData = resCreate.json('data'); 
    const userEmail = userData.email;
    const userPassword = userData.password;

    const loginPayload = JSON.stringify({
        identifier: userEmail,
        password: userPassword
      });

    const loginParams = {
        headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'web',
        },
        tags: { name: '01_Login_Action' } 
    };

    const resLogin = http.post(`${STRESS_TEST_URL}/auth/login`, loginPayload, loginParams);

    if (!check(resLogin, {
      'Login status is 200': (r) => r.status === 200
    })) {
        console.error(`Login Failed: ${resLogin.body}`);
        return;
    }

    const accessToken = resLogin.json('data.accessToken');
    return { accessToken };
}

export default function (data) {
    const { accessToken } = data;

    const headers = {
        'Content-Type': 'application/json',
        'X-Client-Type': 'web',
        'Authorization': `Bearer ${accessToken}`,
    };

    // PUT /me/settings/email
    const timestamp = new Date().getTime().toString();
    const newEmail = `user_${timestamp.slice(-6)}@example.com`;
    const payloadEmail = JSON.stringify({
        newEmail
    });
    const paramsEmail = {
        headers: headers,
        tags: { name: '02_Update_Email' }
    };
    const resEmail = http.put(
        `${STRESS_TEST_URL}/me/settings/email`,
        payloadEmail,
        paramsEmail
    );

    if (!check(resEmail, {
        'Update Email status is 200': (r) => r.status === 200,
    })) {
        console.error(`Update Email Failed: ${resEmail.body}`);
        return;
    }

    const confirmationToken = resEmail.json('data.confirmationToken');

    sleep(0.5);

    // GET /test/otp?identifier=user.id&type=changeEmail
    const userId = userData.id;
    const resOTP = http.get(
        `${STRESS_TEST_URL}/test/otp?identifier=${userId}&type=changeEmail`,
        { tags: { name: '03_Get_Email_OTP' } }
    );
    // No checks here as this is a test-only endpoint
    const otp = resOTP.json('data.otp');

    // POST /me/settings/email/verify
    const payloadVerify = JSON.stringify({
        otp,
        confirmationToken,
    });
    const paramsVerify = {
        headers: headers,
        tags: { name: '04_Verify_New_Email' }
    };
    const resVerify = http.post(
        `${STRESS_TEST_URL}/me/settings/email/verify`,
        payloadVerify,
        paramsVerify
    );
    if (!check(resVerify, {
        'Verify New Email status is 200': (r) => r.status === 200,
    })) {
        console.error(`Verify New Email Failed: ${resVerify.body}`);
        return;
    }
    

    // GET /me/settings
    const resMeSettings = http.get(
        `${STRESS_TEST_URL}/me/settings`,
        { headers: headers, tags: { name: '05_Get_Me_Settings' } }
    );
    if (!check(resMeSettings, {
        'Get Me Settings status is 200': (r) => r.status === 200,
        'Me Settings has birthdate': (r) => r.json('data.email') === newEmail,
    })) {
        console.error(`Get Me Settings Failed: ${resMeSettings.body}`);
        return;
    }
}