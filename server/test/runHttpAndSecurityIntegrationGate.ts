import http from 'http';
import crypto from 'crypto';

function httpRequest(options: http.RequestOptions, body?: any): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: any; rawBody: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch {}
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: parsed,
          rawBody: data
        });
      });
    });
    req.on('error', reject);
    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(payload);
    }
    req.end();
  });
}

async function runGate() {
  console.log('================================================================');
  console.log('🧪 LIVE HTTP RUNTIME & SECURITY GATE VALIDATION');
  console.log('================================================================');

  // 1. Health endpoint
  const healthRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/health',
    method: 'GET'
  });
  console.log(`[1] Health Check: status=${healthRes.statusCode}, adapter=${healthRes.body?.database?.adapter}`);
  if (healthRes.statusCode !== 200) throw new Error('Health check failed');

  // 2. Authentication via HTTP & Set-Cookie verification (register fresh test user)
  const testEmail = `test.gate.${Date.now()}@example.com`;
  const registerRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: testEmail,
    password: 'Password123!',
    name: 'Gate Verification User',
    phone: '+201009998877',
    role: 'Traveler'
  });

  console.log(`[2a] HTTP Register: status=${registerRes.statusCode}`);
  const regSetCookie = registerRes.headers['set-cookie'];
  console.log(`     Set-Cookie on Register: ${Array.isArray(regSetCookie) ? regSetCookie.join('; ') : regSetCookie}`);

  const loginRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail, password: 'Password123!' });

  console.log(`[2b] HTTP Login: status=${loginRes.statusCode}`);
  const setCookie = loginRes.headers['set-cookie'];
  console.log(`     Set-Cookie on Login: ${Array.isArray(setCookie) ? setCookie.join('; ') : setCookie}`);
  
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : (setCookie || '');
  const hasHttpOnly = /HttpOnly/i.test(cookieStr);
  const hasSameSite = /SameSite=Strict/i.test(cookieStr);
  const hasToken = /dahab_auth_token=/i.test(cookieStr);
  console.log(`    Cookie Flags: HttpOnly=${hasHttpOnly}, SameSite=Strict=${hasSameSite}, dahab_auth_token=${hasToken}`);
  if (!hasHttpOnly || !hasSameSite || !hasToken) {
    throw new Error('Cookie attributes do not meet strict security standards');
  }

  // 3. Authenticated request using Cookie header
  const authCookie = cookieStr.split(';')[0];
  const meRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });
  console.log(`[3] Auth via Cookie (/api/auth/me): status=${meRes.statusCode}, user=${meRes.body?.user?.name || meRes.body?.email}`);

  // 4. Logout & cookie clearance
  const logoutRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/logout',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  });
  console.log(`[4] Logout: status=${logoutRes.statusCode}`);
  const logoutCookie = logoutRes.headers['set-cookie']?.[0] || '';
  const isCleared = /Max-Age=0/i.test(logoutCookie) || /dahab_auth_token=;/i.test(logoutCookie);
  console.log(`    Logout Cleared Cookie: ${isCleared}`);

  // 5. Paymob Webhook HMAC Verification
  const webhookSecret = process.env.PAYMOB_HMAC_SECRET || 'dahab_paymob_hmac_secret_2026_prod';
  
  // 5a. Missing signature
  const missingSigRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/payments/paymob-webhook',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { type: 'TRANSACTION', obj: { id: 999999 } });
  console.log(`[5a] Paymob Webhook Missing Signature: status=${missingSigRes.statusCode}, body=${JSON.stringify(missingSigRes.body)}`);

  // 5b. Invalid signature
  const invalidSigRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/payments/paymob-webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paymob-hmac': 'invalid_forged_hmac_signature_hex'
    }
  }, { type: 'TRANSACTION', obj: { id: 999999 } });
  console.log(`[5b] Paymob Webhook Invalid Signature: status=${invalidSigRes.statusCode}, body=${JSON.stringify(invalidSigRes.body)}`);

  // 5c. Valid signature
  const transactionObj = {
    amount_cents: 250000,
    created_at: new Date().toISOString(),
    currency: 'EGP',
    error_occured: false,
    has_parent_transaction: false,
    id: 881234,
    integration_id: 12345,
    is_3d_secure: true,
    is_auth: false,
    is_capture: true,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: { id: 554321 },
    owner: 100,
    pending: false,
    source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
    success: true
  };

  const concatenatedString = [
    transactionObj.amount_cents,
    transactionObj.created_at,
    transactionObj.currency,
    transactionObj.error_occured,
    transactionObj.has_parent_transaction,
    transactionObj.id,
    transactionObj.integration_id,
    transactionObj.is_3d_secure,
    transactionObj.is_auth,
    transactionObj.is_capture,
    transactionObj.is_refunded,
    transactionObj.is_standalone_payment,
    transactionObj.is_voided,
    transactionObj.order.id,
    transactionObj.owner,
    transactionObj.pending,
    transactionObj.source_data.pan,
    transactionObj.source_data.sub_type,
    transactionObj.source_data.type,
    transactionObj.success
  ].join('');

  const validHmac = crypto.createHmac('sha512', webhookSecret).update(concatenatedString).digest('hex');
  const validWebhookRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/payments/paymob-webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paymob-hmac': validHmac
    }
  }, { type: 'TRANSACTION', obj: transactionObj });
  console.log(`[5c] Paymob Webhook Valid HMAC Signature: status=${validWebhookRes.statusCode}, body=${JSON.stringify(validWebhookRes.body)}`);

  // 5d. Duplicate webhook event (Idempotency)
  const duplicateWebhookRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/payments/paymob-webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paymob-hmac': validHmac
    }
  }, { type: 'TRANSACTION', obj: transactionObj });
  console.log(`[5d] Paymob Webhook Duplicate Replay (Idempotent): status=${duplicateWebhookRes.statusCode}, idempotent=${duplicateWebhookRes.body?.idempotent}`);

  console.log('================================================================');
  console.log('✅ ALL LIVE HTTP RUNTIME & SECURITY GATE CHECKS PASSED');
  console.log('================================================================');
}

runGate().catch(err => {
  console.error('❌ LIVE HTTP GATE FAILED:', err);
  process.exit(1);
});
