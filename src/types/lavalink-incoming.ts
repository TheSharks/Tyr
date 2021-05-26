/* eslint-disable no-unused-vars */
import { NodeStats } from '@kyflx-dev/lavalink-types'

export declare enum OPType {
  PLAYER_UPDATE = 'playerUpdate',
  STATS = 'stats',
  EVENT = 'event'
}

export declare interface IncomingMessage {
  op: OPType
}

export declare interface IncomingStats extends IncomingMessage, NodeStats { }
