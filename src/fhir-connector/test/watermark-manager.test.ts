import { describe, expect, it } from 'vitest';
import { WatermarkManager } from '../src/services/watermark-manager.js';

describe('WatermarkManager', () => {
  it('stores and retrieves in-memory watermarks when no Table Storage URL is provided', async () => {
    const wm = new WatermarkManager('');
    expect(await wm.getWatermark('Patient')).toBeUndefined();

    const iso = '2026-09-05T12:00:00.000Z';
    await wm.commitWatermark('Patient', iso);

    expect(await wm.getWatermark('Patient')).toBe(iso);
    expect(await wm.getWatermark('Observation')).toBeUndefined();
  });
});
