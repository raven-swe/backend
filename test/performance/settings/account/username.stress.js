import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  
    { duration: '30s', target: 300 },   
    { duration: '1m', target: 400 },
    { duration: '30s', target: 0 },
  ],    
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:01_Login_Action}': ['p(95)<1800'],
    'http_req_duration{name:02_Get_Username_Suggestions}': ['p(95)<100'],
    'http_req_duration{name:03_Update_Username}': ['p(95)<100'],
    'http_req_duration{name:04_Get_Me_Settings}': ['p(95)<100'],
  },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'http://localhost:3001'; 

export default function () {
    
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

    const headers = {
        'Content-Type': 'application/json',
        'X-Client-Type': 'web',
        'Authorization': `Bearer ${accessToken}`,
    };

    // GET /onboarding/username-suggestions
    const resSuggestions = http.get(
        `${STRESS_TEST_URL}/onboarding/username-suggestions`,
        { headers: headers, tags: { name: '02_Get_Username_Suggestions' } }
    );
    if (!check(resSuggestions, {
        'Get Username Suggestions status is 200': (r) => r.status === 200,
        'Get Username Suggestions has data': (r) => Array.isArray(r.json('data.suggestions')) && r.json('data.suggestions').length > 0,
    })) {
        console.error(`Get Username Suggestions Failed: ${resSuggestions.body}`);
        return;
    }

    const timestamp = new Date().getTime().toString();
    
    // PATCH /me/settings/username
    const newUsername = `u${timestamp.slice(-9)}_${Math.floor(Math.random() * 10000)}`;
    console.log(`VU${__VU} Iteration${__ITER} - Updating username to: ${newUsername}`);
    const payloadUsername = JSON.stringify({
        newUsername
    });
    const resUpdateUsername = http.patch(
        `${STRESS_TEST_URL}/me/settings/username`,
        payloadUsername,
        { headers: headers, tags: { name: '03_Update_Username' } }
    );

    if (!check(resUpdateUsername, {
        'Update Username status is 200': (r) => r.status === 200
    })) {
        console.error(`Update Username Failed: ${resUpdateUsername.body}`);
        return;
    }

    sleep(0.2);

    // GET /me/settings
    const resMeSettings = http.get(
        `${STRESS_TEST_URL}/me/settings`,
        { headers: headers, tags: { name: '04_Get_Me_Settings' } }
    );
    if (!check(resMeSettings, {
        'Get Me Settings status is 200': (r) => r.status === 200,
        'Get Me Settings has correct username': (r) => r.json('data.username') === newUsername,
    })) {
        console.error(`Get Me Settings Failed: ${resMeSettings.body}`);
        return;
    }
}