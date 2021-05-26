export declare interface VoiceUpdate {
  /**
   * The session ID received from Discord
   */
  sessionId: string
  /**
   * The raw incoming packet from Discord
   *
   * Make sure to **not** modify this, it needs to be supplied exactly as it was received
   *
   * @see {@link https://discord.com/developers/docs/topics/gateway#voice-server-update}
   */
  event: any
}
