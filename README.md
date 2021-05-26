# Tyr
Tyr is a lightweight and library-agnostic [Lavalink](https://github.com/freyacodes/Lavalink) implementation.

Tyr includes a connection manager class for [Eris](https://github.com/abalabahaha/Eris).

# Getting started with Eris
## Installation
Tyr includes a `ErisPlayerManager` that replaces the built-in manager from Eris
```js
const Eris = require('eris')
const bot = new Eris('cooltoken')
const { ErisPlayerManager } = require('@thesharks/tyr/eris')

if (!(bot.voiceConnections instanceof ErisPlayerManager)) {
  bot.voiceConnections = new ErisPlayerManager([
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
}
```

## Usage
To join voice channels and manipulate players, use the same methods you'd use with Eris
```js
bot.joinVoiceChannel('302538492393816086').then(player => {
  // do something cool with the player
})
```

Playing tracks is done by first calling `<Node>.loadTracks`
```js
const player = bot.voiceConnections.get('110462143152803840')
player.node.loadTracks('ytsearch:qFDP9egTwfM').then(result => {
  player.play(result.tracks[0].track)
})
```

## Regions
The connection manager will try to balance players to nodes that are the least busy, and are in the same region as the guild the player is created from.
By default, the connection manager recognizes the following regions and what voice servers they correspond to:
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