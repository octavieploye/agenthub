import log from 'electron-log/main'

let shutdownReason = 'unknown'

export function getShutdownReason(): string {
  return shutdownReason
}

export function setShutdownReason(reason: string): void {
  shutdownReason = reason
  log.info('Shutdown reason set', { reason })
}
