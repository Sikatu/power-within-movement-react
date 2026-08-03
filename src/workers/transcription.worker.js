import { pipeline, env } from '@xenova/transformers';

// Disable local models to fetch from Hugging Face hub
env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
  static task = 'automatic-speech-recognition';
  static model = 'Xenova/whisper-base.en';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

// In a Web Worker, AudioContext is sometimes not available depending on the browser,
// so we'll pass the Float32Array directly from the main thread instead of decoding here.
self.addEventListener('message', async (event) => {
  const { type, audioData, uid } = event.data;

  if (type === 'transcribe') {
    try {
      // 1. Initialize the pipeline
      const transcriber = await PipelineSingleton.getInstance((x) => {
        // Send progress updates (model downloading) to the main thread
        self.postMessage({ uid, status: 'progress', data: x });
      });

      // 2. Run the transcription
      self.postMessage({ uid, status: 'processing' });

      // Calculate duration to prevent chunking bugs on very short audio
      const duration_s = audioData.length / 16000;
      const options = {
        language: 'english',
        task: 'transcribe',
      };

      // Only apply chunking if the audio is actually longer than a single chunk
      if (duration_s > 30) {
        options.chunk_length_s = 30;
        options.stride_length_s = 5;
      }

      const output = await transcriber(audioData, options);

      // 3. Send the final transcript back
      let finalString = '';
      if (typeof output === 'string') {
        finalString = output;
      } else if (output && output.text) {
        finalString = output.text;
      } else if (Array.isArray(output)) {
        finalString = output.map(chunk => chunk.text || '').join(' ');
      }

      self.postMessage({ uid, status: 'complete', text: finalString });
    } catch (error) {
      self.postMessage({ uid, status: 'error', message: error.message });
    }
  }
});
