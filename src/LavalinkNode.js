const WebSocket = require('ws')
const SuperAgent = require('superagent')
let EventEmitter

try {
  EventEmitter = require('eventemitter3')
} catch (_) {
  EventEmitter = require('events').EventEmitter
}

module.exports = class LavalinkNode extends EventEmitter {
  /**
   * @param {Object} options Node options
   * @param {String} options.host The address of the node
   * @param {Number} options.port The port of the node
   * @param {Number} options.shards The number of shards your bot has
   * @param {String} options.password The password of the node
   * @param {String} options.userId The user id of your bot
   * @param {String} options.region The geographical region where the node is located
   * @param {Boolean} [options.autoReconnect=true] Whether or not to automatically try reconnecting to the node
   */
  constructor (options) {
    super()

    this.host = options.host
    this.port = options.port
    this.address = `${this.host}:${this.port}`
    this.shards = options.shards
    this.password = options.password || 'youshallnotpass'
    this.userId = options.userId
    this.connected = false
    this.retries = 0
    this.region = options.region || 'us'
    this.autoReconnect = options.autoReconnect || true

    this.connect()
  }

  /**
   * Connect to the node
   */
  connect () {
    this.ws = new WebSocket(`ws://${this.address}`, {
      headers: {
        Authorization: this.password,
        'Num-Shards': this.shards,
        'User-Id': this.userId
      }
    })

    this.ws.on('open', this._ready.bind(this))
    this.ws.on('message', this._onMessage.bind(this))
    this.ws.on('error', e => this.emit('error', e))
    this.ws.on('close', this._disconnected.bind(this))
  }

  /**
   * Destroy the connection to the node
   */
  destroy () {
    if (this.ws) {
      this.ws.removeAllListeners()
      if (this.ws.readyState !== WebSocket.CLOSED) this.ws.close()
      delete this.ws
    }
  }

  /**
   * Send data to the node
   * @param {*} data JSON encodable payload
   */
  send (data) {
    try {
      data = JSON.stringify(data)
    } catch (e) {
      this.emit('error', 'Invalid payload supplied')
    }
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(data)
  }

  /**
   * Load tracks from the node
   * @param {String} search Search query to use
   */
  async loadTracks (search) {
    const data = await SuperAgent
      .get(`http://${this.address}/loadtracks?identifier=${encodeURIComponent(search)}`)
      .set('Authorization', this.password)
    if (data.body) return data.body
    else throw Error('Unusable response')
  }

  _ready () {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval)
      this.reconnectInterval = null
    }
    this.connected = true
    this.retries = 0
    this.emit('ready')
  }

  _onMessage (msg) {
    try {
      msg = JSON.parse(msg)
    } catch (e) {
      this.emit('error', 'Unable to decode WS messsage')
    }
    if (msg.op && msg.op === 'stats') this.stats = msg
    this.emit('message', msg)
  }

  _disconnected () {
    this.emit('disconnected')
    this.connected = false
    delete this.ws
    if (this.autoReconnect) {
      this.reconnectInterval = setTimeout(() => {
        this.retries++
        this.connect()
      }, Math.pow(this.retries + 2, 2) * 1000)
    }
  }
}
