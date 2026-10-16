import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from './ErrorBoundary';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Boom() {
  throw new Error('render failure');
}

let root; let host;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function mount(ui) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(ui));
}

describe('ErrorBoundary', () => {
  it('renders children when nothing fails', () => {
    mount(<ErrorBoundary><p>all good</p></ErrorBoundary>);
    expect(host.textContent).toContain('all good');
    expect(host.querySelector('[data-testid="error-boundary"]')).toBeNull();
  });

  it('shows a recovery screen instead of a blank page when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mount(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(host.querySelector('[data-testid="error-boundary"]')).not.toBeNull();
    expect(host.textContent).toContain('Something went wrong');
    expect(host.querySelector('[data-testid="error-reload-btn"]')).not.toBeNull();
    spy.mockRestore();
  });
});
