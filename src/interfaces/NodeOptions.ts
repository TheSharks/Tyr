export declare interface NodeOptions {
  /**
   * The address of the node
   */
  host: string
  /**
   * The port of the node
   */
  port: string | number
  /**
   * The number of shards the connecting client has
   */
  shards: number
  /**
   * The password of the node
   */
  password: string
  /**
   * The ID of the connecting client
   */
  user: string
  /**
   * The geogrpahical region the node belongs to
   *
   * This is used for regional node selection,
   * this can be left out if this functionality is undesired
   * @default global
   */
  region?: string
  /**
   * Whether or not to automatically try reconnecting to the node
   * @default true
   */
  autoReconnect?: boolean
  /**
   * The resumption token to use when reconnecting to the node
   */
  resumeToken?: string
}
