import { describe, it, expect } from 'vitest';
import { fmt, inr, errMsg, isImagePath, fileUrl, api } from './api';

describe('api helpers', () => {
  it('formats numbers with Indian grouping', () => {
    expect(fmt(1234567.891)).toBe('12,34,567.89');
    expect(fmt(null)).toBe('0');
  });

  it('formats rupee amounts', () => {
    expect(inr(1500.456)).toBe('₹1,500.46');
    expect(inr(undefined)).toBe('₹0');
  });

  it('extracts readable error messages', () => {
    expect(errMsg({ message: 'boom' })).toBe('boom');
    expect(errMsg({ response: { data: { detail: 'Nope' } } })).toBe('Nope');
    expect(
      errMsg({ response: { data: { detail: [{ msg: 'a' }, { msg: 'b' }] } } }),
    ).toBe('a b');
    expect(errMsg({})).toBe('Something went wrong');
  });

  it('detects image paths', () => {
    expect(isImagePath('photo.JPG')).toBe(true);
    expect(isImagePath('invoice.pdf')).toBe(false);
    expect(isImagePath(undefined)).toBe(false);
  });

  it('builds same-origin /api URLs when no backend URL is configured', () => {
    expect(api.defaults.baseURL.endsWith('/api')).toBe(true);
    expect(fileUrl('a/b.png')).toContain('/api/files/a/b.png?auth=');
  });
});
