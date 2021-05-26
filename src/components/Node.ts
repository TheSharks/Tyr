/* eslint-disable no-dupe-class-members,no-redeclare */
import * as WebSocket from 'ws'
import fetch from 'node-fetch'
import { EventEmitter } from 'events'
import { NodeOptions } from '../interfaces/NodeOptions'
import { LoadTrackResponse, NodeStats, PlayerEvent, PlayerUpdate } from '@kyflx-dev/lavalink-types'
import { IncomingMessage, OPType, IncomingStats } from '../types/lavalink-incoming'

interface Node extends NodeOptions {
  /**
   * Fired when the node is considered ready to accept new players
   */
   on(event: 'ready', listener: () => void): this
  /**
   * Fired when a breaking error is encoutered, either with the node or with processing
   */
   on(event: 'error', listener: (e: Error) => void): this
  /**
   * Fired when the node broadcasts a message
   */
   on(event: 'message', listener: (msg: PlayerEvent | PlayerUpdate) => void): this
  /**
   * Fired the node disconnects
   */
   on(event: 'disconnected', listener: () => void): this
}
/**
 * Represents a Lavalink node
 */
class Node extends EventEmitter {
  /**
   * The complete address of the node
   */
  address: string
  /**
   * Whether or not the node is fully connected
   */
  connected: boolean
  /**
   * How may reconnection attempts were tried
   */
  retries: number
  /**
   * Statistics of the node
   *
   * Will be undefined until the node has been ready for at least a minute
   */
  stats: NodeStats | undefined
  #ws: WebSocket | undefined
  #reconnectInterval: NodeJS.Timeout | undefined
  constructor (options: NodeOptions) {
    super()
    this.host = options.host
    this.port = options.port
    this.address = `${this.host}:${this.port}`
    this.shards = options.shards
    this.password = options.password
    this.user = options.user
    this.connected = false
    this.retries = 0
    this.region = options.region || 'global'
    this.autoReconnect = options.autoReconnect || true
  }

  /**
   * Connect to the node
   */
  connect () : void {
    this.#ws = new WebSocket(`ws://${this.address}`, {
      headers: {
        Authorization: this.password,
        'Num-Shards': this.shards,
        'User-Id': this.user
      }
    })

    this.#ws.on('open', this._ready.bind(this))
    this.#ws.on('error', e => this.emit('error', e))
    this.#ws.on('message', this._onMessage.bind(this))
    this.#ws.on('close', this._disconnected.bind(this))
  }

  /**
   * Destroy connection to the node
   */
  destroy () : void {
    if (this.#ws) {
      this.#ws.removeAllListeners()
      if (this.#ws.readyState !== WebSocket.CLOSED) this.#ws.close()
      this.#ws = undefined
    }
  }

  /**
   * Send data to the node
   * @param data The data to send
   */
  send (data: any): void {
    try {
      data = JSON.stringify(data)
      if (this.#ws?.readyState === WebSocket.OPEN) this.#ws.send(data)
    } catch (e) {
      this.emit('error', new Error(`Payload could not be serialized: ${e.message}`))
    }
  }

  /**
   * Instruct the node to load new tracks
   * @param search The search query, supports Lavalink specific modifiers such as `ytsearch` and `scsearch`
   * @returns The response from the node
   */
  async loadTracks (search: string): Promise<LoadTrackResponse> {
    const data = await fetch(`http://${this.address}/loadtracks?identifier=${encodeURIComponent(search)}`, {
      headers: { Authorization: this.password }
    })
    if (data.ok) return await data.json()
    else throw Error('Unusable response')
  }

  private _ready () {
    if (this.#reconnectInterval) {
      clearInterval(this.#reconnectInterval)
      this.#reconnectInterval = undefined
    }
    this.connected = true
    this.retries = 0
    this.emit('ready')
  }

  private _onMessage (msg: string) {
    try {
      const incoming = JSON.parse(msg) as IncomingMessage
      if (incoming.op && incoming.op === OPType.STATS) {
        this.stats = incoming as IncomingStats
      }
      this.emit('message', incoming as PlayerUpdate | PlayerEvent)
    } catch (e) {
      this.emit('error', new Error(`Unable to decode incoming WS message: ${e.message}`))
    }
  }

  private _disconnected () {
    this.emit('disconnected')
    this.connected = false
    this.#ws = undefined
    if (this.autoReconnect) {
      this.#reconnectInterval = setTimeout(() => {
        this.retries++
        this.connect()
      }, Math.pow(this.retries + 2, 2) * 1000)
    }
  }
}

export default Node
