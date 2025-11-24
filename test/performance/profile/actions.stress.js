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
    'http_req_duration{name:02_Block_User_Action}': ['p(95)<300'],
    'http_req_duration{name:03_Unblock_User_Action}': ['p(95)<300'],
    'http_req_duration{name:04_Mute_User_Action}': ['p(95)<300'],
    'http_req_duration{name:05_Unmute_User_Action}': ['p(95)<300'],
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


        // POST /mutes/:username
    const paramsMute = {
        headers: headers,
        tags: { name: '04_Mute_User_Action' }
    };
    const resMute = http.post(
        `${STRESS_TEST_URL}/mutes/gelgel`,
        null,
        paramsMute
    );
    check(resMute, {
        'Mute User status is 201': (r) => r.status === 201
    });

    sleep(0.2);

    // DELETE /mutes/:username
    const paramsUnmute = {
        headers: headers,
        tags: { name: '05_Unmute_User_Action' }
    };
    const resUnmute = http.del(
        `${STRESS_TEST_URL}/mutes/gelgel`,
        null,
        paramsUnmute
    );
    check(resUnmute, {
        'Unmute User status is 204': (r) => r.status === 204
    });
    sleep(0.2);

    // POST /blocks/:username
    const paramsBlock = {
        headers: headers,
        tags: { name: '02_Block_User_Action' } 
    };
    const resBlock = http.post(
        `${STRESS_TEST_URL}/blocks/gelgel`,
        null,
        paramsBlock
    );
    check(resBlock, {
        'Block User status is 201': (r) => r.status === 201
    });

    sleep(0.2);

    // DELETE /blocks/:username
    const paramsUnblock = {
        headers: headers,
        tags: { name: '03_Unblock_User_Action' } 
    };
    const resUnblock = http.del(
        `${STRESS_TEST_URL}/blocks/gelgel`,
        null,
        paramsUnblock
    );
    check(resUnblock, {
        'Unblock User status is 204': (r) => r.status === 204
    });
}