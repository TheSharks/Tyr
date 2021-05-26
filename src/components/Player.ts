/* eslint-disable no-dupe-class-members,no-redeclare */
import { EqualizerBand, PlayerEvent, PlayerUpdateState, PlayerUpdate, TrackEndEvent, TrackExceptionEvent, TrackStartEvent, TrackStuckEvent, WebSocketClosedEvent, PlayerEventType } from '@lavaclient/types'
import { EventEmitter } from 'events'
import { TrackPlay } from '../interfaces/TrackPlay'
import { VoiceUpdate } from '../interfaces/VoiceUpdate'
import { WebsocketImplementation } from '../interfaces/WebsocketImplementation'
import { OPType } from '../types/lavalink-incoming'
import { Snowflake } from '../types/misc'
import Node from './Node'

interface Player {
  /**
   * Fired when the player is considered ready
   */
   on(event: 'ready', listener: () => void): this
  /**
   * Fired when the player encounters something not breaking, but noteworthy
   */
   on(event: 'warn', listener: (ctx: string) => void): this
  /**
   * Fired when the player receives a status update from the node
   */
   on(event: 'statusUpdate', listener: (status: PlayerUpdateState) => void): this
  /**
   * Fired when the track the player is playing has ended
   *
   * A track ends for many reasons, not just because the track is finished.
   * You should check the [[TrackEndEvent.reason]] property before doing additional logic
   */
   on(event: 'trackEnd', listener: (ctx: TrackEndEvent) => void): this
  /**
   * Fired whenever the player encouters an error while playing / trying to play a track
   */
   on(event: 'trackError', listener: (ctx: TrackExceptionEvent) => void): this
  /**
   * Fired whenever the track the player is playing hasn't progressed for a set amount of time
   */
   on(event: 'trackStuck', listener: (ctx: TrackStuckEvent) => void): this
  /**
   * Fired whenever the player starts playing a track
   */
   on(event: 'trackStart', listener: (ctx: TrackStartEvent) => void): this
  /**
   * Fired whenever the player is disconnected from Discord and therefor unable to continue playing
   */
   on(event: 'disconnected', listener: (ctx: WebSocketClosedEvent) => void): this
}

/**
 * Represents a connection between Lavalink and Discord
 *
 * A player is the primary way to interact with Lavalink
 */
class Player extends EventEmitter {
  /**
   * The node supporting this player
   */
  node: Node
  /**
   * The ID of the guild that this player is serving
   */
  id: Snowflake
  /**
   * Whether or not the player is currently paused
   */
  paused: boolean
  /**
   * Whether or not the player is connected and considered ready for use
   */
  connected: boolean
  /**
   * The current state of the player
   *
   * Will be undefined until some time after the player starts playing a track
   */
  state: PlayerUpdateState | undefined
  #ws: WebsocketImplementation
  constructor (node: Node, guildID: Snowflake, websocket: WebsocketImplementation) {
    super()
    this.node = node
    this.id = guildID
    this.paused = false
    this.connected = false
    this.#ws = websocket
  }

  /**
   * Instruct Lavalink to connect the player to Discord
   * @param data The voice data received from Discord
   */
  connect (data: VoiceUpdate) {
    this.node.send({
      op: 'voiceUpdate',
      guildId: this.id,
      sessionId: data.sessionId,
      event: data.event
    })
    this.connected = true
    this.emit('ready')
  }

  /**
   * Play a loaded track
   *
   * Before this function can be used, you must first instruct the node to load the track via [[Node.loadTracks]]
   * @param track The base64 response from [[Node.loadTracks]]
   * @param options Extra options that can be provided
   */
  play (track: string, options?: TrackPlay) {
    this.node.send({
      op: 'play',
      guildId: this.id,
      track: track,
      startTime: options?.startTime,
      endTime: options?.endTime,
      volume: options?.volume,
      noReplace: options?.noReplace,
      pause: options?.pause
    })
  }

  /**
   * Change the volume of the player
   * @param volume The volume the player should be set to
   */
  volume (volume: number) {
    this.node.send({
      op: 'volume',
      guildId: this.id,
      volume: volume
    })
  }

  /**
   * Stop the player
   *
   * This does *not* disconnect the player from Discord
   */
  stop () {
    this.node.send({
      op: 'stop',
      guildId: this.id
    })
  }

  /**
   * Destroy the player
   *
   * This does *not* disconnect the player from Discord
   */
  destroy () {
    this.node.send({
      op: 'destroy',
      guildId: this.id
    })
  }

  /**
   * Disconnect the player
   *
   * This *does* disconnect the player from Discord
   */
  disconnect () {
    this.destroy()
    this.updateVoiceState()
  }

  /**
   * Move the player to a different voice channel
   * @param channelID The channel the player should be moved to
   */
  switchChannel (channelID: Snowflake) {
    this.updateVoiceState(channelID)
  }

  /**
   * Toggle playback for this player
   * @returns Whether or not the player is now paused
   */
  togglePlayback (): boolean {
    this.node.send({
      op: 'pause',
      guildId: this.id,
      pause: !this.paused
    })
    this.paused = !this.paused
    return this.paused
  }

  /**
   * Seek the currently playing track
   * @param position Where the track should be seeked to
   */
  seek (position: number) {
    this.node.send({
      op: 'seek',
      guildId: this.id,
      position: position
    })
  }

  /**
   * Change the equalizer for the player
   * @param bands The bands to change
   */
  eq (bands: EqualizerBand[]) {
    this.node.send({
      op: 'equalizer',
      guildId: this.id,
      bands: bands
    })
  }

  /**
   * Change the client's voice state
   * @param channelID Channel to switch to, omit to disconnect
   * @param mute Should the client appear mute?
   * @param deaf Should the client appear deaf?
   */
  updateVoiceState (channelID?: Snowflake, mute: boolean = false, deaf: boolean = false) {
    this.#ws(4, { // VOICE_STATE_UPDATE
      guild_id: this.id,
      channel_id: channelID ?? null,
      self_mute: mute,
      self_deaf: deaf
    })
  }

  /**
   * Internal function to handle incoming node messages,
   * implement this if you're building your own player manager
   * @param msg The incoming message
   * @hidden
   */
  onNodeMessage (msg: PlayerEvent | PlayerUpdate) {
    if (msg.op === OPType.PLAYER_UPDATE) {
      this.state = msg.state
      return this.emit('statusUpdate', msg.state)
    }
    if (msg.op === OPType.EVENT) {
      switch (msg.type as PlayerEventType) {
        case 'TrackEndEvent': return this.emit('trackEnd', msg)
        case 'TrackExceptionEvent': return this.emit('trackError', msg)
        case 'TrackStuckEvent': return this.emit('trackStuck', msg)
        case 'TrackStartEvent': return this.emit('trackStart', msg)
        case 'WebSocketClosedEvent': return this.emit('disconnected', msg)
        default: return this.emit('warn', `Unknown event payload: TYPE ${msg.type} - ${JSON.stringify(msg)}`)
      }
    }
  }
}

export default Player
