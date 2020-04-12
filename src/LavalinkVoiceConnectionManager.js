const LavalinkNode = require('./LavalinkNode')
const Player = require('./Player')
const { Collection } = require('eris')

module.exports = class LavalinkVoiceConnectionManager extends Collection {
  /**
   * @param {{ host: String, password: String, port: Number|String, region: String }[]} nodes An array of lavalink nodes to connect to
   * @param {{ regions: Object, defaultRegion: String, shards: Number, userId: String }} options Options to pass to the constructor
   */
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

  onNodeMessage (msg) {
    const player = this.get(msg.guildId)
    if (!player) return
    player.onNodeMessage(msg)
  }
}
