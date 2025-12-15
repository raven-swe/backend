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
    'http_req_duration{name:02_Get_Me}': ['p(95)<500'],
    'http_req_duration{name:03_Get_Blocks}': ['p(95)<500'],
    'http_req_duration{name:04_Get_Mutes}': ['p(95)<500'],
    'http_req_duration{name:05_Get_Connected_Accounts}': ['p(95)<500'],
    'http_req_duration{name:06_Get_Countries}': ['p(95)<500'],
    'http_req_duration{name:07_Update_Country}': ['p(95)<500'],
    'http_req_duration{name:08_Update_Gender}': ['p(95)<500'],
    'http_req_duration{name:09_Get_Interests}': ['p(95)<500'],
    'http_req_duration{name:10_Update_Language}': ['p(95)<500'],
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

    // GET /me
    const resMe = http.get(
        `${STRESS_TEST_URL}/me`,
        { headers: headers, tags: { name: '02_Get_Me' } }
    );
    check(resMe, {
        'Get Me status is 200': (r) => r.status === 200,
    });
    sleep(0.1);

    // GET /me/settings/blocks
    const resBlocks = http.get(
        `${STRESS_TEST_URL}/me/settings/blocks`,
        { headers: headers, tags: { name: '03_Get_Blocks' } }
    );
    check(resBlocks, {
        'Get Blocks status is 200': (r) => r.status === 200,
    });
    sleep(0.1);

    // GET /me/settings/mutes
    const resMutes = http.get(
        `${STRESS_TEST_URL}/me/settings/mutes`,
        { headers: headers, tags: { name: '04_Get_Mutes' } }
    );
    check(resMutes, {
        'Get Mutes status is 200': (r) => r.status === 200,
    });
    sleep(0.1);

    // GET /me/settings/connected-accounts
    const resConnected = http.get(
        `${STRESS_TEST_URL}/me/settings/connected-accounts`,
        { headers: headers, tags: { name: '05_Get_Connected_Accounts' } }
    );
    check(resConnected, {
        'Get Connected Accounts status is 200': (r) => r.status === 200,
    });
    sleep(0.1);

    // GET /me/settings/country
    const resCountries = http.get(
        `${STRESS_TEST_URL}/me/settings/country`,
        { headers: headers, tags: { name: '06_Get_Countries' } }
    );
    check(resCountries, {
        'Get Countries status is 200': (r) => r.status === 200,
    });
    sleep(0.1);

    // PUT /me/settings/country
    const payloadCountry = JSON.stringify({
        countryName: "Egypt"
    });
    const resUpdateCountry = http.put(
        `${STRESS_TEST_URL}/me/settings/country`,
        payloadCountry,
        { headers: headers, tags: { name: '07_Update_Country' } }
    );
    check(resUpdateCountry, {
        'Update Country status is 200': (r) => r.status === 200,
    });
    sleep(0.1);

    // PUT /me/settings/gender
    const payloadGender = JSON.stringify({
        gender: "Male"
    });
    const resUpdateGender = http.put(
        `${STRESS_TEST_URL}/me/settings/gender`,
        payloadGender,
        { headers: headers, tags: { name: '08_Update_Gender' } }
    );
    check(resUpdateGender, {
        'Update Gender status is 200': (r) => r.status === 200,
    });
    sleep(0.1);

    // GET /me/settings/interests
    const resInterests = http.get(
        `${STRESS_TEST_URL}/me/settings/interests`,
        { headers: headers, tags: { name: '09_Get_Interests' } }
    );
    check(resInterests, {
        'Get Interests status is 200': (r) => r.status === 200,
    });
    sleep(0.1);

    // PUT /me/settings/language
    const payloadLanguage = JSON.stringify({
        language: "en"
    });
    const resUpdateLanguage = http.put(
        `${STRESS_TEST_URL}/me/settings/language`,
        payloadLanguage,
        { headers: headers, tags: { name: '10_Update_Language' } }
    );
    check(resUpdateLanguage, {
        'Update Language status is 200': (r) => r.status === 200,
    });
    sleep(0.1);
}
