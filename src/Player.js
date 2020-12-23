let EventEmitter

try {
  EventEmitter = require('eventemitter3')
} catch (_) {
  EventEmitter = require('events').EventEmitter
}

/**
 * A player represents a connection between Discord and Lavalink
 *
 * A player is the primary way to interact with Lavalink
 * @param {LavalinkNode} node The node supporting this player
 * @param {String} guild The ID of the guild where this player is used
 * @param {module:eris.Shard} shard The shard that runs this player
 *
 * @property {LavalinkNode} node The node supporting this player
 * @property {String} guild The ID of the guild where this player is used
 * @property {module:eris.Shard} shard The shard that runs this player
 * @property {Boolean} paused Whether or not the playback for this player is paused
 * @property {Boolean} connected Whether or not the player is fully connected
 * @property {Object} state The current state of the player
 * @property {Number} [state.time] The UNIX timestamp when this player started playing
 * @property {Number} [state.position] A time in ms representing the position of the track the player is currently playing
 *
 * @fires Player#trackStart
 * @fires Player#trackEnd
 * @fires Player#trackStuck
 * @fires Player#trackError
 * @fires Player#warn
 * @fires Player#ready
 * @fires Player#disconnected
 */
class Player extends EventEmitter {
  constructor (node, guild, shard) {
    super()
    this.node = node
    this.guild = guild
    this.paused = false
    this.connected = false
    this.state = {}
    this.shard = shard
  }

  /**
   * Connect the player to Discord and prepare for playback
   * @private
   * @param {Object} data Data to use for connecting to Discord
   * @param {String} data.sessionId Session ID for the voice session
   * @param {Object} data.event Object containing voice server information
   * @param {String} data.event.endpoint The endpoint of the voice server
   * @param {String} data.event.guild_id The ID of the guild where this player is assigned to
   * @param {String} data.event.token The token used to identify with the voice server
   */
  /**
   * Fired whenever the player is ready to accept tracks
   * @event Player#ready
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
   * 
   * In order to use this, order the node to load the track first
   * @see LavalinkNode#loadTracks
   * @param {String} track Base64 string corresponding to the track
   * @return {void}
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
   * @return {void}
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
   * @return {void}
   */
  stop () {
    this.node.send({
      op: 'stop',
      guildId: this.guild
    })
  }

  /**
   * Destroy the player
   *
   * This does not affect voice state, meaning the client would still appear to be connected to the voice channel
   * @return {void}
   */
  destroy () {
    this.node.send({
      op: 'destroy',
      guildId: this.guild
    })
  }

  /**
   * Disconnect the player
   *
   * This destroys the player and disconnects the client from the voice channel
   * @return {void}
   */
  disconnect () {
    this.destroy()
    this.updateVoiceState()
  }

  /**
   * Switch the client to a different voice channel
   * @param {String} channelID Channel to switch to
   * @return {void}
   */
  switchChannel (channelID) {
    this.updateVoiceState(channelID)
  }

  /**
   * Toggle playback for the player
   * @returns {Boolean} Whether or not the player is now paused
   */
  togglePlayback () {
    this.node.send({
      op: 'pause',
      guildId: this.guild,
      pause: !this.paused
    })
    this.paused = !this.paused
    return this.paused
  }

  /**
   * Seek the track the player is currently playing
   * @param {Number} position Where the track should be seeked to
   * @returns {void}
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
   * @param {Object[]} bands Array with bands
   * @param {Number} bands.band The band to adjust
   * @param {Number} bands.gain The gain of the band
   * @returns {void}
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
   * @returns {void}
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

  onNodeMessage (msg) {
    if (msg.op === 'playerUpdate') {
      this.state = msg.state
      this.emit('stateUpdate', msg.state)
    }
    if (msg.op === 'event') {
      switch (msg.type) {
        /**
         * This will be fired whenever a track stops playing
         *
         * A track can end for many reasons!
         * You should check the reason property before doing additional logic,
         * like playing new tracks
         * @event Player#trackEnd
         * @type {Object}
         * @property {String} track The track that has ended
         * @property {String} reason Why the track ended
         * @example Player.on('trackEnd', ctx => console.log(`The track ${ctx.track} has ended`))
         */
        case 'TrackEndEvent': return this.emit('trackEnd', msg)
        /**
         * This will be fired whenever lavalink encounters an error while playing a track
         * @event Player#trackError
         * @type {Object}
         * @property {String} track The track that has ended
         * @property {String} error Why the track errored
         * @example Player.on('trackError', ctx => console.error(`The track ${ctx.track} crashed!`, ctx.error))
         */
        case 'TrackExceptionEvent': return this.emit('trackError', msg)
        /**
         * This will be fired whenever lavalink is playing a track, but the track hasn't progressed for a set amount of time
         * @event Player#trackStuck
         * @type {Object}
         * @property {String} track The track that got stuck
         * @example Player.on('trackStuck', ctx => console.error(`The track ${ctx.track} got stuck!`))
         */
        case 'TrackStuckEvent': return this.emit('trackStuck', msg)
        /**
         * This will be fired whenever lavalink starts playing a track
         * @event Player#trackStart
         * @type {Object}
         * @property {String} track The track that's now playing
         * @example Player.on('trackStart', ctx => console.log(`Now playing track ${ctx.track}`))
         */
        case 'TrackStartEvent': return this.emit('trackStart', msg)
        /**
         * This will be fired when the player disconnects due to the websocket breaking
         * @event Player#disconnected
         * @type {Object}
         */
        case 'WebSocketClosedEvent': return this.emit('disconnected', msg)
        /**
         * Fired whenever the player encounters something non-breaking, but noteworthy
         * @event Player#warn
         * @type {String}
         */
        default: return this.emit('warn', `Unknown event payload: ${JSON.stringify(msg)}`)
      }
    }
  }
}

module.exports = Player
