export function getSessionId(): string {
  let sessionId = localStorage.getItem("storeSessionId");
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    localStorage.setItem("storeSessionId", sessionId);
  }
  return sessionId;
}
