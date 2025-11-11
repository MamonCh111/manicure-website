const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3000;
const bcrypt = require('bcryptjs');
const saltRounds = 10; // Сложность хеширования
const requestTimestamps = {};

// Middleware

// Middleware для правильной кодировки

app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
// ==================== ЗАЩИТА ADMIN.HTML ====================
app.get('/admin.html', (req, res) => {
    const token = req.cookies?.adminToken;

    console.log('🔐 Проверка доступа к админке');

    if (!token || !token.startsWith('admin_')) {
        console.log('❌ Доступ запрещен, редирект на вход');
        return res.redirect('/admin-login.html');
    }

    console.log('✅ Доступ разрешен');
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// ==================== АВТОРИЗАЦИЯ АДМИНА ====================
app.post('/api/admin/login', (req, res) => {  // ← ИСПРАВЬТЕ НА /api/admin/login
    const { password } = req.body;
    const ADMIN_PASSWORD = 'manicure2024';

    console.log('🔐 Попытка входа в админку');

    if (password === ADMIN_PASSWORD) {
        const token = 'admin_' + Date.now();

        res.cookie('adminToken', token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000
        });

        res.json({
            message: 'Успешный вход',
            token: token
        });
        console.log('✅ Успешный вход');
    } else {
        console.log('❌ Неверный пароль');
        res.status(401).json({ error: 'Неверный пароль' });
    }
});
/*
app.use((req, res, next) => {
    if (req.path.startsWith('/api/') && (req.method === 'POST' || req.method === 'PUT')) {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();

        if (requestTimestamps[ip] && (now - requestTimestamps[ip]) < 1000) { // 1 секунда
            return res.status(429).json({ error: 'Слишком много запросов. Подождите немного.' });
        }

        requestTimestamps[ip] = now;
    }
    next();
});
*/

// Инициализация базы данных
const db = new sqlite3.Database('./server/database.sqlite', (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
    } else {
        console.log('Подключение к SQLite базе данных установлено');
        initDatabase();
    }
});

// Создание таблиц
function initDatabase() {
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица записей
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        booking_date TEXT NOT NULL,
        booking_time TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active',
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Таблица рабочих часов
    db.run(`CREATE TABLE IF NOT EXISTS working_hours (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week INTEGER NOT NULL, -- 0-6 (воскресенье-суббота)
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL
    )`, () => {
        // Добавляем стандартные рабочие часы
        initWorkingHours();
    });

    console.log('Таблицы базы данных инициализированы');
}
// Тестовый роут для проверки кодировки
app.get('/api/test-russian', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
        message: 'Тест русских символов: Привет, Маникюр, Запись, Успех!'
    });
});
// Инициализация рабочих часов - ИСПРАВЛЕННАЯ ВЕРСИЯ
function initWorkingHours() {
    db.run('DELETE FROM working_hours', () => {
        const workingHours = [
            // Вс - выходной (можно сделать рабочим если нужно)
            { day: 0, start: '10:00', end: '14:00' }, // Воскресенье - сокращенный день
            // Пн-Пт с 9:00 до 18:00
            { day: 1, start: '09:00', end: '18:00' }, // Понедельник
            { day: 2, start: '09:00', end: '18:00' }, // Вторник  
            { day: 3, start: '09:00', end: '18:00' }, // Среда
            { day: 4, start: '09:00', end: '18:00' }, // Четверг
            { day: 5, start: '09:00', end: '18:00' }, // Пятница
            // Сб с 10:00 до 16:00
            { day: 6, start: '10:00', end: '16:00' }  // Суббота
        ];

        const stmt = db.prepare('INSERT INTO working_hours (day_of_week, start_time, end_time) VALUES (?, ?, ?)');

        workingHours.forEach(hour => {
            stmt.run([hour.day, hour.start, hour.end]);
        });

        stmt.finalize();
        console.log('✅ Рабочие часы инициализированы (Вс-Сб)');
    });
}



// ==================== РОУТЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ ====================

/// Регистрация с хешированием пароля
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }

    if (username.length < 3) {
        return res.status(400).json({ error: 'Имя пользователя должно быть не менее 3 символов' });
    }

    if (password.length < 4) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 4 символов' });
    }

    try {
        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        db.run('INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Имя пользователя уже занято' });
                    }
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }
                res.json({
                    message: 'Регистрация успешна',
                    userId: this.lastID
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Ошибка при создании пользователя' });
    }
});

// Вход с проверкой хешированного пароля
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?',
        [username],
        async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            if (!user) {
                return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
            }

            // Сравниваем пароль с хешем
            try {
                const isPasswordValid = await bcrypt.compare(password, user.password);

                if (isPasswordValid) {
                    res.json({
                        message: 'Вход успешен',
                        userId: user.id,
                        username: user.username
                    });
                } else {
                    res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
                }
            } catch (error) {
                res.status(500).json({ error: 'Ошибка проверки пароля' });
            }
        }
    );
});

// ==================== РОУТЫ ДЛЯ БРОНИРОВАНИЯ ====================

// Получить доступные слоты на дату
app.get('/api/available-slots/:date', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const date = req.params.date;

    // Получаем день недели (0-6) - ВОСКРЕСЕНЬЕ = 0
    const dayOfWeek = new Date(date).getDay();

    console.log(`🔍 Запрос слотов для: ${date}, день недели: ${dayOfWeek}`); // ДЛЯ ОТЛАДКИ

    // Получаем рабочие часы на этот день
    db.get('SELECT * FROM working_hours WHERE day_of_week = ?', [dayOfWeek], (err, hours) => {
        if (err) {
            console.error('Ошибка БД:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        console.log(`📅 Найденные рабочие часы:`, hours); // ДЛЯ ОТЛАДКИ

        if (!hours) {
            console.log(`❌ Нет рабочих часов для дня ${dayOfWeek}`);
            return res.json({ availableSlots: [] }); // Нерабочий день
        }

        // Получаем существующие записи на эту дату
        db.all('SELECT booking_time FROM bookings WHERE booking_date = ? AND status = "active"',
            [date],
            (err, bookings) => {
                if (err) {
                    console.error('Ошибка БД:', err);
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }

                const bookedTimes = bookings.map(b => b.booking_time);
                console.log(`⏰ Занятые времена:`, bookedTimes); // ДЛЯ ОТЛАДКИ

                const availableSlots = generateTimeSlots(hours.start_time, hours.end_time, bookedTimes);
                console.log(`✅ Доступные слоты:`, availableSlots); // ДЛЯ ОТЛАДКИ

                res.json({ availableSlots });
            }
        );
    });
});

 //Улучшенная версия бронирования с проверкой времени
app.post('/api/book', (req, res) => {
    const { userId, date, time } = req.body;

    // Базовая проверка данных
    if (!userId || !date || !time) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    // Создаем объект даты и времени бронирования
    const bookingDateTime = new Date(`${date}T${time}`);
    const now = new Date();

    console.log('🕒 Проверка времени:');
    console.log('Время бронирования:', bookingDateTime);
    console.log('Текущее время:', now);
    console.log('Разница (минут):', (bookingDateTime - now) / (1000 * 60));

    // Проверка что дата не в прошлом
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
        return res.status(400).json({ error: 'Нельзя записаться на прошедшую дату' });
    }

    // Проверка что время не в прошлом (для сегодняшней даты)
    if (selectedDate.getTime() === today.getTime() && bookingDateTime < now) {
        const currentTime = now.toTimeString().slice(0, 5);
        return res.status(400).json({ error: `Нельзя записаться на прошедшее время. Сейчас ${currentTime}` });
    }

    // Проверка что нельзя записываться менее чем за 2 часа
    const timeDiff = bookingDateTime - now;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff < 2) {
        return res.status(400).json({ error: 'Запись возможна не менее чем за 2 часа до времени приема' });
    }

    // Остальная логика бронирования...
    // Проверяем, не забронировал ли пользователь уже время на эту дату
    db.get('SELECT * FROM bookings WHERE user_id = ? AND booking_date = ? AND status = "active"',
        [userId, date],
        (err, existingBooking) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            if (existingBooking) {
                return res.status(400).json({ error: 'Вы уже записаны на эту дату' });
            }

            // Простая проверка: не более 5 активных записей всего
            db.get(`SELECT COUNT(*) as count FROM bookings 
                    WHERE user_id = ? AND status = "active"`,
                [userId],
                (err, activeBookings) => {
                    if (err) {
                        return res.status(500).json({ error: 'Ошибка сервера' });
                    }

                    if (activeBookings.count >= 5) {
                        return res.status(400).json({ error: 'Нельзя иметь более 5 активных записей' });
                    }

                    // Создаем бронирование
                    db.run('INSERT INTO bookings (user_id, booking_date, booking_time) VALUES (?, ?, ?)',
                        [userId, date, time],
                        function (err) {
                            if (err) {
                                return res.status(500).json({ error: 'Ошибка сервера' });
                            }
                            res.json({
                                message: 'Запись успешно создана',
                                bookingId: this.lastID
                            });
                        }
                    );
                }
            );
        }
    );
});

// Получить записи пользователя
app.get('/api/my-bookings/:userId', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const userId = req.params.userId;

    db.all(`SELECT b.id, b.booking_date, b.booking_time, b.created_at 
            FROM bookings b 
            WHERE b.user_id = ? AND b.status = "active" 
            ORDER BY b.booking_date, b.booking_time`,
        [userId],
        (err, bookings) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            res.json({ bookings });
        }
    );
});

// Отменить запись
app.post('/api/cancel-booking', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const { bookingId, userId } = req.body;

    db.run('UPDATE bookings SET status = "cancelled" WHERE id = ? AND user_id = ?',
        [bookingId, userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Запись не найдена' });
            }
            res.json({ message: 'Запись отменена' });
        }
    );
});

// ==================== АДМИН РОУТЫ ====================



// Middleware для проверки админских прав - ОБНОВЛЕННАЯ
function requireAdminAuth(req, res, next) {
    const token = req.cookies?.adminToken || req.headers.authorization;

    console.log('🔐 Проверка админского токена для API:', token ? 'есть' : 'нет');

    if (token && token.startsWith('admin_')) {
        next();
    } else {
        console.log('❌ Доступ к API запрещен: неверный токен');
        res.status(401).json({ error: 'Требуется авторизация администратора' });
    }
}


app.get('/api/admin/bookings/:date', requireAdminAuth, (req, res) => {
    // существующий код
});

app.get('/api/admin/all-active-bookings', requireAdminAuth, (req, res) => {
    // существующий код
});

// Отмена записи администратором
app.post('/api/admin/cancel-booking', requireAdminAuth, (req, res) => {
    const { date, time, username } = req.body;

    console.log('🗑️ Запрос на отмену записи:', { date, time, username });

    db.run(`UPDATE bookings SET status = 'cancelled' 
            WHERE booking_date = ? AND booking_time = ? 
            AND user_id = (SELECT id FROM users WHERE username = ?)`,
        [date, time, username],
        function (err) {
            if (err) {
                console.error('❌ Ошибка отмены записи:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            console.log('✅ Запись отменена, изменено записей:', this.changes);

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Запись не найдена' });
            }

            res.json({ message: 'Запись успешно отменена' });
        }
    );
});


app.post('/api/admin/working-hours', requireAdminAuth, (req, res) => {
    // существующий код
});




// Удаление рабочих часов (для выходных дней)
app.post('/api/admin/delete-working-hours', (req, res) => {
    const { dayOfWeek } = req.body;

    db.run('DELETE FROM working_hours WHERE day_of_week = ?',
        [dayOfWeek],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            res.json({ message: 'Рабочие часы удалены' });
        }
    );
});
// Удаление рабочих часов
app.post('/api/admin/delete-working-hours', (req, res) => {
    const { dayOfWeek } = req.body;

    console.log('🗑️ Удаляем рабочие часы для дня:', dayOfWeek);

    db.run('DELETE FROM working_hours WHERE day_of_week = ?',
        [dayOfWeek],
        function (err) {
            if (err) {
                console.error('❌ Ошибка удаления:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            console.log('✅ Удалено записей:', this.changes);
            res.json({ message: 'Рабочие часы удалены', deleted: this.changes });
        }
    );
});
// Получить все записи (для статистики)

app.get('/api/admin/all-bookings', requireAdminAuth, (req, res) => {
    db.all(`SELECT b.booking_date, b.booking_time, u.username 
            FROM bookings b 
            JOIN users u ON b.user_id = u.id 
            WHERE b.status = "active" 
            ORDER BY b.booking_date DESC, b.booking_time`,
        (err, bookings) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            res.json({ bookings });
        }
    );
});
// Получить ВСЕ активные записи (этого роута не хватает!)
app.get('/api/admin/all-active-bookings', requireAdminAuth, (req, res) => {
    db.all(`SELECT 
                b.id,
                b.booking_date, 
                b.booking_time, 
                u.username,
                b.created_at
            FROM bookings b 
            JOIN users u ON b.user_id = u.id 
            WHERE b.status = 'active' 
            ORDER BY b.booking_date ASC, b.booking_time ASC`,
        (err, bookings) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
            }
            res.json({ bookings });
        }
    );
});
// Получить общую статистику
app.get('/api/admin/stats', requireAdminAuth, (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    // Запросы для статистики
    const queries = {
        todayBookings: `SELECT COUNT(*) as count FROM bookings WHERE booking_date = ? AND status = "active"`,
        totalClients: `SELECT COUNT(DISTINCT user_id) as count FROM bookings WHERE status = "active"`,
        weekBookings: `SELECT COUNT(*) as count FROM bookings WHERE booking_date >= date('now', '-7 days') AND status = "active"`,
        totalUsers: `SELECT COUNT(*) as count FROM users`
    };

    // Выполняем все запросы
    db.get(queries.todayBookings, [today], (err, todayResult) => {
        db.get(queries.totalClients, (err, clientsResult) => {
            db.get(queries.weekBookings, (err, weekResult) => {
                db.get(queries.totalUsers, (err, usersResult) => {
                    res.json({
                        todayBookings: todayResult.count,
                        totalClients: clientsResult.count,
                        weekBookings: weekResult.count,
                        totalUsers: usersResult.count
                    });
                });
            });
        });
    });
});

// Отмена записи администратором
app.post('/api/admin/cancel-booking', (req, res) => {
    const { date, time, username } = req.body;

    db.run(`UPDATE bookings SET status = 'cancelled' 
            WHERE booking_date = ? AND booking_time = ? 
            AND user_id = (SELECT id FROM users WHERE username = ?)`,
        [date, time, username],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Запись не найдена' });
            }
            res.json({ message: 'Запись успешно отменена' });
        }
    );
});

// Управление рабочими часами

app.get('/api/admin/working-hours', requireAdminAuth, (req, res) => {
    db.all('SELECT * FROM working_hours ORDER BY day_of_week', (err, hours) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        res.json({ workingHours: hours });
    });
});

app.post('/api/admin/working-hours', (req, res) => {
    const { dayOfWeek, startTime, endTime } = req.body;

    db.run(`INSERT OR REPLACE INTO working_hours (day_of_week, start_time, end_time) 
            VALUES (?, ?, ?)`,
        [dayOfWeek, startTime, endTime],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            res.json({ message: 'Рабочие часы обновлены' });
        }
    );
});
// Массовое сохранение рабочих часов
app.post('/api/admin/working-hours/bulk', requireAdminAuth, (req, res) => {
    const { workingHours } = req.body;

    console.log('📦 Получен запрос на сохранение рабочих часов:', workingHours);

    if (!workingHours) {
        return res.status(400).json({ error: 'Отсутствуют данные рабочих часов' });
    }

    // Начинаем транзакцию
    db.serialize(() => {
        // Удаляем все старые рабочие часы
        db.run('DELETE FROM working_hours', (err) => {
            if (err) {
                console.error('❌ Ошибка очистки рабочих часов:', err);
                return res.status(500).json({ error: 'Ошибка очистки рабочих часов' });
            }

            console.log('✅ Старые рабочие часы удалены');

            // Если массив пустой - все дни выходные
            if (workingHours.length === 0) {
                console.log('📝 Все дни установлены как выходные');
                return res.json({ message: 'Рабочие часы обновлены (все дни - выходные)' });
            }

            // Вставляем новые рабочие часы
            const stmt = db.prepare('INSERT INTO working_hours (day_of_week, start_time, end_time) VALUES (?, ?, ?)');
            let completed = 0;
            const total = workingHours.length;

            workingHours.forEach(hour => {
                stmt.run([hour.dayOfWeek, hour.startTime, hour.endTime], (err) => {
                    if (err) {
                        console.error(`❌ Ошибка сохранения дня ${hour.dayOfWeek}:`, err);
                    } else {
                        console.log(`✅ Сохранен день ${hour.dayOfWeek}: ${hour.startTime}-${hour.endTime}`);
                    }

                    completed++;
                    if (completed === total) {
                        stmt.finalize((err) => {
                            if (err) {
                                console.error('❌ Ошибка финализации:', err);
                                return res.status(500).json({ error: 'Ошибка сохранения рабочих часов' });
                            }
                            console.log('✅ Все рабочие часы сохранены');
                            res.json({ message: 'Рабочие часы успешно обновлены' });
                        });
                    }
                });
            });
        });
    });
});
// Получить все записи на дату (для админа)
app.get('/api/admin/bookings/:date', requireAdminAuth, ( req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const date = req.params.date;

    db.all(`SELECT b.booking_time, u.username 
            FROM bookings b 
            JOIN users u ON b.user_id = u.id 
            WHERE b.booking_date = ? AND b.status = "active" 
            ORDER BY b.booking_time`,
        [date],
        (err, bookings) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            res.json({ bookings });
        }
    );
});

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

// Генерация временных слотов
// Генерация временных слотов по 3 часа
function generateTimeSlots(startTime, endTime, bookedTimes) {
    const slots = [];
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);

    // Создаем слоты по 3 часа (180 минут)
    let current = new Date(start);
    while (current < end) {
        const timeString = current.toTimeString().slice(0, 5);
        const isBooked = bookedTimes.includes(timeString);

        // Проверяем, что следующий слот не выходит за рабочие часы
        const nextSlot = new Date(current);
        nextSlot.setHours(nextSlot.getHours() + 3,30);

        if (nextSlot <= end) {
            slots.push({
                time: timeString,
                available: !isBooked
            });
        }

        current.setHours(current.getHours() + 3,30);
    }

    console.log(`⏰ Сгенерированные слоты по 3 часа:`, slots);
    return slots;
}
// Проверка текущих рабочих часов
app.get('/api/debug/working-hours', (req, res) => {
    db.all('SELECT * FROM working_hours ORDER BY day_of_week', (err, hours) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        const workingHours = hours.map(hour => {
            return {
                day: hour.day_of_week,
                dayName: days[hour.day_of_week],
                start: hour.start_time,
                end: hour.end_time
            };
        });

        res.json({ workingHours });
    });
});
// Функция валидации данных
function validateBookingData(userId, date, time) {
    const errors = [];

    // Проверка userId
    if (!userId || isNaN(userId)) {
        errors.push('Некорректный идентификатор пользователя');
    }

    // Проверка даты
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!date || !dateRegex.test(date)) {
        errors.push('Некорректный формат даты');
    }

    // Проверка времени
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!time || !timeRegex.test(time)) {
        errors.push('Некорректный формат времени');
    }

    // Проверка что дата не в прошлом
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
        errors.push('Нельзя записаться на прошедшую дату');
    }
    // Проверка времени бронирования (не менее чем за 2 часа)
    const bookingDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    const timeDiff = bookingDateTime - now;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff < 2) {
        errors.push('Запись возможна не менее чем за 2 часа до времени приема');
    }
    return errors;
}

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});

// Обработка закрытия приложения
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Закрытие соединения с БД');
        process.exit(0);
    });
});