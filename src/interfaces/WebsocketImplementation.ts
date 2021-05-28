/**
 * An abstraction for Discord's shards
 *
 * This function will be called internally within [[Player]]
 * to send VOICE_STATE_UPDATE events, this is **required** for
 * correct functionality, so implementing this is mandatory
 * if you're creating your own player manager
 *
 * If you're using the included player manager for Eris,
 * you do not need to implement this
 *
 * ```js
 * // if your're using eris, the API maps 1:1
 * const WebsocketAbstract = (op, ctx) => data.shard.sendWS(op, ctx)
 * new Player(someNode, '110462143152803840', WebsocketAbstract)
 * ```
 *
 * ```js
 * // if you're using discord.js...
 * const client = new Discord.Client(options)
 * const WebsocketAbstract = (op, data) => {
 *   return client.ws.get(shardID).send({
 *     op,
 *     ...data
 *   })
 * }
 * new Player(someNode, '110462143152803840', WebsocketAbstract)
 * ```
 */
export declare type WebsocketImplementation = (op: number, data: any) => void
