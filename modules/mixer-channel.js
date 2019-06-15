const FILTER_SMOOTHING = 0.1
const GAIN_SMOOTHING = 0.01

export default class MixerChannel {
  constructor ({ duckAmount = 0, highPass = 0, volume = 1, reverb = 0 } = {}) {
    const ctx = window.audioContext
    this.input = new GainNode(ctx)
    this.output = new GainNode(ctx, { gain: volume })

    // inserts
    this.bitCrusher = new AudioWorkletNode(ctx, 'bit-crusher-processor')
    this.bitDepth = this.bitCrusher.parameters.get('bitDepth')
    this.frequencyReduction = this.bitCrusher.parameters.get('frequencyReduction')
    this.lowPass = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 22000 })
    this.highPass = new BiquadFilterNode(ctx, { type: 'highpass', frequency: highPass })
    this.compressor = ctx.createDynamicsCompressor({
      threshold: -30,
      ratio: 5,
      attack: 0.01,
      release: 0.25
    })

    // sends
    this.reverbSend = new GainNode(ctx, { gain: reverb })
    this.delaySend = new GainNode(ctx, { gain: 0 })

    // state
    this.duckAmount = duckAmount

    // connections
    this.input.connect(this.bitCrusher)
    this.bitCrusher.connect(this.lowPass).connect(this.highPass).connect(this.output)
    this.highPass.connect(this.reverbSend)
    this.highPass.connect(this.delaySend)
  }

  quack () { // duck typing for audio ducking! Yes we are ducking serious! 🦆
    const time = window.audioContext.currentTime
    if (this.duckAmount) {
      const duckValue = Math.max(0, 1 - this.duckAmount)
      const attack = 0.02
      const release = 0.4
      this.input.gain.linearRampToValueAtTime(duckValue, time + attack)
      this.input.gain.linearRampToValueAtTime(1, time + attack + release)
    }
  }

  cc (id, value) {
    let time = window.audioContext.currentTime
    if (id === 1) { // VOLUME
      this.output.gain.setTargetAtTime(cubic(midiFloat(value) * 1.5), time, GAIN_SMOOTHING)
    } else if (id === 2) { // REVERB SEND
      this.reverbSend.gain.setTargetAtTime(cubic(midiFloat(value)), time, GAIN_SMOOTHING)
    } else if (id === 3) { // DELAY SEND
      this.delaySend.gain.setTargetAtTime(cubic(midiFloat(value)), time, GAIN_SMOOTHING)
    } else if (id === 4) { // DUAL FILTER
      if (value > 64) {
        this.lowPass.frequency.setTargetAtTime(20000, time, FILTER_SMOOTHING)
        this.highPass.frequency.setTargetAtTime(cubic(midiFloat(value, 64, 127)) * 20000 + 20, time, FILTER_SMOOTHING)
      } else if (value < 63) {
        this.lowPass.frequency.setTargetAtTime(cubic(midiFloat(value, 0, 63)) * 20000 + 20, time, FILTER_SMOOTHING)
        this.highPass.frequency.setTargetAtTime(20, time, 0.1)
      } else {
        this.lowPass.frequency.setTargetAtTime(20000, time, 0.1)
        this.highPass.frequency.setTargetAtTime(20, time, 0.1)
      }
    } else if (id === 5) { // BIT REDUCTION
      this.bitDepth.setTargetAtTime(16 - (value / 127 * 15), time, FILTER_SMOOTHING)
    } else if (id === 6) { // RATE REDUCTION
      this.frequencyReduction.setTargetAtTime(1.0 - midiFloat(value), time, FILTER_SMOOTHING)
    } else if (id === 7) { // DUCKING AMOUNT
      this.duckAmount = midiFloat(value)
    }
  }
}

function midiFloat (value, from = 0, to = 127) {
  const range = to - from
  return (value - from) / range
}

function exp (value) {
  return value * value
}

function cubic (value) {
  return Math.pow(value, 3)
}
