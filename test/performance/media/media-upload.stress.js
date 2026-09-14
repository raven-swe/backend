import http from 'k6/http';
import { check, sleep, group } from 'k6';
import encoding from 'k6/encoding';

export const options = {
    stages: [
        { duration: '30s', target: 50 },    // Ramp up to 50 users
        { duration: '1m', target: 100 },    // Ramp up to 100 users
        { duration: '30s', target: 200 },   // Ramp up to 200 users
        { duration: '2m', target: 200 },    // Sustain at 200 users
        { duration: '30s', target: 0 },     // Ramp down
    ],
    thresholds: {
        http_req_failed: ['rate<0.05'], // Allow up to 5% failure rate for media uploads (I/O heavy)
        'http_req_duration{name:01_Login_Action}': ['p(95)<3000'],
        'http_req_duration{name:02_Upload_Image}': ['p(95)<10000'], // Image uploads can take longer
        'http_req_duration{name:03_Upload_Video}': ['p(95)<15000'], // Video uploads can take longer
        'http_req_duration{name:04_Upload_Gif}': ['p(95)<5000'],    // GIF (KLIPY lookup) should be faster
    },
};

const STRESS_TEST_URL = __ENV.STRESS_TEST_URL || 'http://localhost:3000';

// Minimal valid PNG file (1x1 red pixel) - properly encoded
const MINIMAL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADklEQVQI12P4z8DwHwAFAAH/q842AAAAAElFTkSuQmCC';

// Minimal valid MP4 bytes - ftyp box only (smallest valid MP4 structure)
// We'll create this as raw bytes array instead of base64 to avoid encoding issues
function createMinimalMP4Bytes() {
    // Minimal ftyp box: box size (4) + box type (4) + brand (4) + version (4)
    const bytes = new Uint8Array([
        0x00, 0x00, 0x00, 0x14, // box size: 20 bytes
        0x66, 0x74, 0x79, 0x70, // box type: 'ftyp'
        0x69, 0x73, 0x6F, 0x6D, // brand: 'isom'
        0x00, 0x00, 0x00, 0x01, // version: 1
        0x69, 0x73, 0x6F, 0x6D, // compatible brand: 'isom'
    ]);
    return bytes.buffer; // Return ArrayBuffer, not Uint8Array
}

/**
 * Helper function to create and login a user
 * Returns { accessToken } or null on failure
 */
function createAndLoginUser(tagName) {
    const resCreateUser = http.post(`${STRESS_TEST_URL}/test/users`);

    if (!check(resCreateUser, { 'User Created 201': (r) => r.status === 201 })) {
        console.error(`Setup Failed (Create User): ${resCreateUser.body}`);
        return null;
    }

    const userData = resCreateUser.json('data');
    const userEmail = userData.email;
    const userPassword = userData.password;

    const loginPayload = JSON.stringify({
        identifier: userEmail,
        password: userPassword,
    });

    const loginParams = {
        headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'web',
        },
        tags: { name: tagName },
    };

    const resLogin = http.post(`${STRESS_TEST_URL}/auth/login`, loginPayload, loginParams);

    if (!check(resLogin, { 'Login 200': (r) => r.status === 200 })) {
        console.error(`Setup Failed (Login): ${resLogin.body}`);
        return null;
    }

    return {
        accessToken: resLogin.json('data.accessToken'),
    };
}

export default function () {
    // ─────────────────────────────────────────────────────────────────────────────
    // SETUP: Create and login user
    // ─────────────────────────────────────────────────────────────────────────────
    const user = createAndLoginUser('01_Login_Action');
    if (!user) return;

    const authHeaders = {
        'X-Client-Type': 'web',
        Authorization: `Bearer ${user.accessToken}`,
    };

    sleep(0.2);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 1: Upload Image (POST /media/upload/image)
    // ─────────────────────────────────────────────────────────────────────────────
    group('Image Upload', function () {
        const imageBytes = encoding.b64decode(MINIMAL_PNG_BASE64);

        const formData = {
            file: http.file(imageBytes, `test-image-${__VU}-${__ITER}.png`, 'image/png'),
            folder: 'tweets',
        };

        const resUploadImage = http.post(
            `${STRESS_TEST_URL}/media/upload/image`,
            formData,
            {
                headers: authHeaders,
                tags: { name: '02_Upload_Image' },
            }
        );

        const imageUploadOk = check(resUploadImage, {
            'Upload Image 2xx': (r) => r.status >= 200 && r.status < 300,
        });

        if (!imageUploadOk) {
            console.error(`Upload Image Failed [VU:${__VU}]: ${resUploadImage.status} - ${resUploadImage.body}`);
        }
    });

    sleep(0.3);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 2: Upload Video (POST /media/upload/video)
    // ─────────────────────────────────────────────────────────────────────────────
    group('Video Upload', function () {
        const videoBytes = createMinimalMP4Bytes();

        const formData = {
            file: http.file(videoBytes, `test-video-${__VU}-${__ITER}.mp4`, 'video/mp4'),
            folder: 'tweets',
        };

        const resUploadVideo = http.post(
            `${STRESS_TEST_URL}/media/upload/video`,
            formData,
            {
                headers: authHeaders,
                tags: { name: '03_Upload_Video' },
            }
        );

        const videoUploadOk = check(resUploadVideo, {
            'Upload Video 2xx': (r) => r.status >= 200 && r.status < 300,
        });

        if (!videoUploadOk) {
            console.error(`Upload Video Failed [VU:${__VU}]: ${resUploadVideo.status} - ${resUploadVideo.body}`);
        }
    });

    sleep(0.3);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 3: Upload GIF via KLIPY ID (POST /media/upload/gif)
    // ─────────────────────────────────────────────────────────────────────────────
    group('GIF Upload', function () {
        // Note: This requires a valid KLIPY GIF ID (copy one from a KLIPY search result)
        const klipyId = '16989471141791455574';

        const gifPayload = JSON.stringify({
            klipyId: klipyId,
        });

        const resUploadGif = http.post(
            `${STRESS_TEST_URL}/media/upload/gif`,
            gifPayload,
            {
                headers: {
                    ...authHeaders,
                    'Content-Type': 'application/json',
                },
                tags: { name: '04_Upload_Gif' },
            }
        );

        const gifUploadOk = check(resUploadGif, {
            'Upload GIF 2xx': (r) => r.status >= 200 && r.status < 300,
        });

        if (!gifUploadOk) {
            console.error(`Upload GIF Failed [VU:${__VU}]: ${resUploadGif.status} - ${resUploadGif.body}`);
        }
    });

    sleep(0.2);
}
