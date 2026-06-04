export const annotations = [
  {
    id: 0,
    reminder: 'Introduction',
    answer: `Over the past four years as an Embedded Software Engineer at Nuvoton, I helped complete the build system and unified C/C++ firmware base that now powers over 30 distinct audio products. The platform is operating across multiple SoC families—including Cortex-M0, Cortex-M4 DSP, NPCA, and NPCP—I work within a modular, layered architecture that bridges vendor BSPs with a common API layer, utilizing Kconfig to dynamically select features, operating systems, and routing topologies for each product application. My day-to-day execution spans low-level hardware bring-up, integrating complex DSP algorithms into graph-based audio chains, and implementing runtime control interfaces. Because the entire runtime is strictly governed by the audio frame deadline, I ensure DSP tasks maintain absolute top priority for deterministic execution.

    To bridge the gap between software and hardware design, I also drove our pre-silicon validation efforts. I developed robust Python tooling to compare bit-exact and tolerance-based outputs between RTL simulations and FPGA bring-ups. By automating per-vector pass/fail verdicts, calculating critical error statistics (Max/RMS/SNR), and generating side-by-side waveform plots, I successfully caught logic divergences before tape-out and significantly shortened the hardware sign-off iteration time.

    The contributions I'm proudest of: integrating AEC and RNNoise into a unified voice front-end and solving a MIPS overrun with a system-level rate split that cut compute roughly 30x; building the runtime parameter control layer that turned tuning iteration from minutes down to seconds; and adding a continuous integration cycle-budget test that catches algorithm-integration regressions before release.
`,
  },
  {
    id: 1,
    reminder: 'Audio Firmware Platform Structure',
    answer: `It's a shared C/C++ firmware platform that ships across more than 30 audio products on Nuvoton silicon. The architecture is three layers — vendor BSP at the bottom, a common_public API and common_private implementation layer in the middle, and per-product apps on top. The platform provides DMA buffer management, codec abstractions, the audio path runtime, and integration points for AEC and noise suppression. A new product variant is added by writing a Kconfig entry and a small set of header overrides — pin mux, codec choice, which DSP modules to enable. So the same source tree compiles into 30+ distinct firmware images. I'm a primary contributor to the shared layer — the platform predates me, but I own meaningful subsystems within it.`,
  },
  {
    id: 2,
    reminder: 'Graph-Based DSP Chain Engine',
    answer: `Contributed to a graph-based DSP chain engine where audio modules – AEC, RNNoise, biquads, compressors, limiters, mixers, band splitters – are nodes in a topology the processor walks each frame. Wrapped new algorithms as chain modules with ioctl parameter interfaces and exposed live tuning via shell and binary control commands; reduced per-parameter tuning iteration from minutes (recompile + reflash) to seconds (live update) and enabled audio engineers to run independent tuning sessions and automated parameter sweeps.`,
  },
  {
    id: 3,
    reminder: 'Pre-Silicon Validation Tooling',
    answer: `Before silicon comes back, the same design exists in two places — RTL simulation and on FPGA. Both should produce the same output for the same input. I wrote Python tooling that runs both, captures outputs, and compares them. It supports bit-exact comparison for fully deterministic blocks and tolerance-based comparison with error statistics — max error, RMS, SNR — for blocks where fixed-point quantization order isn't guaranteed to match. The output is a per-vector pass/fail verdict, the error stats, and side-by-side waveform plots when there's a divergence. The win is catching design issues before tape-out — every divergence we caught early saved a silicon respin or at least a debug cycle on real hardware.`,
  },
  {
    id: 4,
    reminder: 'Real-Time Multi-Task Architecture (FreeRTOS)',
    answer: `It's a deadline-driven FreeRTOS runtime — the DSP task at the highest priority because missing an audio frame is audible, then codec control, shell, USB, and housekeeping below it. The audio task wakes from PDMA half/full transfer interrupts: the ISR posts to a queue, the task receives, processes one frame, returns to blocking. Cross-task shared state is guarded with priority-inheritance mutexes — a shell task mutating audio parameters takes the same mutex the audio task takes when reading them, so the audio task never starves on a lower-priority task. ISR-to-task communication goes entirely through queues, which the OS wrapper handles in an ISR-safe way — that's how we comply with FreeRTOS's rule against calling mutex APIs from inside an ISR, by avoiding ISR-shared mutable state in the first place. On the buffer side, the PDMA driver tracks overflow and underflow counters in its runtime state, and the adaptive buffer-management layer consumes them to react to upstream pressure — tightening that reaction window cut overflow events about 20% under sustained load.`,
  },
  {
    id: 5,
    reminder: 'Hardware Bring-up & Verification Flow',
    answer: `When a new evaluation board comes in, I work the bring-up from schematic to working audio. First, schematic review for pin mux — translating which silicon pins are routed to which peripherals on this board into Kconfig and pin-control settings. Then peripheral init through the BSP — I²S for audio data, I²C for codec control, SPI where the codec or flash uses it. Then verification at the wire level: oscilloscope on the I²S clock, frame sync, and data lines to verify timing and bit alignment; logic analyzer for I²C transactions to confirm the codec is acknowledging and the register writes match the datasheet; protocol analyzer for end-to-end audio playback. The bring-up isn't done until the codec is locked, audio plays cleanly, and the clock tree is stable across temperature and load.`,
  },
  {
    id: 6,
    reminder: 'Build & Release System Strategy',
    answer: `Our build is Kconfig-driven GNU Make that runs on both Windows and Linux hosts. Each product has a Makefile that walks up to common_public/build_tools/makefiles/ and includes a shared project_makefile.mk. The shared makefile handles toolchain selection — armcc, armclang, or GCC ARM — and walks the source tree based on the product's .config. CI runs the full build matrix across all 30+ products on every commit; a regression in shared code that breaks any product fails the merge. My specific contribution there is the cycle-budget gate I added: it runs the DSP pipeline against a worst-case test vector, measures the per-frame cycle count, and fails the build if any frame exceeds 80% of the real-time budget. That's caught a couple of near-misses — algorithm changes that fit on average but would have blown the deadline on a worst-case frame.`,
  },
  {
    id: 7,
    reminder: 'I2C driver architecture',
    answer: `One of the core pieces of infrastructure I built was the I2C driver that sits between the vendor BSP and our application layer.

The main architectural goal was to take a complex, interrupt-driven hardware peripheral and convert it into a clean, synchronous API for the application developers. So, instead of the application team having to manage hardware interrupts, they just call a function like master_read or master_write, and it behaves like a standard blocking call.

Under the hood, here is how I made that work: When the application makes the request, the driver immediately grabs a mutex to lock the bus, kicks off the hardware's 'START' condition, and then puts the calling task to sleep on a FreeRTOS queue. This immediately yields the CPU so other tasks can run.

While the application is sleeping, the actual I2C protocol runs entirely in the background as a state machine inside the Interrupt Service Routine. Every time a tiny step finishes—like an address or a data byte being acknowledged—the ISR catches it and moves to the next state. Once the transaction is completely finished, the ISR issues a 'STOP' condition, disables the interrupt, and signals the RTOS queue to wake the application back up.

I also built in retry logic for hardware NACKs, and specifically sequenced the order of operations to work around a known silicon errata where the bus would freeze if interrupts were disabled prematurely. Ultimately, it gave the application team a thread-safe, highly reliable API while hiding all the ISR complexity.`,
  },
  {
    id: 8,
    reminder: 'How did you design the task schedule and time constraints?',
    answer: `The task hierarchy I work within was defined at the platform level before me — it's documented in a header that lays out every task's priority relative to tskIDLE_PRIORITY. The organizing principle is the audio frame deadline: the DSP task runs at the highest priority, the codec controller just below it, shell and USB and HID at the same mid-tier, and housekeeping and button-manager near idle. The interrupt priorities pair with that — DMA, USB device, and I²S are clustered at one NVIC priority level so they don't preempt each other mid-transaction, while peripheral control like I²C and SPI sit at lower NVIC priority because they're slower housekeeping.
	
What I do design is the timing contract for any new task I add. When I added the audio prompt shell command, the question was: what priority should it run at, what's its worst-case execution time, what state does it share with the audio task, and how is that state protected. The answer: priority 4 (same tier as other shell commands), short execution time per invocation, shares parameter state with the audio task at priority 6, protected by control_mutex with priority inheritance so the shell can never starve the audio task. That's the design discipline — work within the existing priority architecture, prove your new task fits the audio frame deadline, and protect shared state with the right primitive.

On time constraints, the platform's binding constraint is the audio frame budget — at our sample rate and frame size, that's the deadline every cycle. We have a CI test that fails any build where the worst-case frame exceeds 80% of the budget, so the time constraint is encoded as an automated gate, not just a guideline.`,
  },
  {
    id: 9,
    reminder: 'Tell me about a time you failed or made a mistake',
    answer: `One mistake I'll own: I was bringing up a new evaluation board, and we'd decided to reuse the firmware from a previous EVB in the same product family because the SoC was identical. I made the assumption that since the chip was the same, the firmware would just boot — and I didn't carefully diff the two schematics before flashing. What I missed was that several GPIOs had been remapped on the new board — different pins assigned to the codec reset line, an LED, and one of the bus enable signals. When I flashed and powered the board, it hung in early init because it was toggling the wrong pins. The codec never came out of reset, so nothing downstream worked. I burned the better part of a day debugging it before I went back to the schematic, did a proper pin-by-pin diff against the previous board, and saw the changes. Once I updated the pin definitions in the firmware, it came up cleanly on the next flash. The fix was simple, but the wasted day was avoidable. The habit I built after that: before reusing any firmware on a new board, I do a side-by-side schematic compare for at least the SoC pinout, the power rails, and the bus connections. I now keep a short checklist for board reuse — what to verify before flashing — and I share it with anyone else taking over similar bring-up work on our team. The bigger lesson was that 'same chip' doesn't mean 'same board.' Even small hardware changes need an explicit firmware audit, not an assumption.`,
  },
  {
    id: 10,
    reminder: 'Tell me about a time you took initiative / solved a bottleneck',
    answer: `During an AEC integration project, I noticed something that was slowing the whole team down. The AEC algorithm had a handful of tuning parameters — the adaptive filter length, the NLMS step size, the double-talk-detector threshold, the residual echo suppressor gain, and the comfort noise level — and they were all hardcoded as constants in the source. Every time the audio tuning engineer wanted to try a different value to test echo cancellation quality, we had to change the constant, recompile the firmware, reflash the device, capture a recording, and listen. That round-trip took several minutes per parameter tweak, and we were doing dozens of tweaks per session.

Nobody assigned this to me, but it was clearly killing iteration speed. I spent a couple of days building a small wrapper library around the AEC parameters — each one exposed as a get/set API — and wired the API into our existing shell command interface on the device. After that, the tuning engineer could connect to the board, change any parameter live with a one-line command, and immediately hear the effect on the running pipeline. No recompile, no reflash, no restart.

The iteration cycle for parameter tuning dropped from minutes to seconds. The audio engineers started running tuning sessions on their own without needing me in the loop, which freed me up for other work. As a side benefit, the same wrapper became the foundation for automated tuning experiments later — we could script parameter sweeps and capture metrics without human intervention.

The thing I'm proudest of in that work is that I didn't wait for someone to ask. I saw the bottleneck, recognized that the fix was small relative to the friction it would remove, and built it.`,
  },
  {
    id: 11,
    reminder: "Tell me about the most difficult bug you've debugged",
    answer: `After integrating a new equalizer block, we'd get a quiet click roughly every half second — too quiet to hear in the office, but clean enough to show up on an FFT of the captured output. The period was the giveaway. It matched the rate at which our ping-pong DMA was switching halves of the audio buffer.

I went looking at how the algorithm and DMA shared state, and found a current_buffer index being written by the DMA-complete interrupt and read by the main processing loop with nothing protecting the access. Most of the time it was fine, but occasionally the main loop read a half-updated value and processed the wrong half for one frame.

Fix was volatile on the index and a brief interrupt disable around the few read sites that needed a consistent value. Click disappeared completely. The lesson: anything shared between an ISR and the main loop needs explicit synchronization — 'it's just one variable, it'll be atomic' is the bug that bites you in production.`,
  },
  {
    id: 12,
    reminder: 'Tell me about your proudest accomplishment',
    answer: `We needed to integrate AEC and a neural-network noise suppressor — the RNNoise architecture — into the same voice front-end on one of our smart-audio targets. Each algorithm worked fine in isolation, but the moment we tried to run them together at the native 48 kHz capture rate, we blew straight past the MIPS budget. The first reflex was to optimize each block in place — tighter SIMD, smaller network. Picked up some gains, not enough.

The fix that actually worked came from stepping back and looking at the system. The speaker playback path had to stay at 48 kHz for music quality, but the voice path didn't — voice commands and telephony sound perfectly clean at 8 kHz. So we split the chain: kept playback at 48 kHz but dropped a down sampler in front of the voice front-end. That cut AEC cost by roughly thirty times.

The unglamorous part was re-deriving every buffer size and frame-sync timing at the new rate. Once it was stitched up, the chain ran with comfortable margin and shipped.

The lesson I took: when you're MIPS-bound, the biggest wins usually aren't in the inner loop — they're one level up, in questioning the assumptions about what has to run at what rate.`,
  },
  {
    id: 13,
    reminder: 'Tell me about a time you had to learn something new quickly',
    answer: `One example I think about a lot: when I first started getting hardware bring-up tasks on new evaluation boards, I had to learn to read schematics and navigate component data-sheets quickly. My background is computer science — I came in solid on the software side but with essentially no formal training in reading schematics or working with hardware data-sheets. The first time someone handed me a new EVB and said 'bring this up,' I realized I had to ramp fast.

The way I approached it: I sat with the schematic for the new board and the schematic for a board I'd already worked on side by side, and I traced every signal from the SoC pin to the destination. That forced me to learn the symbols, the naming conventions, the pull-up and pull-down patterns, the level-shifting between voltage domains — by comparison rather than from a textbook. For the codec data-sheet, instead of trying to read it cover to cover, I'd jump to the section relevant to whatever I was wiring up that day — power sequencing, I2C register map, I2S configuration — and work through just that piece in depth.

After a few boards, I was comfortable enough that I could open a new schematic, identify the audio codec, find the I2C and I2S signals, check the pin musing on the SoC side, and know which data-sheet pages I'd need before writing any code.

The lesson for me was that hardware fluency, for a software engineer, is best built on a real bring-up rather than from a textbook. Side-by-side schematic comparison is the technique I'd recommend to anyone going through the same transition.`,
  },
];
