import { PlayerEvent, PlayerUpdate } from '@lavaclient/types'
import { Collection } from 'eris'
import { NodeConstructor, PlayerManagerOptions } from '../interfaces/NodeConstructor'
import { Snowflake } from '../types/misc'
import Node from './Node'
import Player from './Player'

export class ErisPlayerManager extends Collection<Player> {
  nodes: Node[]
  #pending: Record<string, any>
  regions: Record<string, string[]>
  defaultRegion: string
  constructor (nodes: NodeConstructor[], options: PlayerManagerOptions) {
    super(Player)
    this.nodes = nodes.map(x => {
      return new Node({
        shards: options.shards,
        user: options.userId,
        ...x
      })
    })
    this.nodes.forEach(x => x.on('message', this.onNodeMessage.bind(this)))
    this.#pending = {}
    this.regions = options.regions ?? {
      asia: ['singapore', 'hongkong', 'russia', 'japan', 'india', 'dubai'],
      eu: ['europe', 'amsterdam', 'london', 'frankfurt', 'eu-central', 'eu-west', 'vip-amsterdam'],
      us: ['us-west', 'us-east', 'us-central', 'us-south', 'brazil', 'vip-us-west', 'vip-us-east'],
      africa: ['southafrica'],
      australia: ['sidney']
    }
    this.defaultRegion = options.defaultRegion ?? 'global'
  }

  async join (guildID: Snowflake, channelID: Snowflake) {
    const player = this.get(guildID)
    if (player && player.connected) {
      player.switchChannel(channelID)
      return Promise.resolve(player)
    }
    return new Promise((resolve, reject) => {
      this.#pending[guildID] = {
        channelID: channelID,
        res: resolve,
        rej: reject,
        timeout: setTimeout(() => {
          delete this.#pending[guildID]
          reject(new Error('Voice connection timeout'))
        }, 10000)
      }
    })
  }

  leave (guildID: Snowflake) {
    const player = this.get(guildID)
    if (!player) return
    player.disconnect()
    this.delete(guildID)
  }

  switch (guildID: Snowflake, channelID: Snowflake) {
    const player = this.get(guildID)
    if (!player) return
    player.switchChannel(channelID)
  }

  voiceServerUpdate (data: any) {
    if (this.#pending[data.guild_id] && this.#pending[data.guild_id].timeout) {
      clearTimeout(this.#pending[data.guild_id].timeout)
      this.#pending[data.guild_id].timeout = null
    }
    let player = this.get(data.guild_id)
    if (!player) {
      if (!this.#pending[data.guild_id]) {
        return
      }
      player = new Player(this.selectBestLavalinkNode(data.endpoint), data.guild_id, (op, ctx) => data.shard.sendWS(op, ctx))
      this.set(data.guild_id, player)
    }
    player.once('ready', () => {
      if (this.#pending[data.guild_id]) {
        this.#pending[data.guild_id].res(player)
        delete this.#pending[data.guild_id]
      }
    })
    player.once('disconnected', ctx => {
      if (this.#pending[data.guild_id]) {
        this.#pending[data.guild_id].rej(new Error(ctx.reason || 'Disconnected'))
        delete this.#pending[data.guild_id]
      }
      this.delete(data.guild_id)
    })
    player.connect({
      sessionId: data.session_id,
      event: data
    })
  }

  /**
   * Select the least busy Lavalink node which is in the same region as the requesting guild
   * @param endpoint The endpoint Discord returned which should be connected to
   * @returns The most optimal node to use
   */
  private selectBestLavalinkNode (endpoint: string) {
    const region = this.voiceRegionFromEndpoint(endpoint)
    const availableNodes = this.nodes.filter(x => x.connected).sort((a, b) => {
      const aload = a.stats?.cpu ? (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100 : 0
      const bload = b.stats?.cpu ? (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100 : 0
      return aload - bload
    })
    if (availableNodes.length === 0) throw new Error('No lavalink nodes connected that are able to handle connections')
    const regionalNodes = availableNodes.filter(x => x.region === region)
    if (regionalNodes.length === 0) return availableNodes[0]
    else return regionalNodes[0]
  }

  /**
   * Select a load balancing region from Discord's voice server
   * @param endpoint The endpoint Discord returned which should be connected to
   * @returns The load balancing region
   */
  private voiceRegionFromEndpoint (endpoint: string) {
    if (!endpoint) return this.defaultRegion
    for (const key in this.regions) {
      for (const region of this.regions[key]) {
        if (endpoint.startsWith(region)) return key
      }
    }
    return this.defaultRegion
  }

  /**
   * Connect to new nodes
   * @param nodes New nodes to connect to
   * @param options Player manager options
   * @param destructive Whether or not the current connections should be destroyed
   * @returns The nodes which are used now
   */
  remapNodes (nodes: NodeConstructor[], options: PlayerManagerOptions, destructive: boolean = false) {
    if (destructive) {
      if (this.nodes.length > 0) this.nodes.forEach(x => x.destroy())
      this.nodes = nodes.map(x => {
        return new Node({
          shards: options.shards,
          user: options.userId,
          ...x
        })
      })
    } else {
      const nodeAdresses = this.nodes.map(x => x.address)
      const newnodes = nodes.filter(x => !nodeAdresses.includes(`${x.host}:${x.port}`))
      newnodes.forEach(x => {
        this.nodes.push(new Node({
          shards: options.shards,
          user: options.userId,
          ...x
        }))
      })
    }

    this.nodes
      .filter(x => x.listenerCount('message') === 0)
      .forEach(x => x.on('message', this.onNodeMessage.bind(this)))

    return this.nodes
  }

  private onNodeMessage (msg: PlayerEvent | PlayerUpdate) {
    const player = this.get(msg.guildId)
    if (!player) return
    player.onNodeMessage(msg)
  }
}
