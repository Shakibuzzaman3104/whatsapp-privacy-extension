// Copies MediaPipe's SIMD WebAssembly build into the extension (MV3 forbids loading code remotely).
import { copyFileSync, mkdirSync } from 'node:fs';
const from = 'node_modules/@mediapipe/tasks-vision/wasm';
const to = 'public/mediapipe';
mkdirSync(to, { recursive: true });
for (const file of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) copyFileSync(`${from}/${file}`, `${to}/${file}`);
