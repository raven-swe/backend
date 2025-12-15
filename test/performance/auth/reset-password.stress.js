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
    'http_req_duration{name:01_Forgot_Init}': ['p(95)<8000'], 
    'http_req_duration{name:02_Resend_OTP}': ['p(95)<1200'],
    'http_req_duration{name:03_Verify_OTP}': ['p(95)<500'],  
    'http_req_duration{name:04_Reset_Password}': ['p(95)<2000'], 
  },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'https://test.api.raven.cmp27.space'; 

export function setup() {
  const resCreate = http.post(
    `${STRESS_TEST_URL}/test/users`, 
  );

  if (!check(resCreate, { 'User Created 201': (r) => r.status === 201 })) {
    console.error(`Setup Failed: ${resCreate.body}`);
    return;
  }

  const userData = resCreate.json('data'); 
  const userEmail = userData.email;
  return { userEmail };
}

export default function (data) {
  const { userEmail } = data;
  const params = {
    headers: { 
      'Content-Type': 'application/json',
      'X-Client-Type': 'web'
    },
  };

  const payloadForgot = JSON.stringify({
    identifier: userEmail,
    recaptchaToken: "test"
  });

  const resForgot = http.post(
    `${STRESS_TEST_URL}/auth/password/forgot`,
    payloadForgot,
    { ...params, tags: { name: '01_Forgot_Init' } }
  );

  if (!check(resForgot, { 'Forgot Init 201': (r) => r.status === 201 })) {
    console.error(`Forgot Init Failed: ${resForgot.body}`);
    return;
  }

  const confirmationToken = resForgot.json('data.confirmationToken'); 

  const payloadResend = JSON.stringify({
    confirmationToken: confirmationToken
  });

  const resResend = http.post(
    `${STRESS_TEST_URL}/auth/password/resend-otp`,
    payloadResend,
    { ...params, tags: { name: '02_Resend_OTP' } }
  );

  if (!check(resResend, { 'Resend 201': (r) => r.status === 201 })) {
    console.error(`Resend Failed: ${resResend.body}`);
    return;
  }

  sleep(0.5); 

  const resOtp = http.get(
    `${STRESS_TEST_URL}/test/otp?identifier=${userEmail}&type=forgotPassword`,
  );

  if (!check(resOtp, { 'Fetch OTP 200': (r) => r.status === 200 })) {
    console.error(`Fetch OTP Failed: ${resOtp.status}`);
    return;
  }

  const otpCode = resOtp.json('data.otp');

  const payloadVerify = JSON.stringify({
    confirmationToken: confirmationToken,
    otp: otpCode
  });

  const resVerify = http.post(
    `${STRESS_TEST_URL}/auth/password/forgot/verify`,
    payloadVerify,
    { ...params, tags: { name: '03_Verify_OTP' } }
  );

  if (!check(resVerify, { 'Verify 201': (r) => r.status === 201 })) {
    console.error(`Verify Failed: ${resVerify.body}`);
    return;
  }

  const NEW_PASSWORD = "NewStrongPassword186!";

  const payloadReset = JSON.stringify({
    confirmationToken: confirmationToken,
    newPassword: NEW_PASSWORD
  });

  const resReset = http.post(
    `${STRESS_TEST_URL}/auth/password/reset`,
    payloadReset,
    { ...params, tags: { name: '04_Reset_Password' } }
  );

  if (!check(resReset, { 'Reset 201': (r) => r.status === 201 })) {
    console.error(`Reset Failed: ${resReset.body}`);
    return;
  }
  
  sleep(0.1);
}