const LavalinkNode = require('./LavalinkNode')
const Player = require('./Player')
const { Collection } = require('eris')

/**
 * @param {Object[]} nodes An array of lavalink nodes to connect to
 * @param {String} nodes.host The address of the node
 * @param {String} nodes.password The password of the node
 * @param {Number} nodes.port The port of the node
 * @param {String} nodes.region The geographical region of the node
 * @param {Object} options
 * @param {String} options.userId The user ID from the client
 * @param {Number} options.shards How many shards the client is running
 * @param {Object} [options.regions] What regions to use
 * @param {String} [options.defaultRegion='us'] The default region to use if no regions correspond
 *
 * @see {@link https://abal.moe/Eris/docs/Collection|Eris documentation on Collection}
 */
class LavalinkVoiceConnectionManager extends Collection {
  constructor (nodes, options = {}) {
    super()
    this.nodes = nodes.map(x => {
      return new LavalinkNode({
        shards: options.shards,
        userId: options.userId,
        ...x
      })
    })
    this.nodes.forEach(x => x.on('message', this.onNodeMessage.bind(this)))
    this.pendingGuilds = {}
    this.regions = options.regions || {
      asia: ['singapore', 'hongkong', 'russia', 'japan', 'india', 'dubai'],
      eu: ['europe', 'amsterdam', 'london', 'frankfurt', 'eu-central', 'eu-west', 'vip-amsterdam'],
      us: ['us-west', 'us-east', 'us-central', 'us-south', 'brazil', 'vip-us-west', 'vip-us-east'],
      africa: ['southafrica'],
      australia: ['sidney']
    }
    this.defaultRegion = options.defaultRegion || 'us'
  }

  async join (guildID, channelID) {
    const player = this.get(guildID)
    if (player && player.connected) {
      player.switchChannel(channelID)
      return Promise.resolve(player)
    }
    return new Promise((resolve, reject) => {
      this.pendingGuilds[guildID] = {
        channelID: channelID,
        res: resolve,
        rej: reject,
        timeout: setTimeout(() => {
          delete this.pendingGuilds[guildID]
          reject(new Error('Voice connection timeout'))
        }, 10000)
      }
    })
  }

  leave (guildID) {
    const player = this.get(guildID)
    if (!player) return
    player.disconnect()
    this.delete(guildID)
  }

  switch (guildID, channelID) {
    const player = this.get(guildID)
    if (!player) return
    player.switchChannel(channelID)
  }

  voiceServerUpdate (data) {
    if (this.pendingGuilds[data.guild_id] && this.pendingGuilds[data.guild_id].timeout) {
      clearTimeout(this.pendingGuilds[data.guild_id].timeout)
      this.pendingGuilds[data.guild_id].timeout = null
    }
    let player = this.get(data.guild_id)
    if (!player) {
      if (!this.pendingGuilds[data.guild_id]) {
        return
      }
      player = new Player(this.selectBestLavalinkNode(data.endpoint), data.guild_id, data.shard)
      this.set(data.guild_id, player)
    }
    player.once('ready', () => {
      if (this.pendingGuilds[data.guild_id]) {
        this.pendingGuilds[data.guild_id].res(player)
        delete this.pendingGuilds[data.guild_id]
      }
    })
    player.once('disconnected', ctx => {
      if (this.pendingGuilds[data.guild_id]) {
        this.pendingGuilds[data.guild_id].rej(new Error(ctx.reason || 'Disconnected'))
        delete this.pendingGuilds[data.guild_id]
      }
      this.delete(data.guild_id)
    })
    player.connect({
      sessionId: data.session_id,
      guildId: data.guild_id,
      event: data
    })
  }

  selectBestLavalinkNode (endpoint) {
    const region = this.voiceRegionFromEndpoint(endpoint)
    const availableNodes = this.nodes.filter(x => x.connected).sort((a, b) => {
      const aload = a.stats.cpu ? (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100 : 0
      const bload = b.stats.cpu ? (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100 : 0
      return aload - bload
    })
    if (availableNodes.length === 0) throw new Error('No lavalink nodes connected that are able to handle connections')
    const regionalNodes = availableNodes.filter(x => x.region === region)
    if (regionalNodes.length === 0) return availableNodes[0]
    else return regionalNodes[0]
  }

  voiceRegionFromEndpoint (endpoint) {
    for (const key in this.regions) {
      for (const region of this.regions[key]) {
        if (endpoint.startsWith(region)) return key
      }
    }
    return this.defaultRegion
  }

  /**
   * Connect to new nodes
   * @param {Object[]} nodes An array of lavalink nodes to connect to
   * @param {String} nodes.host The address of the node
   * @param {String} nodes.password The password of the node
   * @param {Number} nodes.port The port of the node
   * @param {String} nodes.region The geographical region of the node
   * @param {Object} options
   * @param {String} options.userId The user ID from the client
   * @param {Number} options.shards How many shards the client is running
   * @param {Boolean} destructive Destroy connections to all current nodes?
   * @return {LavalinkNode[]} The nodes the module is connecting to now
   */
  remapNodes (nodes, options, destructive = false) {
    if (destructive) {
      if (this.nodes.length > 0) this.nodes.forEach(x => x.destroy())
      this.nodes = nodes.map(x => {
        return new LavalinkNode({
          shards: options.shards,
          userId: options.userId,
          ...x
        })
      })
    } else {
      const nodeAdresses = this.nodes.map(x => x.address)
      const newnodes = nodes.filter(x => !nodeAdresses.includes(`${x.host}:${x.port}`))
      newnodes.forEach(x => {
        this.nodes.push(new LavalinkNode({
          shards: options.shards,
          userId: options.userId,
          ...x
        }))
      })
    }

    this.nodes
      .filter(x => x.listenerCount('message') === 0)
      .forEach(x => x.on('message', this.onNodeMessage.bind(this)))

    return this.nodes
  }

  onNodeMessage (msg) {
    const player = this.get(msg.guildId)
    if (!player) return
    player.onNodeMessage(msg)
  }
}

module.exports = LavalinkVoiceConnectionManager
