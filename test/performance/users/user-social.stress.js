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
    'http_req_duration{name:01_Login_Action}': ['p(95)<2000'],
    'http_req_duration{name:02_Follow_User}': ['p(95)<1000'],
    'http_req_duration{name:03_Get_Following}': ['p(95)<1000'],
    'http_req_duration{name:04_Get_Followers}': ['p(95)<1000'],
    'http_req_duration{name:05_Get_Relationship}': ['p(95)<500'],
    'http_req_duration{name:06_Get_Mutual}': ['p(95)<1000'],
    'http_req_duration{name:07_Unfollow_User}': ['p(95)<1000'],
  },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'https://test.api.raven.cmp27.space';

export function setup() {
  // 1. Create User A (The Actor)
  const resCreateUser = http.post(`${STRESS_TEST_URL}/test/users`);
  if (!check(resCreateUser, { 'User A Created 201': (r) => r.status === 201 })) {
    console.error(`Setup Failed (Create User A): ${resCreateUser.body}`);
    return;
  }
  const userData = resCreateUser.json('data');
  const userEmail = userData.email;
  const userPassword = userData.password;
  const userUsername = userData.username;

  // 3. Login as User A
  const loginPayload = JSON.stringify({
    identifier: userEmail,
    password: userPassword,
  });

  const loginParams = {
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'web',
    },
    tags: { name: '01_Login_Action' },
  };

  const resLogin = http.post(`${STRESS_TEST_URL}/auth/login`, loginPayload, loginParams);

  if (!check(resLogin, { 'Login 200': (r) => r.status === 200 })) {
    console.error(`Setup Failed (Login): ${resLogin.body}`);
    return;
  }

  const accessToken = resLogin.json('data.accessToken');
  return { accessToken, userUsername };
}

export default function (data) {
  const { accessToken, userUsername } = data;

  const authParams = {
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'web',
      'Authorization': `Bearer ${accessToken}`,
    },
  };

  sleep(0.5);
  const users = ['notnowomar', 'gelgel'];
  const randomUser = users[Math.floor(Math.random() * users.length)];

  // 4. Follow User B
  const resFollow = http.post(
    `${STRESS_TEST_URL}/users/${randomUser}/following`,
    null, // No body needed for follow usually, or empty object
    { ...authParams, tags: { name: '02_Follow_User' } }
  );

  check(resFollow, { 'Follow User 200': (r) => r.status === 200 || r.status === 201 });
  sleep(0.5);

  // 5. Get Following (of User A)
  const resGetFollowing = http.get(
    `${STRESS_TEST_URL}/users/${userUsername}/following`,
    { ...authParams, tags: { name: '03_Get_Following' } }
  );

  check(resGetFollowing, { 'Get Following 200': (r) => r.status === 200 });
  sleep(0.5);

  // 6. Get Followers (of User B)
  const resGetFollowers = http.get(
    `${STRESS_TEST_URL}/users/${randomUser}/followers`,
    { ...authParams, tags: { name: '04_Get_Followers' } }
  );

  check(resGetFollowers, { 'Get Followers 200': (r) => r.status === 200 });
  sleep(0.5);

  // 7. Get Relationship (A with B)
  const resGetRelationship = http.get(
    `${STRESS_TEST_URL}/users/${randomUser}/relationship`,
    { ...authParams, tags: { name: '05_Get_Relationship' } }
  );

  check(resGetRelationship, { 'Get Relationship 200': (r) => r.status === 200 });
  sleep(0.5);

  // 8. Get Mutual (A with B)
  const resGetMutual = http.get(
    `${STRESS_TEST_URL}/users/${randomUser}/mutual`,
    { ...authParams, tags: { name: '06_Get_Mutual' } }
  );

  check(resGetMutual, { 'Get Mutual 200': (r) => r.status === 200 });
  sleep(0.5);

  // 9. Unfollow User B
  const resUnfollow = http.del(
    `${STRESS_TEST_URL}/users/${randomUser}/following`,
    null,
    { ...authParams, tags: { name: '07_Unfollow_User' } }
  );

  check(resUnfollow, { 'Unfollow User 200': (r) => r.status === 200 });
}
