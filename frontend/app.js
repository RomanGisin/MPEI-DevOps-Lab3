// Генератор UUID для небезопасного контекста (HTTP)
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
const API_BASE = '/api/v1';
let currentEventId = null;

const logContainer = document.getElementById('logs');
const btnCreate = document.getElementById('create-event');
const btnBuy = document.getElementById('buy-tickets');
const btnCheck = document.getElementById('check-tickets');

function log(message, type = 'info') {
    const div = document.createElement('div');
    div.className = `log-${type}`;
    const time = new Date().toLocaleTimeString();
    div.textContent = `[${time}] ${message}`;
    logContainer.appendChild(div);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// 1. СОЗДАНИЕ СОБЫТИЯ
btnCreate.addEventListener('click', async () => {
    btnCreate.disabled = true;
    try {
        log("Создаем артиста...");
        // 1. Создаем артиста (поля могут отличаться, проверь в Swagger!)
        const artistRes = await fetch(`${API_BASE}/artists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: "Тестовый Артист", description: "Создан для лабы" })
        });
        if (!artistRes.ok) throw new Error(`Ошибка артиста: ${await artistRes.text()}`);
        const artistData = await artistRes.json();
        const artistId = artistData.id;
        log(`Артист создан: ${artistId}`, 'success');

        log("Создаем площадку...");
        // 2. Создаем площадку (исправленный JSON)
        const venueRes = await fetch(`${API_BASE}/venues`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: "Тестовая Площадка", 
                city: "Москва",
                district_code: "CAO", // Центральный административный округ
                street: "Тверская",
                house: "1",
                formatted_address: "г. Москва, ул. Тверская, д. 1",
                capacity: 100
            })
        });
        if (!venueRes.ok) throw new Error(`Ошибка площадки: ${await venueRes.text()}`);
        const venueData = await venueRes.json();
        const venueId = venueData.id;
        log(`Площадка создана: ${venueId}`, 'success');

        log("Создаем событие с квотой 1 билет...");
        // 3. Создаем само событие, используя реальные ID
        const eventData = {
            title: "Тестовое событие",
            artist_id: artistId,
            venue_id: venueId,
            genre_code: "concert",
            starts_at: new Date(Date.now() + 86400000).toISOString(),
            ends_at: new Date(Date.now() + 90000000).toISOString(),
            price_rub: 1500.0,
            age_rating: 18,
            ticket_quota: 1,
            status: "published"
        };

        const eventRes = await fetch(`${API_BASE}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        });

        if (!eventRes.ok) throw new Error(`Ошибка события: ${await eventRes.text()}`);
        
        const data = await eventRes.json();
        currentEventId = data.id; 
        log(`Успех! Создано событие ID: ${currentEventId} (Квота: 1)`, 'success');
        
    } catch (error) {
        log(error.message, 'error');
    } finally {
        btnCreate.disabled = false;
    }
});

// 2. ОТПРАВКА 10 ОДНОВРЕМЕННЫХ ЗАПРОСОВ
btnBuy.addEventListener('click', async () => {
    if (!currentEventId) {
        log("Сначала создайте событие (кнопка 1)!", 'error');
        return;
    }

    btnBuy.disabled = true;
    log("Запускаем 10 одновременных запросов на бронирование...", 'info');

    const requests = Array.from({ length: 10 }).map(async (_, index) => {
        // Генерируем уникальный ключ (fallback для старых браузеров)
        const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? crypto.randomUUID() 
            : Date.now() + '-' + Math.random().toString(36).substring(2);

        try {
            const response = await fetch(`${API_BASE}/reservations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': idempotencyKey
                },
                body: JSON.stringify({
                    event_id: currentEventId,
                    quantity: 1 
                })
            });

            if (response.ok) {
                log(`Поток ${index + 1}: БИЛЕТ КУПЛЕН (${response.status})`, 'success');
                return true;
            } else {
                log(`Поток ${index + 1}: Отклонено (${response.status})`, 'error');
                return false;
            }
        } catch (error) {
            log(`Поток ${index + 1}: Ошибка сети`, 'error');
            return false;
        }
    });

    const results = await Promise.all(requests);
    const successCount = results.filter(r => r === true).length;
    
    log(`ИТОГ: Успешно куплено билетов: ${successCount} из 10.`, 'info');
    btnBuy.disabled = false;
});

// 3. ПРОВЕРКА ОСТАТКА
btnCheck.addEventListener('click', async () => {
    if (!currentEventId) {
        log("Сначала создайте событие!", 'error');
        return;
    }
    btnCheck.disabled = true;
    try {
        const response = await fetch(`${API_BASE}/events/${currentEventId}`);
        const data = await response.json();
        
        // Красиво форматируем вывод
        log(`--- СТАТУС СОБЫТИЯ ---`, 'info');
        log(`Всего билетов (квота): ${data.ticket_quota}`, 'info');
        log(`Продано билетов: ${data.sold_tickets}`, 'success');
        log(`Свободно билетов: ${data.available_tickets}`, 'info');
        log(`Заполняемость: ${data.occupancy_percent}%`, 'info');
        
        // Проверка главного условия лабы
        if (data.sold_tickets <= data.ticket_quota) {
            log(`✅ УСПЕХ: Продано (${data.sold_tickets}) не превышает квоту (${data.ticket_quota}).`, 'success');
        } else {
            log(`❌ ОШИБКА: ПРОДАНО БОЛЬШЕ, ЧЕМ ЕСТЬ!`, 'error');
        }
        
    } catch (error) {
        log("Ошибка проверки: " + error.message, 'error');
    } finally {
        btnCheck.disabled = false;
    }
});
