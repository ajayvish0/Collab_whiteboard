import { API_URL } from "../config.js";

// A free-tier backend can take about a minute to wake from sleep.
const CREATE_TIMEOUT_MS = 90_000;

export async function createBoard() {
  let res;
  try {
    res = await fetch(`${API_URL}/boards`, {
      method: "POST",
      signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  if (res.status === 429) {
    throw new Error("Too many boards created from your network. Try again in a few minutes.");
  }
  if (!res.ok) throw new Error(`The server could not create a board (HTTP ${res.status}).`);
  const { boardId } = await res.json();
  return boardId;
}
