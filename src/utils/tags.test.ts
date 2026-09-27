import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { APIButtonComponent } from 'discord.js';
import tags from './tags';
import { EMBED_LIMITS, embedLimitProblems } from './embedLimits';
import { TAG_CHOICES } from '../commands/tag';

/**
 * Suggest-pattern corpus. `match` must trigger the tag; `noMatch` must not.
 * Add a false positive here whenever one is reported in the server.
 */
const corpus: Record<string, { match: string[]; noMatch: string[] }> = {
  avrdude: {
    match: [
      'avrdude: stk500_recv(): programmer is not responding',
      'avrdude: stk500_getsync() attempt 10 of 10: not in sync: resp=0x00',
      'I keep getting an avrdude error when uploading',
    ],
    noMatch: [
      'my two servos are not in sync',
      'the audio and video are not in sync',
      'the LEDs blink not in sync with the beat',
    ],
  },
  debounce: {
    match: [
      'how do I debounce a button?',
      'my button registers multiple presses when I press it once',
      'the button counts twice every time',
      'push button triggers several times per press',
      'the switch is bouncing and toggles the LED randomly',
    ],
    noMatch: [
      'I have a button and multiple LEDs on my breadboard',
      'I pressed the button twice but nothing happened',
      'there are several buttons on this remote',
    ],
  },
  espcomm: {
    match: [
      'A fatal error occurred: Failed to connect to ESP32: Timed out waiting for packet header',
      'esptool.py v4.5 failed to upload',
      'Failed to connect to ESP8266: Wrong boot mode detected (0x13)',
    ],
    noMatch: [
      'my ESP32 connects to wifi fine',
      'a fatal error occurred in my life',
    ],
  },
  hid: {
    match: [
      'can my arduino act as a keyboard?',
      'I want to emulate a mouse with a Pro Micro',
      '#include <Keyboard.h> gives an error',
      'is the Uno R3 usable as a USB HID device?',
      'does the Nano support HID keyboard mode',
    ],
    noMatch: [
      'I hid the wires behind the enclosure',
      'she hid the arduino in a box',
      'I want to connect a keyboard to my arduino',
    ],
  },
  levelShifter: {
    match: [
      'do I need a level shifter for the NRF24L01?',
      'is the ESP32 5V tolerant?',
      'how do I convert 5V to 3.3V logic for the RX pin',
      'the SDA/SCL lines go from 3.3v to 5v, is that ok?',
      'which logic level converter should I buy',
    ],
    noMatch: [
      'which logic level MOSFET should I use for my LED strip',
      'I need to step up 3.3v to 5v to power my servo',
      'my regulator turns 5v to 3.3v',
    ],
  },
  libmissing: {
    match: [
      'fatal error: Adafruit_SSD1306.h: No such file or directory',
      "DHT.h: No such file or directory compilation terminated",
      'it says the library is not installed',
      'fatal error: WiFi.h no such file',
    ],
    noMatch: [
      "can't open device \"/dev/ttyUSB0\": No such file or directory",
      'avrdude: ser_open(): can\'t open device "/dev/ttyACM0": No such file or directory',
      'the library example is missing the wiring diagram',
    ],
  },
  ninevolt: {
    match: [
      'can I power my uno with a 9V battery?',
      'I am using a 9 volt battery for my motors',
      'running it off a battery (9V) via the barrel jack',
      'using a smoke alarm battery to power the nano',
    ],
    noMatch: [
      'I have a 9V adapter and some AA batteries',
      'my 12v battery is charged, the regulator outputs 9v',
      'my battery pack is 7.4v',
    ],
  },
  power: {
    match: [
      'Brownout detector was triggered',
      'how do I power my arduino from a wall adapter?',
      'the voltage drops when the motor starts',
      'not enough current for the servos',
      'best way of powering my nano in the car',
    ],
    noMatch: [
      'what is the voltage drop across a red LED?',
      'how to power the meeting through without coffee',
      'the power went out last night so I lost my sketch',
    ],
  },
  pullup: {
    match: [
      'do I need a pull-up resistor on the button?',
      'use the internal pullup on pin 2',
      'my input pin is floating',
      'the button pin reads high and low randomly',
      'the button randomly triggers without being pressed',
    ],
    noMatch: [
      'let me pull up the datasheet',
      'select it in the pull-down menu',
      'pull down the latest code from github',
      'I want a button that picks a random number',
    ],
  },
};

const suggestible = Object.entries(tags).filter(([, tag]) => tag.suggest);

test('every suggestible tag has a pattern corpus', () => {
  for (const [name] of suggestible)
    assert.ok(corpus[name], `add ${name} to the suggest corpus in tags.test.ts`);
});

for (const [name, { match, noMatch }] of Object.entries(corpus)) {
  test(`suggest pattern for ${name}`, () => {
    const pattern = tags[name]?.suggest?.pattern;
    assert.ok(pattern, `${name} has no suggest pattern`);
    for (const text of match)
      assert.ok(pattern.test(text), `${name} should match: "${text}"`);
    for (const text of noMatch)
      assert.ok(!pattern.test(text), `${name} should NOT match: "${text}"`);
  });
}

test('suggest patterns are not stateful (no g/y flags)', () => {
  for (const [name, tag] of suggestible)
    assert.ok(
      !/[gy]/.test(tag.suggest!.pattern.flags),
      `${name} pattern must not use g/y flags (RegExp.test would keep state)`
    );
});

test('every tag fits Discord message limits', () => {
  for (const [name, tag] of Object.entries(tags)) {
    const embeds = tag.embeds ?? [];
    assert.ok(embeds.length <= 10, `${name}: more than 10 embeds`);
    const embedChars = embeds.reduce((sum, embed) => {
      const problems = embedLimitProblems(embed.toJSON());
      assert.deepEqual(problems, [], `${name}: ${problems.join(' ')}`);
      const data = embed.toJSON();
      return (
        sum +
        (data.title?.length ?? 0) +
        (data.description?.length ?? 0) +
        (data.fields ?? []).reduce((s, f) => s + f.name.length + f.value.length, 0) +
        (data.footer?.text.length ?? 0) +
        (data.author?.name.length ?? 0)
      );
    }, 0);
    assert.ok(
      embedChars <= EMBED_LIMITS.total,
      `${name}: embeds total ${embedChars} chars across the message (max ${EMBED_LIMITS.total})`
    );

    if (tag.content) {
      const content =
        typeof tag.content === 'function'
          ? tag.content('123456789012345678')
          : tag.content;
      // /tag may prepend a mention, so leave room for "<@id>\n".
      assert.ok(
        content.length + 23 <= 2000,
        `${name}: content is ${content.length} chars (max ~1977 with mention)`
      );
    }

    const rows = tag.components ?? [];
    assert.ok(rows.length <= 5, `${name}: more than 5 action rows`);
    for (const row of rows) {
      const buttons = row.toJSON().components as APIButtonComponent[];
      assert.ok(buttons.length <= 5, `${name}: more than 5 buttons in a row`);
      for (const button of buttons) {
        assert.ok(
          (('label' in button && button.label) || '').length <= EMBED_LIMITS.buttonLabel,
          `${name}: button label too long`
        );
        if ('custom_id' in button) {
          assert.ok(button.custom_id.length <= 100, `${name}: custom_id too long`);
          // tag:<name> buttons must point at a real tag.
          if (button.custom_id.startsWith('tag:'))
            assert.ok(
              tags[button.custom_id.slice(4)],
              `${name}: button points at unknown tag ${button.custom_id}`
            );
        }
      }
    }
  }
});

test('/tag choices match the tags map and fit Discord limits', () => {
  assert.ok(TAG_CHOICES.length <= EMBED_LIMITS.choices, 'more than 25 choices');
  const values = TAG_CHOICES.map((choice) => choice.value).sort();
  assert.deepEqual(values, Object.keys(tags).sort());
  for (const choice of TAG_CHOICES) {
    assert.ok(choice.name.length >= 1 && choice.name.length <= 100);
    assert.ok(choice.value.length <= 100);
  }
});

test('help tag lists every tag', () => {
  const field = tags.help?.embeds?.[0]
    ?.toJSON()
    .fields?.find((f) => f.name === 'Available Commands');
  assert.ok(field, 'help tag has no "Available Commands" field');
  const listed = [...field.value.matchAll(/`([^`]+)`/g)].map((m) => m[1]).sort();
  assert.deepEqual(listed, Object.keys(tags).sort());
});
