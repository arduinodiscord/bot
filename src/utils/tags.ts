import { MessageEmbed, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import universalEmbed from '../index';
export default {
  ask: {
    embeds: [
      new MessageEmbed(universalEmbed)
        .setTitle('Don\'t ask to ask - Just ask!')
        .addFields({
          name: 'Describe what your code/hardware does and what you want it to do instead. Sharing is caring! Share your code, click the **"codeblock"** button below to learn how.',
          value:
            'Keep in mind: no one here is paid to help you, so the least you can do is refine your question in proper language.',
        }),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('codeblock')
          .setLabel('codeblock')
          .setStyle(ButtonStyle.Primary)
      ),
    ],
  },
  avrdude: {
    embeds: [
      new MessageEmbed(universalEmbed)
        .setTitle('Solving AVRDUDE communication errors (Try these in order)')
        .addFields(
          {
            name: '1. Is your Serial monitor open?',
            value:
              'If it is, close it. This allows your IDE to upload sketches without conflicts with the Serial Monitor.',
          },
          {
            name: '2. Have you selected the right port in your IDE?',
            value:
              'You could have selected something that is **not** your Arduino. Change the port in the Arduino IDE by going into Tools -> Port.',
          },
          {
            name: '3. Have you selected the right board in your IDE?',
            value: 'You need to select the right board and model.',
          },
          {
            name: 'You need to select the right board and model.',
            value:
              'If it does, unplug and re-plug your board, then check for blinking LEDs. If only the Power LED or no LEDs light up ask for further assistance (not for all boards).',
          },
          {
            name: '5. Do you have a Nano or other Atmega 328p based board?',
            value:
              "If so, try using the old bootloader. In the Arduino IDE Go to Tools -> Processor and select 328p(old bootloader). If your board doesn't have an Atmega 328p, you can skip this step.",
          },
          {
            name: '6. Does your onboard LED blink when you press the reset button?',
            value:
              "Try pressing the reset button on your Arduino, if the onboard LED doesn't blink when you reset, you probably have a broken bootloader, you can check out [this tutorial](https://www.arduino.cc/en/Hacking/Bootloader?from=Tutorial.Bootloader) on how to burn the bootloader.",
          },
          {
            name: '7. Is anything connected to your Tx and Rx pins?',
            value: 'If there is, try removing everything connected to them.',
          },
          {
            name: "8. Is this a problem on your computer's side?",
            value:
              "This might be a problem on your computer's side, so try restarting your computer.",
          },
          {
            name: '9. Are you running Linux?',
            value:
              'If you are running Linux, try checking which groups you belong by using the `groups` command, then look at which group you need to be in with `ls -l /dev/ttyACM*`, `ls -l /dev/S*` or `ls -ls /dev/USB*` (replace the `*` with your port number), then use this command:- `sudo usermod -a -G <group> <username>` and add your user to the necessary groups.',
          },
          {
            name: '10. Are your drivers installed?',
            value:
              "Check your drivers, sometimes just reinstalling them works. If you are using a clone board, you might have the CH340 USB-Serial chip, which isn't supported by default. You can check by looking at your board and checking the SMD USB-Serial chip's name (not the big one). [Click here](https://learn.sparkfun.com/tutorials/how-to-install-ch340-drivers/all) to learn how to install CH340 Drivers. If you have an FTDI chip, [This website](https://learn.sparkfun.com/tutorials/how-to-install-ftdi-drivers/all) will show you how to install their drivers. If you don't have either we recommend googling the USB-Serial chip that your board uses.",
          },
          {
            name: '11. Is your cable faulty or capable of sending data?',
            value:
              'Some USB cables arent capable of transferring data, and some may be faulty, so make sure to try a different one to see if it works!',
          },
          {
            name: '12. Is this a problem with your IDE?',
            value: "If you think that's the case, try reinstalling the IDE.",
          }
        ),
    ],
  },
  codeblock: {
    content: '```ino\n// Please right-click on this message (long-press on mobile)\n// then select "Copy Text."\n\n// After that, copy your code; then paste it in place of this comment\n```'
  },
  espcomm: {
    embeds: [
      new MessageEmbed(universalEmbed)
        .setTitle("Solving your ESP board's communication errors (Try these in order)")
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
            name: "4. Is your Serial monitor showing gibberish?",
            value: "Try setting it to the correct baud rate (At the bottom right corner of the Serial monitor). Most examples use 115200 baud."
          },
          {
            name: "5. Is anything connected to your Tx and Rx pins?",
            value: "If there is, try removing everything connected to them."
          },
          {
            name: "6. Have you tried holding down the BOOT/FLASH button?",
            value: "Try Holding down the BOOT/FLASH button before uploading."
          },
          {
            name: "7. Are there any problems with your wiring?",
            value: "Check if there are any wiring errors or loose connections (Note: if you are using an FTDI Board, FTDI TX and RX pins must be cross-connected with the ESP Tx and Rx pins (TX goes to RX))."
          },
          {
            name: "8. Can't see your ESP's COM Port?",
            value: "This often means you don’t have the USB drivers installed. Take a closer look at the USB chip and check its name, Go to Google and search for your particular chip to find the drivers and install them in your operating system. If you have the CP2102 chip, here are the [official drivers](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)."
          },
          {
            name: "Still not fixed?",
            value: "Check out these troubleshooting guides for your respective boards: [ESP32](https://randomnerdtutorials.com/esp32-troubleshooting-guide/#:~:text=When%20you%20try%20to%20upload,button%20in%20your%20ESP32%20board), [ESP32 CAM](https://randomnerdtutorials.com/esp32-cam-troubleshooting-guide/#:~:text=If%20you%20get%20this%20exact,times%2C%20might%20solve%20the%20issue.) and [ESP8266](https://randomnerdtutorials.com/esp8266-troubleshooting-guide/)."
          }
        )
    ]
  },

  hid: {
    embeds: [
      new MessageEmbed(universalEmbed)
        .setTitle("Can your Arduino be used as a keyboard or mouse?")
        .addFields(
          {
            name: "You want to use your Arduino for a Human Interface Device?",
            value: "Arduino has many boards that can be used as a mouse/keyboard natively. This is referred to as HID."
          },
          {
            name: "Boards that are __NOT__ HID compliant",
            value: "Uno (R3 or older), Mega, Nano, Pro Mini, cannot be used as a HID device."
          },
          {
            name: "Boards that __ARE__ HID compliant",
            value: "Uno R4, Giga, RP2040, Leonardo, (Pro)Micro, any other 8u2/16u2/at90usb8/162/32u2/32u4 board, Zero, MKR1000."
          }
        )
    ]
  },

  language: {
    embeds: [
      new MessageEmbed(universalEmbed)
        .setTitle("What coding language does Arduino IDE use? What language should you learn?")
        .addFields(
          {
            name: "Arduino IDE code is normally C++14",
            value: "The language most often used in Arduino IDE for programming is primarily **C++14**. There are some added functions that are very useful for using the Arduino platform. They can be found at https://www.arduino.cc/reference/en/. MicroPython and other Python types are sometimes used; however, they are extremely limited in both the boards that support them and the library selection that is offered. Also, the community, examples, and tutorials are extremely limited, so they are rarely used in this community and never used in real-world **commercial or industrial** applications."
          }
        )
    ]
  },

  libmissing: {
    embeds: [
      new MessageEmbed(universalEmbed)
        .setTitle('Solving library errors (such as "yourlib.h not found")')
        .addFields(
          {
            name: "1. Is your library installed?",
            value: "Go to the **Library Manager** (Sketch -> Include Library -> Manage Libraries), search for the library, and install it. If it is already installed, try reinstalling it through the Library Manager."
          },
          {
            name: "2. Is your `#include` statement spelled correctly?",
            value: "Check for any capitalization errors as well!"
          },
          {
            name: "3. Did you download it manually?",
            value: "If you downloaded it from GitHub or somewhere else and it came as a zip file, do not open the zip. Instead, open the IDE, go to Libraries -> Install from ZIP, then point to the zip folder and install. Then close all IDEs you have open, wait 20 seconds, then open the IDE, go to Libraries and see if it's now listed there. It should be.",
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
      new MessageEmbed(universalEmbed)
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
      new MessageEmbed(universalEmbed)
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
      new MessageEmbed(universalEmbed) // Or just new MessageEmbed() if you don't have a universal one
        .setTitle("Logic Level Shifters: Protecting Your 3.3V Modules")
        .addFields(
          {
            name: "The Problem: Voltage Mismatch",
            value: "Many popular Arduino boards like the Uno and Mega operate at **5 Volts (5V)**. This means their digital pins send out 5V for a 'HIGH' signal.\n\nHowever, a lot of modern modules and sensors (like the NRF24L01, ESP8266, SD cards) are designed to operate at **3.3 Volts (3.3V)**. Their input pins are often **NOT 5V tolerant**."
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
                   "It safely steps down the 5V signals from the Arduino to 3.3V for the module's inputs. Most bi-directional shifters also step up 3.3V signals from the module to 5V for the Arduino's inputs, though 3.3V is often high enough to be read as a 'HIGH' by a 5V Arduino."
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
            value: "Besides logic levels, ensure your 3.3V module is also **powered** with 3.3V (e.g., from the 3.3V pin on your Arduino, or a dedicated 3.3V regulator). Do NOT power a 3.3V module with 5V VCC unless its datasheet explicitly states it has an onboard regulator that can handle 5V input."
          }
        )
    ]
  },
  debounce: {
    embeds: [
      new MessageEmbed(universalEmbed)
        .setTitle("🔘 Taming Bouncy Buttons: Understanding Debouncing")
        .addFields(
          {
            name: "The Problem: \"Bouncy\" Switches",
            value: "When you press a mechanical button or switch, the metal contacts inside don't make a single, clean connection. Instead, they 'bounce' a few times, rapidly opening and closing the circuit before settling.\n\nAn Arduino is fast enough to see these bounces as multiple separate presses!"
          },
          {
            name: "What Happens Without Debouncing?",
            value: "If you're trying to count presses or toggle an LED, you'll get erratic behavior: one physical press might register as 2, 3, or even more presses, or an LED might flicker unpredictably."
          },
          {
            name: "The Solution: Debouncing",
            value: "Debouncing is a technique to ensure that only one action is registered for a single intentional press.\n\n**Common Software Debounce Method:**\n" +
                   "1. Detect an initial button press (e.g., pin goes LOW).\n" +
                   "2. Wait for a short period (e.g., 20-50 milliseconds).\n" +
                   "3. After the delay, check the button state again.\n" +
                   "4. If it's still in the pressed state, then consider it a valid press."
          },
          {
            name: "Simple Code Logic (Conceptual)",
            value: "```cpp\n" +
                   "// Previous button state\n" +
                   "bool lastButtonState = HIGH;\n" +
                   "unsigned long lastDebounceTime = 0;\n" +
                   "unsigned long debounceDelay = 50; // 50ms\n\n" +
                   "// In your loop():\n" +
                   "bool reading = digitalRead(buttonPin);\n\n" +
                   "if (reading != lastButtonState) {\n" +
                   "  lastDebounceTime = millis(); // Reset debounce timer\n" +
                   "}\n\n" +
                   "if ((millis() - lastDebounceTime) > debounceDelay) {\n" +
                   "  // If current reading has been stable for longer than the delay\n" +
                   "  if (reading == LOW) { // Assuming button pulls LOW when pressed\n" +
                   "    // Button is considered pressed\n" +
                   "    // Your action here (e.g., toggle LED, count press)\n" +
                   "    // Make sure to only act on state change (e.g. if it *was* HIGH and *is now* LOW)\n" +
                   "  }\n" +
                   "}\n" +
                   "lastButtonState = reading;\n" +
                   "```\n" +
                   "*Note: This is a common approach. Libraries can also simplify debouncing.*"
          },
          {
            name: "Key Takeaway",
            value: "If your project uses buttons, switches, or any mechanical contact that triggers an action, you almost certainly need to implement debouncing for reliable operation."
          }
        )
    ]
  },

  analogRead: {
    embeds: [
      new MessageEmbed(universalEmbed)
        .setTitle("🌡️ Reading the World: Analog Inputs with `analogRead()`")
        .addFields(
          {
            name: "What is an Analog Signal?",
            value: "Unlike digital signals which are either HIGH (e.g., 5V) or LOW (e.g., 0V), analog signals can have any voltage within a continuous range. Many sensors (like potentiometers, light sensors, temperature sensors) output analog voltages."
          },
          {
            name: "The `analogRead(pin)` Function",
            value: "Arduino boards have an **Analog-to-Digital Converter (ADC)** that converts these analog voltages into numbers your code can understand.\n\n`int sensorValue = analogRead(A0);` will read the voltage on pin A0 and store the result in `sensorValue`."
          },
          {
            name: "The 0 to 1023 Range Explained",
            value: "Most common Arduinos (Uno, Nano, Mega) have a **10-bit ADC**. This means:\n" +
                   "- It can represent 2<sup>10</sup> = **1024** distinct values.\n" +
                   "- These values range from **0 to 1023**.\n\n" +
                   "**How it maps to voltage (typically):**\n" +
                   "- `0` corresponds to 0 Volts (GND).\n" +
                   "- `1023` corresponds to the ADC's reference voltage (usually 5V on a 5V Arduino, or 3.3V on a 3.3V Arduino like an ESP32 or Arduino Zero). You can change the reference with `analogReference()`.\n" +
                   "- A reading of `512` would be approximately half the reference voltage (e.g., 2.5V if AREF is 5V)."
          },
          {
            name: "Example: Reading a Potentiometer",
            value: "A potentiometer (variable resistor) is a great way to test `analogRead()`.\n" +
                   "**Connections:**\n" +
                   "1. One outer pin to GND.\n" +
                   "2. The other outer pin to 5V (or 3.3V, matching your Arduino's logic level).\n" +
                   "3. The middle pin (wiper) to an analog input pin (e.g., A0).\n\n" +
                   "Turning the knob will change the voltage on A0, and `analogRead(A0)` will return values between 0 and 1023."
          },
          {
            name: "Which Pins? Analog vs. Digital",
            value: "Use pins labeled 'A0', 'A1', etc., for `analogRead()`. These are specifically connected to the ADC. Digital pins cannot be used with `analogRead()` (unless they are also analog pins, like on some MCUs)."
          }
        )
    ]
  },

  motorControl: {
    embeds: [
      new MessageEmbed(universalEmbed)
        .setTitle("⚙️ Powering Motors Safely: Don't Fry Your Arduino!")
        .addFields(
          {
            name: "The Big NO-NO: Connecting Motors Directly to GPIO Pins",
            value: "You should **NEVER** connect a DC motor, servo (power lines), solenoid, or any high-current device directly to an Arduino's digital or analog I/O pins for power."
          },
          {
            name: "Why is it Dangerous?",
            value: "1.  **Excessive Current Draw:** Arduino pins are designed for low current signals (typically 20mA, max ~40mA). Motors draw significantly more current, especially on startup (stall current) or under load. This will overload and damage the Arduino pin or the entire microcontroller.\n" +
                   "2.  **Inductive Loads & Back-EMF:** Motors are inductive. When power is cut or changes rapidly, the collapsing magnetic field can generate a voltage spike (Back-EMF) in the opposite direction. This spike can be much higher than the Arduino's operating voltage and can destroy the MCU."
          },
          {
            name: "The Correct Approach: Using Drivers & Separate Power",
            value: "**1. Motor Drivers:**\n" +
                   "   - **What they do:** Act as a high-current switch controlled by the Arduino's low-current signals. They isolate the Arduino from the motor's power demands and often provide features like speed and direction control.\n" +
                   "   - **Examples:** L298N, TB6612FNG, DRV8833, MOSFETs (used as switches), H-Bridge ICs.\n\n" +
                   "**2. Relays:**\n" +
                   "   - For simple ON/OFF control of higher voltage (AC or DC) or very high current devices. A relay module will also isolate the Arduino.\n\n" +
                   "**3. Separate Power Supply:**\n" +
                   "   - Motors need their own power supply adequately rated for their voltage and current requirements. Do NOT try to power them from the Arduino's 5V or Vin pin (unless they are extremely tiny, low-power motors, and even then, it's risky).\n" +
                   "   - **Crucial:** Connect the ground (GND) of the motor's power supply to the Arduino's GND."
          },
          {
            name: "What About Servos?",
            value: "Servos have three wires: Signal, VCC (Power), and GND.\n" +
                   "- The **Signal** wire *can* be connected to an Arduino pin.\n" +
                   "- The **VCC and GND** wires for the servo should connect to a separate power supply capable of providing enough current (especially for multiple or larger servos). Don't power servos (except maybe one very small one) directly from the Arduino 5V pin."
          },
          {
            name: "Key Takeaway",
            value: "Protect your Arduino! Always use an appropriate motor driver or relay and a separate, suitable power supply for motors and other inductive or high-current loads."
          }
        )
    ]
  },

  pwm: {
    embeds: [
      new MessageEmbed(universalEmbed)
        .setTitle("💡 Faking Analog: Pulse Width Modulation (PWM) with `analogWrite()`")
        .addFields(
          {
            name: "The `analogWrite(pin, value)` Misconception",
            value: "On most common Arduinos (like Uno, Nano, Mega), `analogWrite()` does **not** produce a true, smooth analog voltage. Instead, it generates a **Pulse Width Modulation (PWM)** signal."
          },
          {
            name: "What is PWM?",
            value: "PWM is a technique where a digital pin is rapidly switched ON and OFF. The 'width' of the ON pulse (relative to the total period of one ON/OFF cycle) determines the *average* power delivered.\n\n" +
                   "Think of it like flicking a light switch very fast. If it's on half the time and off half the time, it appears dimmer than if it's on all the time."
          },
          {
            name: "Duty Cycle: The `value` in `analogWrite()`",
            value: "The `value` argument in `analogWrite(pin, value)` ranges from **0 to 255** (for 8-bit PWM, common on Arduino).\n" +
                   "- `analogWrite(pin, 0)`: 0% duty cycle. The pin is effectively always LOW (0V).\n" +
                   "- `analogWrite(pin, 127)`: ~50% duty cycle. The pin is HIGH for about half the time and LOW for half the time.\n" +
                   "- `analogWrite(pin, 255)`: 100% duty cycle. The pin is effectively always HIGH (5V or 3.3V)."
          },
          {
            name: "How it's Perceived",
            value: "Many devices react to this average power:\n" +
                   "- **LEDs:** Brightness appears to change. A 50% duty cycle makes an LED look half as bright.\n" +
                   "- **DC Motors (with a driver):** Speed can be controlled.\n" +
                   "- **Some audio applications:** Can generate simple tones."
          },
          {
            name: "PWM Capable Pins",
            value: "Not all digital pins can do PWM. On Arduino Uno/Nano, PWM pins are typically marked with a tilde (`~`) symbol next to the pin number (e.g., `~3`, `~5`, `~6`, `~9`, `~10`, `~11`).\n\n" +
                   "Check your board's documentation for its specific PWM pins."
          },
          {
            name: "True Analog Output (DAC)",
            value: "Some microcontrollers (like ESP32, Arduino Due, MKR boards) have a **Digital-to-Analog Converter (DAC)** which *can* produce true analog voltages. This is different from PWM and uses functions like `dacWrite()` on ESP32."
          }
        )
    ]
  },
  wiki: {
    embeds: [
      new MessageEmbed(universalEmbed)
        .setTitle("The arduino wiki has lots of information about Arduino basics")
        .addFields(
          {
            name: "Learn how to combine sketches",
            value: "Take two sketches and place them together, or learn how to use libraries."
          },
          {
            name: "Learn how Calculate resistor values for LEDs",
            value: "Learn how to calculate the resistor value for LEDs, and how to use them in your projects."
          },
          {
            name: "Learn how breadboards work",
            value: "Learn how to use breadboards, and how to connect components together."  
          },
          {
            name: "Learn A lot more, all of the wiki is created by discord users like you!",
            value: "https://wiki.arduinodiscord.cc/ is the place to go for more information about Arduino basics, and how to use them in your projects."
          }
        )
    ]
  } 
};
