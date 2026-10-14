import { describe, expect, it } from 'vitest';
import { projectIdFromUrl } from './project-url';

const ID = '64a1f0c2e4b0a1b2c3d4e5f6';

describe('projectIdFromUrl', () => {
  it.each([
    [`https://www.overleaf.com/project/${ID}`],
    [`https://www.overleaf.com/project/${ID}/`],
    [`https://www.overleaf.com/project/${ID}?foo=bar#L10`],
    [`https://cn.overleaf.com/project/${ID}`],
    [`https://overleaf.com/project/${ID}`],
  ])('extracts the ID from %s', (url) => {
    expect(projectIdFromUrl(url)).toBe(ID);
  });

  it.each([
    ['https://www.overleaf.com/project'],
    ['https://www.overleaf.com/project/'],
    ['https://www.overleaf.com/project/not-an-id'],
    [`https://www.overleaf.com/project/${ID.toUpperCase()}`],
    [`http://www.overleaf.com/project/${ID}`],
    [`https://evil-overleaf.com/project/${ID}`],
    [`https://www.overleaf.com.evil.example/project/${ID}`],
    [`https://www.overleaf.com/read/${ID}`],
    ['not a url'],
  ])('rejects %s', (url) => {
    expect(projectIdFromUrl(url)).toBeNull();
  });
});
