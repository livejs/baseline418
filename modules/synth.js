const FILTER_SMOOTHING = 0.05
const AMP_SMOOTHING = 0.01
const PITCH_SMOOTHING = 0.01

export default class Synth {
  constructor ({ sub = 1, vibrato = 0 } = {}) {
    this.context = window.audioContext

    // build exp curve
    const expCurve = new Float32Array(256)
    for (let i = 0; i < 128; i++) {
      let value = i / 127
      expCurve[i + 128] = Math.pow(value, 2)
    }

    console.log(expCurve)

    // build drive curve
    const shaperCurveAmount = 50
    const driveCurve = new Float32Array(this.context.sampleRate)
    const deg = Math.PI / 180
    for (let i = 0; i < this.context.sampleRate; ++i) {
      let x = i * 2 / this.context.sampleRate - 1
      driveCurve[i] = (3 + shaperCurveAmount) * x * 20 * deg / (Math.PI + shaperCurveAmount * Math.abs(x))
    }

    // build noise buffer
    const noiseLength = 2 * this.context.sampleRate
    const noiseBuffer = this.context.createBuffer(1, noiseLength, this.context.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (var i = 0; i < noiseLength; i++) {
      noiseData[i] = Math.random() * 2 - 1
    }

    // oscillators
    this.squareOsc = new OscillatorNode(this.context, { type: 'square', frequency: 440 })
    this.sawOsc = new OscillatorNode(this.context, { type: 'sawtooth', frequency: 440 })
    this.subOsc = new OscillatorNode(this.context, { type: 'triangle', frequency: 220 })
    this.noise = new AudioBufferSourceNode(this.context, { buffer: noiseBuffer, loop: true })
    this.vibratoLfo = new OscillatorNode(this.context, { type: 'triangle', frequency: 8 })

    this.squareAmp = new GainNode(this.context, { gain: 1 })
    this.sawAmp = new GainNode(this.context, { gain: 0 })
    this.subAmp = new GainNode(this.context, { gain: sub })
    this.noiseAmp = new GainNode(this.context, { gain: 0 })
    this.drive = new WaveShaperNode(this.context, { curve: driveCurve })
    this.filter = new BiquadFilterNode(this.context, { type: 'lowpass', frequency: 0 })
    this.vca = new GainNode(this.context, { gain: 0 })

    this.envelope = new ConstantSourceNode(this.context)
    this.noteValue = new ConstantSourceNode(this.context)
    this.pitch = new ConstantSourceNode(this.context)
    this.detuneValue = new ConstantSourceNode(this.context)
    this.filterEnvelopeAmount = new GainNode(this.context, { gain: 0.5 })
    this.vibratoAmount = new GainNode(this.context, { gain: vibrato })
    this.filterValue = new ConstantSourceNode(this.context, { offset: 0.01 })
    this.filterShaper = new WaveShaperNode(this.context, { curve: expCurve })
    this.filterOffset = new ConstantSourceNode(this.context, { offset: 20 })
    // filter modulation connections
    this.envelope.connect(this.filterEnvelopeAmount).connect(this.filterShaper)
    this.filterValue.connect(this.filterShaper)
    this.filterShaper.connect(new GainNode(this.context, { gain: 20000 })).connect(this.filter.frequency)

    // pitch modulation connnections
    this.noteValue.connect(this.squareOsc.detune)
    this.noteValue.connect(this.sawOsc.detune)
    this.noteValue.connect(this.subOsc.detune)
    this.detuneValue.connect(this.sawOsc.detune)
    this.vibratoLfo.connect(this.vibratoAmount).connect(this.pitch.offset)
    this.pitch.connect(this.noteValue.offset)
    this.filterOffset.connect(this.filter.frequency)

    // signal flow
    this.squareOsc.connect(this.squareAmp).connect(this.filter)
    this.sawOsc.connect(this.sawAmp).connect(this.filter)
    this.subOsc.connect(this.subAmp).connect(this.filter)
    this.noise.connect(this.noiseAmp).connect(this.filter)
    this.filter.connect(new GainNode(this.context, { gain: 0.1 })).connect(this.drive).connect(this.vca)
    // this.filter.connect(this.vca)

    // oscillator start
    this.squareOsc.start()
    this.sawOsc.start()
    this.subOsc.start()
    this.noise.start()
    this.vibratoLfo.start()
    this.filterOffset.start()

    // constant source start
    this.pitch.start()
    this.noteValue.start()
    this.detuneValue.start()
    this.envelope.start()
    this.filterValue.start()

    // state
    this.attackDuration = 0.5
    this.decayDuration = 0.5
    this.sustain = 0
    this.releaseDuration = 0.1
    this.glideDuration = 0.01
    this.noteStack = []
  }

  get output () {
    return this.vca
  }

  cc (control, value) {
    const time = this.context.currentTime
    if (control === 1) { // attack
      this.attackDuration = exp(midiFloat(value)) * 4
    } else if (control === 2) { // decay
      this.decayDuration = exp(midiFloat(value)) * 4
    } else if (control === 3) { // sustain
      this.sustain = midiFloat(value)
    } else if (control === 4) { // release
      this.releaseDuration = exp(midiFloat(value)) * 4
    } else if (control === 5) { // portamento
      this.glideDuration = exp(midiFloat(value)) * 2
    } else if (control === 6) { // cutoff
      this.filterValue.offset.setTargetAtTime(exp(midiFloat(value)), time, FILTER_SMOOTHING)
    } else if (control === 7) { // resonance
      this.filter.Q.setTargetAtTime(exp(midiFloat(value)) * 20, time, FILTER_SMOOTHING)
    } else if (control === 8) { // filter envelope
      this.filterEnvelopeAmount.gain.setTargetAtTime(exp(midiFloat(value) * 2 - 1), time, FILTER_SMOOTHING)
    } else if (control === 9) { // square <-|-> saw
      this.squareAmp.gain.setTargetAtTime(exp(1 - midiFloat(value)), time, AMP_SMOOTHING)
      this.sawAmp.gain.setTargetAtTime(exp(midiFloat(value)), time, AMP_SMOOTHING)
    } else if (control === 10) { // sub
      this.subAmp.gain.setTargetAtTime(exp(midiFloat(value) * 1.5), time, AMP_SMOOTHING)
    } else if (control === 11) { // noise
      this.noiseAmp.gain.setTargetAtTime(exp(midiFloat(value)), time, AMP_SMOOTHING)
    } else if (control === 12) { // amp envelope amount
      // TODO
    } else if (control === 13) { // oscillator detune
      this.detuneValue.offset.setTargetAtTime((midiFloat(value) * 2 - 1) * 1200, time, PITCH_SMOOTHING)
    } else if (control === 14) { // vibrato
      this.vibratoAmount.gain.setTargetAtTime(midiFloat(value) * 200, time, PITCH_SMOOTHING)
    } else if (control === 15) { // pitch

    } else if (control === 16) { // pitch envelope
      // TODO
    }
  }

  pb (value) {
    const time = this.context.currentTime
    this.pitch.offset.setTargetAtTime((value * 2 - 1) * 1200 + 1200, time, PITCH_SMOOTHING)
  }

  noteOn (note, velocity) {
    this._setNote(note)
    this._triggerAttack()
    this.noteStack.push(note)
  }

  noteOff (note) {
    let last = this.noteStack[this.noteStack.length - 1]
    removeAllFrom(note, this.noteStack)
    console.log(note, this.noteStack)
    if (this.noteStack.length && last === note) {
      this._triggerAttack()
      this._setNote(this.noteStack[this.noteStack.length - 1])
    } else if (!this.noteStack.length) {
      this._triggerRelease()
    }
  }

  stop () {
    // stop all notes
    this.noteStack.length = 0
    this._triggerRelease()
    this.envelope.offset.setValueAtTime(0, this.context.currentTime)
  }

  // private

  _triggerAttack () {
    const time = this.context.currentTime
    this.vca.gain.setTargetAtTime(1, window.audioContext.currentTime, 0.01)

    this.envelope.offset.linearRampToValueAtTime(1, time + this.attackDuration)
    this.envelope.offset.setTargetAtTime(Math.max(0.0001, this.sustain), time + this.attackDuration, this.decayDuration / 8)
  }

  _triggerRelease () {
    const time = this.context.currentTime
    this.vca.gain.cancelScheduledValues(time)

    this.envelope.offset.setTargetAtTime(0.0001, time, this.releaseDuration / 8)
    this.vca.gain.setTargetAtTime(0.0001, time, this.releaseDuration / 8)
  }

  _setNote (note) {
    if (this.lastNote !== note) {
      const time = this.context.currentTime
      this.noteValue.offset.cancelAndHoldAtTime(time)
      this.noteValue.offset.linearRampToValueAtTime((note - 69) * 100, time + this.glideDuration)
      this.lastNote = note
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

function removeAllFrom (value, array) {
  for (var i = array.length; i--; i >= 0) {
    if (array[i] === value) {
      array.splice(i, 1)
    }
  }
}
