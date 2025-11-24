import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  
    { duration: '1m', target: 50 },   
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 }, 
    { duration: '30s', target: 0 },
  ],    
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:01_Check_Identifier}': ['p(95)<100'],
    'http_req_duration{name:02_Login_Action}': ['p(95)<1800'],
    'http_req_duration{name:03_Refresh_Token}': ['p(95)<200'],
    'http_req_duration{name:04_Logout_Action}': ['p(95)<200'],
  },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'http://localhost:3000'; 

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

    const checkParams = {
        tags: { name: '01_Check_Identifier' }
    };

    const resCheck = http.get(`${STRESS_TEST_URL}/auth/check-identifier?identifier=${userEmail}`, checkParams);

    if(!check(resCheck, {
        'Check ID status is 200': (r) => r.status === 200,
    })){
        console.error(`Check Identifier Failed: ${resCheck.body}`);
        return;
    } 

    const loginPayload = JSON.stringify({
        identifier: userEmail,
        password: userPassword
      });

    const loginParams = {
        headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'web',
        },
        tags: { name: '02_Login_Action' } 
    };

    const resLogin = http.post(`${STRESS_TEST_URL}/auth/login`, loginPayload, loginParams);

    if (!check(resLogin, {
      'Login status is 200': (r) => r.status === 200
    })) {
        console.error(`Login Failed: ${resLogin.body}`);
        return;
    }

    const initialRefreshToken = resLogin.json('data.refreshToken');

    sleep(0.5);

    const refreshPayload = JSON.stringify({
        refreshToken: initialRefreshToken
    });

    const refreshParams = {
        headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'web',
        },
        tags: { name: '03_Refresh_Token' }
    };

    const resRefresh = http.post(`${STRESS_TEST_URL}/auth/refresh-token`, refreshPayload, refreshParams);

    if (!check(resRefresh, { 'Refresh status is 200': (r) => r.status === 200 })) {
        console.error(`Refresh Failed: ${resRefresh.body}`);
        return;
    }

    const newRefreshToken = resRefresh.json('data.refreshToken');
    const newAccessToken = resRefresh.json('data.accessToken');

    sleep(0.1);

    const logoutPayload = JSON.stringify({
        refreshToken: newRefreshToken
    });

    const logoutParams = {
        headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'web',
            'Authorization': `Bearer ${newAccessToken}`
        },
        tags: { name: '04_Logout_Action' }
    };

    const resLogout = http.post(`${STRESS_TEST_URL}/auth/logout`, logoutPayload, logoutParams);

    if(!check(resLogout, {
        'Logout status is 200': (r) => r.status === 200,
    })) {
        console.error(`Logout Failed: ${resLogout.body}`);
        return;
    }
  
    sleep(0.1);
}