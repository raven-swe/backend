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
    'http_req_duration{name:02_Create_Target}':      ['p(95)<2000'],
    'http_req_duration{name:03_Like_Tweet}':         ['p(95)<500'],
    'http_req_duration{name:04_Get_Likes}':          ['p(95)<500'],
    'http_req_duration{name:05_Unlike_Tweet}':       ['p(95)<500'],
    'http_req_duration{name:06_Retweet_Tweet}':      ['p(95)<500'],
    'http_req_duration{name:07_Get_Retweets}':       ['p(95)<500'],
    'http_req_duration{name:08_Undo_Retweet}':       ['p(95)<500'],
  },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'https://test.api.raven.cmp27.space'; 

export function setup() {

  const resCreateUser = http.post(
    `${STRESS_TEST_URL}/test/users`,
  );

  if (!check(resCreateUser, { 'User Created 201': (r) => r.status === 201})) {
    console.error(`Setup Failed: ${resCreateUser.body}`);
    return;
  }

  const userData = resCreateUser.json('data'); 
  const loginPayload = JSON.stringify({
    identifier: userData.email,
    password: userData.password
  });

  const loginParams = {
    headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'web' },
    tags: { name: '01_Login_Action' } 
  };

  const resLogin = http.post(`${STRESS_TEST_URL}/auth/login`, loginPayload, loginParams);

  if (!check(resLogin, { 'Login 200': (r) => r.status === 200 })) {
    console.error(`Login Failed: ${resLogin.body}`);
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

  const createPayload = JSON.stringify({
    content: `Engagement Target ${__VU}-${__ITER}`
  });

  const resCreate = http.post(
    `${STRESS_TEST_URL}/tweets`,
    createPayload,
    { ...authParams, tags: { name: '02_Create_Target' } }
  );

  if (!check(resCreate, { 'Target Created 201': (r) => r.status === 201 })) {
    console.error(`Create Target Failed: ${resCreate.body}`);
    return;
  }

  const tweetId = resCreate.json('data.id');
  
  sleep(0.5);
  
  const resLike = http.post(
    `${STRESS_TEST_URL}/tweets/${tweetId}/like`,
    null, 
    { ...authParams, tags: { name: '03_Like_Tweet' } }
  );
  
  if(!check(resLike, { 'Like 201': (r) => r.status === 201})) {
    console.error(`Like Failed: ${resLike.body}`);
    return;
  }

  const resGetLikes = http.get(
    `${STRESS_TEST_URL}/tweets/${tweetId}/likes?limit=20`,
    { ...authParams, tags: { name: '04_Get_Likes' } }
  );
  
  if(!check(resGetLikes, { 'Get Likes 200': (r) => r.status === 200 })) {
    console.error(`Get Likes Failed: ${resGetLikes.body}`);
    return;
  }

  const resUnlike = http.del(
    `${STRESS_TEST_URL}/tweets/${tweetId}/like`,
    null,
    { ...authParams, tags: { name: '05_Unlike_Tweet' } }
  );
  
  if(!check(resUnlike, { 'Unlike 200': (r) => r.status === 200 })) {
    console.error(`Unlike Failed: ${resUnlike.body}`);
    return;
  }

  sleep(0.5);

  const resRetweet = http.post(
    `${STRESS_TEST_URL}/tweets/${tweetId}/retweet`,
    null,
    { ...authParams, tags: { name: '06_Retweet_Tweet' } }
  );
  
  if(!check(resRetweet, { 'Retweet 201': (r) => r.status === 201 })) {  
    console.error(`Retweet Failed: ${resRetweet.body}`);
    return;
  }

  const resGetRetweets = http.get(
    `${STRESS_TEST_URL}/tweets/${tweetId}/retweets?limit=20`,
    { ...authParams, tags: { name: '07_Get_Retweets' } }
  );
  
  if(!check(resGetRetweets, { 'Get Retweets 200': (r) => r.status === 200 })) {
    console.error(`Get Retweets Failed: ${resGetRetweets.body}`);
    return;
  }

  const resUndoRetweet = http.del(
    `${STRESS_TEST_URL}/tweets/${tweetId}/retweet`,
    null,
    { ...authParams, tags: { name: '08_Undo_Retweet' } }
  );
  
  if(!check(resUndoRetweet, { 'Undo Retweet 200': (r) => r.status === 200 })) { 
    console.error(`Undo Retweet Failed: ${resUndoRetweet.body}`);
    return;
  }

  sleep(0.1);
}