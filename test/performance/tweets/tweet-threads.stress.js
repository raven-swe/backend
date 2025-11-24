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
    'http_req_duration{name:01_Login_Action}':        ['p(95)<2000'],
    'http_req_duration{name:02_Create_Root}':         ['p(95)<2000'],
    'http_req_duration{name:03_Create_Reply}':        ['p(95)<2000'],
    'http_req_duration{name:04_Create_Quote}':        ['p(95)<2000'],
    'http_req_duration{name:05_Get_Replies}':         ['p(95)<1000'],
    'http_req_duration{name:06_Get_Quotes}':          ['p(95)<1000'],
  },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'http://localhost:3000'; 

export default function () {
  const resCreateUser = http.post(
    `${STRESS_TEST_URL}/test/users`,
  );

  if (!check(resCreateUser, { 'User Created 201': (r) => r.status === 201 })) {
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
  const authParams = {
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'web',
      'Authorization': `Bearer ${accessToken}`
    },
  };

  sleep(0.5);

  const rootPayload = JSON.stringify({
    content: `Root Tweet ${__VU}-${__ITER}`
  });

  const resRoot = http.post(
    `${STRESS_TEST_URL}/tweets`,
    rootPayload,
    { ...authParams, tags: { name: '02_Create_Root' } }
  );

  if (!check(resRoot, { 'Root Created 201': (r) => r.status === 201 })) {
    console.error(`Create Root Failed: ${resRoot.body}`);
    return;
  }

  const rootId = resRoot.json('data.id');
  
  sleep(0.5);

  const replyPayload = JSON.stringify({
    content: `Reply from ${__VU}`,
    replyToTweetId: rootId
  });

  const resReply = http.post(
    `${STRESS_TEST_URL}/tweets`,
    replyPayload,
    { ...authParams, tags: { name: '03_Create_Reply' } }
  );

  if(!check(resReply, { 'Reply Created 201': (r) => r.status === 201})) {
    console.error(`Reply Creation Failed: ${resReply.body}`);
    return;
  }

  const quotePayload = JSON.stringify({
    content: `Quote from ${__VU}`,
    quoteToTweetId: rootId
  });

  const resQuote = http.post(
    `${STRESS_TEST_URL}/tweets`,
    quotePayload,
    { ...authParams, tags: { name: '04_Create_Quote' } }
  );
  
  if(!check(resQuote, { 'Quote Created 201': (r) => r.status === 201 })) {
    console.error(`Quote Creation Failed: ${resQuote.body}`);
    return;
  }

  const resGetReplies = http.get(
    `${STRESS_TEST_URL}/tweets/${rootId}/replies?limit=20`,
    { ...authParams, tags: { name: '05_Get_Replies' } }
  );
  
  if(!check(resGetReplies, { 'Get Replies 200': (r) => r.status === 200 })) {
    console.error(`Get Replies Failed: ${resGetReplies.body}`);
    return;
  }

  const resGetQuotes = http.get(
    `${STRESS_TEST_URL}/tweets/${rootId}/quotes?limit=20`,
    { ...authParams, tags: { name: '06_Get_Quotes' } }
  );

  if(!check(resGetQuotes, { 'Get Quotes 200': (r) => r.status === 200 })) {
    console.error(`Get Quotes Failed: ${resGetQuotes.body}`);
    return;
  }

  sleep(0.1);
}