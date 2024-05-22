const volumeControl = document.getElementById('volume');
const bassControl = document.getElementById('bass');
const midControl = document.getElementById('mid');
const trebleControl = document.getElementById('treble');
const visualizerCanvas = document.getElementById('visualizer');
const recordButton = document.getElementById('record-button');
const counter = document.getElementById('counter');

const audioContext = new AudioContext();
const analyserNode = new AnalyserNode(audioContext, { fftSize: 256 });
const gainNode = new GainNode(audioContext, { gain: volumeControl.value });
const bassEQ = createEQNode(audioContext, 'lowshelf', 500, bassControl.value);
const midEQ = createEQNode(audioContext, 'peaking', 1500, midControl.value, Math.SQRT1_2);
const trebleEQ = createEQNode(audioContext, 'highshelf', 3000, trebleControl.value);

let mediaRecorder;
let recordedChunks = [];
let recordingInterval;
let startTime;

setupEventListeners();
initializeAudioContext();
resizeVisualizer();
startVisualizer();

function createEQNode(context, type, frequency, gain, Q = 1) {
  return new BiquadFilterNode(context, { type, frequency, gain, Q });
}

function setupEventListeners() {
  window.addEventListener('resize', resizeVisualizer);

  volumeControl.addEventListener('input', (e) => {
    updateAudioParameter(gainNode.gain, e.target.value);
  });

  bassControl.addEventListener('input', (e) => {
    updateAudioParameter(bassEQ.gain, e.target.value);
  });

  midControl.addEventListener('input', (e) => {
    updateAudioParameter(midEQ.gain, e.target.value);
  });

  trebleControl.addEventListener('input', (e) => {
    updateAudioParameter(trebleEQ.gain, e.target.value);
  });

  recordButton.addEventListener('click', toggleRecording);
}

function updateAudioParameter(parameter, value) {
  parameter.setTargetAtTime(parseFloat(value), audioContext.currentTime, 0.01);
}

async function initializeAudioContext() {
  const guitarStream = await getGuitarStream();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  const source = audioContext.createMediaStreamSource(guitarStream);
  connectAudioNodes(source, [bassEQ, midEQ, trebleEQ, gainNode, analyserNode, audioContext.destination]);
  setupRecorder(guitarStream);
}

function connectAudioNodes(source, nodes) {
  nodes.reduce((prev, curr) => prev.connect(curr), source);
}

function getGuitarStream() {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
      latency: 0
    }
  });
}

function startVisualizer() {
  requestAnimationFrame(startVisualizer);

  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyserNode.getByteFrequencyData(dataArray);
  drawVisualizer(dataArray);
}

function drawVisualizer(dataArray) {
  const width = visualizerCanvas.width;
  const height = visualizerCanvas.height;
  const barWidth = width / dataArray.length;
  const canvasContext = visualizerCanvas.getContext('2d');
  canvasContext.clearRect(0, 0, width, height);

  dataArray.forEach((value, index) => {
    const barHeight = (value / 255) * height;
    const x = barWidth * index;
    const color = `hsl(${(barHeight / height) * 400}, 100%, 50%)`;

    canvasContext.fillStyle = color;
    canvasContext.fillRect(x, height - barHeight, barWidth, barHeight);
  });
}

function resizeVisualizer() {
  visualizerCanvas.width = visualizerCanvas.clientWidth * window.devicePixelRatio;
  visualizerCanvas.height = visualizerCanvas.clientHeight * window.devicePixelRatio;
}

function setupRecorder(stream) {
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, {
      type: 'audio/wav; codecs=opus'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'recording.wav';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);

    stopCounter();
  };
}

function toggleRecording() {
  if (mediaRecorder.state === 'inactive') {
    recordedChunks = [];
    mediaRecorder.start();
    recordButton.textContent = 'STOP';
    startCounter();
  } else {
    mediaRecorder.stop();
    recordButton.textContent = 'RECORDING';
  }
}

function startCounter() {
  startTime = Date.now();
  recordingInterval = setInterval(updateCounter, 10);
}

function updateCounter() {
  const elapsedMilliseconds = Date.now() - startTime;
  const minutes = Math.floor(elapsedMilliseconds / 60000);
  const seconds = Math.floor((elapsedMilliseconds % 60000) / 1000);
  const milliseconds = Math.floor((elapsedMilliseconds % 1000) / 10);

  counter.textContent = `${pad(minutes, 2)}:${pad(seconds, 2)}:${pad(milliseconds, 2)}`;
}

function stopCounter() {
  clearInterval(recordingInterval);
  counter.textContent = '00:00:00';
}

function pad(number, length) {
  return number.toString().padStart(length, '0');
}
