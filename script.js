// Данные из localStorage или пустые
const channels = JSON.parse(localStorage.getItem('channels') || '[]');
const posts = JSON.parse(localStorage.getItem('posts') || '[]'); // { id, text, date, time, status, mediaName }

const usernameInput = document.getElementById('usernameInput');
const savedName = localStorage.getItem('username') || '';
if (savedName) usernameInput.value = savedName;

const channelsContainer = document.getElementById('channelsContainer');
const channelInput = document.getElementById('channelInput');
const addChannelBtn = document.getElementById('addChannelBtn');

const schedulePostBtn = document.getElementById('schedulePostBtn');
const publishNowBtn = document.getElementById('publishNowBtn');
const output = document.getElementById('output');

const postsHistory = document.getElementById('postsHistory');

const postText = document.getElementById('postText');
const postDate = document.getElementById('postDate');
const postTime = document.getElementById('postTime');
const mediaInput = document.getElementById('mediaInput');

// Сохраняем и рендерим каналы
function renderChannels() {
  channelsContainer.innerHTML = '';
  if (channels.length === 0) {
    channelsContainer.innerHTML = '<em>Пока нет каналов</em>';
    return;
  }
  channels.forEach((ch, idx) => {
    const div = document.createElement('div');
    div.className = 'channel-item';
    div.textContent = ch;
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Удалить';
    delBtn.onclick = () => {
      channels.splice(idx, 1);
      saveChannels();
      renderChannels();
    };
    div.appendChild(delBtn);
    channelsContainer.appendChild(div);
  });
}
function saveChannels() {
  localStorage.setItem('channels', JSON.stringify(channels));
}

// Сохраняем имя пользователя
function saveUsername() {
  localStorage.setItem('username', usernameInput.value.trim());
}
usernameInput.onchange = saveUsername;
usernameInput.oninput = saveUsername;

// Добавляем канал
addChannelBtn.onclick = () => {
  const val = channelInput.value.trim();
  if (!val) {
    alert('Введите название канала');
    return;
  }
  if (!val.startsWith('@') && isNaN(val)) {
    alert('Канал должен начинаться с @ или быть числовым ID');
    return;
  }
  if (channels.includes(val)) {
    alert('Канал уже добавлен');
    return;
  }
  channels.push(val);
  saveChannels();
  renderChannels();
  channelInput.value = '';
};

// Проверка данных для поста
function validatePost(text, date, time, media, requireFuture = true) {
  if (channels.length === 0) {
    alert('Добавьте хотя бы один канал');
    return false;
  }
  if (!text && !media) {
    alert('Введите текст или прикрепите медиа');
    return false;
  }
  if (!date || !time) {
    alert('Выберите дату и время публикации');
    return false;
  }
  const dateTime = new Date(`${date}T${time}:00`);
  if (requireFuture && dateTime <= new Date()) {
    alert('Дата и время должны быть в будущем');
    return false;
  }
  return true;
}

// Сохраняем посты
function savePosts() {
  localStorage.setItem('posts', JSON.stringify(posts));
}

// Добавляем пост в историю
function addPostToHistory(post) {
  posts.unshift(post);
  savePosts();
  renderPosts();
}

// Рендер истории постов
function renderPosts() {
  postsHistory.innerHTML = '';
  if (posts.length === 0) {
    postsHistory.innerHTML = '<em>Постов пока нет</em>';
    return;
  }
  posts.forEach(post => {
    const div = document.createElement('div');
    div.className = 'post-item';

    const txt = document.createElement('div');
    txt.className = 'post-text';
    txt.title = post.text;
    txt.textContent = post.text.length > 70 ? post.text.slice(0, 67) + '...' : post.text;

    const status = document.createElement('div');
    status.className = 'post-status ' + (post.status === 'published' ? 'published' : 'scheduled');
    status.textContent = post.status === 'published' ? 'Опубликован' : 'Запланирован';

    div.appendChild(txt);
    div.appendChild(status);
    postsHistory.appendChild(div);
  });
}

// Функция отправки сообщения в телеграм (замени свой токен и логику отправки)
async function sendMessageToTelegram(channel, message) {
  const token = 'ВАШ_TELEGRAM_BOT_TOKEN'; // <-- сюда свой токен вставь
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const payload = {
    chat_id: channel,
    text: message,
    parse_mode: 'HTML'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || 'Ошибка API Telegram');
    }
    return true;
  } catch (err) {
    console.error('Ошибка отправки сообщения:', err);
    return false;
  }
}

// Отправка поста сразу в все каналы
async function publishPostNow(text, mediaName) {
  output.textContent = 'Публикация...';
  for (let ch of channels) {
    const result = await sendMessageToTelegram(ch, text + (mediaName ? `\n[Прикреплено: ${mediaName}]` : ''));
    if (!result) {
      output.textContent = `Ошибка публикации в канале ${ch}`;
      return false;
    }
  }
  output.textContent = 'Пост успешно опубликован во всех каналах.';
  return true;
}

// Добавление запланированного поста
schedulePostBtn.onclick = () => {
  const text = postText.value.trim();
  const date = postDate.value;
  const time = postTime.value;
  const mediaName = mediaInput.files.length ? mediaInput.files[0].name : null;

  if (!validatePost(text, date, time, mediaName)) return;

  const id = Date.now();

  const newPost = {
    id,
    text,
    date,
    time,
    status: 'scheduled',
    mediaName
  };

  addPostToHistory(newPost);

  output.textContent = `Пост запланирован на ${date} ${time}`;

  // Очищаем поля после планирования
  postText.value = '';
  postDate.value = '';
  postTime.value = '';
  mediaInput.value = '';
};

// Публикация сразу
publishNowBtn.onclick = async () => {
  const text = postText.value.trim();
  const mediaName = mediaInput.files.length ? mediaInput.files[0].name : null;

  if (!validatePost(text, new Date().toISOString().slice(0, 10), new Date().toTimeString().slice(0, 5), mediaName, false)) return;

  const success = await publishPostNow(text, mediaName);
  if (success) {
    const id = Date.now();
    posts.unshift({
      id,
      text,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      status: 'published',
      mediaName
    });
    savePosts();
    renderPosts();
    output.textContent = 'Пост опубликован.';
    postText.value = '';
    mediaInput.value = '';
  }
};

// Планировщик публикации (проверка каждую минуту)
setInterval(() => {
  const now = new Date();
  // Формат для сравнения: YYYY-MM-DD HH:MM
  const nowStr = now.toISOString().slice(0, 16).replace('T', ' ');

  posts.forEach(async (post) => {
    if (post.status === 'scheduled') {
      const postDateTimeStr = `${post.date} ${post.time}`;
      if (postDateTimeStr <= nowStr) {
        // Публикуем
        const success = await publishPostNow(post.text, post.mediaName);
        if (success) {
          post.status = 'published';
          savePosts();
          renderPosts();
          output.textContent = `Запланированный пост опубликован (${post.date} ${post.time})`;
        }
      }
    }
  });
}, 60 * 1000); // проверка каждую минуту

// Инициализация интерфейса
renderChannels();
renderPosts();
saveUsername();
