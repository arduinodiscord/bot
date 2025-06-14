import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import universalEmbed from "../index";

export default {
  ask: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setImage("https://i.imgur.com/QLgiMEM.jpeg")
        .setTitle("💡 How to Ask for Help Effectively 💡")
        .setDescription(
          "When you need help, **don't just ask HELP, or ask if you can ask a question**—just ask your question directly! Here's how to get the best help:"
        )
        .addFields(
          {
            name: "1️⃣ Describe Your Problem Clearly",
            value: "Explain **what your code or hardware is doing** and **what you want it to do instead**. Be as specific as possible. List hardware code and any sources that you're using. If you have an error message, include it in your question.",
          },
          {
            name: "2️⃣ Share Your Code",
            value: "Sharing your code helps others understand your issue. Click the **\"Codeblock\"** button below to learn how to format and share your code properly.",
          },
          {
            name: "3️⃣ Be Patient and Polite",
            value: "Remember, no one here is paid to help you. Take the time to write a clear question, and be respectful while waiting for a response. Only ask for help in ONE channel. Asking in multiple channels will not get you help faster and will only annoy people, and is against server rules.",
          }
        )
        .setFooter({
          text: "The clearer your question, the faster and better the help you'll receive!",
        }
      ),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("codeblock")
          .setLabel("Learn How to Share Code")
          .setStyle(ButtonStyle.Primary)
      ),
    ],
  },

  avrdude: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle("Solving AVRDUDE Communication Errors (Try These in Order)")
        .addFields(
          {
            name: "1. Is your Serial monitor open?",
            value: "If it is, close it. This allows your IDE to upload sketches without conflicts with the Serial Monitor."

          },
          {
            name: "2. Have you selected the right port in your IDE?",
            value: "You could have selected something that is **not** your Arduino. Change the port in the Arduino IDE by going into Tools -> Port. Only have one Arduino connected to your computer at a time, as having multiple Arduinos connected can cause issues with the IDE."

          },
          {
            name: "3. Have you selected the right board in your IDE?",
            value: "You need to select the right board and model."

          },
          {
            name: "4. Is anything connected to your Tx and Rx pins?",
            value: "If there is, try removing everything connected to them."

          },
          {
            name: "5. Are your drivers installed?",
            value: "Check your drivers, sometimes just reinstalling them works. If you are using a clone board, you might have the **CH340 USB-Serial** chip, which isn't supported by default. You can check by looking at your board and checking the SMD USB-Serial chip's name (not the big one). **[Click here](https://learn.sparkfun.com/tutorials/how-to-install-ch340-drivers/all)** to learn how to install CH340 Drivers. If you have an FTDI chip, **[This website](https://learn.sparkfun.com/tutorials/how-to-install-ftdi-drivers/all)** will show you how to install their drivers. If you don't have either, we recommend googling the USB-Serial chip that your board uses."

          },
          {
            name: "6. Is your cable faulty or capable of sending data?",
            value: "Some USB cables aren't capable of transferring data, and some may be faulty, so make sure to try a different one to see if it works! APPLE computers sometimes have issues with USB cables, so if you are using an Apple computer, try a different cable, or another adapter for your MAC."
          },
          {
            name: "7. Does the power LED light up on your board?",
            value: "If it does, unplug and re-plug your board, then check for blinking LEDs. If only the Power LED or no LEDs light up, ask for further assistance (not for all boards)."

          },
          {
            name: "8. Do you have a Nano or other Atmega 328p-based board?",
            value: "If so, try using the old bootloader. In the Arduino IDE, go to Tools -> Processor and select 328p (old bootloader). If your board doesn't have an Atmega 328p, you can skip this step."

          },
          {
            name: "9. Does your onboard LED blink when you press the reset button?",
            value: "Try pressing the reset button on your Arduino. If the onboard LED doesn't blink when you reset, you probably have a broken bootloader. You can check out [this tutorial](https://www.arduino.cc/en/Hacking/Bootloader?from=Tutorial.Bootloader) on how to burn the bootloader."
          },
          {
            name: "10. Is this a problem on your computer's side?",
            value: "This might be a problem on your computer's side, so try restarting your computer."

          },
          {
            name: "11. Are you running Linux?",
            value: "If you are running Linux, try checking which groups you belong to by using the `groups` command, then look at which group you need to be in with `ls -l /dev/ttyACM*`, `ls -l /dev/S*` or `ls -ls /dev/USB*` (replace the `*` with your port number), then use this command: `sudo usermod -a -G <group> <username>` and add your user to the necessary groups."

          },
          {
            name: "12. Is this a problem with your IDE?",
            value: "If you think that's the case, try reinstalling the IDE."

          }
        ),
    ],
  },

  codeblock: {
    content: "```ino\n// Please right-click on this message (long-press on mobile)\n// then select \"Copy Text.\"\n\n// After that, copy your code; then paste it in place of this comment\n```",
  },

  espcomm: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle("Solving Your ESP Board's Communication Errors (Try These in Order)")
        .addFields(
          {
            name: "1. Is your Serial monitor open?",
            value: "If it is, close it. This allows your IDE to upload sketches without conflicts with the Serial Monitor."
          },
          {
            name: "2. Have you selected the right port in your IDE?",
            value: "You could have selected something that is **not** your ESP. Change the port in the Arduino IDE by going into Tools -> Port."
          },
          {
            name: "3. Have you selected the right board in your IDE?",
            value: "You need to select the right board and model."
          },
          {
            name: "4. Is your Serial monitor showing gibberish?", value: "Try setting it to the correct baud rate (At the bottom right corner of the Serial monitor). Most examples use 115200 baud."
          },
          {
            name: "5. Is anything connected to your Tx and Rx pins?",
            value: "If there is, try removing everything connected to them."
          },
          {
            name: "6. Have you tried holding down the BOOT/IO0/FLASH button?",
            value: "Try holding down the BOOT/IO0/FLASH button before uploading."
          },
          {
            name: "7. Are there any problems with your wiring?",
            value: "Check if there are any wiring errors or loose connections (Note: if you are using an FTDI Board, FTDI TX and RX pins must be cross-connected with the ESP Tx and Rx pins (TX goes to RX))."
          },
          {
            name: "8. Can't see your ESP's COM Port?",
            value: "This often means you don’t have the USB drivers installed. Take a closer look at the USB chip and check its name. Go to Google and search for your particular chip to find the drivers and install them in your operating system. If you have the CP2102 chip, here are the [official drivers](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)."
          },
          {
            name: "Still not fixed?",
            value: "Check out these troubleshooting guides for your respective boards: [ESP32](https://randomnerdtutorials.com/esp32-troubleshooting-guide/#:~:text=When%20you%20try%20to%20upload,button%20in%20your%20ESP32%20board), [ESP32 CAM](https://randomnerdtutorials.com/esp32-cam-troubleshooting-guide/#:~:text=If%20you%20get%20this%20exact,times%2C%20might%20solve%20the%20issue.) and [ESP8266](https://randomnerdtutorials.com/esp8266-troubleshooting-guide/)."
          }
        ),
    ],
  },

  hid: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle("Can your Arduino be used as a keyboard or mouse?")
        .addFields(
          {
            name: "You want to use your Arduino for a Human Interface Device? HID",
            value: "Arduino has many boards that can be used as a mouse/keyboard natively. This is referred to as HID."
          },
          {
            name: "Boards that are __NOT__ HID compliant",
            value: "Uno (R3 or older), Mega, Nano(328), Pro Mini, cannot be used as a HID device."
          },
          {
            name: "Boards that __ARE__ HID compliant",
            value: "Uno R4, Giga, RP2040, Leonardo, (Pro)Micro, any other 8u2/16u2/at90usb8/162/32u2/32u4 board, Zero, MKR1000."
          },
          {
            name: "I have seen people use the Uno R3 as a HID device, how is that possible?",
            value: "The Uno R3 can be used as a HID device, but it requires a special bootloader to be flashed onto the board. This is not recommended for beginners, and it is better to use a board that is already HID compliant. Also we do not recommend using the Uno R3 as a HID device, as it is not designed for that purpose and can cause issues with your computer. We do not help with this as it normaly ends up in a unusable device and is rarly usefull."
          }
        )
    ]
  },

  language: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle("What coding language does Arduino IDE use? What language should you learn?")
        .addFields(
          {
            name: "Arduino IDE code is normally C++14",
            value: "The language most often used in Arduino IDE for programming is primarily **C++14**. There are some added functions that are very useful for using the Arduino platform. They can be found at https://www.arduino.cc/reference/en/. MicroPython and other Python types are sometimes used; however, they are extremely limited in both the boards that support them and the library selection that is offered. Also, the community, examples, and tutorials are extremely limited, so they are rarely used in this community and never used in real-world **commercial or industrial** applications. Finding help for them is also very difficult, so we do not recommend using them unless you are already familiar with them and have a specific reason to use them. If possable, we recommend learning C++14, as it is the most widely used language in the Arduino community and is also used in many other applications, such as game development, web development, and more.",
          }
        )
    ]
  },

  libmissing: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle('Solving library errors (such as "yourlib.h not found")')
        .addFields(
          {
            name: "1. Is your library installed?",
            value: "Go to the **Library Manager** (Sketch -> Include Library -> Manage Libraries), search for the library, and install it. If it is already installed, try reinstalling it through the Library Manager."
          },
          {
            name: "2. Is your `#include` statement spelled correctly?",
            value: "Check for any capitalization errors as well! Also there is a difference in the way you include libraries: if you are using a library that is not in the Library Manager, you need to use `#include <yourlib.h>` instead of `#include \"yourlib.h\"`."
          },
          {
            name: "3. Did you download it manually?",
            value: "If you downloaded it from GitHub or somewhere else and it came as a zip file, do not open the zip. Instead, open the IDE, go to Libraries -> Install from ZIP, then point to the zip folder and install. Then close all IDEs you have open, wait 20 seconds, then open the IDE, go to Libraries and see if it's now listed there. It should be."
          },
          {
            name: "4. #include <yourlib.h> vs #include \"yourlib.h\"",
            value: "If you are using a library that is not in the Library Manager, you need to use `#include \"yourlib.h\"` instead of `#include <yourlib.h>`. The first one is used for libraries that are not in the Library Manager, while the second one is used for libraries that are installed in the Library Manager."
          },
          {
            name: "Still can't fix it?",
            value: "Check out [this Arduino forum post](https://forum.arduino.cc/t/no-headers-files-h-found/596090#:~:text=This%20might%20be%20result%20from,one%20of%20the%20libraries%20folders.) for more assistance."
          }
        )
    ]
  },

  power: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle("Powering an Arduino")
        .addFields(
          {
            name: "1. How much power can an Arduino provide?",
            value: "Most PC USB ports are limited to 500mA. The Arduino has a fuse on the board to help protect your PC and the Arduino from shorts. This is limited to 400mA. If you try to draw more current than this, the fuse will get hot and stop the short."
          },
          {
            name: "2. How much power can each pin of the Arduino provide?",
            value: "Each pin of the Arduino **UNO** is rated for 20mA (*other Arduinos are less*). In many cases, if you do not provide a resistor to the circuit on a pin, you can damage the Arduino. We use resistors for LEDs or any other component that can draw more than 20mA. **Motors should never be driven directly off the Arduino pins**, no matter how small they are or what you have seen others do. This risks damaging your Arduino or your PC in some cases.",
          },
          {
            name: "3. Powering the Arduino properly",
            value: "On most Arduino boards, there will be a pin marked **VIN**. This stands for Voltage Input. You can provide the maximum power rating for your board on this pin. An UNO will accept 7-12V. If you have a regulated 5-volt power supply, you can sometimes use the 5V pin to power the Arduino. You should **NOT** connect batteries to the 5V or 3.3V pins. You can also power Arduinos via USB plugs or the barrel jack on some boards."
          },
          {
            name: "4. The 3.3V pin",
            value: "The 3.3V pin on the UNO is designed to output 50mA. It is mostly used so the Arduino can communicate to the PC and is used as a reference for the Arduino itself. Normally, it's safe to use up to 30mA from this pin. Trying to use **more** than this amount from this pin will usually cause communication issues to the PC, and will cause power outages for the device that is trying to be powered from the pin. So things like ESP32s, wireless modules, and cellphone modules, etc., **cannot** be powered from this pin.",
          },
          {
            name: "5. Max output from the IC",
            value: "Although there is a max value the regulator can output (say 400mA), this does **not** mean you have full access to that value. The Arduino UNO will use about 50mA of that, and that 400mA is if you are supplying 6.8V. If you supply 9V, then you only have around 300mA; if you supply 12V, then you will only have around 150mA. Keep this in mind as you work on your project. Along with this, the MCU that you're using has a max output also. For example, the UNO 328 IC can output 20mA per pin. It has 19 pins, so that should be 380mA. However, this is not correct either, as the max it can source is 200mA. So it is very important to read the datasheets of anything you're working with to **avoid causing issues with your devices**.",
          }
        )
    ]
  },

  pullup: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle("What does pull-up (or pull-down) mean, and how do I use it?")
        .addFields(
          {
            name: "Pins used as INPUT should not be left unconnected (floating).",
            value: "This can lead to undesired behavior. If input pins are connected to digital sensors, the sensor itself usually keeps the pin either **HIGH** or **LOW**."
          },
          {
            name: "Pins used with switches (pushbuttons or others) should use a resistor to 'pull' the pin HIGH or LOW.",
            value: "If the pin is connected to **Vcc** through a resistor, it is said to be 'pulled up'. If the pin goes to ground through a resistor, it is said to be 'pulled down'. When a resistor is used this way, the input is held at either Vcc or ground when the switch is not closed, so that it is never 'floating'. Pins that are pulled down are normally **LOW** and go **HIGH** when the switch (wired to Vcc) is closed. Pins that are pulled up are normally **HIGH** and go **LOW** when the switch (wired to ground) is closed. (The resistor, often 10KΩ, allows only a small current to flow from Vcc to ground when the switch is closed. If the pin was tied directly to a power rail, closing the switch would short out the power supply!)"
          },
          {
            name: "Many chips include internal resistors, so an external resistor doesn't need to be added to your circuit.",
            value: "On the ATmega328P chips used on many Arduino boards, you can pull up the pin by using `pinMode(pin, INPUT_PULLUP)`. If the pin is declared this way, it is normally **HIGH**, and all that is needed is a switch wired from the pin to ground. When the switch is closed, the pin will go **LOW**. The example below shows pin 2 set up this way."
          }
        )
        .setImage("https://www.arduino.cc/wiki/static/f7e18e95df4a8d274fc9129fa60eb428/928ea/PullUp.png")
    ]
  },
  levelShifter: {
    embeds: [
      new EmbedBuilder(universalEmbed)
      .setTitle("Logic Level Shifters: Protecting Your 3.3V Modules")
      .addFields(
        {
          name: "The Problem: Voltage Mismatch",
          value: "Many popular Arduino boards like the Uno and Mega operate at **5 Volts (5V)**. This means their digital pins send out 5V for a 'HIGH' signal.\n\nHowever, a lot of modern modules and sensors (like the NRF24L01, ESP8266, SD cards) are designed to operate at **3.3 Volts (3.3V)**. Their input pins are often **NOT 5V tolerant**. https://wiki.arduinodiscord.cc/hardwareGuides/logiclevel"
        },
        {
          name: "What Happens if You Connect 5V to a 3.3V Pin?",
          value: "Sending a 5V signal directly to a 3.3V input pin on a module is like shouting too loudly into someone's sensitive ear. You're applying excessive voltage.\n\n**Consequences:**\n" +
          "- **Immediate Damage:** The module might be instantly destroyed.\n" +
          "- **Reduced Lifespan:** The module might work for a while, but the over-voltage stresses the internal components, leading to premature failure.\n" +
          "- **Unreliable Operation:** Your project might behave erratically or work intermittently before failing completely."
        },
        {
          name: "The Solution: Logic Level Shifter (LLS)",
          value: "A Logic Level Shifter is a small, inexpensive board that acts as a 'voltage translator' between your 5V Arduino and your 3.3V module.\n\n" +
          "It safely steps down the 5V signals from the Arduino to 3.3V for the module's inputs. Most bi-directional shifters also step up 3.3V signals from the module to 5V for the Arduino's inputs, though 3.3V is often high enough to be read as a 'HIGH' by a 5V Arduino. Some times the arduino might not be able to hear such a small signal and it would end up not reciving the data from the module, so it is best to use a bi-directional level shifter for both directions.\n\n" +
          "**Note:** Not all modules require a level shifter, but many do. Always check the module's datasheet for its voltage requirements."
        },
        {
          name: "Common Modules Requiring 3.3V Logic (and often a Shifter with 5V Arduinos)",
          value: "- **NRF24L01 / NRF24L01+** (Wireless Transceiver)\n" +
          "- **ESP8266 (e.g., ESP-01)** (Wi-Fi Module)\n" +
          "- **ESP32** (Wi-Fi & Bluetooth MCU - its pins are 3.3V logic)\n" +
          "- **Many SD Card Modules** (especially microSD breakout boards)\n" +
          "- **Cellular Modules (e.g., SIM800L, A6/A7 GSM/GPRS)**\n" +
              "- **Some Accelerometers/Gyroscopes (e.g., MPU6050 - *check specific breakout board, some have on-board regulators/shifters, many don't for logic lines*)\n" +
              "- **Many newer Sensors & Displays** (e.g., some TFTs, OLEDs, BME280/BMP280)\n\n" +
              "**Always check the module's datasheet for its VCC (power) and logic level specifications!**"
          },
          {
            name: "⚠️ \"But I saw a video/tutorial where it worked without one!\"",
            value: "You might find examples online where people connect 3.3V modules directly to 5V Arduinos, and it *appears* to work. **This is bad practice and risky.**\n\n" +
              "**Why it might *seem* to work (temporarily):**\n" +
              "1.  **Short-term tolerance:** Some chips might tolerate over-voltage for a short period before failing.\n" +
              "2.  **Input protection diodes:** Some chips have internal diodes that try to clamp excess voltage, but these are not designed for continuous operation outside specified limits and will eventually burn out.\n" +
              "3.  **Luck:** Sometimes, it just hasn't failed *yet*.\n\n" +
              "**Relying on this is asking for trouble.** Your project might work during testing but then fail unpredictably later. It shortens the lifespan of your module and is not a reliable or proper engineering approach."
          },
          {
            name: "When is it Critical?",
            value: "The most critical connections are when your **5V Arduino is sending data TO the 3.3V module** (e.g., MOSI, SCK, Chip Select, Arduino TX to Module RX).\n\n" +
              "When the **3.3V module sends data TO the 5V Arduino** (e.g., MISO, Module TX to Arduino RX), a level shifter is less often *strictly* needed because most 5V MCUs will correctly interpret a 3.3V signal as a 'HIGH'. However, using a bi-directional level shifter handles both directions cleanly and is good practice."
          },
          {
            name: "Proper Powering is Also Key!",
            value: "Besides logic levels, ensure your 3.3V module is also **powered** with 3.3V ( The 3.3V pin on your Arduino is only rated for 50ma in many cases and so it can NOT be used to power esp's or cellphone modules or other power hungry devices. In most cases use a dedicated 3.3V regulator). Do NOT power a 3.3V module with 5V VCC unless its datasheet explicitly states it has an onboard regulator that can handle 5V input."
          }
        )
    ]
  },
  wiki: {
    embeds: [
      new EmbedBuilder(universalEmbed)
        .setTitle("The arduino wiki has lots of information about Arduino basics")
        .addFields(
          {
            name: "Learn how to combine sketches",
            value: "Take two sketches and merge them together, or learn how to use libraries."
          },
          {
            name: "Learn how Calculate resistor values for LEDs, why do you need resistors for leds?",
            value: "Learn how to calculate the resistor value for LEDs, and how to use them in your projects."
          },
          {
            name: "Learn how breadboards work",
            value: "Learn how to use breadboards, and how to connect components together on them. Also learn how to use jumper wires, and how to connect them to your Arduino."
          },
          {
            name: "Learn A lot more, all of the wiki is created by discord users like you!",
            value: "https://wiki.arduinodiscord.cc/ is the place to go for more information about Arduino basics, and how to use them in your projects."
          }
        )
    ]
  }
};



