/* eslint-disable no-unused-vars */
import { StatsData } from '@lavaclient/types'

export declare enum OPType {
  PLAYER_UPDATE = 'playerUpdate',
  STATS = 'stats',
  EVENT = 'event'
}

export declare interface IncomingMessage {
  op: OPType
}

export declare interface IncomingStats extends IncomingMessage, StatsData { }
