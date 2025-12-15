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
    'http_req_duration{name:02_Get_User_By_Id}': ['p(95)<500'],
    'http_req_duration{name:03_Get_User_Profile}': ['p(95)<500'],
    'http_req_duration{name:04_Get_User_Tweets}': ['p(95)<1000'],
    'http_req_duration{name:05_Get_User_Replies}': ['p(95)<1000'],
    'http_req_duration{name:06_Get_User_Media}': ['p(95)<1000'],
    'http_req_duration{name:07_Get_User_Likes}': ['p(95)<1000'],
  },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'https://test.api.raven.cmp27.space';

export function setup() {
  // 1. Create User
  const resCreateUser = http.post(`${STRESS_TEST_URL}/test/users`);

  if (!check(resCreateUser, { 'User Created 201': (r) => r.status === 201 })) {
    console.error(`Setup Failed (Create User): ${resCreateUser.body}`);
    return;
  }

  const userData = resCreateUser.json('data');
  const userEmail = userData.email;
  const userPassword = userData.password;
  const userId = userData.id;

  // 2. Login
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
  return { accessToken, userId };
}

export default function (data) {
  const { accessToken, userId } = data;

  const authParams = {
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'web',
      'Authorization': `Bearer ${accessToken}`,
    },
  };

  sleep(0.5);

  // 3. Get User By ID
  const resGetUserById = http.get(
    `${STRESS_TEST_URL}/users/id/${userId}`,
    { ...authParams, tags: { name: '02_Get_User_By_Id' } }
  );

  check(resGetUserById, { 'Get User By Id 200': (r) => r.status === 200 });
  sleep(0.5);

  const users = ['notnowomar', 'gelgel'];
  const randomUser = () => users[Math.floor(Math.random() * users.length)];

  // 4. Get User Profile
  const resGetUserProfile = http.get(
    `${STRESS_TEST_URL}/users/${randomUser()}/profile`,
    { ...authParams, tags: { name: '03_Get_User_Profile' } }
  );

  check(resGetUserProfile, { 'Get User Profile 200': (r) => r.status === 200 });
  sleep(0.5);

  // 5. Get User Tweets
  const resGetUserTweets = http.get(
    `${STRESS_TEST_URL}/users/${randomUser()}/tweets`,
    { ...authParams, tags: { name: '04_Get_User_Tweets' } }
  );

  check(resGetUserTweets, { 'Get User Tweets 200': (r) => r.status === 200 });
  sleep(0.5);

  // 6. Get User Replies
  const resGetUserReplies = http.get(
    `${STRESS_TEST_URL}/users/${randomUser()}/replies`,
    { ...authParams, tags: { name: '05_Get_User_Replies' } }
  );

  check(resGetUserReplies, { 'Get User Replies 200': (r) => r.status === 200 });
  sleep(0.5);

  // 7. Get User Media
  const resGetUserMedia = http.get(
    `${STRESS_TEST_URL}/users/${randomUser()}/media`,
    { ...authParams, tags: { name: '06_Get_User_Media' } }
  );

  check(resGetUserMedia, { 'Get User Media 200': (r) => r.status === 200 });
  sleep(0.5);

  // 8. Get User Likes
  const resGetUserLikes = http.get(
    `${STRESS_TEST_URL}/users/${randomUser()}/likes`,
    { ...authParams, tags: { name: '07_Get_User_Likes' } }
  );

  check(resGetUserLikes, { 'Get User Likes 200': (r) => r.status === 200 });
}
