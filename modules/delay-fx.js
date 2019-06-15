import TempoMatcher from './tempo-matcher.js'

function midiFloat (value, from = 0, to = 127) {
  const range = to - from
  return (value - from) / range
}

function cubic (value) {
  return Math.pow(value, 3)
}

export default class DelayFX {
  constructor () {
    this.audioContext = window.audioContext
    this.output = new GainNode(this.audioContext)
    this.delay = this.audioContext.createDelay(10)
    this.returnGain = this.audioContext.createGain()
    this.inGain = this.audioContext.createGain()
    this.inGain.gain.value = 1
    this.returnGain.gain.value = 0.3
    this.filter = this.audioContext.createBiquadFilter()
    this.filter.mode = 'highpass'
    this.filter.frequency.value = 800
    this.filter.Q.value = -0.77
    this.shaper = this.audioContext.createWaveShaper()
    this.filter.connect(this.delay)
    this.inGain.connect(this.filter)
    this.delay.connect(this.returnGain)
    this.delay.connect(this.shaper)
    this.delay.connect(this.output)
    // this.shaper.connect(new GainNode(this.audioContext, { gain: 0.3 })).connect(this.output)

    this.returnGain.connect(this.delay)
    this.clockDivider = 3

    this.modAmount = new GainNode(this.audioContext, { gain: 0.0001 })
    this.lfo = new OscillatorNode(this.audioContext, { frequency: 8 })
    this.lfo.connect(this.modAmount).connect(this.delay.delayTime)
    // this.returnShaper.connect(this.delay)
    this.delay.delayTime.value = 0.2
    this.tempoMatcher = new TempoMatcher()
    this.setShaperCurve(50)
    this.lfo.start()
  }
  setShaperCurve (k) {
    const samples = 44100
    const curve = new Float32Array(samples)
    const deg = Math.PI / 180
    for (let i = 0; i < samples; ++i) {
      let x = i * 2 / samples - 1
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x))
    }
    this.shaper.curve = curve
  }
  clock (time) {
    this.tempoMatcher.clock(time)
    this.adjustDelayTime()
  }
  stop () {
    this.tempoMatcher.stop()
  }

  cc (ccnum, value) {
    if (ccnum === 1) { // delay time
      if (value > 64) {
        this.clockDivider = Math.round((value - 64) / 8)
      } else if (value < 63) {
        this.clockDivider = null
        this.delay.delayTime.setTargetAtTime((value / 63) / 2, this.audioContext.currentTime, 0.1)
      } else {
        this.clockDivider = 1
      }
    }
    if (ccnum === 2) { // feedback
      this.returnGain.gain.setTargetAtTime(cubic(midiFloat(value)) * 2, this.audioContext.currentTime, 0.001)
    }
  }

  get input () {
    return this.inGain
  }

  adjustDelayTime () {
    if (this.clockDivider) {
      const newTime = 60 / (this.tempoMatcher.tempo * 4) * this.clockDivider
      this.delay.delayTime.setTargetAtTime(newTime, this.audioContext.currentTime, 0.5)
    }
  }
}
