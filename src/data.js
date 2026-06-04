export const annotations = [
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Introduction',
    answer: `Over the past four years as an Embedded Software Engineer at Nuvoton, I helped complete the build system and unified C/C++ firmware base that now powers over 30 distinct audio products. The platform is operating across multiple SoC families—including Cortex-M0, Cortex-M4 DSP, NPCA, and NPCP—I work within a modular, layered architecture that bridges vendor BSPs with a common API layer, utilizing Kconfig to dynamically select features, operating systems, and routing topologies for each product application. My day-to-day execution spans low-level hardware bring-up, integrating complex DSP algorithms into graph-based audio chains, and implementing runtime control interfaces. Because the entire runtime is strictly governed by the audio frame deadline, I ensure DSP tasks maintain absolute top priority for deterministic execution.

    To bridge the gap between software and hardware design, I also drove our pre-silicon validation efforts. I developed robust Python tooling to compare bit-exact and tolerance-based outputs between RTL simulations and FPGA bring-ups. By automating per-vector pass/fail verdicts, calculating critical error statistics (Max/RMS/SNR), and generating side-by-side waveform plots, I successfully caught logic divergences before tape-out and significantly shortened the hardware sign-off iteration time.

    The contributions I'm proudest of: integrating AEC and RNNoise into a unified voice front-end and solving a MIPS overrun with a system-level rate split that cut compute roughly 30x; building the runtime parameter control layer that turned tuning iteration from minutes down to seconds; and adding a continuous integration cycle-budget test that catches algorithm-integration regressions before release.
`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Why looking for new job?',
    answer: `When I joined four years ago, several pieces of the firmware platform and build system were still being filled out — the runtime parameter control layer, the host-side DSP validation tooling, and the voice front-end with AEC plus RNNoise. I've contributed to bringing those to a state where they cover the product roadmap and run reliably across all 30+ products. The platform is in a good place — which I'm proud of — but it also means my current work is mostly maintenance and expansion of product variants on infrastructure that's largely complete. I'm finding I'm learning less than I was two years ago. I'm looking for a role where the technical surface is still expanding, where the architecture is still being shaped, and where I can take on more architectural ownership than I have today.
`,
  },
  {
    id: crypto.randomUUID(),
    enabled: false,
    reminder: 'Why Sonatus?',
    answer: `I am highly interested in the Embedded Software Engineer position on the Updater team because the team mission on safely scaling firmware delivery is the exact type of architectural challenge I want to tackle next. Having spent the last four years contributing to a unified C/C++ firmware base and build system that scales across more than 30 distinct hardware products, I deeply understand the complexities of managing diverse target assets using layered architectures and Kconfig.

Sonatus’s mission to orchestrate seamless OTA updates and campaign management across millions of vehicles takes this configuration management to a massive, global scale. Being based right down the road in San Jose, I am eager to bring my experience in RTOS-level inter-process communication and system-level debugging to a local company that is fundamentally changing how automotive software is deployed and maintained.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Why Tarana Wireless?',
    answer: `I am drawn to the Embedded Software Engineer position at Tarata Wireless because it presents the perfect opportunity to apply my deep background in hard real-time DSP systems to the telecommunications domain. My core engineering drive has always been at the intersection of low-level hardware bring-up and deterministic software execution. Transitioning from audio signal processing to wireless communications offers the exact kind of high-stakes architectural challenges—like complex modulation, high-speed sampling, and filtering on internally developed SoCs—that I want to tackle next.

At a technical level, Tarata’s environment directly mirrors where I operate best. I have spent my career writing C/C++ firmware for ARM architectures, managing strict deadline-driven RTOS environments, and scaling shared build systems across multiple hardware product lines. I am highly comfortable in the lab environment, using oscilloscopes and logic analyzers alongside schematics to debug the hardware-software boundary. Ultimately, I am looking to join a team where I can leverage my DSP background and pre-silicon Python validation experience to build robust, next-generation enterprise wireless products.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'GDP Debugging / Hardware Debugging',
    answer: `On the firmware side, I am very comfortable tracking down complex system issues. I use the Nu-Link probe and GDB within NuEclipse not just for standard execution control, but for deeper memory and RTOS analysis. For example, I recently used GDB watchpoints to track down a complex buffer overflow. We had a situation where data was behaving completely unexpectedly because adjacent memory was being silently corrupted. Instead of guessing, I set a hardware watchpoint on the corrupted variable's address, and the moment the rogue pointer wrote past its bounds, GDB halted the processor and gave me the exact backtrace.

When it comes to the physical hardware layer—like using oscilloscopes and logic analyzers—I will be completely honest: that hasn't historically been my primary domain, but it is an area where I am actively building my skillset right now.

Recently, I was tasked with bringing up a new evaluation board. While it is based on the architecture I am used to, there were several changes to the pin muxing and the peripheral routing. To verify those changes, I couldn't just rely on the software; I had to get hands-on in the lab. I have been using a logic analyzer and scope to physically trace the signals and prove that my new pin configurations and peripheral drivers are actually doing what they are supposed to do on the metal. It has been a great learning experience that is really rounding out my ability to own the full hardware-software boundary.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Reading data sheet',
    answer: `Most of the time the codec or peripheral init sequence is already given — either from the chip vendor's reference code, the existing platform driver, or a previous product that used the same chip. I don't usually build a full init sequence from scratch by reading a datasheet cover-to-cover. Where the datasheet work actually happens is when I need to change something — bumping the codec sample rate, enabling or disabling a filter stage like a DC blocker or high-pass, adjusting a gain register, switching the codec's mode, or changing a clock divider for a new board variant. That's when I open the datasheet, find the specific register chapter, read what each bit field means, work out the new value, and update the init sequence in our firmware.

The skill there isn't reading the whole datasheet — it's knowing which register controls the behavior I want to change, reading just that section carefully, and understanding how a change to one register affects others. For example, changing the codec's sample rate often means re-checking the I²S bit-clock divider on the SoC side so the two stay in sync, and re-verifying that gain and filter settings are still appropriate at the new rate. The datasheet reading is targeted — I go in with a specific question, find the answer, validate it on the scope or in the audio output, and move on.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Audio Firmware Platform Structure',
    answer: `I specialize in building high-stakes, deadline-driven embedded systems right at the hardware-software boundary. A prime example of this is my recent work on a shared C/C++ platform, where I contributed to completing the build system and firmware base across more than 30 audio products on Nuvoton silicon.

To manage that level of scale, the architecture is broken down into three strict layers:

At the foundation is the vendor BSP for low-level hardware abstraction. The middle layer is our core engine. It houses our peripheral drivers—like I2S and DMA buffer management—alongside our common and private DSP algorithms, such as Acoustic Echo Cancellation and noise suppression. The top application layer is where system integration happens. It uses a topology graph-based system to dynamically route audio paths, sitting right alongside a parameter control layer for real-time tuning.

Because of this modular design, adding a new product variant is seamless. By simply writing a Kconfig entry and a few header overrides for things like pin muxing and codec selection, that single source tree cleanly compiles into over 30 unique firmware images.

Of course, audio is highly sensitive to timing—missing a cycle budget means an audible pop. I architected the runtime so the DSP task sits at the absolute highest FreeRTOS priority, waking strictly from DMA interrupts via queues. To protect shared state without stalling this critical path, I use priority-inheritance mutexes for task-to-task communication, ensuring the audio thread is never starved by a lower-priority task.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Graph-Based DSP Chain Engine',
    answer: `Contributed to a graph-based DSP chain engine where audio modules – AEC, RNNoise, biquads, compressors, limiters, mixers, band splitters – are nodes in a topology the processor walks each frame. Wrapped new algorithms as chain modules with ioctl parameter interfaces and exposed live tuning via shell and binary control commands; reduced per-parameter tuning iteration from minutes (recompile + reflash) to seconds (live update) and enabled audio engineers to run independent tuning sessions and automated parameter sweeps.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Pre-Silicon Validation Tooling',
    answer: `Before silicon comes back, the same design exists in two places — Register-Transfer Level simulation and on FPGA. Both should produce the same output for the same input. I wrote Python tooling that runs both, captures outputs, and compares them. It supports bit-exact comparison for fully deterministic blocks and tolerance-based comparison with error statistics — max error, RMS, SNR — for blocks where fixed-point quantization order isn't guaranteed to match. The output is a per-vector pass/fail verdict, the error stats, and side-by-side waveform plots when there's a divergence. The win is catching design issues before tape-out — every divergence we caught early saved a silicon respin or at least a debug cycle on real hardware.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Real-Time Multi-Task Architecture (FreeRTOS)',
    answer: `It's a deadline-driven FreeRTOS runtime — the DSP task at the highest priority because missing an audio frame is audible, then codec control, shell, USB, and housekeeping below it. The audio task wakes from PDMA half/full transfer interrupts: the ISR posts to a queue, the task receives, processes one frame, returns to blocking. Cross-task shared state is guarded with priority-inheritance mutexes — a shell task mutating audio parameters takes the same mutex the audio task takes when reading them, so the audio task never starves on a lower-priority task. ISR-to-task communication goes entirely through queues, which the OS wrapper handles in an ISR-safe way — that's how we comply with FreeRTOS's rule against calling mutex APIs from inside an ISR, by avoiding ISR-shared mutable state in the first place. On the buffer side, the PDMA driver tracks overflow and underflow counters in its runtime state, and the adaptive buffer-management layer consumes them to react to upstream pressure — tightening that reaction window cut overflow events about 20% under sustained load.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Hardware Bring-up & Verification Flow',
    answer: `When a new evaluation board comes in, I work the bring-up from schematic to working audio. First, schematic review for pin mux — translating which silicon pins are routed to which peripherals on this board into Kconfig and pin-control settings. Then peripheral init through the BSP — I²S for audio data, I²C for codec control, SPI where the codec or flash uses it. Then verification at the wire level: oscilloscope on the I²S clock, frame sync, and data lines to verify timing and bit alignment; logic analyzer for I²C transactions to confirm the codec is acknowledging and the register writes match the datasheet; protocol analyzer for end-to-end audio playback. The bring-up isn't done until the codec is locked, audio plays cleanly, and the clock tree is stable across temperature and load.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Build & Release System Strategy',
    answer: `Our build is Kconfig-driven GNU Make that runs on both Windows and Linux hosts. Each product has a Makefile that walks up to common_public/build_tools/makefiles/ and includes a shared project_makefile.mk. The shared makefile handles toolchain selection — armcc, armclang, or GCC ARM — and walks the source tree based on the product's .config. CI runs the full build matrix across all 30+ products on every commit; a regression in shared code that breaks any product fails the merge. My specific contribution there is the cycle-budget gate I added: it runs the DSP pipeline against a worst-case test vector, measures the per-frame cycle count, and fails the build if any frame exceeds 80% of the real-time budget. That's caught a couple of near-misses — algorithm changes that fit on average but would have blown the deadline on a worst-case frame.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'I2C driver architecture',
    answer: `One of the core pieces of infrastructure I built was the I2C driver that sits between the vendor BSP and our application layer.

The main architectural goal was to take a complex, interrupt-driven hardware peripheral and convert it into a clean, synchronous API for the application developers. So, instead of the application team having to manage hardware interrupts, they just call a function like master_read or master_write, and it behaves like a standard blocking call.

Under the hood, here is how I made that work: When the application makes the request, the driver immediately grabs a mutex to lock the bus, kicks off the hardware's 'START' condition, and then puts the calling task to sleep on a FreeRTOS queue. This immediately yields the CPU so other tasks can run.

While the application is sleeping, the actual I2C protocol runs entirely in the background as a state machine inside the Interrupt Service Routine. Every time a tiny step finishes—like an address or a data byte being acknowledged—the ISR catches it and moves to the next state. Once the transaction is completely finished, the ISR issues a 'STOP' condition, disables the interrupt, and signals the RTOS queue to wake the application back up.

I also built in retry logic for hardware NACKs, and specifically sequenced the order of operations to work around a known silicon errata where the bus would freeze if interrupts were disabled prematurely. Ultimately, it gave the application team a thread-safe, highly reliable API while hiding all the ISR complexity.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'How did you design the task schedule and time constraints?',
    answer: `The task hierarchy I work within was defined at the platform level before me — it's documented in a header that lays out every task's priority relative to tskIDLE_PRIORITY. The organizing principle is the audio frame deadline: the DSP task runs at the highest priority, the codec controller just below it, shell and USB and HID at the same mid-tier, and housekeeping and button-manager near idle. The interrupt priorities pair with that — DMA, USB device, and I²S are clustered at one NVIC priority level so they don't preempt each other mid-transaction, while peripheral control like I²C and SPI sit at lower NVIC priority because they're slower housekeeping.
	
What I do design is the timing contract for any new task I add. When I added the audio prompt shell command, the question was: what priority should it run at, what's its worst-case execution time, what state does it share with the audio task, and how is that state protected. The answer: priority 4 (same tier as other shell commands), short execution time per invocation, shares parameter state with the audio task at priority 6, protected by control_mutex with priority inheritance so the shell can never starve the audio task. That's the design discipline — work within the existing priority architecture, prove your new task fits the audio frame deadline, and protect shared state with the right primitive.

On time constraints, the platform's binding constraint is the audio frame budget — at our sample rate and frame size, that's the deadline every cycle. We have a CI test that fails any build where the worst-case frame exceeds 80% of the budget, so the time constraint is encoded as an automated gate, not just a guideline.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Tell me about a time you failed or made a mistake',
    answer: `One mistake I'll own: I was bringing up a new evaluation board, and we'd decided to reuse the firmware from a previous EVB in the same product family because the SoC was identical. I made the assumption that since the chip was the same, the firmware would just boot — and I didn't carefully diff the two schematics before flashing. What I missed was that several GPIOs had been remapped on the new board — different pins assigned to the codec reset line, an LED, and one of the bus enable signals. When I flashed and powered the board, it hung in early init because it was toggling the wrong pins. The codec never came out of reset, so nothing downstream worked. I burned the better part of a day debugging it before I went back to the schematic, did a proper pin-by-pin diff against the previous board, and saw the changes. Once I updated the pin definitions in the firmware, it came up cleanly on the next flash. The fix was simple, but the wasted day was avoidable. The habit I built after that: before reusing any firmware on a new board, I do a side-by-side schematic compare for at least the SoC pinout, the power rails, and the bus connections. I now keep a short checklist for board reuse — what to verify before flashing — and I share it with anyone else taking over similar bring-up work on our team. The bigger lesson was that 'same chip' doesn't mean 'same board.' Even small hardware changes need an explicit firmware audit, not an assumption.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Tell me about a time you took initiative / solved a bottleneck',
    answer: `During an AEC integration project, I noticed something that was slowing the whole team down. The AEC algorithm had a handful of tuning parameters — the adaptive filter length, the NLMS step size, the double-talk-detector threshold, the residual echo suppressor gain, and the comfort noise level — and they were all hardcoded as constants in the source. Every time the audio tuning engineer wanted to try a different value to test echo cancellation quality, we had to change the constant, recompile the firmware, reflash the device, capture a recording, and listen. That round-trip took several minutes per parameter tweak, and we were doing dozens of tweaks per session.

Nobody assigned this to me, but it was clearly killing iteration speed. I spent a couple of days building a small wrapper library around the AEC parameters — each one exposed as a get/set API — and wired the API into our existing shell command interface on the device. After that, the tuning engineer could connect to the board, change any parameter live with a one-line command, and immediately hear the effect on the running pipeline. No recompile, no reflash, no restart.

The iteration cycle for parameter tuning dropped from minutes to seconds. The audio engineers started running tuning sessions on their own without needing me in the loop, which freed me up for other work. As a side benefit, the same wrapper became the foundation for automated tuning experiments later — we could script parameter sweeps and capture metrics without human intervention.

The thing I'm proudest of in that work is that I didn't wait for someone to ask. I saw the bottleneck, recognized that the fix was small relative to the friction it would remove, and built it.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: "Tell me about the most difficult bug you've debugged",
    answer: `After integrating a new equalizer block, we'd get a quiet click roughly every half second — too quiet to hear in the office, but clean enough to show up on an FFT of the captured output. The period was the giveaway. It matched the rate at which our ping-pong DMA was switching halves of the audio buffer.

I went looking at how the algorithm and DMA shared state, and found a current_buffer index being written by the DMA-complete interrupt and read by the main processing loop with nothing protecting the access. Most of the time it was fine, but occasionally the main loop read a half-updated value and processed the wrong half for one frame.

Fix was volatile on the index and a brief interrupt disable around the few read sites that needed a consistent value. Click disappeared completely. The lesson: anything shared between an ISR and the main loop needs explicit synchronization — 'it's just one variable, it'll be atomic' is the bug that bites you in production.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Tell me about your proudest accomplishment',
    answer: `We needed to integrate AEC and a neural-network noise suppressor — the RNNoise architecture — into the same voice front-end on one of our smart-audio targets. Each algorithm worked fine in isolation, but the moment we tried to run them together at the native 48 kHz capture rate, we blew straight past the MIPS budget. The first reflex was to optimize each block in place — tighter SIMD, smaller network. Picked up some gains, not enough.

The fix that actually worked came from stepping back and looking at the system. The speaker playback path had to stay at 48 kHz for music quality, but the voice path didn't — voice commands and telephony sound perfectly clean at 8 kHz. So we split the chain: kept playback at 48 kHz but dropped a down sampler in front of the voice front-end. That cut AEC cost by roughly thirty times.

The unglamorous part was re-deriving every buffer size and frame-sync timing at the new rate. Once it was stitched up, the chain ran with comfortable margin and shipped.

The lesson I took: when you're MIPS-bound, the biggest wins usually aren't in the inner loop — they're one level up, in questioning the assumptions about what has to run at what rate.`,
  },
  {
    id: crypto.randomUUID(),
    enabled: true,
    reminder: 'Tell me about a time you had to learn something new quickly',
    answer: `One example I think about a lot: when I first started getting hardware bring-up tasks on new evaluation boards, I had to learn to read schematics and navigate component data-sheets quickly. My background is computer science — I came in solid on the software side but with essentially no formal training in reading schematics or working with hardware data-sheets. The first time someone handed me a new EVB and said 'bring this up,' I realized I had to ramp fast.

The way I approached it: I sat with the schematic for the new board and the schematic for a board I'd already worked on side by side, and I traced every signal from the SoC pin to the destination. That forced me to learn the symbols, the naming conventions, the pull-up and pull-down patterns, the level-shifting between voltage domains — by comparison rather than from a textbook. For the codec data-sheet, instead of trying to read it cover to cover, I'd jump to the section relevant to whatever I was wiring up that day — power sequencing, I2C register map, I2S configuration — and work through just that piece in depth.

After a few boards, I was comfortable enough that I could open a new schematic, identify the audio codec, find the I2C and I2S signals, check the pin musing on the SoC side, and know which data-sheet pages I'd need before writing any code.

The lesson for me was that hardware fluency, for a software engineer, is best built on a real bring-up rather than from a textbook. Side-by-side schematic comparison is the technique I'd recommend to anyone going through the same transition.`,
  },
];
