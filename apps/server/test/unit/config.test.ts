import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/main/config.js';

describe('loadConfig', () => {
  it('reserves the API and web ports for the app', () => {
    expect(loadConfig({}).reservedPorts).toEqual([4100, 5173]);
    expect(loadConfig({ PORT: '9000', WEB_ORIGIN: 'https://fleet.local' }).reservedPorts).toEqual([
      9000, 443,
    ]);
  });
});
