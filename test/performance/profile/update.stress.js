import http from 'k6/http';
import { check, sleep } from 'k6';

const avatarFile = open('./avatar.png', 'b');
const bannerFile = open('./banner.jpg', 'b');

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
    'http_req_duration{name:02_Update_Profile_With_Files}': ['p(95)<2000'],

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

    // PATCH /me
    const dataPayload = {
        birthDate: '1990-01-01',
        displayName: 'Test User',
        bio: 'This is a test bio',
        location: 'Cairo',
        websiteUrl: 'https://example.com',
    };

    const formData = {
        ...dataPayload,
        avatar: http.file(avatarFile, 'avatar.png', 'image/png'),
        banner: http.file(bannerFile, 'banner.png', 'image/png'),
    };

    const paramsMe = {
        headers: {
            'X-Client-Type': 'web',
            'Authorization': `Bearer ${accessToken}`,
        },
        tags: { name: '02_Update_Profile_With_Files' } 
    };

    const resMe = http.patch(
        `${STRESS_TEST_URL}/me`,
        formData,
        paramsMe
    );
    if (!check(resMe, {
        'Update Me status is 200': (r) => r.status === 200,
    })) {
        console.error(`Update Me Failed: ${resMe.body}`);
        return;
    }
    

}