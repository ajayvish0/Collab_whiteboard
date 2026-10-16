const KEY = "teamsketch:name";

const ADJECTIVES = ["Swift", "Calm", "Bright", "Clever", "Brave", "Lucky", "Quiet", "Happy"];
const ANIMALS = ["Otter", "Fox", "Panda", "Heron", "Koala", "Lynx", "Owl", "Whale"];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function getDisplayName() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
  } catch {
    // Storage can be unavailable (private mode); fall through to a new name.
  }
  const name = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
  setDisplayName(name);
  return name;
}

export function setDisplayName(name) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // Not persisted; the name still applies to this session.
  }
}
