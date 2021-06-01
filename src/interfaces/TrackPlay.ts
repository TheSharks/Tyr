export declare interface TrackPlay {
  /**
   * Optional setting that determines the starting offset of the track, defaults to 0
   * @default 0
   */
  startTime?: string
  /**
   * Optional setting that determines the ending offset of the track, defaults to the end of the encoded data
   */
  endTime?: string
  /**
   * Optional setting to change the volume once the track begins
   */
  volume?: string
  /**
   * Whether or not to ignore this operation if a track is already playing or paused, defaults to false
   * @default false
   */
  noReplace?: boolean
  /**
   * Whether or not to pause the playback as soon as the track has started, defaults to false
   * @default false
   */
  pause?: boolean
}
