
```
██████╗  █████╗ ███████╗███████╗██╗     ██╗███╗   ██╗███████╗ ██╗  ██╗ ██╗ █████╗ 
██╔══██╗██╔══██╗██╔════╝██╔════╝██║     ██║████╗  ██║██╔════╝ ██║  ██║███║██╔══██╗
██████╔╝███████║███████╗█████╗  ██║     ██║██╔██╗ ██║█████╗   ███████║╚██║╚█████╔╝
██╔══██╗██╔══██║╚════██║██╔══╝  ██║     ██║██║╚██╗██║██╔══╝   ╚════██║ ██║██╔══██╗
██████╔╝██║  ██║███████║███████╗███████╗██║██║ ╚████║███████╗      ██║ ██║╚█████╔╝
╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝      ╚═╝ ╚═╝ ╚════╝
```

MIDI DRIVEN SYNTH RIG IN YOUR BROWSER

- originally written for [JSConfEu 2019 Festival X Opening](https://youtu.be/o1rzsna263c?t=1222) ([DOMinator](https://github.com/livejs/DOMinator))

Written by Matt McKegg (@mmckegg) & Jan Krutisch (@halfbyte)

<img width=100 src='teapot.png'/>

## Install / Use

- use git-lfs to check out the samples
- run npm i to install the webserver
- trigger stuff with midi! (yes, that easy. OR NOT)
- probably change the code to make it work with your midi setup

## Structure

- The modules folder contains all of the sound engine parts
- index.js contains the performance related setup
- Each Instrument, which can be one of
  - Drum/Oneshot Sampler
  - Slicer
  - Synth
- is then fed into a Mixer Channel which contains a
  - Bitcrusher
  - Dual filter (similar to these on DJ Mixers)
  - Sends to a Reverb and a Delay
  - A ducker (ala sidechain compression)

## License

See [LICENSE](LICENSE)
