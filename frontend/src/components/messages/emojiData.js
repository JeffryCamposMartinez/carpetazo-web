// Emojis del selector del chat, por categoría (sin dependencias). `icon` es el ícono de la pestaña.
const list = (text) => text.split(/\s+/).filter(Boolean);

export const EMOJI_CATEGORIES = [
  { id: 'frecuentes', label: 'Frecuentes', icon: 'schedule', emojis: [] }, // se llena con los usados por la persona
  { id: 'caras', label: 'Caras', icon: 'mood', emojis: list('😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫡 🤭 🤫 🫢 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕') },
  { id: 'gestos', label: 'Gestos', icon: 'waving_hand', emojis: list('👍 👎 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👋 🤚 🖐️ ✋ 🖖 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💪 🦾 🫵 💅 🤳') },
  { id: 'corazones', label: 'Corazones', icon: 'favorite', emojis: list('❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 💕 💞 💓 💗 💖 💘 💝 💟 ❣️ 💌 💋 🔥 ✨ ⭐ 🌟 💫 💥 💯 ✅ ❌ ⚡ 🎉 🎊 🎁') },
  { id: 'juegos', label: 'Juegos y cartas', icon: 'style', emojis: list('🃏 🎴 🀄 🎮 🕹️ 🎲 ♟️ 🧩 🎯 🏆 🥇 🥈 🥉 🏅 🎖️ ⚔️ 🛡️ 🗡️ 🏹 🪄 🔮 🧙 🐉 👾 🤖 👑 💎 💰 🪙 💵 💳 🛒 📦 🚚 📍 🤝') },
  { id: 'animales', label: 'Animales', icon: 'pets', emojis: list('🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🦎 🐙 🦑 🦀 🐠 🐬 🐳 🦈 🐊 🦖 🦕') },
  { id: 'comida', label: 'Comida', icon: 'restaurant', emojis: list('🍎 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🌽 🥕 🥔 🍞 🧀 🍳 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🍝 🍜 🍣 🍱 🍦 🍩 🍪 🎂 🍰 🍫 🍿 ☕ 🍵 🍺 🍷 🥤') },
  { id: 'objetos', label: 'Objetos', icon: 'emoji_objects', emojis: list('📱 💻 ⌚ 📷 🎧 🔋 💡 🔑 🔒 📌 📎 ✂️ 📝 📚 📅 ⏰ ⌛ 🧾 📊 📈 📉 🔔 🔍 🛠️ 🧰 ⚙️ 🏠 🚗 🚇 🚌 ✈️ 🚲 🌎 ☀️ 🌙 ☁️ 🌧️ ⛈️ ❄️ 🌈') },
];

const FREQUENT_KEY = 'carpetazo:chat-emoji-frequent';
export const readFrequent = () => {
  try { const value = JSON.parse(localStorage.getItem(FREQUENT_KEY) || '[]'); return Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(0, 24) : []; } catch { return []; }
};
export const rememberEmoji = (emoji) => {
  try { localStorage.setItem(FREQUENT_KEY, JSON.stringify([emoji, ...readFrequent().filter((item) => item !== emoji)].slice(0, 24))); } catch { /* sin almacenamiento */ }
};

// Reacciones rápidas del menú de un mensaje
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
