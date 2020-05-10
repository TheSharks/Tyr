# Tyr
Tyr is a lightweight [Lavalink](https://github.com/Frederikam/Lavalink) implementation built around [Eris](https://github.com/abalabahaha/Eris).

# Getting started
This is a quick overview on how to get started with Tyr, for more comprehensive documentation please see the [docs](https://thesharks.github.io/Tyr)

## Installation
Tyr includes a `VoiceConnectionManager` that replaces the built-in one from Eris
```js
const Eris = require('eris')
const bot = new Eris('cooltoken')
const { LavalinkVoiceConnectionManager } = require('@thesharks/tyr')

bot.voiceConnections = new LavalinkVoiceConnectionManager([
  {
    host: 'localhost',
    port: 8080,
    password: 'youshallnotpass',
    region: 'eu', // what region is the node in?
  }
], {
  shards: 2, // how many shards are you running?
  userId: '107904023901777920' // what's the user ID from your bot?
})
```

## Usage
To join voice channels and manipulate players, use the same methods you'd use with Eris
```js
bot.joinVoiceChannel('302538492393816086').then(player => {
  // do something cool with the player
})
```

Playing tracks is done by first calling `<LavalinkNode>.loadTracks`
```js
const player = bot.voiceConnections.get('110462143152803840')
player.node.loadTracks('qFDP9egTwfM').then(result => {
  player.play(result.tracks[0].track)
})
```

## Regions
Tyr will try to balance players to nodes that are the least busy, and are in the same region as the guild the player is created from.
By default, Tyr recognizes the following regions and what voice servers they correspond to:
```js
{
  asia: ['singapore', 'hongkong', 'russia', 'japan', 'india', 'dubai'],
  eu: ['europe', 'amsterdam', 'london', 'frankfurt', 'eu-central', 'eu-west', 'vip-amsterdam'],
  us: ['us-west', 'us-east', 'us-central', 'us-south', 'brazil', 'vip-us-west', 'vip-us-east'],
  africa: ['southafrica'],
  australia: ['sidney']
}
```
It's possible to override the default regions by passing a new object with regions when constructing the connection manager