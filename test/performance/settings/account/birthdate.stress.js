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
    'http_req_duration{name:02_Update_Birthdate}': ['p(95)<100'],
    'http_req_duration{name:03_Get_Me_Settings}': ['p(95)<100'],
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

    // PUT /me/settings/birthdate
    const newBirthdate = '1990-01-01';
    const payloadBirthdate = JSON.stringify({
        date: newBirthdate,
    });
    const paramsBirthdate = {
        headers: headers,
        tags: { name: '02_Update_Birthdate' } 
    };
    const resBirthdate = http.put(
        `${STRESS_TEST_URL}/me/settings/birthdate`,
        payloadBirthdate,
        paramsBirthdate
    );
    if (!check(resBirthdate, {
        'Update Birthdate status is 200': (r) => r.status === 200,
    })) {
        console.error(`Update Birthdate Failed: ${resBirthdate.body}`);
        return;
    }
    sleep(0.2);

    // GET /me/settings
    const resMeSettings = http.get(
        `${STRESS_TEST_URL}/me/settings`,
        { headers: headers, tags: { name: '03_Get_Me_Settings' } }
    );
    if (!check(resMeSettings, {
        'Get Me Settings status is 200': (r) => r.status === 200,
        'Me Settings has birthdate': (r) => r.json('data.birthDate') === newBirthdate,
    })) {
        console.error(`Get Me Settings Failed: ${resMeSettings.body}`);
        return;
    }

}