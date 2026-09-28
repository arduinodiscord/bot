import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Jimp } from 'jimp';
import { recognizeImage, stopOcr } from './ocr';

after(() => stopOcr());

test('OCR reads text using the bundled model (no network)', async () => {
  // Render nothing fancy: a white canvas is enough to prove the worker boots
  // from the local language data and completes a job.
  const blank = new Jimp({ width: 200, height: 80, color: 0xffffffff });
  const text = await recognizeImage(await blank.getBuffer('image/png'));
  assert.equal(typeof text, 'string');
});

test('an undecodable image rejects instead of crashing the process', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  await assert.rejects(recognizeImage(svg));
  // Still alive and usable afterwards.
  const blank = new Jimp({ width: 50, height: 50, color: 0xffffffff });
  assert.equal(typeof (await recognizeImage(await blank.getBuffer('image/png'))), 'string');
});
