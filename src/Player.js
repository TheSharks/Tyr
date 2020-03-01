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
   * @param {Object} voiceData Initial voice data to be passed to the player
   */
  constructor (node, guild, voiceData) {
    super()
    this.node = node
    this.guild = guild
    this.voiceData = voiceData
    this.paused = false
    this.connected = false
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
    this.connnected = true
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
}
