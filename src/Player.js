let EventEmitter

try {
  EventEmitter = require('eventemitter3')
} catch (_) {
  EventEmitter = require('events').EventEmitter
}

module.exports = class Player extends EventEmitter {
  /**
   * @param {LavalinkNode} node The node supporting this player
   * @param {String} guild The ID of the guild where this player is used
   * @param {module:eris.Shard} shard The shard that runs this player
   */
  constructor (node, guild, shard) {
    super()
    this.node = node
    this.guild = guild
    this.paused = false
    this.connected = false
    this.state = null
    this.shard = shard
  }

  /**
   * Connect the player to Discord and prepare for playback
   * @param {Object} data Data to use for connecting to Discord
   * @param {String} data.sessionId Session ID for the voice session
   * @param {Object} data.event Object containing voice server information
   * @param {String} data.event.endpoint The endpoint of the voice server
   * @param {String} data.event.guild_id The ID of the guild where this player is assigned to
   * @param {String} data.event.token The token used to identify with the voice server
   */
  connect (data) {
    this.node.send({
      op: 'voiceUpdate',
      guildId: this.guild,
      sessionId: data.sessionId,
      event: data.event
    })
    this.connected = true
    this.emit('ready')
  }

  /**
   * Instruct the player to play a loaded track
   * In order to use this, order the node to load the track first
   * @param {String} track Base64 string corresponding to the track
   */
  play (track) {
    this.node.send({
      op: 'play',
      guildId: this.guild,
      track: track
    })
  }

  /**
   * Adjust the player's volume
   * @param {Number} volume How loud the player should be
   */
  setVolume (volume) {
    this.node.send({
      op: 'volume',
      guildId: this.guild,
      volume: volume
    })
  }

  /**
   * Stop the player
   */
  stop () {
    this.node.send({
      op: 'stop',
      guildId: this.guild
    })
  }

  /**
   * Destroy the player
   * This does not affect voice state
   */
  destroy () {
    this.node.send({
      op: 'destroy',
      guildId: this.guild
    })
  }

  /**
   * Disconnect the player
   * This destroys the player and disconnects the client from discord
   */
  disconnect () {
    this.destroy()
    this.updateVoiceState()
  }

  /**
   * Switch the client to a different voice channel
   * @param {String} channelID Channel to switch to
   */
  switchChannel (channelID) {
    this.updateVoiceState(channelID)
  }

  /**
   * Toggle playback for the player
   */
  togglePlayback () {
    this.node.send({
      op: 'pause',
      guildId: this.guild,
      pause: !this.paused
    })
    this.paused = !this.paused
  }

  /**
   * Seek the track the player is currently playing
   * @param {Number} position Where the track should be seeked to
   */
  seek (position) {
    this.node.send({
      op: 'seek',
      guildId: this.guild,
      position: position
    })
  }

  /**
   * Change the equalizer for this player
   * @param {{ band: Number, gain: Number }[]} bands Array with bands
   */
  eq (bands) {
    this.node.send({
      op: 'equalizer',
      guildId: this.guild,
      bands: bands
    })
  }

  /**
   * Change the voice state of the client
   * @param {String | undefined} channelID Channel to switch to, leave blank to disconnect
   * @param {Boolean | undefined} mute Should the client appear muted? This doesn't affect voice data transmitted
   * @param {Boolean | undefined} deaf Should the client appear deaf? This doesn't affect voice data received
   */
  updateVoiceState (channelID, mute, deaf) {
    if (this.shard.sendWS) {
      this.shard.sendWS(4, { // VOICE_STATE_UPDATE
        guild_id: this.guild,
        channel_id: channelID || null,
        self_mute: !!mute,
        self_deaf: !!deaf
      })
    }
  }

  _onMessage (msg) {
    if (msg.op === 'playerUpdate') {
      this.state = msg.state
    }
    if (msg.op === 'event') {
      switch (msg.type) {
        case 'TrackEndEvent': return this.emit('trackEnd', msg)
        case 'TrackExceptionEvent': return this.emit('trackError', msg)
        case 'TrackStuckEvent': return this.emit('trackStuck', msg)
        default: return this.emit('warn', `Unknown event payload: ${JSON.stringify(msg)}`)
      }
    }
  }
}
