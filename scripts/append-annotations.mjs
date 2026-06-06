// One-off script: append a list of annotations to the Firebase 'annotations' node.
// Usage:  node scripts/append-annotations.mjs
//
// Reads VITE_FIREBASE_* from .env via a tiny inline parser (no extra deps).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set } from 'firebase/database';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
    }),
);

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const newItems = [
  {
    answer: "volatile stops the compiler from optimizing away memory accesses but does not guarantee atomicity or ordering. std::atomic provides both true atomic operations and memory ordering guarantees. The rule of thumb is simple: use volatile for hardware registers and MMIO. Use std::atomic for shared data between threads. In embedded work, for ISR-to-task signaling, RTOS semaphores are often the better choice over std::atomic.",
    enabled: true,
    reminder: [
      "What is the difference between volatile and std::atomic, and when would you use each in an embedded system?",
      "When would you reach for std::atomic instead of just marking a variable volatile?",
      "Can you explain why volatile alone is not enough to safely share data between two threads?",
      "What guarantees does std::atomic give you that volatile does not?",
      "If an ISR and a task both access the same counter, how do you decide whether to use volatile, atomic, or an RTOS primitive?",
      "Have you ever had a bug caused by using volatile where you should have used something stronger?",
    ],
  },
  {
    answer: "On Cortex-M, aligned 32-bit load and store are already atomic — essentially free. Read-modify-write operations use LDREX and STREX instructions, which can retry under contention. Using acquire or release memory order inserts a DMB memory barrier. 64-bit atomics fall back to a library lock and are much slower. For shared counters, keeping them 32-bit and word-aligned avoids most of these costs.",
    enabled: true,
    reminder: [
      "What is the performance cost of using std::atomic on a Cortex-M processor, and what happens with 64-bit atomics?",
      "How does the hardware actually implement an atomic read-modify-write on a Cortex-M4?",
      "What happens under the hood when you use std::atomic with acquire or release ordering on ARM?",
      "Why should you avoid 64-bit atomics on a Cortex-M microcontroller?",
      "What is the difference between a free atomic operation and one that requires LDREX and STREX?",
      "How do you minimize the cost of atomic operations in a latency-sensitive embedded system?",
    ],
  },
  {
    answer: "The C++ memory model defines ordering rules because modern CPUs reorder memory accesses for speed. The four ordering options are: relaxed for atomic operations with no ordering, acquire for a consumer reading a flag, release for a producer publishing data, and seq_cst for full ordering which is the default and the slowest. The classic pattern is a producer release-storing a flag while the consumer acquire-loads it, guaranteeing the data is visible when the flag is seen.",
    enabled: true,
    reminder: [
      "Can you explain the basics of the C++ memory model and the difference between relaxed, acquire, release, and seq_cst ordering?",
      "Why does C++ have memory ordering options on atomic operations at all — what problem are they solving?",
      "What is the acquire-release pattern and when would you use it in embedded firmware?",
      "When is it safe to use relaxed memory ordering on an atomic variable?",
      "What is the cost of using seq_cst ordering and when is it worth it?",
      "How would you use the C++ memory model to safely publish a data buffer from a producer task to a consumer task?",
    ],
  },
  {
    answer: "RAII stands for Resource Acquisition Is Initialization. The idea is to bind a resource's lifetime to a stack object — the constructor acquires the resource and the destructor releases it on every exit path. A practical embedded example is an InterruptDisableScope class where the constructor calls __disable_irq() and the destructor restores the interrupt state. This eliminates manual cleanup and prevents leaks even when control flow is complex.",
    enabled: true,
    reminder: [
      "Can you explain RAII and give me a concrete embedded systems example of where you would apply it?",
      "How do you use C++ to guarantee that a critical section is always exited, even if the code inside returns early?",
      "What is the embedded equivalent of std::lock_guard, and how would you implement it?",
      "Have you ever used a C++ destructor to manage a hardware resource — what did that look like?",
      "Why is RAII particularly valuable in embedded systems compared to manual acquire and release calls?",
      "How would you design a class that automatically restores interrupt state when it goes out of scope?",
    ],
  },
  {
    answer: "Each class with virtual functions gets a vtable, which is an array of function pointers. Each object carries a hidden vptr pointing to that table. A virtual call requires two memory loads plus an indirect branch, which is hard for the CPU to predict. On a hot path this can cost 5 to 15 cycles plus pipeline stalls. The keyword final allows the compiler to devirtualize a call when the type can be proven at compile time. On the audio hot path, function pointers are preferred over virtual dispatch for the same flexibility at lower cost.",
    enabled: true,
    reminder: [
      "How does virtual function dispatch work in C++, and why would you avoid it on a performance-critical embedded path?",
      "What is a vtable and what is the runtime cost of a virtual function call on Cortex-M?",
      "How do you get polymorphic behavior in embedded C++ without paying the cost of virtual dispatch?",
      "When would you use the final keyword in C++, and what optimization does it enable?",
      "Have you ever replaced virtual functions with something cheaper in a real-time system — what did you use instead?",
      "Why is an indirect branch expensive on a microcontroller, and how does that affect your use of virtual functions?",
    ],
  },
  {
    answer: "constexpr tells the compiler to evaluate a function or value at compile time if possible. The result is baked directly into the binary and lives in flash rather than RAM. In embedded DSP work this is especially valuable for generating lookup tables like FIR coefficient tables or Bark-band tables at compile time, resulting in zero runtime cost and read-only flash placement.",
    enabled: true,
    reminder: [
      "What does constexpr do in C++, and how have you used it to improve performance in an embedded or DSP context?",
      "How do you move a computation from runtime to compile time in C++?",
      "What is the difference between const and constexpr in C++?",
      "How would you generate a lookup table at compile time instead of computing it at startup?",
      "Why does placing read-only data in flash matter in an embedded system, and how does constexpr help with that?",
      "Have you ever used constexpr to eliminate a runtime initialization cost — what was the table or value you generated?",
    ],
  },
  {
    answer: "Floating-point is easier to write and debug, with automatic dynamic range and hardware rounding, making it the default choice on chips with a hardware FPU. Fixed-point formats like Q15 and Q31 are faster on chips without an FPU, are deterministic in cycle count, and produce bit-exact results across runs. The tradeoff is that fixed-point requires careful headroom and saturation management. A common approach is to run most DSP in 32-bit floats on the FPU while using Q31 fixed-point for algorithms that require bit-exact convergence.",
    enabled: true,
    reminder: [
      "When would you choose fixed-point arithmetic over floating-point in an embedded DSP system, and what are the tradeoffs?",
      "What is the difference between Q15 and Q31 fixed-point formats, and when would you use each?",
      "Have you ever had to port a DSP algorithm from floating-point to fixed-point — what was the hardest part?",
      "Why does fixed-point produce bit-exact results while floating-point does not, and when does that distinction matter?",
      "How do you manage headroom and saturation when doing fixed-point arithmetic in an audio pipeline?",
      "On a chip with a hardware FPU, when would you still choose fixed-point over floating-point?",
    ],
  },
  {
    answer: "Compiler intrinsics map directly to specific CPU instructions, letting you use hardware features without writing assembly. On Cortex-M4, the most impactful intrinsic is __SMLAD, which performs two 16-bit multiply-accumulates in a single cycle. Replacing a standard C MAC loop in a FIR filter with __SMLAD can reduce cycle count by 30 to 40 percent. Other useful intrinsics include __DSB for memory barriers, __CLZ for count-leading-zeros, and __REV for byte-swapping.",
    enabled: true,
    reminder: [
      "Have you ever used compiler intrinsics in embedded C or C++? Which ones have you used and what performance improvement did they give you?",
      "How do you access a specific CPU instruction from C code without dropping into assembly?",
      "What is __SMLAD and why is it useful for DSP work on Cortex-M4?",
      "Tell me about a time you used a hardware-specific instruction to significantly reduce cycle count in a tight loop.",
      "What intrinsics have you used for memory barriers or byte manipulation on ARM Cortex-M?",
      "How do you decide when a compiler intrinsic is worth the loss of portability?",
    ],
  },
  {
    answer: "The golden rule is to never touch the heap during steady-state audio processing. Everything should be pre-allocated at initialization time. Techniques include static arrays sized at compile time, fixed-size object pools when constructor or destructor semantics are needed, and stack allocators for short-lived scratch memory. Placing hot buffers in DTCM gives deterministic access latency. A custom operator new that asserts on any call can be used to enforce this in CI.",
    enabled: true,
    reminder: [
      "How do you avoid heap allocation on the audio processing hot path, and what techniques do you use to manage memory instead?",
      "Why is dynamic memory allocation dangerous on a real-time audio hot path?",
      "How do you enforce a no-heap rule in your firmware codebase and catch violations automatically?",
      "What is DTCM and why would you place your audio buffers there specifically?",
      "How do you handle cases where you need object lifecycle management without using the heap?",
      "What is a fixed-size object pool and when would you use one instead of static allocation?",
    ],
  },
  {
    answer: "Release-only bugs are most commonly caused by missing volatile keywords, uninitialized variables that happened to be zero in debug builds, code that depends on assert side effects, stack overwrites that appear with more inlining, or strict-aliasing violations. The debugging method is to bisect optimization levels — testing at O0, O1, and O2 — to find which level breaks the behavior, then read the assembly diff and toggle individual compiler passes to narrow it down.",
    enabled: true,
    reminder: [
      "How do you approach debugging a bug that only appears in a release build but not in a debug build?",
      "What are the most common causes of a bug that disappears when you turn off compiler optimizations?",
      "Have you ever had a wait loop that worked in debug but hung in release — what caused it and how did you fix it?",
      "How do you use optimization level bisection to narrow down a compiler-related bug?",
      "What is a strict-aliasing violation and how can it cause a release-only bug?",
      "How does assert behavior differ between debug and release builds, and what bugs can that difference hide?",
    ],
  },
];

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const PATH = 'annotations';

const snap = await get(ref(db, PATH));
const existing = snap.exists()
  ? Array.isArray(snap.val())
    ? snap.val()
    : Object.values(snap.val())
  : [];

const withIds = newItems.map((item) => ({ id: randomUUID(), ...item }));
const combined = [...existing, ...withIds];

await set(ref(db, PATH), combined);

console.log(`✅ Appended ${withIds.length} item(s). Total now: ${combined.length}`);
process.exit(0);
