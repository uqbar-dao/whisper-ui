import { pipeline } from '@xenova/transformers';

class MyTranscriptionPipeline {
  static task = "automatic-speech-recognition";
  static model = "Xenova/whisper-tiny.en";
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      // const config = await AutoConfig.from_pretrained(this.model);
      this.instance = pipeline(this.task, this.model, { progress_callback, quantized: false });
    }

    return this.instance;
  }
}

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
  let transcriber = await MyTranscriptionPipeline.getInstance((x) => {
    self.postMessage(x);
  });

  let audioData = event.data.audio;

  if (Array.isArray(audioData)) {
      if (audioData.length > 1) {
          const SCALING_FACTOR = Math.sqrt(2);

          // Merge channels (into first channel to save memory)
          for (let i = 0; i < audioData[0].length; ++i) {
              audioData[0][i] = SCALING_FACTOR * (audioData[0][i] + audioData[1][i]) / 2;
          }
      }

      // Select first channel
      audioData = audioData[0];
  }

  let output = await transcriber(audioData, {
    // callback_function: (x) => { // TODO what is this for
    //     console.log(x)
    //     self.postMessage({ status: 'update', output: transcriber})
    //   }
  });

  // Send the output back to the main thread
  self.postMessage({
    status: "complete",
    output: output,
  });
});
