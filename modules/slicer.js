const PITCH_SMOOTHING = 0.001

export default class Slicer {
  constructor ({ audioBuffer, sliceCount, ticks, tickQuantize = 6, startNote = 0 }) {
    this.buffer = audioBuffer
    this.ticks = ticks
    this.sliceCount = sliceCount
    this.tickQuantize = tickQuantize
    this.startNote = startNote
    this.output = new GainNode(window.audioContext)

    // STATE
    this.detuneAmount = 0
    this.position = 0
    this.lastPosition = 0
    this.length = 0
    this.playing = false
    this.envelope = null
    this.player = null
  }

  clock () {
    if (this.buffer) {
      const ctx = window.audioContext
      if (this.playing && this.length < this.ticks / this.sliceCount) {
        const quantizedPosition = this.position % this.tickQuantize
        // const distance = Math.abs(this.position - this.lastPosition)

        if (quantizedPosition === 0) {
          const offset = (this.position / this.ticks) * this.buffer.duration

          if (this.player) {
            this._choke()
          }

          this.envelope = new GainNode(ctx, { gain: 0 })
          this.player = new AudioBufferSourceNode(ctx, { buffer: this.buffer, detune: this.detuneAmount })
          this.player.start(ctx.currentTime, offset)
          this.envelope.gain.setTargetAtTime(1, ctx.currentTime, 0.001)
          this.player.connect(this.envelope).connect(this.output)
          this.lastPosition = this.position
        }
      } else if (this.player) {
        this._choke()
      }
    }
    this.position = (this.position + 1) % this.ticks
    this.length += 1
  }

  noteOn (noteId, velocity) {
    if (noteId >= this.startNote && noteId < this.startNote + this.sliceCount) {
      let sliceIndex = noteId - this.startNote
      let sliceLength = this.ticks / this.sliceCount
      this.position = Math.floor(sliceLength * sliceIndex)
      this.length = 0
      this.playing = true
      this.clock()
    } else {
      this.playing = false
    }
  }

  stop () {
    // stop all sounds on MIDI Clock Stop signal
    this._choke()
    this.playing = false
  }

  pb (value) {
    this.detuneAmount = value * 1200

    if (this.player) {
      this.player.detune.setTargetAtTime(value * 1200, window.audioContext.currentTime, PITCH_SMOOTHING)
    }
  }

  // private
  _choke () {
    const ctx = window.audioContext
    if (this.player) {
      this.player.stop(ctx.currentTime + 0.01)
      this.envelope.gain.setTargetAtTime(0, ctx.currentTime, 0.001)
      this.player = null
      this.envelope = null
    }
  }
}
