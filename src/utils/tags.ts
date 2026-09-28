import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import universalEmbed from './embed';

/**
 * Shape of a single tag. Every field is optional because tags vary: most are
 * rich embeds, a few are plain (or templated) text, and some opt out of the
 * bot-commands-channel-only behaviour.
 */
/**
 * An optional auto-suggest rule for a tag. When a user's message matches
 * `pattern`, the suggestion engine offers this tag via a single button with
 * `prompt` as the lead-in. Co-locating the trigger with the tag means adding a
 * suggestible tag is a one-place change.
 */
export interface TagSuggestion {
  pattern: RegExp;
  prompt: string;
}

export interface Tag {
  embeds?: EmbedBuilder[];
  components?: ActionRowBuilder<ButtonBuilder>[];
  content?: string | ((user?: string) => string);
  botCommandsOnly?: boolean;
  suggest?: TagSuggestion;
}

const tags: Record<string, Tag> = {
  ai: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setImage(
          'https://static.vecteezy.com/system/resources/previews/025/435/769/non_2x/do-not-use-ai-tools-artificial-intelegent-is-not-allowed-anti-ai-sign-no-ai-generated-content-protest-against-ai-illustration-university-school-rule-vector.jpg',
        )
        .setTitle('🚫 NO AI ZONE')
        .setDescription(
          "This server is a **NO AI** zone. AI-generated content is not allowed. That includes ChatGPT, Midjourney, DALL-E and similar tools, and it covers code, schematics, and anything else AI can generate, including requests for help with it.\n\nIf you have a question, ask the community. You learn more by working through a problem with other members than by having a tool do it for you.\n\nDo NOT use AI to reply to users. If someone is using AI for their project, do not assist.",
        )
        .setFooter({
          text: 'Help us keep this a NO AI zone.\n\nAnswering someone with AI does them no favors. It holds back their learning.',
        }),
    ],
  },

  ask: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setImage('https://i.imgur.com/QLgiMEM.jpeg')
        .setTitle('How to Ask for Help')
        .setDescription(
          "**Don't just say \"help\" or ask if you can ask a question.** Ask your question directly. To get good help:",
        )
        .addFields(
          {
            name: '1. Describe your problem clearly',
            value:
              "Explain **what your code or hardware is doing** and **what you want it to do instead**. Be specific. List your hardware, your code, and any guides you're following. If you have an error message, include it.",
          },
          {
            name: '2. Share your code',
            value:
              'Your code helps others understand the problem. Click **How to share code** below to see how to format it.',
          },
          {
            name: '3. Be patient and polite',
            value:
              'No one here is paid to help you. Take the time to write a clear question, and be respectful while you wait for an answer. Ask in ONE channel only, and have your project in front of you and time to work on it before you ask. Asking in multiple channels will not get you help faster, annoys people, and is against the server rules.',
          },
        )
        .setFooter({
          text: 'The clearer your question, the faster and better the help.',
        }),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('tag:codeblock')
          .setLabel('How to share code')
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  },

  avrdude: {
    suggest: {
      // Real AVRDUDE output names stk500/avrdude; a bare "not in sync" also
      // fired on "my servos are not in sync".
      pattern: /stk500|\bavrdude[:\s]|not in sync: resp=/i,
      prompt: 'This looks like an **AVRDUDE upload error**.',
    },
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle('Solving AVRDUDE Communication Errors (Try These in Order)')
        .setDescription(
          "The __avrdude: stk500__ ... error is very common and has many possible causes. Try these steps in order. If none of them work, ask for help in the **#general-help channel.**",
        )
        .addFields(
          {
            name: '1. Is your Serial monitor, or any 3D printer software open?',
            value:
              'If it is, close it, so the IDE can upload without a conflict. Only have one IDE open at a time, since multiple open IDEs can cause problems. Close them all before uploading, and try restarting your PC.',
          },
          {
            name: '2. Have you selected the right port in your IDE?',
            value:
              '- You may have selected something that is **not** your Arduino. Change the port in the Arduino IDE under Tools -> Port.\n' +
              '- Only have one Arduino connected to your computer at a time. *Having multiple Arduinos connected can cause issues with the IDE.*',
          },
          {
            name: '3. Have you selected the right board in your IDE?',
            value:
              "Select the right board and model in your IDE, and check that it shows up correctly in your device manager.",
          },
          {
            name: '4. Is anything connected to your Tx and Rx pins?',
            value:
              'Remove everything connected to the TX and RX pins of your board, including shields, modules, and wires. If you are using a shield, make sure it is compatible with your board.\n' +
              'If your board used to work and now does __not__, remove the shield and try again. If it works without it, the shield is probably the cause. If you are using a clone board, make sure it is compatible and that you have the correct drivers installed.',
          },
          {
            name: '5. Are your drivers installed?',
            value:
              "Check your drivers. Sometimes uninstalling them, reinstalling them, and rebooting the PC fixes it. Clone boards often use the **CH340 USB-Serial** chip, which isn't supported by default. Check the name printed on the small SMD USB-Serial chip on your board (not the big one).\n" +
              '- **[How to install CH340 drivers](https://learn.sparkfun.com/tutorials/how-to-install-ch340-drivers/all)**\n' +
              "- If you have an FTDI chip: **[how to install FTDI drivers](https://learn.sparkfun.com/tutorials/how-to-install-ftdi-drivers/all)**. If you have neither, search for the name of your board's USB-Serial chip.",
          },
          {
            name: '6. Is your cable faulty or capable of sending data?',
            value:
              "Some USB cables can't carry data (charge-only), and some are faulty. Try a different cable, or plug another device into the same cable to check that data gets through.\n" +
              'Apple computers sometimes have issues with USB adapters. Try another adapter, or an official one for your Mac.',
          },
          {
            name: '7. Is the power LED lit on your board?',
            value:
              'If it is, unplug and re-plug your board, then check for blinking LEDs. If only the Power LED or no LEDs light up, ask for further assistance (not for all boards).',
          },
          {
            name: '8. Do you have a Nano or other ATmega328P-based board?',
            value:
              'If so, try using the old bootloader. In the Arduino IDE, go to Tools → Processor and select **ATmega328P (Old Bootloader)**. This is most common on Nanos and Nano-style clones, but some other 328P-based boards expose it too. *If the Processor option appears in your Tools menu, it is worth a try; if it does not, you can skip this step.*',
          },
          {
            name: '9. Does your onboard LED blink when you press the reset button?',
            value:
              "Press the reset button on your Arduino. If the onboard LED doesn't blink, you probably have a broken bootloader. See [this tutorial](https://www.arduino.cc/en/Hacking/Bootloader?from=Tutorial.Bootloader) on how to burn the bootloader.\n\n" +
              'If it does blink, unplug the board, hold down the reset button, and plug the board back in while still holding it. After a few seconds, release the button and try uploading again. You can also hold the button down until the IDE finishes compiling and starts to UPLOAD, then release it. This "manual reset" method can help with communication issues.',
          },
          {
            name: "10. Is this a problem on your computer's side?",
            value:
              "This might be a problem on your computer's side, so try restarting your computer.",
          },
          {
            name: '11. Are you running Linux?',
            value:
              'If you are running Linux, try checking which groups you belong to by using the `groups` command, then look at which group you need to be in with `ls -l /dev/ttyACM*`, `ls -l /dev/S*` or `ls -ls /dev/USB*` (replace the `*` with your port number), then use this command: `sudo usermod -a -G <group> <username>` and add your user to the necessary groups.',
          },
          {
            name: '12. Is this a problem with your IDE?',
            value: "If you think that's the case, try reinstalling the IDE.",
          },
        ),
    ],
  },

  codeblock: {
    content:
      '```ino\n// Please right-click on this message (long-press on mobile)\n// then select "Copy Text."\n\n// After that, copy your code; then paste it in place of this comment\n```',
    botCommandsOnly: false,
  },

  debounce: {
    suggest: {
      // A button/switch with a bounce symptom nearby. The old
      // "button.*multiple" fired on "a button and multiple LEDs".
      pattern:
        /debounc|\b(button|switch)(es)?\b.{0,40}\b(bounc\w*|(registers?|counts?|triggers?|fires?|reads?|detects?|press(es|ed)?|toggles?)( as)? (multiple|several|two|2|double) (times|presses|clicks)|(registers?|counts?|triggers?|fires?|toggles?) twice|double[- ]?(triggers?|counts?|press(es)?))\b/i,
      prompt: 'This sounds like a **switch bounce** problem.',
    },
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle('Button Bounce and Debouncing')
        .setImage(
          'https://thecustomizewindows.cachefly.net/wp-content/uploads/2024/05/Read-a-Pushbutton-with-Arduino-with-Interrupts-and-Debounce.png',
        )
        .addFields(
          {
            name: 'The problem: switches bounce',
            value:
              "When you press a mechanical button or switch, the metal contacts inside don't make a single, clean connection. Instead, they 'bounce' a few times, rapidly opening and closing the circuit before settling.\n\nAn Arduino is fast enough to see these bounces as multiple separate presses.",
          },
          {
            name: 'What happens without debouncing?',
            value:
              "If you're trying to count presses or toggle an LED, you'll get erratic behavior: one physical press might register as 2, 3, or even more presses, or an LED might flicker unpredictably.",
          },
          {
            name: 'The fix: debouncing',
            value:
              'Debouncing makes sure one press registers as one action.\n\n**Common software debounce method:**\n' +
              '1. Detect an initial button press (e.g., pin goes LOW).\n' +
              '2. Wait for a short period (e.g., 20-50 milliseconds).\n' +
              '3. After the delay, check the button state again.\n' +
              "4. If it's still in the pressed state, then consider it a valid press.",
          },
          {
            name: 'Simple code logic (conceptual)',
            value:
              '```cpp\n' +
              '// Previous button state\n' +
              'bool lastButtonState = HIGH;\n' +
              'unsigned long lastDebounceTime = 0;\n' +
              'unsigned long debounceDelay = 50; // 50ms\n\n' +
              '// In your loop():\n' +
              'bool reading = digitalRead(buttonPin);\n\n' +
              'if (reading != lastButtonState) {\n' +
              '  lastDebounceTime = millis(); // Reset debounce timer\n' +
              '}\n\n' +
              'if ((millis() - lastDebounceTime) > debounceDelay) {\n' +
              '  // If current reading has been stable for longer than the delay\n' +
              '  if (reading == LOW) { // Assuming button pulls LOW when pressed\n' +
              '    // Button is considered pressed\n' +
              '    // Your action here (e.g., toggle LED, count press)\n' +
              '    // Make sure to only act on state change (e.g. if it *was* HIGH and *is now* LOW)\n' +
              '  }\n' +
              '}\n' +
              'lastButtonState = reading;\n' +
              '```\n' +
              '*Note: This is a common approach. Libraries can also simplify debouncing.*',
          },
          {
            name: 'In short',
            value:
              'If your project uses buttons, switches, or any mechanical contact to trigger an action, you almost certainly need debouncing for it to work reliably.',
          },
        ),
    ],
  },

  espcomm: {
    suggest: {
      pattern:
        /espcomm|esptool|failed to connect to esp|wrong boot mode|a fatal error occurred.*(packet|connect|timed out)/i,
      prompt: 'This looks like an **ESP upload or connection** problem.',
    },
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle(
          "Solving Your ESP Board's Communication Errors (Try These in Order)",
        )
        .addFields(
          {
            name: '1. Is your Serial Monitor open?',
            value:
              'If it is, close it, so the IDE can upload without a conflict.',
          },
          {
            name: '2. Have you selected the right port in your IDE?',
            value:
              'You may have selected something that is **not** your ESP. Change the port in the Arduino IDE under **Tools** -> **Port**.',
          },
          {
            name: '3. Have you selected the right board in your IDE?',
            value: 'You need to select the correct board and model.',
          },
          {
            name: '4. Is your Serial monitor showing gibberish?',
            value:
              'Set it to the correct baud rate (bottom right corner of the Serial Monitor). Most examples use 115200 baud.',
          },
          {
            name: '5. Is anything connected to your Tx and Rx pins?',
            value: 'If there is, try removing everything connected to them.',
          },
          {
            name: '6. Have you tried holding down the BOOT/IO0/FLASH button?',
            value:
              'Unplug the board and wait 10 seconds, then try holding down the BOOT/IO0/FLASH button. Keep holding it until **AFTER** compiling is done and the IDE says "uploading".\n\nThen release the button. This puts the board into flash mode, which can help with communication issues.\n\nOn some boards the buttons are labeled backwards, so if it has another button, try again with that one.',
          },
          {
            name: '7. Are there any problems with your wiring?',
            value:
              'Check for wiring errors or loose connections. Note: if you are using an FTDI board, the FTDI TX and RX pins must be cross-connected to the ESP TX and RX pins (TX goes to RX).',
          },
          {
            name: "8. Can't see your ESP's COM Port?",
            value:
              'This often means the USB drivers are not installed. Check the name printed on the USB chip, search for that chip to find its drivers, and install them. If you have the CP2102 chip, here are the [official drivers](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers).',
          },
          {
            name: 'Still not fixed?',
            value:
              'See these troubleshooting guides for your board: [ESP32](https://randomnerdtutorials.com/esp32-troubleshooting-guide/#:~:text=When%20you%20try%20to%20upload,button%20in%20your%20ESP32%20board), [ESP32 CAM](https://randomnerdtutorials.com/esp32-cam-troubleshooting-guide/#:~:text=If%20you%20get%20this%20exact,times%2C%20might%20solve%20the%20issue.) and [ESP8266](https://randomnerdtutorials.com/esp8266-troubleshooting-guide/).',
          },
        ),
    ],
  },

  help: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle('Bot Commands Help')
        .setDescription(
          'How to use the bot, and a list of available commands.',
        )
        .addFields(
          {
            name: 'Usage',
            value:
              'To post a tag, type `/tag` followed by the tag name. For example:\n```/tag ask```',
          },
          {
            name: 'Available Commands',
            value:
              '`ai`, `ask`, `avrdude`, `codeblock`, `debounce`, `espcomm`, `help`, `hid`, `lab`, `language`, `levelShifter`, `libmissing`, `needinfo`, `ninevolt`, `power`, `pullup`, `reinstall`, `wiki`',
          },
          {
            name: 'Contributing',
            value:
              'This bot is open source. You can contribute by submitting pull requests to our [GitHub repository](https://wiki.arduinodiscord.cc/contributing/dev_docs).',
          },
        ),
    ],
  },

  hid: {
    suggest: {
      // A bare "hid" matched "I hid the wires"; require USB/HID context.
      pattern:
        /\busb[\s-]?hid\b|\bhid[\s-](device|keyboard|mouse|gamepad|joystick|library|compliant|support|mode)s?\b|\b(as an?|arduino|leonardo|pro ?micro|32u4) hid\b|\b(hid|keyboard|mouse)\.h\b|\bemulat(e|es|ing|ion of) (an? )?(usb )?(keyboard|mouse|gamepad)\b|\b(act|acts|acting|work|show up|appear|be (used|recognized|detected)) as an? (usb )?(keyboard|mouse|gamepad)\b/i,
      prompt: 'This looks like a **USB HID (keyboard/mouse)** question. Not every board can do this.',
    },
    embeds: [
      new EmbedBuilder({ ...universalEmbed })
        .setTitle('Can Your Arduino Be Used as a Keyboard or Mouse?')
        .setDescription(
          'Which boards can act as a Human Interface Device (HID), such as a keyboard or mouse.',
        )
        .addFields(
          {
            name: 'Boards that are __NOT__ HID compliant',
            value:
              'Uno (R3 or older), Mega, Nano (328), and Pro Mini cannot be used as HID devices. Attempting to do so will result in a bricked board.',
          },
          {
            name: 'Boards that __ARE__ HID compliant',
            value:
              'Many Arduino boards can act as a mouse or keyboard natively. This is called HID.\n\n' +
              'Uno R4, Giga, RP2040, Leonardo, (Pro)Micro, any other 8u2/16u2/at90usb8/162/32u2/32u4 board, Zero and MKR1000 can all be used as HID devices.',
          },
          {
            name: 'I have seen people use the Uno R3 as a HID device, how is that possible?',
            value:
              'The Uno R3 can be used as a HID device, but it requires a special bootloader to be flashed onto the board. This is **not recommended**. Use a board that is already HID compliant instead. __We do not help with this, or with recovering a board it has already been done to. It usually ends in an unusable board and wasted time.__',
          },
        ),
    ],
  },

  lab: {
    embeds: [
      new EmbedBuilder({ ...universalEmbed })
        .setTitle('What Should I Get for My Lab?')
        .setDescription(
          'Recommendations for the essential tools and supplies in an electronics lab.',
        )
        .addFields(
          {
            name: 'Essential Lab Equipment',
            value:
              "For details on multimeters, oscilloscopes, power supplies, components, and soldering supplies, see the server's wiki.",
          },
          {
            name: 'Wiki Link',
            value:
              '[Lab Supplies section of the wiki](https://wiki.arduinodiscord.cc/gettingStarted/lab-supplies)',
          },
        ),
    ],
  },

  language: {
    embeds: [
      new EmbedBuilder({ ...universalEmbed })
        .setTitle(
          'What Coding Language Does Arduino IDE Use? What Language Should You Learn?',
        )
        .addFields({
          name: 'Arduino IDE code is normally C++14',
          value:
            'The Arduino IDE mainly uses **C++14**, plus some added functions for the Arduino platform, listed at https://www.arduino.cc/reference/en/. MicroPython and other Python variants are sometimes used, but very few boards support them and their library selection is small. Their community, examples, and tutorials are also very limited, so they are rarely used in this community and never used in real-world **commercial or industrial** applications. Help for them is hard to find, so we do not recommend them unless you already know them and have a specific reason to use them. If possible, learn C++14. It is the most widely used language in the Arduino community and is also used in many other areas, such as game development, web development, and more.',
        }),
    ],
  },

  levelShifter: {
    suggest: {
      // A bare "logic level" also covers logic-level MOSFETs, and "3.3V to 5V"
      // is often a power question, so require a signal/pin context.
      pattern:
        /level[\s-]?shift|logic[- ]?level (shift|convert|translat)|\b5\s?v[\s-]tolerant\b|(3\.3\s?v?\s*(to|->|→)\s*5\s?v|5\s?v?\s*(to|->|→)\s*3\.3\s?v)\b.{0,40}\b(logic|signals?|pins?|gpio|rx|tx|sda|scl|spi|i2c|uart|serial|data)\b|\b(logic|signals?|pins?|gpio|rx|tx|sda|scl|spi|i2c|uart|serial|data)\b.{0,40}(3\.3\s?v?\s*(to|->|→)\s*5\s?v|5\s?v?\s*(to|->|→)\s*3\.3\s?v)\b/i,
      prompt: 'This sounds like a **3.3V / 5V logic level** question.',
    },
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle('Logic Level Shifters: Protecting Your 3.3V Modules')
        .addFields(
          {
            name: 'The Problem: Voltage Mismatch',
            value:
              "Many popular Arduino boards, like the Uno and Mega, operate at **5 volts (5V)**. Their digital pins use 5V for a 'HIGH' signal, and they expect 5V in return: **3.3V will not be recognized**.\n\nMany modern modules and sensors (like the NRF24L01, ESP8266, and SD cards) are designed for **3.3 volts (3.3V)**. Their **input or GPIO** pins are often **NOT 5V tolerant**, and they can **NOT reliably send 5V to devices** either.\n\nThe two sides cannot communicate reliably. https://wiki.arduinodiscord.cc/hardwareGuides/logiclevel",
          },
          {
            name: 'What Happens if You Connect 5V to a 3.3V Pin?',
            value:
              "Sending a 5V signal directly to a 3.3V input pin on a module applies more voltage than the pin is rated for.\n\n**Consequences:**\n" +
              '- **Immediate Damage:** The module might be instantly destroyed.\n' +
              '- **Reduced Lifespan:** The module might work for a while, but the over-voltage stresses the internal components, leading to premature failure.\n' +
              '- **Unreliable Operation:** Your project might behave erratically or work intermittently before failing completely.',
          },
          {
            name: 'The Solution: Logic Level Shifter (LLS)',
            value:
              "A logic level shifter is a small, cheap board that translates signals between your 5V Arduino and your 3.3V module.\n\n" +
              ' https://www.amazon.com/SparkFun-12009-Logic-Converter-Bi-Directional/dp/B088FYQJYZ?',
          },
          {
            name: 'Common Modules Requiring 3.3V Logic (and often a Shifter with 5V Arduinos)',
            value:
              '- **NRF24L01 / NRF24L01+** (Wireless Transceiver)\n' +
              '- **ESP8266 and ESP32 (e.g., ESP-01)** (Wi-Fi Module)\n' +
              '- **Cellular Modules (e.g., SIM800L, A6/A7 GSM/GPRS)**\n' +
              '- **Many newer Sensors & Displays** (e.g., some TFTs, OLEDs, BME280/BMP280)\n\n' +
              "**Always check the module's datasheet for its VCC (power) and logic level specifications!**",
          },
          {
            name: '⚠️ "But I saw a video/tutorial where it worked without one!"',
            value:
              'You might find examples online where people connect 3.3V modules directly to 5V Arduinos, and it *appears* to work. **This is bad practice and risky.**\n\n' +
              '**Why it might *seem* to work (temporarily):**\n' +
              '1.  **Short-term tolerance:** Some chips might tolerate over-voltage for a short period before failing.\n' +
              '2.  **Input protection diodes:** Some chips have internal diodes that try to clamp excess voltage, but these are not designed for continuous operation outside specified limits and will eventually burn out.\n' +
              "3.  **Luck:** Sometimes, it just hasn't failed *yet*.\n\n" +
              '**Do not rely on this.** Your project might work during testing and then fail unpredictably later. It shortens the life of your module and is not a reliable engineering approach.',
          },
        ),
    ],
  },

  libmissing: {
    suggest: {
      // Header errors only: a bare "No such file or directory" is usually a
      // serial port path (/dev/ttyUSB0), not a missing library.
      pattern:
        /\.h(pp)?['"]?:? no such file|fatal error: [\w./-]+\.h(pp)?\b|\blibrary\b.{0,30}\b(not found|is not installed|not installed)\b/i,
      prompt: 'This looks like a **missing library or header** error.',
    },
    embeds: [
      new EmbedBuilder({ ...universalEmbed })
        .setTitle('Solving Library Errors (Such as "yourlib.h not found")')
        .addFields(
          {
            name: '1. Is your library installed?',
            value:
              'Go to the **Library Manager** (Sketch -> Include Library -> Manage Libraries), search for the library, and install it. If it is already installed, try reinstalling it through the **Library Manager**. Make sure your working directory is not a cloud folder like **ONEDRIVE** or **DROPBOX**. If it is, *reinstall* to a local drive on your computer.',
          },
          {
            name: '2. Is your `#include` statement spelled correctly?',
            value:
              'Check the capitalization too. Also, there is a difference in the way you include libraries: if you are using a library that is not in the Library Manager, you need to use `#include <yourlib.h>` instead of `#include "yourlib.h"`.',
          },
          {
            name: '3. Did you download it manually?',
            value:
              "If you downloaded it from GitHub or elsewhere as a zip file, do not open the zip. Instead, open the IDE, go to Libraries -> Install from ZIP, select the zip file and install it. Then close all open IDEs, wait 20 seconds, open the IDE again, and check that the library is listed under Libraries.",
          },
          {
            name: '4. Are you using the correct board?',
            value:
              'Some libraries are only compatible with certain boards. Make sure you have selected the correct board in **Tools** -> **Board**.',
          },
          {
            name: "Still can't fix it?",
            value:
              'See [this Arduino forum post](https://forum.arduino.cc/t/no-headers-files-h-found/596090#:~:text=This%20might%20be%20result%20from,one%20of%20the%20libraries%20folders.) for more assistance.',
          },
        ),
    ],
  },

  needinfo: {
    content: (user?: string) =>
      `${user ? `<@${user}>\n` : ''}**We need more information to help you.**\n\n` +
      'Please provide the following:\n\n' +
      '1. **A real photo of your actual project/board** (not a stock image).\n' +
      '2. **A wiring diagram** of your circuit (hand-drawn is fine if clear).\n' +
      '3. **A list of all parts** you are using, including:\n' +
      '   - Which parts are working\n' +
      '   - Which parts are NOT working\n' +
      '4. **What you have tried so far** to fix the issue.\n' +
      '5. **Links to any resources** you are following (websites, tutorials, datasheets, etc.).\n' +
      '6. **Links to the exact components** you are using (product pages, datasheets).\n' +
      '7. **Your code** (if relevant), shared as a file or using code blocks.\n' +
      '8. **Any error messages** you are seeing.\n' +
      '9. **If your question is about power or battery life:**\n' +
      '   - List how much current each part uses\n' +
      '   - Include all relevant data and calculations\n' +
      '10. **(Optional but helpful)**: Short video or more photos showing the problem in action.\n\n' +
      'Example:\n' +
      '> Hello, I am working on a line-following robot. Here is a link to my kit: www... and my sensors: www... I am following this tutorial: www... The issue is the bot always turns left or stops; it will NOT turn right or go straight. Here is my wiring diagram, photos of my board and robot, and a video of the problem. Please let me know if you need anything else.\n\n' +
      'The more detail you give, the faster and better we can help.',
    botCommandsOnly: false,
  },

  ninevolt: {
    suggest: {
      // Keep "9V" and "battery" adjacent; ".*" matched "9V adapter ... AA batteries".
      pattern:
        /\b9\s?-?v(olt)?s?\b[\s-]{0,3}(batter|cell|pp3)|\bbatter(y|ies)\s*\(?\s*9\s?v(olt)?\b|\bpp3 batter|smoke (alarm|detector) batter/i,
      prompt: '**9V batteries** are a poor power source for most projects.',
    },
    embeds: [
      new EmbedBuilder({ ...universalEmbed })
        .setTitle('Are 9V Batteries Useful?')
        .setDescription('Not very.')
        .addFields({
          name: 'Dies quickly',
          value:
            '9V batteries are not very useful for powering Arduinos or other electronics. They have low capacity and die quickly, in 15 minutes or less when powering an Arduino. They do not have enough power to drive motors or servos. They are rarely useful in Arduino projects and are not recommended, even though many kits include them. https://odysee.com/@Maderdash:2/9vBattery:0',
        }),
    ],
  },

  power: {
    suggest: {
      // "voltage drop" alone fired on LED/resistor maths and "how to power the"
      // on anything; require a board or load being powered.
      pattern:
        /brown[\s-]?out|not enough (power|current)|voltage (drops|dropping|sags?|sagging) (when|whenever|once|as soon as)|how (do i|to|should i|can i|would i) power (my|the|an?) (board|arduino|esp\w*|nano|uno|mega|project|servos?|motors?)\b|powering (my|the|an?) (board|arduino|esp\w*|nano|uno|mega)\b/i,
      prompt: 'This looks like a question about **powering your board**.',
    },
    embeds: [
      new EmbedBuilder({ ...universalEmbed })
        .setTitle('Powering an Arduino')
        .addFields(
          {
            name: '1. How much power can an Arduino provide?',
            value:
              'Most PC USB ports are limited to 500mA. The Arduino has a fuse on the board to help protect your PC and the Arduino from shorts. This is limited to 400mA. If you try to draw more current than this, the fuse will get hot and stop the short.',
          },
          {
            name: '2. How much power can each pin of the Arduino provide?',
            value:
              'Each pin of the Arduino **UNO** is rated for 20mA (*other Arduinos are less*). In many cases, if you do not provide a resistor to the circuit on a pin, you can damage the Arduino. We use resistors for LEDs or any other component that can draw more than 20mA. **Motors should never be driven directly off the Arduino pins**, no matter how small they are or what you have seen others do. This risks damaging your Arduino or your PC in some cases.',
          },
          {
            name: '3. Powering the Arduino properly',
            value:
              'Most Arduino boards have a pin marked **VIN** (Voltage Input). You can supply up to your board\'s maximum rated voltage on this pin. An UNO accepts 7-12V. The voltage regulator needs around 2V more than its output: 5V plus 2V of overhead = 7V or more. The more voltage you supply to this pin, the less current you can get out of the board. For example, at 7V you can get 400mA out of the regulator; at 12V, 100mA. 24V might overheat the regulator with just the board itself. If you have a regulated 5V power supply, you can sometimes use the 5V pin to power the Arduino. You should **NOT** connect batteries to the 5V or 3.3V pins. You can also power Arduinos via USB, which is connected directly to the 5V pin on the board, or the barrel jack, which is connected directly to the VIN pin on some boards.',
          },
          {
            name: '4. The 3.3V pin',
            value:
              "The 3.3V pin on the UNO is designed to output 50mA. It is mostly used so the Arduino can communicate with the PC and is used as a reference for the Arduino itself. Normally, it's safe to use up to 30mA from this pin. Trying to use **more** than this amount from this pin will usually cause communication issues with the PC and will cause power outages for the device that is trying to be powered from the pin. So, things like ESP32s, wireless modules, and cell phone modules, etc., **cannot** be powered from this pin.",
          },
          {
            name: '5. Max output from the IC',
            value:
              "Although there is a max value the regulator can output (say 400mA), this does **not** mean you have full access to that value. The Arduino UNO will use about 50mA of that, and that 400mA is if you are supplying 6.8V. If you supply 9V, then you only have around 300mA; if you supply 12V, then you will only have around 150mA. Keep this in mind as you work on your project. Along with this, the MCU that you're using has a max output also. For example, the UNO 328 IC can output 20mA per pin. It has 19 pins, so that should be 380mA. However, this is not correct either, as the max it can source is 200mA. So, it is very important to read the datasheets of anything you're working with to **avoid causing issues with your devices**.",
          },
        ),
    ],
  },

  pullup: {
    suggest: {
      // "pull up" alone fired on "let me pull up the datasheet" and "pull-down
      // menu", and "button.*random" on "a button that picks a random number";
      // require resistor/pin context.
      pattern:
        /\bpull[\s-]?(up|down)s? resistors?\b|\b(internal|external|weak) pull[\s-]?(up|down)s?\b|\bpulled (up|down) (to|with) (vcc|gnd|ground|5\s?v|3\.3\s?v)\b|\bfloating (pin|input)s?\b|\b(pin|input) (is|keeps|was) floating\b|\b(button|switch|pin|input)\b.{0,40}\b(randomly (triggers?|reads?|changes?|toggles?|goes|flickers?)|reads? (randomly|random values|high and low))\b|\bghost (presses|triggers)\b/i,
      prompt: 'This sounds like a **pull-up / floating input** issue.',
    },
    embeds: [
      new EmbedBuilder({ ...universalEmbed })
        .setTitle('What does pull-up (or pull-down) mean, and how do I use it?')
        .addFields(
          {
            name: 'Pins used as INPUT should not be left unconnected (floating).',
            value:
              'This can lead to undesired behavior. If input pins are connected to digital sensors, the sensor itself usually keeps the pin either **HIGH** or **LOW**.',
          },
          {
            name: 'Pins used with switches (pushbuttons or others) should use a resistor to "pull" the pin HIGH or LOW.',
            value:
              'If the pin is connected to **Vcc** through a resistor, it is said to be "pulled up." If the pin goes to ground through a resistor, it is said to be "pulled down." When a resistor is used this way, the input is held at either Vcc or ground when the switch is not closed, so that it is never "floating." Pins that are pulled down are normally **LOW** and go **HIGH** when the switch (wired to Vcc) is closed. Pins that are pulled up are normally **HIGH** and go **LOW** when the switch (wired to ground) is closed. (The resistor, often 10KΩ, allows only a small current to flow from Vcc to ground when the switch is closed. If the pin was tied directly to a power rail, closing the switch would short out the power supply!)',
          },
          {
            name: "Many chips include internal resistors, so an external resistor doesn't need to be added to your circuit.",
            value:
              'On the ATmega328P chips used on many Arduino boards, you can pull up the pin by using `pinMode(pin, INPUT_PULLUP)`. If the pin is declared this way, it is normally **HIGH**, and all that is needed is a switch wired from the pin to ground. When the switch is closed, the pin will go **LOW**. The example below shows pin 2 set up this way.',
          },
        )
        .setImage(
          'https://www.arduino.cc/wiki/static/f7e18e95df4a8d274fc9129fa60eb428/928ea/PullUp.png',
        ),
    ],
  },

  reinstall: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle('How to Reinstall the Arduino IDE')
        .setDescription(
          'A clean reinstall of the Arduino IDE often fixes unexpected problems. Follow these steps to do a complete reinstall.',
        )
        .addFields(
          {
            name: '1. Download the latest version',
            value:
              'First, download the latest official Arduino IDE from the [Arduino website](https://www.arduino.cc/en/Main/Software) so you have the installer ready.',
          },
          {
            name: '2. Uninstall the current version',
            value:
              "Use your operating system's standard procedure to uninstall the Arduino IDE. This usually means 'Add or remove programs' on Windows or dragging the application to the Trash on macOS.",
          },
          {
            name: '3. Remove old configuration files',
            value:
              'This removes any corrupted settings. **Please back up any custom files or sketches you have saved in these folders before deleting.**\n\n' +
              '**Windows:**\n' +
              '• `%LOCALAPPDATA%\\Arduino15`\n' +
              '• `%USERPROFILE%\\Documents\\Arduino\\libraries` (optional, for a completely clean library state)\n' +
              '• `C:\\Users\\<username>\\AppData\\Local\\Programs\\Arduino IDE`\n\n' +
              '**macOS:**\n' +
              '• `~/Library/Arduino15`\n' +
              '• `~/Documents/Arduino/libraries` (optional)\n\n' +
              '**Linux:**\n' +
              '• `~/.arduino15`\n' +
              '• `~/Arduino/libraries` (optional)',
          },
          {
            name: '4. Install the new version',
            value:
              'Run the installer you downloaded in step 1 and follow the on-screen instructions. **NOTE:** *Do NOT install it to a cloud storage location like Google Drive or Dropbox.*',
          },
          {
            name: '5. Check the installation',
            value:
              'Open the Arduino IDE and make sure it starts correctly. You may need to reinstall your boards and libraries through the Boards Manager and Library Manager.',
          },
        ),
    ],
  },

  wiki: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle('The Arduino Discord Wiki')
        .setDescription(
          'Our community wiki covers Arduino basics and has tutorials.',
        )
        .addFields(
          {
            name: 'What you can find on the wiki:',
            value:
              '• How to merge sketches\n' +
              '• Calculating resistor values for LEDs\n' +
              '• Breadboard and jumper wire basics\n' +
              '• Using `millis()` instead of `delay()`\n' +
              '• Debouncing buttons\n' +
              '• And more',
          },
          {
            name: 'Visit the Wiki',
            value:
              '[Open the wiki](https://wiki.arduinodiscord.cc/)',
          },
        ),
    ],
  },

  // Example restricted tag (uncomment and edit as needed)
  // restrictedtag: {
  //   content: "This is a restricted tag.",
  //   requiredRoles: ['Admin', 'Moderator'], // Role names or IDs
  // },
};

export default tags;
