# Занятие 5. Собственный сервер на Node.js и Express

## О занятии

В предыдущих работах браузер отправлял запросы к уже готовому API. Теперь серверную часть нужно сделать самостоятельно.

В этой работе используется Node.js и Express. Сервер будет принимать HTTP-запросы, разбирать параметры, работать с данными и возвращать JSON-ответы с корректными HTTP-кодами.

По ходу работы понадобятся:

- Node.js как среда выполнения JavaScript вне браузера;
- Express для маршрутизации и обработки HTTP-запросов;
- маршруты вида `/api/items` и `/api/items/:id`;
- `req` для чтения данных запроса;
- `res` для формирования ответа;
- path parameters и query parameters;
- JSON и HTTP-коды;
- проверка API через браузер, DevTools или `curl`.

Пока данные будут храниться в обычном массиве в памяти. База данных появится на следующем этапе курса.

---

# 1. Что меняется по сравнению с предыдущими работами

До этого JavaScript запускался в браузере.

Например:

```javascript
document.querySelector('#button')
```

работает только потому, что браузер предоставляет DOM.

На сервере DOM нет.

Node.js позволяет выполнять JavaScript вне браузера:

```text
JavaScript
   ↓
Node.js
   ↓
операционная система / сеть / файлы
```

Серверное приложение постоянно работает и ждёт входящие HTTP-запросы.

---

# 2. Что такое Express

На чистом Node.js HTTP-сервер можно написать самостоятельно, но тогда придётся вручную разбирать:

- URL;
- методы;
- заголовки;
- тело запроса;
- маршрутизацию.

Express упрощает эту работу.

Установка:

```bash
npm init -y
npm install express
```

Минимальный сервер:

```javascript
const express = require('express');

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send('Сервер работает');
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
```

Запуск:

```bash
node server.js
```

После этого можно открыть:

```text
http://localhost:3000
```

---

# 3. Что происходит при запуске сервера

Строка:

```javascript
app.listen(PORT)
```

означает, что программа начинает слушать сетевой порт.

Условно:

```text
localhost:3000
      ↓
Express
      ↓
ищет подходящий маршрут
      ↓
вызывает обработчик
      ↓
формирует HTTP-ответ
```

Сервер после одного запроса не завершается.

Он продолжает ждать следующие запросы.

---

# 4. Маршрут

Пример:

```javascript
app.get('/hello', (req, res) => {
  res.send('Hello');
});
```

Здесь задаются:

```text
HTTP-метод: GET
URL: /hello
```

То есть обработчик сработает для:

```text
GET http://localhost:3000/hello
```

Но не обязан сработать для:

```text
POST /hello
GET /users
```

Маршрут — это сочетание метода и пути.

---

# 5. req и res

У обработчика:

```javascript
(req, res) => {}
```

есть два основных объекта.

## req

`req` содержит информацию о запросе:

- URL;
- параметры;
- query;
- заголовки;
- тело запроса;
- HTTP-метод.

## res

`res` используется для формирования ответа.

Например:

```javascript
res.send('Готово');
```

или:

```javascript
res.json({
  message: 'Готово'
});
```

---

# 6. JSON-ответ

API обычно возвращает не HTML, а данные.

Например:

```javascript
app.get('/api/info', (req, res) => {
  res.json({
    course: 'Internet Technologies',
    lesson: 5,
    server: 'Express'
  });
});
```

Клиент получит JSON:

```json
{
  "course": "Internet Technologies",
  "lesson": 5,
  "server": "Express"
}
```

После этого браузер может получить его через `fetch()`.

---

# 7. Массив данных на сервере

Пока базы данных нет, данные можно временно хранить в массиве:

```javascript
const tasks = [
  { id: 1, title: 'Разобрать Express', done: true },
  { id: 2, title: 'Сделать маршрут', done: false },
  { id: 3, title: 'Проверить API', done: false }
];
```

Маршрут:

```javascript
app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});
```

Теперь:

```text
GET /api/tasks
```

возвращает массив.

Важно: сейчас эти данные живут только в памяти процесса Node.js.

После перезапуска сервера все изменения такого массива будут потеряны.

---

# 8. Path parameters

Иногда часть URL является параметром.

Например:

```text
/api/tasks/2
```

означает: получить задачу с ID = 2.

Маршрут:

```javascript
app.get('/api/tasks/:id', (req, res) => {
  console.log(req.params.id);
});
```

Для запроса:

```text
GET /api/tasks/2
```

получим:

```javascript
req.params.id === '2'
```

Обратите внимание: значение приходит строкой.

Поэтому часто нужно:

```javascript
const id = Number(req.params.id);
```

---

# 9. Поиск одного объекта

Пример:

```javascript
app.get('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);

  const task = tasks.find(item => item.id === id);

  if (!task) {
    return res.status(404).json({
      error: 'Task not found'
    });
  }

  res.json(task);
});
```

Здесь появляется важный принцип:

```text
объект найден
→ 200

объект не найден
→ 404
```

Сервер должен не просто возвращать текст ошибки, но и правильный HTTP-код.

---

# 10. Query parameters

URL:

```text
/api/tasks?done=true
```

содержит query parameter.

Express предоставляет его через:

```javascript
req.query.done
```

Можно выполнить фильтрацию:

```javascript
app.get('/api/tasks', (req, res) => {
  const done = req.query.done;

  if (done === undefined) {
    return res.json(tasks);
  }

  const expected = done === 'true';

  const filtered = tasks.filter(task => {
    return task.done === expected;
  });

  res.json(filtered);
});
```

Получаем:

```text
GET /api/tasks
→ все задачи

GET /api/tasks?done=true
→ только выполненные

GET /api/tasks?done=false
→ только невыполненные
```

---

# 11. Path и query — в чём разница

Пример path parameter:

```text
/api/tasks/5
```

Здесь `5` указывает на конкретный ресурс.

Пример query:

```text
/api/tasks?done=true
```

Здесь `done=true` изменяет способ получения коллекции.

Упрощённо:

```text
/tasks/5
→ какой объект?

/tasks?done=true
→ какие объекты из коллекции?
```

---

# 12. HTTP-коды

Минимальный набор для этой работы:

| Код | Значение |
|---|---|
| 200 | запрос успешно выполнен |
| 201 | ресурс создан |
| 400 | некорректный запрос |
| 404 | ресурс не найден |
| 500 | ошибка сервера |

Пример:

```javascript
res.status(404).json({
  error: 'Not found'
});
```

---

# 13. Middleware express.json()

Чтобы Express мог читать JSON из тела входящего запроса:

```javascript
app.use(express.json());
```

После этого в POST/PATCH можно обращаться к:

```javascript
req.body
```

Например клиент отправляет:

```json
{
  "title": "Новая задача"
}
```

Сервер получает:

```javascript
req.body.title
```

---

# 14. POST на своём сервере

Пример:

```javascript
app.post('/api/tasks', (req, res) => {
  const title = String(req.body.title ?? '').trim();

  if (!title) {
    return res.status(400).json({
      error: 'title is required'
    });
  }

  const task = {
    id: Date.now(),
    title,
    done: false
  };

  tasks.push(task);

  res.status(201).json(task);
});
```

Теперь сервер уже не только читает данные, но и изменяет собственное состояние.

---

# 15. Серверная валидация

Даже если браузер проверяет форму, сервер всё равно обязан проверять входные данные.

Почему?

Потому что HTTP-запрос можно отправить:

- не через вашу форму;
- через DevTools;
- через другой клиент;
- через скрипт.

Клиентская проверка улучшает интерфейс.

Серверная проверка защищает данные приложения.

---

# 16. Проверка API

API можно проверять без готового фронтенда.

Для GET достаточно браузера:

```text
http://localhost:3000/api/tasks
```

Также можно использовать:

- DevTools;
- `curl`;
- Postman или аналогичный клиент.

Пример:

```bash
curl http://localhost:3000/api/tasks
```

POST:

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Новая задача"}'
```

---

# Практическая работа №5. Собственный REST API

Создайте:

```text
internet-technologies/05/
```

Минимальная структура:

```text
package.json
server.js
README.md
```

Можно разделить сервер на несколько файлов, если это делает код понятнее.

---

## Часть 1. Запуск сервера

Создайте Express-приложение.

Сервер должен запускаться командой:

```bash
npm start
```

Добавьте в `package.json`:

```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

Порт можно взять из переменной окружения:

```javascript
const PORT = process.env.PORT || 3000;
```

---

## Часть 2. Данные

Создайте на сервере массив минимум из 6 объектов.

Тема объектов может быть любой разумной:

- задачи;
- книги;
- фильмы;
- товары;
- заметки.

Каждый объект должен иметь минимум:

```text
id
name/title
ещё два осмысленных поля
```

Один из параметров должен подходить для фильтрации.

---

## Часть 3. Получение коллекции

Реализуйте:

```text
GET /api/items
```

Он должен возвращать весь массив.

Название `items` можно заменить на название своей сущности:

```text
/api/books
/api/tasks
/api/movies
```

---

## Часть 4. Получение одного объекта

Реализуйте:

```text
GET /api/items/:id
```

Если объект существует:

```text
200
```

Если нет:

```text
404
```

и JSON:

```json
{
  "error": "Not found"
}
```

---

## Часть 5. Query parameters

Добавьте минимум два query-параметра.

Например:

```text
GET /api/books?author=...
GET /api/books?available=true
```

или:

```text
GET /api/tasks?done=true
GET /api/tasks?q=express
```

Один запрос может использовать сразу несколько параметров.

Если query отсутствует, сервер должен вернуть обычную коллекцию.

---

## Часть 6. Создание

Реализуйте:

```text
POST /api/items
```

Сервер должен:

1. прочитать `req.body`;
2. проверить обязательные поля;
3. создать новый ID;
4. добавить объект в массив;
5. вернуть созданный объект;
6. установить статус `201`.

Некорректные данные:

```text
400 Bad Request
```

---

## Часть 7. Служебный маршрут

Добавьте:

```text
GET /api/info
```

Он должен возвращать, например:

```json
{
  "name": "My API",
  "version": 1,
  "items": 6
}
```

Количество должно вычисляться из массива.

---

## Часть 8. 404 для неизвестного маршрута

В конце добавьте обработку неизвестного API-маршрута:

```javascript
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found'
  });
});
```

Проверьте:

```text
GET /api/does-not-exist
```

---

## Часть 9. Проверка

Проверьте минимум:

1. коллекцию;
2. существующий ID;
3. несуществующий ID;
4. query-фильтр №1;
5. query-фильтр №2;
6. корректный POST;
7. POST без обязательного поля;
8. неизвестный маршрут.

Для каждого случая посмотрите HTTP-код.

---

## Что сдавать

В репозитории:

```text
internet-technologies/
└── 05/
    ├── package.json
    ├── server.js
    └── README.md
```

`node_modules/` в GitHub не добавлять.

Добавьте:

```text
node_modules/
```

в `.gitignore`.

В `README.md` укажите:

- установку зависимостей;
- запуск;
- выбранную сущность;
- список маршрутов;
- примеры query;
- примеры корректного и ошибочного запроса;
- таблицу вида:

| Метод | URL | Описание | Возможные статусы |
|---|---|---|---|
| GET | /api/items | список | 200 |
| GET | /api/items/:id | один объект | 200, 404 |
| POST | /api/items | создание | 201, 400 |

---
