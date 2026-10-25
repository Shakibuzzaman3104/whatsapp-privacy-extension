/**
 * @author Shakib
 * @since 25/10/26
 *
 * Hidden page that owns the camera while the guard runs. Frames never leave
 * this page: only the number of faces is sent to the background.
 */
import { FaceDetector } from '@mediapipe/tasks-vision';
import { SAMPLE_MS } from '@/lib/guard';
import { sendToBackground } from '@/lib/messages';

const video = document.getElementById('camera') as HTMLVideoElement;

async function start() {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, frameRate: 5 } });
  } catch (error) {
    await sendToBackground({ type: 'cameraError', name: (error as DOMException).name ?? 'Error' });
    return;
  }
  video.srcObject = stream;
  await video.play();

  const detector = await FaceDetector.createFromOptions(
    {
      wasmLoaderPath: chrome.runtime.getURL('/mediapipe/vision_wasm_internal.js'),
      wasmBinaryPath: chrome.runtime.getURL('/mediapipe/vision_wasm_internal.wasm'),
    },
    {
      baseOptions: { modelAssetPath: chrome.runtime.getURL('/mediapipe/blaze_face_short_range.tflite'), delegate: 'CPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.6,
    },
  );

  setInterval(() => {
    if (video.readyState < 2) return;
    const { detections } = detector.detectForVideo(video, performance.now());
    void sendToBackground({ type: 'faces', count: detections.length });
  }, SAMPLE_MS);
}

void start().catch((error) => sendToBackground({ type: 'cameraError', name: String(error?.name ?? 'Error') }));
