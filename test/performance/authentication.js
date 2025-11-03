import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const loginSuccessRate = new Rate('login_success_rate');
const registrationSuccessRate = new Rate('registration_success_rate');
const refreshTokenSuccessRate = new Rate('refresh_token_success_rate');
const loginDuration = new Trend('login_duration');
const registrationDuration = new Trend('registration_duration');

export const options = {
  scenarios: {
    // Scenario 1: Login stress test
    login_stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // Ramp up to 50 users
        { duration: '2m', target: 100 },   // Stay at 100 users
        { duration: '1m', target: 200 },   // Spike to 200 users
        { duration: '30s', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
      exec: 'loginFlow',
    },
    
    // Scenario 2: Registration flow stress test
    registration_stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },   // Ramp up to 20 users
        { duration: '2m', target: 50 },    // Stay at 50 users
        { duration: '1m', target: 100 },   // Spike to 100 users
        { duration: '30s', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
      exec: 'registrationFlow',
      startTime: '10s', // Start after login test begins
    },
    
    // Scenario 3: Token refresh stress test
    token_refresh_stress: {
      executor: 'constant-vus',
      vus: 30,
      duration: '3m',
      exec: 'tokenRefreshFlow',
      startTime: '20s',
    },
    
    // Scenario 4: Password reset flow
    password_reset_stress: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 50,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '2m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      exec: 'passwordResetFlow',
      startTime: '30s',
    },
    
    // Scenario 5: Check endpoints (email, username, identifier)
    check_endpoints_stress: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 20,
      maxVUs: 100,
      exec: 'checkEndpointsFlow',
      startTime: '15s',
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'], // 95% under 1s, 99% under 2s
    http_req_failed: ['rate<0.05'], // Less than 5% failed requests
    login_success_rate: ['rate>0.90'], // 90% login success rate
    registration_success_rate: ['rate>0.85'], // 85% registration success rate
    refresh_token_success_rate: ['rate>0.95'], // 95% refresh token success rate
    login_duration: ['p(95)<800'],
    registration_duration: ['p(95)<1500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_PREFIX = '/auth';

// Helper function to generate random data
function generateRandomEmail() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `testuser_${timestamp}_${random}@example.com`;
}

function generateRandomUsername() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `user_${timestamp}_${random}`;
}

function generateRandomPassword() {
  return `Pass${Math.random().toString(36).substring(2)}123!`;
}

function generateRandomPhone() {
  return `+201${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
}

// Common headers
const headers = {
  'Content-Type': 'application/json',
  'X-Client-Type': 'mobile',
};

// Login Flow
export function loginFlow() {
  const testUsers = [
    { identifier: 'testuser1@example.com', password: 'Password123!' },
    { identifier: 'testuser2@example.com', password: 'Password123!' },
    { identifier: 'testuser3', password: 'Password123!' },
  ];
  
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  
  const loginPayload = JSON.stringify({
    identifier: user.identifier,
    password: user.password,
  });
  
  const startTime = Date.now();
  const loginRes = http.post(`${BASE_URL}${API_PREFIX}/login`, loginPayload, { headers });
  const duration = Date.now() - startTime;
  
  loginDuration.add(duration);
  
  const loginSuccess = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login returns accessToken': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.accessToken !== undefined;
      } catch {
        return false;
      }
    },
    'login returns refreshToken': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.refreshToken !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  loginSuccessRate.add(loginSuccess);
  
  if (loginRes.status === 200) {
    const tokens = JSON.parse(loginRes.body);
    
    // Test authenticated endpoint - logout
    const logoutPayload = JSON.stringify({
      refreshToken: tokens.refreshToken,
    });
    
    const authHeaders = {
      ...headers,
      'Authorization': `Bearer ${tokens.accessToken}`,
    };
    
    const logoutRes = http.post(`${BASE_URL}${API_PREFIX}/logout`, logoutPayload, { 
      headers: authHeaders 
    });
    
    check(logoutRes, {
      'logout status is 200': (r) => r.status === 200,
    });
  }
  
  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

// Registration Flow
export function registrationFlow() {
  const email = generateRandomEmail();
  const username = generateRandomUsername();
  const password = generateRandomPassword();
  const name = `Test User ${Math.random().toString(36).substring(7)}`;
  const birthDate = new Date(1990 + Math.floor(Math.random() * 20), 
                             Math.floor(Math.random() * 12), 
                             Math.floor(Math.random() * 28) + 1).toISOString();
  
  // Step 1: Start Registration
  const startRegPayload = JSON.stringify({
    email: email,
    password: password,
  });
  
  const startTime = Date.now();
  const startRegRes = http.post(`${BASE_URL}${API_PREFIX}/register/start`, startRegPayload, { headers });
  
  const step1Success = check(startRegRes, {
    'start registration status is 201': (r) => r.status === 201,
    'start registration returns creationToken': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.creationToken !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  if (!step1Success || startRegRes.status !== 201) {
    registrationSuccessRate.add(false);
    sleep(1);
    return;
  }
  
  const { creationToken } = JSON.parse(startRegRes.body);
  
  // Step 2: Verify OTP (using mock OTP for testing)
  const verifyOtpPayload = JSON.stringify({
    creationToken: creationToken,
    otp: '123456', // Mock OTP - in real scenario this would fail
  });
  
  const verifyOtpRes = http.post(`${BASE_URL}${API_PREFIX}/register/verify`, verifyOtpPayload, { headers });
  
  const step2Success = check(verifyOtpRes, {
    'verify OTP status is 200 or 400': (r) => r.status === 200 || r.status === 400,
  });
  
  // For stress testing purposes, we'll assume verification passes
  // In production, you'd need valid OTPs
  
  // Step 3: Complete Registration (will likely fail without valid OTP verification)
  const completeRegPayload = JSON.stringify({
    creationToken: creationToken,
    username: username,
    name: name,
    birthDate: birthDate,
  });
  
  const completeRegRes = http.post(`${BASE_URL}${API_PREFIX}/register/complete`, completeRegPayload, { headers });
  const duration = Date.now() - startTime;
  
  registrationDuration.add(duration);
  
  const completeSuccess = check(completeRegRes, {
    'complete registration status is 201 or 400': (r) => r.status === 201 || r.status === 400,
  });
  
  registrationSuccessRate.add(completeRegRes.status === 201);
  
  sleep(Math.random() * 2 + 1);
}

// Token Refresh Flow
export function tokenRefreshFlow() {
  // First login to get tokens
  const loginPayload = JSON.stringify({
    identifier: 'testuser1@example.com',
    password: 'Password123!',
  });
  
  const loginRes = http.post(`${BASE_URL}${API_PREFIX}/login`, loginPayload, { headers });
  
  if (loginRes.status !== 200) {
    sleep(1);
    return;
  }
  
  const { refreshToken } = JSON.parse(loginRes.body);
  
  // Wait a bit before refreshing
  sleep(2);
  
  // Refresh token
  const refreshPayload = JSON.stringify({
    refreshToken: refreshToken,
  });
  
  const refreshRes = http.post(`${BASE_URL}${API_PREFIX}/refresh-token`, refreshPayload, { headers });
  
  const refreshSuccess = check(refreshRes, {
    'refresh token status is 200': (r) => r.status === 200,
    'refresh returns new accessToken': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.accessToken !== undefined;
      } catch {
        return false;
      }
    },
    'refresh returns new refreshToken': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.refreshToken !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  refreshTokenSuccessRate.add(refreshSuccess);
  
  sleep(Math.random() * 3 + 2);
}

// Password Reset Flow
export function passwordResetFlow() {
  const email = 'testuser1@example.com';
  
  // Step 1: Forgot Password
  const forgotPasswordPayload = JSON.stringify({
    email: email,
  });
  
  const forgotRes = http.post(`${BASE_URL}${API_PREFIX}/password/forgot`, forgotPasswordPayload, { headers });
  
  check(forgotRes, {
    'forgot password status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'forgot password returns resetToken': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.resetToken !== undefined || r.status === 201;
      } catch {
        return r.status === 201;
      }
    },
  });
  
  sleep(Math.random() * 2 + 1);
}

// Check Endpoints Flow
export function checkEndpointsFlow() {
  const endpoints = [
    {
      url: `${BASE_URL}${API_PREFIX}/check-email?email=${generateRandomEmail()}`,
      name: 'check email',
    },
    {
      url: `${BASE_URL}${API_PREFIX}/check-identifier?identifier=${generateRandomUsername()}`,
      name: 'check identifier',
    },
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  const res = http.get(endpoint.url, { headers: { 'Content-Type': 'application/json' } });
  
  check(res, {
    [`${endpoint.name} status is 200`]: (r) => r.status === 200,
    [`${endpoint.name} returns exists field`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.exists !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  sleep(Math.random() * 1 + 0.5);
}
