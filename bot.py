import time
import threading
from datetime import datetime, timedelta
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import Updater, CommandHandler, CallbackQueryHandler, CallbackContext, MessageHandler, Filters

TOKEN = '7367812518:AAGNc4pmBjrTfGlOU1Tg0ZF-i8VBC4Qugjo'

bot = Bot(token=TOKEN)
updater = Updater(token=TOKEN, use_context=True)
dispatcher = updater.dispatcher

scheduled_posts = []
target_channels = []  # Динамический список каналов
user_states = {}

# Стартовое меню
def start(update: Update, context: CallbackContext):
    keyboard = [
        [InlineKeyboardButton("➕ Плановый пост", callback_data='schedule_post')],
        [InlineKeyboardButton("📅 Список запланированных", callback_data='show_scheduled')],
        [InlineKeyboardButton("➕ Добавить канал", callback_data='add_channel')],
        [InlineKeyboardButton("📢 Список каналов", callback_data='show_channels')],
    ]
    update.message.reply_text("Выбери действие:", reply_markup=InlineKeyboardMarkup(keyboard))

# Обработка инлайн-кнопок
def button_handler(update: Update, context: CallbackContext):
    query = update.callback_query
    query.answer()
    user_id = query.from_user.id

    if query.data == 'schedule_post':
        query.message.reply_text("Отправь текст сообщения для планирования:")
        user_states[user_id] = {'step': 'waiting_text'}

    elif query.data == 'show_scheduled':
        if scheduled_posts:
            msg = "\n".join([f"{i+1}. {p['datetime'].strftime('%d.%m %H:%M')} - {p['content']}" for i, p in enumerate(scheduled_posts)])
            query.message.reply_text(f"Запланированные посты:\n{msg}")
        else:
            query.message.reply_text("Запланированных постов нет.")

    elif query.data == 'add_channel':
        query.message.reply_text("Отправь username канала (с @) или числовой chat_id:")
        user_states[user_id] = {'step': 'waiting_channel'}

    elif query.data == 'show_channels':
        if target_channels:
            msg = "\n".join([f"{i+1}. {ch}" for i, ch in enumerate(target_channels)])
            query.message.reply_text(f"Текущий список каналов:\n{msg}")
        else:
            query.message.reply_text("Список каналов пуст.")

# Обработка текста от пользователя
def handle_text(update: Update, context: CallbackContext):
    user_id = update.message.from_user.id
    state = user_states.get(user_id, {})

    if state.get('step') == 'waiting_text':
        user_states[user_id]['content'] = update.message.text
        user_states[user_id]['step'] = 'waiting_date'
        show_calendar(update.message)

    elif state.get('step') == 'waiting_time':
        try:
            time_obj = datetime.strptime(update.message.text.strip(), "%H:%M").time()
            date_obj = datetime.strptime(state['date'], "%Y-%m-%d").date()
            post_datetime = datetime.combine(date_obj, time_obj)
            scheduled_posts.append({
                'content': state['content'],
                'datetime': post_datetime,
                'channels': target_channels.copy()
            })
            update.message.reply_text(f"Сообщение запланировано на {post_datetime.strftime('%d.%m %H:%M')}")
            user_states.pop(user_id)
        except ValueError:
            update.message.reply_text("Неверный формат времени. Введи время как ЧЧ:ММ")

    elif state.get('step') == 'waiting_channel':
        channel = update.message.text.strip()
        if channel.startswith("@") or channel.lstrip('-').isdigit():
            target_channels.append(channel)
            update.message.reply_text(f"Канал {channel} добавлен.")
            user_states.pop(user_id)
        else:
            update.message.reply_text("Некорректный формат. Введи username с @ или chat_id.")

    else:
        update.message.reply_text("Используй /start для вызова меню.")

# Календарь выбора даты
def show_calendar(message):
    today = datetime.now().date()
    keyboard = []
    for i in range(7):
        day = today + timedelta(days=i)
        btn = InlineKeyboardButton(day.strftime("%d.%m (%a)"), callback_data=f'select_date_{day.isoformat()}')
        keyboard.append([btn])
    message.reply_text("Выбери дату публикации:", reply_markup=InlineKeyboardMarkup(keyboard))

# Выбор даты из календаря
def calendar_handler(update: Update, context: CallbackContext):
    query = update.callback_query
    query.answer()
    user_id = query.from_user.id

    if query.data.startswith('select_date_'):
        date_str = query.data.replace('select_date_', '')
        if user_id in user_states:
            user_states[user_id]['date'] = date_str
            query.message.reply_text("Введи время публикации (ЧЧ:ММ):")
            user_states[user_id]['step'] = 'waiting_time'

# Фоновая проверка публикаций
def scheduler_loop():
    while True:
        now = datetime.now()
        for post in scheduled_posts[:]:
            if now >= post['datetime']:
                for channel in post['channels']:
                    try:
                        bot.send_message(chat_id=channel, text=post['content'])
                        print(f"Отправлено в {channel}: {post['content']}")
                    except Exception as e:
                        print(f"Ошибка отправки: {e}")
                scheduled_posts.remove(post)
        time.sleep(30)

# Запуск
threading.Thread(target=scheduler_loop, daemon=True).start()
dispatcher.add_handler(CommandHandler("start", start))
dispatcher.add_handler(CallbackQueryHandler(button_handler, pattern='^(schedule_post|show_scheduled|add_channel|show_channels)$'))
dispatcher.add_handler(CallbackQueryHandler(calendar_handler, pattern='^select_date_'))
dispatcher.add_handler(MessageHandler(Filters.text & ~Filters.command, handle_text))

print("Бот запущен.")
updater.start_polling()
updater.idle()
