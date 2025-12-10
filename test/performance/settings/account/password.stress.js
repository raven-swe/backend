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
    'http_req_duration{name:02_Update_Password}': ['p(95)<100'],
    'http_req_duration{name:03_Validate_Password}': ['p(95)<100'],
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

    // PUT /me/password
    const newPassword = 'NewP@ssw0rd123!';
    const payloadPassword = JSON.stringify({
        currentPassword: userPassword,
        newPassword: newPassword,
    });
    const paramsPassword = {
        headers: headers,
        tags: { name: '02_Update_Password' }
    };
    const resPassword = http.put(
        `${STRESS_TEST_URL}/me/password`,
        payloadPassword,
        paramsPassword
    );

    if (!check(resPassword, {
        'Update Password status is 200': (r) => r.status === 200,
    })) {
        console.error(`Update Password Failed: ${resPassword.body}`);
        return;
    }

    // POST /me/settings/password/validate
    const validatePayload = JSON.stringify({
        password: newPassword,
    });
    const validateParams = {
        headers: headers,
        tags: { name: '03_Validate_Password' }
    };
    const resValidate = http.post(
        `${STRESS_TEST_URL}/me/settings/password/validate`,
        validatePayload,
        validateParams
    );

    if (!check(resValidate, {
        'Validate Password status is 200': (r) => r.status === 200,
        'Validate Password is valid': (r) => r.json('data.isValid') === true,
    })) {
        console.error(`Validate Password Failed: ${resValidate.body}`);
        return;
    }
}