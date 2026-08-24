import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('admin package portability', () => {
  it('declares every build and test runtime instead of relying on root hoisting', () => {
    const manifest = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(manifest.dependencies).toEqual(expect.objectContaining({
      expo: expect.any(String),
      'react-native': expect.any(String),
      'react-native-web': expect.any(String),
    }));
    expect(manifest.devDependencies).toEqual(expect.objectContaining({
      'babel-preset-expo': expect.any(String),
      eslint: expect.any(String),
      jest: expect.any(String),
      'jest-expo': expect.any(String),
      '@testing-library/react-native': expect.any(String),
      '@types/jest': expect.any(String),
    }));
  });
});
