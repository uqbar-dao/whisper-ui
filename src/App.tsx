import { useState, useEffect, useRef } from 'react'
import './App.css'
import Progress from './components/Progress';
import { AudioRecorder } from 'react-audio-voice-recorder';
import { Buffer } from 'buffer';
import { WaveFile } from 'wavefile';

type FileProgress = {
  file: string;
  progress: number;
}

function App() {
  const [ready, setReady] = useState(false);
  const [progressItems, setProgressItems] = useState<Array<FileProgress>>([]);
  const worker = useRef<Worker>();

  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(`${window.location.origin}/worker.js`, {
        type: 'module'
      });

      worker.current.addEventListener('error', (event) => {
        console.error('Error in web worker:', event);
      });
    }

    const onMessageReceived = (e: MessageEvent<any>) => {
      switch (e.data.status) {
        case 'initiate':
          // Model file start load: add a new progress item to the list.
          setReady(false);
          setProgressItems(prev => [...prev, e.data] as Array<FileProgress>); // Explicitly specify the type of `prev`
          break;


        case 'progress':
          // Model file progress: update one of the progress items.
          setProgressItems(
            prev => prev.map(item => {
              if (item.file === e.data.file) {
                return { ...item, progress: e.data.progress }
              }
              return item;
            })
          );
          break;

        case 'done':
          // Model file loaded: remove the progress item from the list.
          setProgressItems(
            prev => prev.filter(item => item.file !== e.data.file)
          );
          break;

        case 'ready':
          // Pipeline ready: the worker is ready to accept messages.
          setReady(true);
          break;
        
        case 'complete':
          // Generation complete: re-enable the "Search" button
          console.log('complete', e.data.output.text)
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener('message', onMessageReceived);

    // Define a cleanup function for when the component is unmounted.
    return () => worker?.current.removeEventListener('message', onMessageReceived);
  }, [])

  const addAudioElement = async (rawBlob: Blob) => {
    // 1. convert the webm to wav
    const FFmpeg = await import("@ffmpeg/ffmpeg");
    const ffmpeg = FFmpeg.createFFmpeg({ log: false });
    await ffmpeg.load();

    const inputName = "input.webm";
    const outputName = "output.wav";

    ffmpeg.FS(
      "writeFile",
      inputName,
      new Uint8Array(await rawBlob.arrayBuffer())
    );

    await ffmpeg.run("-i", inputName, outputName);

    const outputData = ffmpeg.FS("readFile", outputName);
    const wavBlob = new Blob([outputData.buffer], {
      type: `audio/wav`,
    });

    // 2. process the wav
    const buffer = Buffer.from(await wavBlob.arrayBuffer())
    const wav = new WaveFile(buffer);
    wav.toBitDepth('32f'); // Pipeline expects input as a Float32Array
    wav.toSampleRate(16000); // Whisper expects audio with a sampling rate of 16000
    const audioData = wav.getSamples();

    // 3. send the wav to the worker
    worker.current.postMessage({
      audio: audioData,
    })
  }

  return (
    <>
      <AudioRecorder 
        onRecordingComplete={addAudioElement}
        showVisualizer={true}
        audioTrackConstraints={{
          noiseSuppression: true,
          echoCancellation: true,
          sampleRate: 16000,
        }} 
        downloadOnSavePress={false}
        downloadFileExtension="wav"
      />
      <div className='progress-bars-container'>
        {ready === false && (
          <label>Loading models... (only run once)</label>
        )}
        {progressItems.map(data => (
          <div key={data.file}>
            <Progress text={data.file} percentage={data.progress} />
          </div>
        ))}
      </div>
      {/* <button onClick={loadModels}>Search</button> */}
    </>
  )
}

export default App
