/**
 * UUID v4 from Math.random — Hermes has no crypto.randomUUID. Used as the
 * client-generated sessions.id so a retried upload is idempotent; collision
 * odds are irrelevant at one-user scale.
 */
export function uuid4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
