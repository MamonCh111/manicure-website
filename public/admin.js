// Админ-панель - с полной проверкой авторизации
console.log('🔄 admin.js ЗАГРУЖЕН!');

// ==================== СИСТЕМА АВТОРИЗАЦИИ ====================

function getAdminToken() {
    return localStorage.getItem('adminToken');
}

function checkAdminAuth() {
    const token = getAdminToken();
    if (!token || !token.startsWith('admin_')) {
        alert('❌ Требуется авторизация администратора');
        window.location.href = '/admin-login.html';
        return false;
    }
    return true;
}

// Функция для авторизованных запросов
async function makeAdminRequest(url, options = {}) {
    const token = getAdminToken();

    if (!checkAdminAuth()) {
        throw new Error('Not authorized');
    }

    const defaultOptions = {
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    };

    const mergedOptions = { ...defaultOptions, ...options };

    const response = await fetch(url, mergedOptions);

    if (response.status === 401) {
        alert('❌ Сессия истекла. Требуется повторный вход.');
        window.location.href = '/admin-login.html';
        return null;
    }

    return response;
}

// Выход из админки
function adminLogout() {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin-login.html';
}

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================

// Инициализация при загрузке страницы - ТОЛЬКО ОДИН РАЗ!
document.addEventListener('DOMContentLoaded', function () {
    console.log('🔐 Проверка авторизации админки...');

    // Проверяем авторизацию
    if (!checkAdminAuth()) {
        return;
    }

    console.log('✅ Авторизация успешна, загружаем данные...');

    // Загружаем данные если авторизованы
    loadTodayBookings();
    loadStats();
    loadAllActiveBookings();

    // Закрытие модального окна при клике вне его
    const modal = document.getElementById('workingHoursModal');
    if (modal) {
        modal.addEventListener('click', function (event) {
            if (event.target === modal) {
                closeWorkingHoursModal();
            }
        });
        console.log('✅ Модальное окно инициализировано');
    }
});

// Загрузка статистики
async function loadStats() {
    try {
        const response = await makeAdminRequest('/api/admin/stats');
        if (!response) return;

        const data = await response.json();

        if (response.ok) {
            document.getElementById('today-bookings').textContent = data.todayBookings;
            document.getElementById('week-bookings').textContent = data.weekBookings;
            document.getElementById('total-clients').textContent = data.totalClients;
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}
// Загрузка всех записей для кнопки "Все записи"
async function loadAllBookings() {
    try {
        console.log('📋 Загрузка всех активных записей в основной контейнер...');

        const response = await makeAdminRequest('/api/admin/all-active-bookings');
        if (!response) return;

        const data = await response.json();

        if (response.ok) {
            // Используем существующую функцию renderBookings, но для всех записей
            renderAllBookingsInMainContainer(data.bookings);
        } else {
            alert('Ошибка загрузки всех записей: ' + data.error);
        }
    } catch (error) {
        console.error('Ошибка загрузки всех записей:', error);
    }
}

// Отрисовка всех записей в основном контейнере (bookings-container)
function renderAllBookingsInMainContainer(bookings) {
    const container = document.getElementById('bookings-container');

    if (!bookings || bookings.length === 0) {
        container.innerHTML = '<div>Активных записей нет</div>';
        return;
    }

    let html = '<div style="margin-bottom: 15px; font-weight: bold;">';
    html += 'Все активные записи: ' + bookings.length;
    html += '</div>';

    // Группируем записи по датам
    const bookingsByDate = {};
    bookings.forEach(booking => {
        if (!bookingsByDate[booking.booking_date]) {
            bookingsByDate[booking.booking_date] = [];
        }
        bookingsByDate[booking.booking_date].push(booking);
    });

    // Отрисовываем по датам
    Object.keys(bookingsByDate).sort().forEach(date => {
        html += `<div style="margin: 15px 0; padding: 10px; background: #f0f0f0; border-radius: 5px;">`;
        html += `<strong>📅 ${formatDisplayDate(date)}</strong>`;

        bookingsByDate[date].forEach(booking => {
            html += `
                <div class="booking-admin-item" style="margin: 5px 0;">
                    <div>
                        <strong>🕒 ${booking.booking_time}</strong>
                        <br>👤 Клиент: ${booking.username}
                        <br><small>Запись создана: ${new Date(booking.created_at).toLocaleString('ru-RU')}</small>
                    </div>
                    <div>
                        <button class="cancel-btn" onclick="cancelAdminBooking('${booking.booking_date}', '${booking.booking_time}', '${booking.username}')">
                            Отменить
                        </button>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    });

    container.innerHTML = html;
}
// Загрузка всех активных записей
async function loadAllActiveBookings() {
    try {
        const response = await makeAdminRequest('/api/admin/all-active-bookings');
        if (!response) return;

        const data = await response.json();

        if (response.ok) {
            renderAllBookings(data.bookings);
        } else {
            alert('Ошибка загрузки записей: ' + data.error);
        }
    } catch (error) {
        console.error('Ошибка загрузки всех записей:', error);
    }
}

// Отрисовка всех записей
function renderAllBookings(bookings) {
    const container = document.getElementById('all-bookings-container');

    if (!bookings || bookings.length === 0) {
        container.innerHTML = '<div>Активных записей нет</div>';
        return;
    }

    let html = `
        <div style="margin-bottom: 15px; font-weight: bold;">
            Всего активных записей: ${bookings.length}
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
    `;

    // Группируем записи по датам
    const bookingsByDate = {};
    bookings.forEach(booking => {
        if (!bookingsByDate[booking.booking_date]) {
            bookingsByDate[booking.booking_date] = [];
        }
        bookingsByDate[booking.booking_date].push(booking);
    });

    // Отрисовываем по датам
    Object.keys(bookingsByDate).sort().forEach(date => {
        html += `<div style="margin: 15px 0; padding: 10px; background: #f0f0f0; border-radius: 5px;">`;
        html += `<strong>📅 ${formatDisplayDate(date)}</strong>`;

        bookingsByDate[date].forEach(booking => {
            html += `
                <div class="booking-admin-item" style="margin: 5px 0;">
                    <div>
                        <strong>🕒 ${booking.booking_time}</strong>
                        <br>👤 Клиент: ${booking.username}
                        <br><small>Запись создана: ${new Date(booking.created_at).toLocaleString('ru-RU')}</small>
                    </div>
                    <div>
                        <button class="cancel-btn" onclick="cancelAdminBooking('${booking.booking_date}', '${booking.booking_time}', '${booking.username}')">
                            Отменить
                        </button>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

// Загрузка записей на выбранную дату
async function loadAllBookings() {
    try {
        console.log('📋 Загрузка всех записей...');

        // Меняем endpoint на all-bookings
        const response = await makeAdminRequest('/api/admin/all-bookings');
        console.log('📨 Ответ получен, статус:', response.status);

        if (!response) {
            console.error('❌ Нет ответа от сервера');
            return;
        }

        const data = await response.json();
        console.log('📊 Данные от сервера:', data);

        if (response.ok) {
            console.log('✅ Успешный ответ, записей:', data.bookings ? data.bookings.length : 0);
            renderAllBookingsInMainContainer(data.bookings);
        } else {
            console.error('❌ Ошибка сервера:', data.error);
            alert('Ошибка загрузки всех записей: ' + data.error);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки всех записей:', error);
    }
}

// Загрузка записей на сегодня
async function loadTodayBookings() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('filter-date').value = today;
    await loadBookingsByDate(today);
}

// Загрузка записей по дате
async function loadBookingsByDate(date) {
    try {
        const response = await makeAdminRequest('/api/admin/bookings/' + date);
        if (!response) return;

        const data = await response.json();

        if (response.ok) {
            renderBookings(data.bookings, date);
        } else {
            alert('Ошибка загрузки записей: ' + data.error);
        }
    } catch (error) {
        console.error('Ошибка загрузки записей по дате:', error);
    }
}

// Отрисовка списка записей
function renderBookings(bookings, date) {
    const container = document.getElementById('bookings-container');

    if (!bookings || bookings.length === 0) {
        container.innerHTML = '<div>На ' + formatDisplayDate(date) + ' записей нет</div>';
        return;
    }

    let html = '<div style="margin-bottom: 15px; font-weight: bold;">';
    html += 'Записи на ' + formatDisplayDate(date) + ': ' + bookings.length;
    html += '</div>';

    bookings.forEach(function (booking) {
        html += '<div class="booking-admin-item">';
        html += '<div>';
        html += '<strong>' + booking.booking_time + '</strong>';
        html += '<br>Клиент: ' + booking.username;
        html += '</div>';
        html += '<div>';
        html += '<button class="cancel-btn" onclick="cancelAdminBooking(\'' + date + '\', \'' + booking.booking_time + '\', \'' + booking.username + '\')">';
        html += 'Отменить';
        html += '</button>';
        html += '</div>';
        html += '</div>';
    });

    container.innerHTML = html;
}

/// Отмена записи администратором
async function cancelAdminBooking(date, time, username) {
    const confirmed = confirm(`Вы уверены, что хотите отменить запись?\n\nКлиент: ${username}\nДата: ${formatDisplayDate(date)}\nВремя: ${time}\n\nЭта операция необратима.`);

    if (!confirmed) {
        return;
    }

    try {
        console.log('🗑️ Отмена записи:', { date, time, username });

        const response = await makeAdminRequest('/api/admin/cancel-booking', {
            method: 'POST',
            body: JSON.stringify({
                date: date,
                time: time,
                username: username
            })
        });

        if (!response) {
            console.error('❌ Нет ответа от сервера');
            return;
        }

        const data = await response.json();
        console.log('📨 Ответ сервера:', data);

        if (response.ok) {
            alert('✅ Запись успешно отменена');

            // Обновляем все списки
            loadBookingsByDate(date); // Обновляем записи по дате
            loadStats(); // Обновляем статистику
            loadAllActiveBookings(); // Обновляем список всех активных записей
            loadAllBookings(); // Обновляем основной контейнер

        } else {
            alert('❌ Ошибка: ' + data.error);
        }
    } catch (error) {
        console.error('❌ Ошибка соединения:', error);
        alert('❌ Ошибка соединения');
    }
}

// ==================== РАБОЧИЕ ЧАСЫ ====================

function showWorkingHoursModal() {
    console.log('📅 Открытие модального окна рабочих часов');

    const modal = document.getElementById('workingHoursModal');
    if (modal) {
        modal.style.display = 'block';
        console.log('✅ Модальное окно открыто');

        // Добавим временную проверку видимости
        setTimeout(() => {
            console.log('🔍 Проверка модального окна:');
            console.log('Display:', modal.style.display);
            console.log('Видимый размер:', modal.offsetWidth, 'x', modal.offsetHeight);

            const content = modal.querySelector('.modal-content');
            if (content) {
                console.log('Контент видим:', content.offsetWidth > 0 && content.offsetHeight > 0);
            }
        }, 100);

        loadWorkingHoursData();
    } else {
        console.error('❌ Модальное окно не найдено');
    }
}

function closeWorkingHoursModal() {
    console.log('❌ Закрытие модального окна');

    const modal = document.getElementById('workingHoursModal');
    if (modal) {
        modal.style.display = 'none';
        console.log('✅ Модальное окно закрыто');
    } else {
        console.error('❌ Модальное окно не найдено для закрытия');
    }
}

async function loadWorkingHoursData() {
    try {
        console.log('📥 Загрузка текущих рабочих часов...');

        const response = await fetch('/api/admin/working-hours');
        const data = await response.json();

        if (response.ok) {
            renderWorkingHoursForm(data.workingHours);
        } else {
            console.error('❌ Ошибка загрузки:', data.error);
            alert('Ошибка загрузки рабочих часов: ' + data.error);
        }
    } catch (error) {
        console.error('❌ Ошибка сети:', error);
        alert('Ошибка соединения: ' + error.message);
    }
}

function renderWorkingHoursForm(workingHours) {
    const container = document.getElementById('working-hours-form');

    const days = [
        { id: 0, name: 'Воскресенье', weekend: true },
        { id: 1, name: 'Понедельник', weekend: false },
        { id: 2, name: 'Вторник', weekend: false },
        { id: 3, name: 'Среда', weekend: false },
        { id: 4, name: 'Четверг', weekend: false },
        { id: 5, name: 'Пятница', weekend: false },
        { id: 6, name: 'Суббота', weekend: true }
    ];

    let html = '';

    days.forEach(day => {
        const dayHours = workingHours.find(h => h.day_of_week === day.id);
        const isWorking = dayHours && dayHours.start_time && dayHours.end_time;

        html += `
            <div class="working-day-item" style="margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <label style="display: flex; align-items: center; gap: 10px;">
                            <input type="checkbox" 
                                   id="day-${day.id}" 
                                   ${isWorking ? 'checked' : ''} 
                                   onchange="toggleDay(${day.id})">
                            <strong>${day.name}</strong>
                            ${day.weekend ? ' 🏖️' : ' 💼'}
                        </label>
                    </div>
                    <div class="time-inputs" id="times-${day.id}" style="display: ${isWorking ? 'flex' : 'none'}; gap: 10px;">
                        <input type="time" 
                               id="start-${day.id}" 
                               value="${isWorking ? dayHours.start_time : '09:00'}" 
                               style="padding: 5px;">
                        <span>—</span>
                        <input type="time" 
                               id="end-${day.id}" 
                               value="${isWorking ? dayHours.end_time : '18:00'}" 
                               style="padding: 5px;">
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function toggleDay(dayId) {
    const checkbox = document.getElementById(`day-${dayId}`);
    const timeInputs = document.getElementById(`times-${dayId}`);

    if (checkbox && timeInputs) {
        timeInputs.style.display = checkbox.checked ? 'flex' : 'none';
    }
}

async function saveWorkingHours() {
    console.log('🔄 Сохранение рабочих часов...');

    // Собираем данные из формы
    const hoursData = [];
    const days = [0, 1, 2, 3, 4, 5, 6];

    days.forEach(dayId => {
        const checkbox = document.getElementById(`day-${dayId}`);
        const startInput = document.getElementById(`start-${dayId}`);
        const endInput = document.getElementById(`end-${dayId}`);

        if (checkbox && checkbox.checked && startInput && endInput) {
            hoursData.push({
                dayOfWeek: dayId,
                startTime: startInput.value,
                endTime: endInput.value
            });
        }
    });

    console.log('📦 Данные для сохранения:', hoursData);

    // Получаем токен авторизации
    const token = localStorage.getItem('adminToken');
    if (!token) {
        alert('❌ Ошибка авторизации. Войдите заново.');
        return;
    }

    try {
        console.log('📤 Отправка запроса с авторизацией...');

        // Отправляем запрос на сервер С токеном авторизации
        const response = await fetch('/api/admin/working-hours/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token  // ← ДОБАВЬТЕ ЭТУ СТРОКУ
            },
            body: JSON.stringify({ workingHours: hoursData }),
        });

        console.log('📨 Статус ответа:', response.status);

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Успешный ответ:', result);
            alert('✅ Рабочие часы успешно сохранены!');
            closeWorkingHoursModal();

            // Обновляем интерфейс через 1 секунду
            setTimeout(() => {
                location.reload();
            }, 1000);

        } else {
            // Если ошибка авторизации
            if (response.status === 401) {
                alert('❌ Сессия истекла. Войдите заново.');
                adminLogout();
            } else {
                const error = await response.json();
                alert('❌ Ошибка сохранения: ' + error.error);
            }
        }

    } catch (error) {
        console.error('❌ Ошибка сети:', error);
        alert('❌ Ошибка соединения с сервером: ' + error.message);
    }
}


// Экспорт записей
function exportBookings() {
    alert('Функция экспорта будет реализована в следующем обновлении\nПока можно скопировать список из раздела выше');
}

// Форматирование даты для отображения
function formatDisplayDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU');

}
