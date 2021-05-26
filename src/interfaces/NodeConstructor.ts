import { Snowflake } from '../types/misc'

export declare interface NodeConstructor {
  /**
   * The address of the node
   */
  host: string
  /**
   * The port of the node
   */
  port: number | string
  /**
   * The password of the node
   */
  password: string
  /**
   * The geographical region the node is in
   */
  region?: string
}

export declare interface PlayerManagerOptions {
  /**
   * The ID of the connecting client
   */
  userId: Snowflake
  /**
   * How many shard the client is running
   */
  shards: number
  /**
   * What regions the player manager should use for load balancing
   */
  regions?: Record<string, string[]>
  /**
   * What region to use if no regions corresponded
   */
  defaultRegion?: string
}
