// Глобальные переменные
let currentUser = null;
let currentDate = new Date();
let selectedDate = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function () {
    initCalendar();
    setupEventListeners();
    checkAuthStatus();
});

// Настройка обработчиков событий
function setupEventListeners() {
    document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeMonth(1));
    document.getElementById('register-btn').addEventListener('click', register);
    document.getElementById('login-btn').addEventListener('click', login);
}

// ==================== КАЛЕНДАРЬ ====================

// Инициализация календаря
function initCalendar() {
    renderCalendar();
    loadAvailableDates();
}

// Отрисовка календаря
function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYear = document.getElementById('current-month');

    // Устанавливаем заголовок месяца
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    monthYear.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

    // Очищаем календарь
    calendarGrid.innerHTML = '';

    // Получаем первый день месяца и количество дней
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Добавляем пустые ячейки для дней предыдущего месяца
    // Корректируем для отображения с понедельника (1) вместо воскресенья (0)
    let startDay = firstDay.getDay();
    if (startDay === 0) startDay = 7; // Воскресенье становится 7-м днем

    for (let i = 1; i < startDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyDay);
    }

    // Добавляем дни месяца
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';

        // Добавляем число
        const dayNumber = document.createElement('div');
        dayNumber.textContent = day;
        dayNumber.style.fontWeight = 'bold';
        dayNumber.style.fontSize = '16px';
        dayElement.appendChild(dayNumber);

        // Добавляем день недели маленьким текстом
        const dayOfWeek = document.createElement('div');
        const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dayNames = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
        dayOfWeek.textContent = dayNames[dateObj.getDay()];
        dayOfWeek.style.fontSize = '12px';
        dayOfWeek.style.color = '#666';
        dayOfWeek.style.marginTop = '2px';
        dayElement.appendChild(dayOfWeek);

        const dateStr = formatDate(dateObj);

        // Проверяем сегодняшний ли это день
        const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        cellDate.setHours(0, 0, 0, 0);
        if (cellDate.getTime() === today.getTime()) {
            dayElement.classList.add('today');

            // Добавляем метку "Сегодня"
            const todayLabel = document.createElement('div');
            todayLabel.textContent = 'Сегодня';
            todayLabel.style.fontSize = '10px';
            todayLabel.style.color = '#e91e63';
            todayLabel.style.marginTop = '2px';
            dayElement.appendChild(todayLabel);
        }

        // Проверяем доступность даты
        if (isDateAvailable(dateStr)) {
            dayElement.classList.add('available');
            dayElement.addEventListener('click', () => selectDate(dateStr, dayElement));
        } else {
            dayElement.classList.add('booked');
        }

        calendarGrid.appendChild(dayElement);
    }

}

// Смена месяца
function changeMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    renderCalendar();
    loadAvailableDates();
}

// Загрузка доступных дат (заглушка - в реальности будет API запрос)
function loadAvailableDates() {
    // Здесь будет запрос к API для получения занятых дат
    console.log('Загрузка доступных дат для', currentDate.getMonth() + 1);
}

// Проверка доступности даты
function isDateAvailable(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Нельзя записаться на прошедшие даты
    if (date < today) {
        return false;
    }

    // Проверяем рабочие часы через API
    // Пока временно разрешаем все дни кроме прошедших
    // Позже подключим проверку реальных рабочих часов

    return true; // Временно разрешаем все будущие даты
}

// Выбор даты
function selectDate(dateStr, element) {
    // Снимаем выделение со всех дней
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
    });

    // Выделяем выбранный день
    element.classList.add('selected');

    selectedDate = dateStr;
    document.getElementById('selected-date').textContent = `Выбрана дата: ${formatDisplayDate(dateStr)}`;

    // Загружаем доступные временные слоты
    loadTimeSlots(dateStr);

    // Показываем секцию бронирования если пользователь авторизован
    if (currentUser) {
        document.getElementById('booking-section').style.display = 'block';
    }
}

// ==================== АВТОРИЗАЦИЯ ====================

// Регистрация
async function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('auth-message');

    if (!username || !password) {
        showMessage(messageEl, 'Заполните все поля', 'error');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(messageEl, 'Регистрация успешна! Теперь войдите.', 'success');
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
        } else {
            showMessage(messageEl, data.error, 'error');
        }
    } catch (error) {
        showMessage(messageEl, 'Ошибка соединения', 'error');
    }
}

// Вход
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('auth-message');

    if (!username || !password) {
        showMessage(messageEl, 'Заполните все поля', 'error');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = {
                id: data.userId,
                username: data.username
            };
            showMessage(messageEl, `Добро пожаловать, ${data.username}!`, 'success');
            updateUIAfterLogin();
            loadMyBookings();
        } else {
            showMessage(messageEl, data.error, 'error');
        }
    } catch (error) {
        showMessage(messageEl, 'Ошибка соединения', 'error');
    }
}

// Обновление интерфейса после входа
function updateUIAfterLogin() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('booking-section').style.display = 'block';
    document.getElementById('my-bookings-section').style.display = 'block';

    if (selectedDate) {
        loadTimeSlots(selectedDate);
    }
}

// Проверка статуса авторизации (при загрузке страницы)
function checkAuthStatus() {
    // В реальном приложении здесь была бы проверка токена/сессии
    // Пока оставляем пустым - пользователь должен войти заново
}

// ==================== БРОНИРОВАНИЕ ====================

// Загрузка временных слотов
async function loadTimeSlots(dateStr) {
    const timeSlotsEl = document.getElementById('time-slots');
    const messageEl = document.getElementById('booking-message');

    timeSlotsEl.innerHTML = '<div>Загрузка...</div>';

    try {
        const response = await fetch(`/api/available-slots/${dateStr}`);
        const data = await response.json();

        if (response.ok) {
            renderTimeSlots(data.availableSlots);
        } else {
            showMessage(messageEl, 'Ошибка загрузки слотов', 'error');
        }
    } catch (error) {
        showMessage(messageEl, 'Ошибка соединения', 'error');
    }
}

// Отрисовка временных слотов
function renderTimeSlots(slots) {
    const timeSlotsEl = document.getElementById('time-slots');
    timeSlotsEl.innerHTML = '';

    if (slots.length === 0) {
        timeSlotsEl.innerHTML = '<div>Нет доступных слотов на эту дату</div>';
        return;
    }

    slots.forEach(slot => {
        const slotElement = document.createElement('div');
        slotElement.className = `time-slot ${slot.available ? 'available' : 'booked'}`;
        slotElement.textContent = slot.time;

        if (slot.available && currentUser) {
            slotElement.addEventListener('click', () => bookTimeSlot(slot.time));
        }

        timeSlotsEl.appendChild(slotElement);
    });
}

// Бронирование времени
async function bookTimeSlot(time) {
    const messageEl = document.getElementById('booking-message');

    if (!currentUser) {
        showMessage(messageEl, 'Для бронирования необходимо войти в систему', 'error');
        return;
    }

    if (!selectedDate) {
        showMessage(messageEl, 'Пожалуйста, выберите дату', 'error');
        return;
    }

    try {
        const response = await fetch('/api/book', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: currentUser.id,
                date: selectedDate,
                time: time
            }),
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(messageEl, '✅ Запись успешно создана!', 'success');
            loadTimeSlots(selectedDate); // Обновляем слоты
            loadMyBookings(); // Обновляем список записей

            // Автоматически скрываем сообщение через 3 секунды
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 3000);

        } else {
            showMessage(messageEl, '❌ ' + data.error, 'error');
        }
    } catch (error) {
        showMessage(messageEl, '❌ Ошибка соединения с сервером', 'error');
    }
}


// ==================== МОИ ЗАПИСИ ====================

// Загрузка моих записей
async function loadMyBookings() {
    if (!currentUser) return;

    try {
        const response = await fetch(`/api/my-bookings/${currentUser.id}`);
        const data = await response.json();

        if (response.ok) {
            renderMyBookings(data.bookings);
        }
    } catch (error) {
        console.error('Ошибка загрузки записей:', error);
    }
}

// Отрисовка моих записей
function renderMyBookings(bookings) {
    const bookingsListEl = document.getElementById('my-bookings-list');

    if (!bookings || bookings.length === 0) {
        bookingsListEl.innerHTML = '<div>У вас нет активных записей</div>';
        return;
    }

    bookingsListEl.innerHTML = '';

    bookings.forEach(booking => {
        const bookingElement = document.createElement('div');
        bookingElement.className = 'booking-item';
        bookingElement.innerHTML = `
            <div>
                <strong>${formatDisplayDate(booking.booking_date)}</strong>
                <br>Время: ${booking.booking_time}
            </div>
            <button class="cancel-btn" onclick="cancelBooking(${booking.id})">Отменить</button>
        `;

        bookingsListEl.appendChild(bookingElement);
    });
}

// Отмена записи
async function cancelBooking(bookingId) {
    if (!confirm('Вы уверены, что хотите отменить запись?')) {
        return;
    }

    try {
        const response = await fetch('/api/cancel-booking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                bookingId: bookingId,
                userId: currentUser.id
            }),
        });

        const data = await response.json();

        if (response.ok) {
            alert('Запись отменена');
            loadMyBookings();
            if (selectedDate) {
                loadTimeSlots(selectedDate);
            }
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Ошибка соединения');
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

// Форматирование даты для API (YYYY-MM-DD)
function formatDate(date) {
    // Используем локальную дату чтобы избежать проблем с часовыми поясами
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Форматирование даты для отображения (DD.MM.YYYY) - ИСПРАВЛЕННАЯ ВЕРСИЯ
function formatDisplayDate(dateStr) {
    // Создаем дату в локальном часовом поясе
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('ru-RU');
}


// Показать сообщение
function showMessage(element, text, type) {
    element.textContent = text;
    element.className = `message ${type}`;
    element.style.display = 'block';

    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

// Выход (дополнительная функция)
function logout() {
    currentUser = null;
    selectedDate = null;

    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('booking-section').style.display = 'none';
    document.getElementById('my-bookings-section').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';

    // Сбрасываем выделение даты
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.style.border = '';
    });
}