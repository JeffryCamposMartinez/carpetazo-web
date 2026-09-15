const fs = require('fs');
let content = fs.readFileSync('frontend/src/utils/api.js', 'utf8');

content = content.replace('headers[\'Authorization\'] = "Bearer ${token}`";', 'headers[\'Authorization\'] = Bearer ;');
content = content.replace('const response = await fetch(`"`", {', 'const response = await fetch(${API_BASE_URL}, {');
content = content.replace('throw new Error(errorData.message || `"Error: ${response.status}`");', 'throw new Error(errorData.message || Error: );');
content = content.replace('getFolder: (id) => apiFetch(`"/folders/`"),', 'getFolder: (id) => apiFetch(/folders/),');
content = content.replace('deleteFolder: (id) => apiFetch(`"/folders/`", { method: \'DELETE\' }),', 'deleteFolder: (id) => apiFetch(/folders/, { method: \'DELETE\' }),');
content = content.replace('addCardToFolder: (folderId, data) => apiFetch(`"/folders//cards`", { method: \'POST\', body: JSON.stringify(data) }),', 'addCardToFolder: (folderId, data) => apiFetch(/folders//cards, { method: \'POST\', body: JSON.stringify(data) }),');
content = content.replace('deleteCard: (id) => apiFetch(`"/cards/`", { method: \'DELETE\' }),', 'deleteCard: (id) => apiFetch(/cards/, { method: \'DELETE\' }),');
content = content.replace('markMessageRead: (id) => apiFetch(`"/messages//read`", { method: \'PUT\' }),', 'markMessageRead: (id) => apiFetch(/messages//read, { method: \'PUT\' }),');

fs.writeFileSync('frontend/src/utils/api.js', content, 'utf8');
