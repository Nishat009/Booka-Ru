import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

const originalFetch = global.fetch;

beforeEach(() => {
  window.scrollTo = jest.fn();
  window.localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => []
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  window.history.pushState({}, '', '/');
});

test('renders the Booka-Ru storefront and Dhaka map', async () => {
  render(<App />);
  expect(screen.getByRole('link', { name: /booka-ru home/i })).toBeInTheDocument();
  expect(screen.getByTitle('OpenStreetMap centered on Dhaka city').getAttribute('src'))
    .toContain('marker=23.8103%2C90.4125');
  expect(await screen.findByText(/the shelf is quiet for now/i)).toBeInTheDocument();
});

test('offers email login without Google sign-in', () => {
  window.history.pushState({}, '', '/login');
  render(<App />);
  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
});

test('opens sign in and returns to the collection without reloading', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: /^sign in$/i }));
  expect(window.location.pathname).toBe('/login');
  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /find your next/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: /back to the bookshop/i }));
  expect(window.location.pathname).toBe('/');
  expect(screen.getByRole('heading', { name: /find your next/i })).toBeInTheDocument();
  expect(await screen.findByText(/the shelf is quiet for now/i)).toBeInTheDocument();
});
