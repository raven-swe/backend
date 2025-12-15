import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  
    { duration: '1m', target: 50 }, 
    { duration: '30s', target: 200 }, 
    { duration: '1m', target: 400 },  
    { duration: '30s', target: 0 },  
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:01_Login_Action}':       ['p(95)<2000'],
    'http_req_duration{name:02_Create_Tweet}':       ['p(95)<2000'],
    'http_req_duration{name:03_Get_Tweet}':          ['p(95)<500'],
    'http_req_duration{name:04_Delete_Tweet}':       ['p(95)<1000'],
  },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'https://test.api.raven.cmp27.space'; 

export function setup() {
  const resCreateUser = http.post(
    `${STRESS_TEST_URL}/test/users`,
  );

  if (!check(resCreateUser, { 'User Created 201': (r) => r.status === 201})) {
    console.error(`Setup Failed (Create User): ${resCreateUser.body}`);
    return;
  }

  const userData = resCreateUser.json('data'); 
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

  if (!check(resLogin, { 'Login 200': (r) => r.status === 200 })) {
    console.error(`Setup Failed (Login): ${resLogin.body}`);
    return;
  }

  const accessToken = resLogin.json('data.accessToken');
  return { accessToken };
}

export default function (data) {
  const { accessToken } = data;

  const authParams = {
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'web',
      'Authorization': `Bearer ${accessToken}`
    },
  };

  sleep(0.5); 

  const uniqueContent = `Stress Test Tweet ${__VU}-${__ITER} - ${Date.now()}`;
  
  const createPayload = JSON.stringify({
    content: uniqueContent,
  });

  const resCreateTweet = http.post(
    `${STRESS_TEST_URL}/tweets`,
    createPayload,
    { ...authParams, tags: { name: '02_Create_Tweet' } }
  );

  if (!check(resCreateTweet, { 'Create Tweet 201': (r) => r.status === 201 })) {
    console.error(`Create Tweet Failed: ${resCreateTweet.body}`);
    return;
  }

  const tweetId = resCreateTweet.json('data.id');

  sleep(0.5);

  const resGetTweet = http.get(
    `${STRESS_TEST_URL}/tweets/${tweetId}`,
    { ...authParams, tags: { name: '03_Get_Tweet' } }
  );

  if (!check(resGetTweet, { 'Get Tweet 200': (r) => r.status === 200 })) {
    console.error(`Get Tweet Failed: ${resGetTweet.body}`);
    return;
  }

  sleep(0.5);

  const resDeleteTweet = http.del(
    `${STRESS_TEST_URL}/tweets/${tweetId}`,
    null,
    { ...authParams, tags: { name: '04_Delete_Tweet' } }
  );

  if(!check(resDeleteTweet, { 'Delete Tweet 200': (r) => r.status === 200 })) {
    console.error(`Delete Tweet Failed: ${resDeleteTweet.body}`);
    return;
  }

  sleep(0.1);
}