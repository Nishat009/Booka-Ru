import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

const originalFetch = global.fetch;

beforeEach(() => {
  window.scrollTo = jest.fn();
  window.localStorage.clear();
  // Matches the API contract: HTTP 200 with { success, message, data }.
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, message: '', data: [] })
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  window.history.pushState({}, '', '/');
});

test('shows the landing page with a Live Demo button', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: /sell bangla and english books/i })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /live demo/i })[0].getAttribute('href')).toBe('/login');
});

test('renders the Booka-Ru storefront and Dhaka map', async () => {
  window.history.pushState({}, '', '/home');
  render(<App />);
  expect(screen.getByRole('link', { name: /booka-ru home/i })).toBeInTheDocument();
  expect(screen.getByTitle('OpenStreetMap centered on Dhaka city').getAttribute('src'))
    .toContain('marker=23.8103%2C90.4125');
  expect(await screen.findByText(/the shelf is quiet for now/i)).toBeInTheDocument();
});

test('shows one-click demo buttons for every role', () => {
  window.history.pushState({}, '', '/login');
  render(<App />);
  ['Admin', 'Staff', 'Customer'].forEach(role => expect(screen.getByRole('button', { name: new RegExp('sign in as ' + role, 'i') })).toBeInTheDocument());
});

test('offers email login without Google sign-in', () => {
  window.history.pushState({}, '', '/login');
  render(<App />);
  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
});

test('opens sign in and returns to the collection without reloading', async () => {
  window.history.pushState({}, '', '/home');
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: /^sign in$/i }));
  expect(window.location.pathname).toBe('/login');
  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /find your next/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: /back to the bookshop/i }));
  expect(window.location.pathname).toBe('/home');
  expect(screen.getByRole('heading', { name: /find your next/i })).toBeInTheDocument();
  expect(await screen.findByText(/the shelf is quiet for now/i)).toBeInTheDocument();
});
