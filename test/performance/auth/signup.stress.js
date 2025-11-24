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
    'http_req_duration{name:01_Check_Email}': ['p(95)<100'],
    'http_req_duration{name:02_Start_Reg}': ['p(95)<8000'],
    'http_req_duration{name:03_Resend_OTP}': ['p(95)<1200'],
    'http_req_duration{name:04_Fetch_OTP}': ['p(95)<100'],
    'http_req_duration{name:05_Verify_OTP}': ['p(95)<600'],
    'http_req_duration{name:06_Complete_Reg}': ['p(95)<1500'],
    'http_req_duration{name:07_Refresh_Token}': ['p(95)<400'],
    'http_req_duration{name:08_Logout}': ['p(95)<400'],
  },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'http://localhost:3000'; 

export default function () {
  const uniqueId = `${__VU}-${__ITER}-${Date.now()}`;
  const testEmail = `loadtest-${uniqueId}@example.com`;
  
  const params = {
    headers: { 
      'Content-Type': 'application/json',
      'X-Client-Type': 'web'
    },
  };

  const resCheck = http.get(
    `${STRESS_TEST_URL}/auth/check-email?email=${testEmail}`, 
    { ...params, tags: { name: '01_Check_Email' } }
  );

  if (!check(resCheck, { 'Check Email: status 200': (r) => r.status === 200 })) {
    console.error(`Check Email Failed: ${resCheck.body}`);
    return;
  }

  const payloadStart = JSON.stringify({
    name: "Test User",
    email: testEmail,
    birthDate: "2000-01-01",
    recaptchaToken: "test" 
  });

  const resStart = http.post(
    `${STRESS_TEST_URL}/auth/register/start`, 
    payloadStart, 
    { ...params, tags: { name: '02_Start_Reg' } }
  );

  if (!check(resStart, { 'Start: status 201': (r) => r.status === 201 })) {
    console.error(`Start Failed: ${resStart.body}`);
    return; 
  }

  const creationToken = resStart.json('data.creationToken'); 

  const payloadResend = JSON.stringify({
    creationToken: creationToken
  });

  const resResend = http.post(
    `${STRESS_TEST_URL}/auth/register/resend-otp`,
    payloadResend,
    { ...params, tags: { name: '03_Resend_OTP' } }
  );

  if (!check(resResend, { 'Resend: status 201': (r) => r.status === 201 })) {
    console.error(`Resend Failed: ${resResend.body}`);
    return;
  }

  sleep(0.1);

  const resOtp = http.get(
    `${STRESS_TEST_URL}/test/otp?identifier=${testEmail}&type=registration`,
    { ...params, tags: { name: '04_Fetch_OTP' } }
  );

  if (!check(resOtp, { 'OTP Fetch: status 200': (r) => r.status === 200 })) {
    console.error(`Fetching OTP Failed: ${resOtp.body}`);
    return;
  }

  const otpCode = resOtp.json('data.otp');

  const payloadVerify = JSON.stringify({
    creationToken: creationToken,
    otp: otpCode 
  });

  const resVerify = http.post(
    `${STRESS_TEST_URL}/auth/register/verify`, 
    payloadVerify, 
    { ...params, tags: { name: '05_Verify_OTP' } }
  );

  if (!check(resVerify, { 'Verify: status 201': (r) => r.status === 201 })) {
    console.error(`Verify Failed: ${resVerify.body}`);
    return;
  }

  const payloadComplete = JSON.stringify({
    creationToken: creationToken,
    password: "StrongPassword123!"
  });

  const resComplete = http.post(
    `${STRESS_TEST_URL}/auth/register/complete`, 
    payloadComplete, 
    { ...params, tags: { name: '06_Complete_Reg' } }
  );

  if(!check(resComplete, { 'Complete: status 201': (r) => r.status === 201 })) {
    console.error(`Complete Failed: ${resComplete.body}`);
    return;
  }

  const firstRefreshToken = resComplete.json('data.refreshToken');

  sleep(0.5);

  const payloadRefresh = JSON.stringify({
    refreshToken: firstRefreshToken
  });

  const resRefresh = http.post(
    `${STRESS_TEST_URL}/auth/refresh-token`,
    payloadRefresh,
    { ...params, tags: { name: '07_Refresh_Token' } }
  );

  if(!check(resRefresh, { 'Refresh: status 200': (r) => r.status === 200 })) {
    console.error(`Refresh Failed: ${resRefresh.body}`);
    return;
  }

  const secondRefreshToken = resRefresh.json('data.refreshToken');
  const newAccessToken = resRefresh.json('data.accessToken');

  sleep(0.1);

  const payloadLogout = JSON.stringify({
    refreshToken: secondRefreshToken
  });

  const logoutParams = {
    headers: { 
      'Content-Type': 'application/json', 
      'X-Client-Type': 'web',
      'Authorization': `Bearer ${newAccessToken}`
    },
    tags: { name: '08_Logout' }
  };

  const resLogout = http.post(
    `${STRESS_TEST_URL}/auth/logout`,
    payloadLogout,
    logoutParams
  );

  if(!check(resLogout, { 'Logout: status 200': (r) => r.status === 200 })){
    console.error(`Logout Failed: ${resLogout.body}`);
    return;
  }
  
  sleep(0.1);
}