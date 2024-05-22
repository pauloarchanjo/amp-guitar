// Seleção de elementos DOM
const volumeControl = document.getElementById('volume');
const bassControl = document.getElementById('bass');
const midControl = document.getElementById('mid');
const trebleControl = document.getElementById('treble');
const visualizerCanvas = document.getElementById('visualizer');

// Inicialização do contexto de áudio e nós de áudio
const audioContext = new AudioContext();
const analyserNode = new AnalyserNode(audioContext, { fftSize: 256 });
const gainNode = new GainNode(audioContext, { gain: volumeControl.value });
const bassEQ = createEQNode(audioContext, 'lowshelf', 500, bassControl.value);
const midEQ = createEQNode(audioContext, 'peaking', 1500, midControl.value, Math.SQRT1_2);
const trebleEQ = createEQNode(audioContext, 'highshelf', 3000, trebleControl.value);

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
