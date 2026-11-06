require('dotenv').config();

const api = String(process.env.DEMO_API_URL || `http://localhost:${process.env.PORT || 5500}`).replace(/\/$/, '');
const accounts = {
  admin: { email: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(), password: process.env.DEMO_ADMIN_PASSWORD },
  staff: { email: 'bookaru.staff.test@example.com', password: process.env.DEMO_STAFF_PASSWORD },
  customer: { email: 'bookaru.customer.test@example.com', password: process.env.DEMO_CUSTOMER_PASSWORD }
};

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  });
  const raw = await response.json().catch(() => ({}));
  const body = response.status === 200 && 'data' in raw ? raw.data : raw;
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

async function login(account) {
  const { response, body } = await request('/auth/login', { method: 'POST', body: JSON.stringify(account) });
  if (!response.ok) throw new Error(`Login failed for a demo account with HTTP ${response.status}.`);
  return body;
}

async function verify() {
  if (!accounts.admin.email || !accounts.admin.password || !accounts.staff.password || !accounts.customer.password) {
    throw new Error('Set ADMIN_EMAIL and all three DEMO_*_PASSWORD values before running this verification.');
  }

  const [admin, staff, customer] = await Promise.all([login(accounts.admin), login(accounts.staff), login(accounts.customer)]);
  assert(admin.user.role === 'admin' && staff.user.role === 'staff' && customer.user.role === 'customer', 'demo accounts receive their intended roles');

  let result = await request('/admin/users', { token: staff.token });
  assert(result.response.status === 422, 'staff cannot access user administration');

  const unique = Date.now();
  const bookName = `ডেমো বই ${unique}`;
  result = await request('/books', { token: admin.token, method: 'POST', body: JSON.stringify({
    name: bookName, author: 'Booka-Ru demo', description: 'Database-backed admin-created Bangla book.',
    category: 'বাংলা সাহিত্য', genre: 'গল্প', language: 'বাংলা', price: 125, quantity: 3, imageURL: ''
  }) });
  assert(result.response.status === 200, 'admin creates a Bangla book through the API');
  const bookId = result.body._id;
  result = await request('/books?language=%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE');
  assert(result.response.ok && result.body.some(book => book._id === bookId), 'homepage book feed returns the saved book from MongoDB');

  result = await request('/books', { token: staff.token, method: 'POST', body: JSON.stringify({ name: `Staff test ${unique}`, price: 20, quantity: 1 }) });
  assert(result.response.status === 200, 'staff with books:write can create a book');
  await request(`/books/${result.body._id}`, { token: admin.token, method: 'DELETE' });

  result = await request('/orders', { token: customer.token, method: 'POST', body: JSON.stringify({ bookId, quantity: 1, shippingAddress: 'Demo address, Dhaka' }) });
  assert(result.response.status === 200 && result.body.status === 'new', 'customer places an order and stock is reserved');
  const orderId = result.body._id;
  result = await request('/orders', { token: staff.token });
  assert(result.response.ok && result.body.some(order => order._id === orderId), 'staff with order permissions can view the order');

  result = await request(`/orders/${orderId}`, { token: staff.token, method: 'PATCH', body: JSON.stringify({ status: 'on-call' }) });
  assert(!result.response.ok, 'staff cannot take an order on call (admin only)');
  result = await request(`/orders/${orderId}`, { token: admin.token, method: 'PATCH', body: JSON.stringify({ status: 'on-call' }) });
  assert(result.response.ok, 'admin takes the order on call');
  result = await request(`/orders/${orderId}/messages`, { token: customer.token, method: 'POST', body: JSON.stringify({ text: 'Please confirm my order.' }) });
  assert(result.response.status === 200, 'customer sends a support message');
  result = await request(`/orders/${orderId}/messages`, { token: staff.token });
  assert(!result.response.ok, 'staff cannot read the support conversation');
  result = await request(`/orders/${orderId}/messages`, { token: admin.token });
  assert(result.response.ok && result.body.length === 1, 'admin reads the support conversation');
  result = await request(`/orders/${orderId}/messages`, { token: admin.token, method: 'POST', body: JSON.stringify({ text: 'Your order is confirmed.' }) });
  assert(result.response.status === 200, 'admin replies to the customer');
  result = await request(`/orders/${orderId}`, { token: staff.token, method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
  assert(result.response.ok, 'staff fulfils the order');

  result = await request('/reviews', { token: customer.token, method: 'POST', body: JSON.stringify({ rating: 5, text: 'বাংলা বইয়ের অর্ডারটি সুন্দরভাবে পেয়েছি।' }) });
  assert(result.response.status === 200, 'customer submits a review for moderation');
  result = await request('/admin/reviews', { token: staff.token });
  assert(result.response.ok && result.body.some(item => item.text === 'বাংলা বইয়ের অর্ডারটি সুন্দরভাবে পেয়েছি।' && !item.approved), 'review is pending and staff can access moderation');
  const review = result.body.find(item => item.text === 'বাংলা বইয়ের অর্ডারটি সুন্দরভাবে পেয়েছি।');
  result = await request(`/admin/reviews/${review._id}`, { token: admin.token, method: 'PATCH', body: JSON.stringify({ approved: true }) });
  assert(result.response.ok, 'admin approves the customer review');
  result = await request('/reviews');
  assert(result.response.ok && result.body.some(item => item._id === review._id), 'approved review appears in the public API feed');
  result = await request('/orders', { token: customer.token });
  assert(result.response.ok && result.body.some(order => order._id === orderId && order.status === 'completed'), 'customer sees the fulfilled order');
  console.log(`FLOW_COMPLETE book=${bookId} order=${orderId} review=${review._id}`);
}

verify().catch(error => { console.error('DEMO FLOW FAILED:', error.message); process.exitCode = 1; });
