// ВАЖНО: вставь сюда свой токен
const BOT_TOKEN = '7367812518:AAGNc4pmBjrTfGlOU1Tg0ZF-i8VBC4Qugjo'

const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

const channels = JSON.parse(localStorage.getItem('channels') || '[]');
const posts = JSON.parse(localStorage.getItem('posts') || '[]');

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

function saveUsername() {
  localStorage.setItem('username', usernameInput.value.trim());
}
usernameInput.onchange = saveUsername;
usernameInput.oninput = saveUsername;

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

function savePosts() {
  localStorage.setItem('posts', JSON.stringify(posts));
}

function addPostToHistory(post) {
  posts.unshift(post);
  savePosts();
  renderPosts();
}

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

// Отправка сообщения в Telegram (по API)
async function sendMessageToChannel(channel, text) {
  // Удаляем @, если есть, тк API принимает либо @username либо ID, но не с @ для ID
  let chat_id = channel.startsWith('@') ? channel : channel;
  // Формируем fetch запрос
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
    });
    const json = await res.json();
    if (!json.ok) {
      throw new Error(json.description || 'Ошибка отправки');
    }
    return true;
  } catch (e) {
    console.error('Ошибка при отправке в канал', channel, e);
    return false;
  }
}

async function publishPost(text) {
  output.textContent = 'Отправка...';
  let allSuccess = true;
  for (const channel of channels) {
    const ok = await sendMessageToChannel(channel, text);
    if (!ok) allSuccess = false;
  }
  if (allSuccess) {
    output.textContent = 'Успешно опубликовано во всех каналах!';
    return true;
  } else {
    output.textContent = 'Ошибка при публикации в некоторых каналах.';
    return false;
  }
}

// События кнопок

schedulePostBtn.onclick = () => {
  const text = document.getElementById('postText').value.trim();
  const date = document.getElementById('postDate').value;
  const time = document.getElementById('postTime').value;
  const mediaInput = document.getElementById('mediaInput');
  const media = mediaInput.files.length > 0 ? mediaInput.files[0] : null;

  if (!validatePost(text, date, time, media, true)) return;

  // Записываем пост в localStorage с флагом "запланирован"
  const datetime = new Date(`${date}T${time}:00`).toISOString();
  const newPost = {
    id: Date.now(),
    text,
    datetime,
    status: 'scheduled',
  };
  addPostToHistory(newPost);

  output.textContent = 'Пост запланирован. Для публикации нужно открыть страницу в указанное время.';
  // Не реализуем автоотправку — тк нет backend, планировщик работает, если страница открыта и запущен таймер.

  mediaInput.value = ''; // очищаем медиа
  document.getElementById('postText').value = '';
  document.getElementById('postDate').value = '';
  document.getElementById('postTime').value = '';
};

publishNowBtn.onclick = async () => {
  const text = document.getElementById('postText').value.trim();
  const mediaInput = document.getElementById('mediaInput');
  const media = mediaInput.files.length > 0 ? mediaInput.files[0] : null;
  const date = new Date().toISOString().slice(0, 10);
  const time = new Date().toTimeString().slice(0,5);

  if (!validatePost(text, date, time, media, false)) return;

  const ok = await publishPost(text);
  if (ok) {
    const newPost = {
      id: Date.now(),
      text,
      datetime: new Date().toISOString(),
      status: 'published',
    };
    addPostToHistory(newPost);

    mediaInput.value = '';
    document.getElementById('postText').value = '';
    document.getElementById('postDate').value = '';
    document.getElementById('postTime').value = '';
  }
};

// Планировщик (будет проверять каждую минуту запланированные посты)
function checkScheduledPosts() {
  const now = new Date();
  posts.forEach(async (post) => {
    if (post.status === 'scheduled') {
      const postDate = new Date(post.datetime);
      if (now >= postDate) {
        // Публикуем
        const ok = await publishPost(post.text);
        if (ok) {
          post.status = 'published';
          savePosts();
          renderPosts();
        }
      }
    }
  });
}

// Инициализация
renderChannels();
renderPosts();
setInterval(checkScheduledPosts, 60 * 1000);