# Занятие 6. SQLite и хранение данных на сервере

## О занятии

В предыдущей работе Express-сервер хранил данные в обычном JavaScript-массиве. Это удобно для первого API, но после перезапуска Node.js все изменения исчезают.

В этой работе данные переносятся в SQLite. Express по-прежнему принимает HTTP-запросы, но операции чтения, создания, изменения и удаления теперь выполняются через SQL.

Схема работы:

~~~text
HTTP-запрос
    ↓
Express-маршрут
    ↓
SQL-запрос
    ↓
SQLite
    ↓
результат
    ↓
JSON-ответ
~~~

Используем SQLite, команды SELECT, INSERT, UPDATE и DELETE, первичный ключ, параметризованные запросы и полный CRUD.

---

# 1. Зачем нужна база данных

Массив JavaScript существует только в памяти процесса.

~~~text
сервер остановился
      ↓
память процесса очищена
      ↓
изменения потеряны
~~~

SQLite хранит данные в файле, например data.db, и не требует отдельного сервера базы данных. Для учебного проекта этого достаточно.

---

# 2. Подключение SQLite

В проекте:

~~~bash
npm install express better-sqlite3
~~~

Подключение:

~~~javascript
const Database = require('better-sqlite3');

const db = new Database('data.db');
~~~

Если файла базы ещё нет, он будет создан.

---

# 3. Создание таблицы

Для примера используем задачи:

~~~sql
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  done INTEGER NOT NULL DEFAULT 0
);
~~~

Таблицу можно создавать при запуске приложения:

~~~javascript
db.prepare(
  'CREATE TABLE IF NOT EXISTS tasks (' +
  'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
  'title TEXT NOT NULL, ' +
  'description TEXT NOT NULL DEFAULT "", ' +
  'done INTEGER NOT NULL DEFAULT 0' +
  ')'
).run();
~~~

Поле id является первичным ключом. AUTOINCREMENT позволяет базе самостоятельно выдавать новые идентификаторы.

---

# 4. SELECT: чтение данных

Получить все записи:

~~~sql
SELECT id, title, description, done
FROM tasks
ORDER BY id;
~~~

В Node.js:

~~~javascript
const rows = db.prepare(
  'SELECT id, title, description, done FROM tasks ORDER BY id'
).all();
~~~

Метод all() возвращает массив строк.

Маршрут:

~~~javascript
app.get('/api/tasks', (req, res) => {
  const rows = db.prepare(
    'SELECT id, title, description, done FROM tasks ORDER BY id'
  ).all();

  const tasks = rows.map(row => ({
    ...row,
    done: Boolean(row.done)
  }));

  res.json(tasks);
});
~~~

---

# 5. Поиск одной записи

SQL:

~~~sql
SELECT id, title, description, done
FROM tasks
WHERE id = ?;
~~~

Знак вопроса — место для значения параметра.

~~~javascript
const task = db.prepare(
  'SELECT id, title, description, done FROM tasks WHERE id = ?'
).get(id);
~~~

Если запись не найдена, сервер должен вернуть 404.

~~~javascript
app.get('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);

  const task = db.prepare(
    'SELECT id, title, description, done FROM tasks WHERE id = ?'
  ).get(id);

  if (!task) {
    return res.status(404).json({
      error: 'Task not found'
    });
  }

  res.json({
    ...task,
    done: Boolean(task.done)
  });
});
~~~

---

# 6. Параметризованные запросы

Пользовательский ввод нельзя напрямую подставлять в SQL-строку.

Плохой вариант:

~~~javascript
const sql =
  "SELECT * FROM tasks WHERE title = '" +
  req.query.title +
  "'";
~~~

Правильный вариант:

~~~javascript
db.prepare(
  'SELECT * FROM tasks WHERE title = ?'
).all(req.query.title);
~~~

SQL-команда и значение передаются отдельно. В этой работе все значения, которые пришли от клиента, должны передаваться в SQL через параметры.

---

# 7. INSERT: создание записи

SQL:

~~~sql
INSERT INTO tasks (title, description, done)
VALUES (?, ?, ?);
~~~

Пример:

~~~javascript
app.post('/api/tasks', (req, res) => {
  const title = String(req.body.title ?? '').trim();
  const description =
    String(req.body.description ?? '').trim();

  if (!title) {
    return res.status(400).json({
      error: 'title is required'
    });
  }

  const result = db.prepare(
    'INSERT INTO tasks (title, description, done) VALUES (?, ?, ?)'
  ).run(title, description, 0);

  const task = db.prepare(
    'SELECT * FROM tasks WHERE id = ?'
  ).get(result.lastInsertRowid);

  res.status(201).json({
    ...task,
    done: Boolean(task.done)
  });
});
~~~

После INSERT база сама создаёт id. Созданную запись удобно сразу прочитать и вернуть клиенту.

---

# 8. UPDATE и PATCH

SQL для изменения записи:

~~~sql
UPDATE tasks
SET title = ?, description = ?, done = ?
WHERE id = ?;
~~~

PATCH означает, что клиент может изменить только часть полей.

Например:

~~~json
{
  "done": true
}
~~~

Сервер может сначала получить текущую запись, затем заменить только переданные поля.

~~~javascript
app.patch('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);

  const current = db.prepare(
    'SELECT * FROM tasks WHERE id = ?'
  ).get(id);

  if (!current) {
    return res.status(404).json({
      error: 'Task not found'
    });
  }

  const title =
    req.body.title === undefined
      ? current.title
      : String(req.body.title).trim();

  const description =
    req.body.description === undefined
      ? current.description
      : String(req.body.description).trim();

  const done =
    req.body.done === undefined
      ? Boolean(current.done)
      : Boolean(req.body.done);

  if (!title) {
    return res.status(400).json({
      error: 'title cannot be empty'
    });
  }

  db.prepare(
    'UPDATE tasks SET title = ?, description = ?, done = ? WHERE id = ?'
  ).run(title, description, done ? 1 : 0, id);

  const updated = db.prepare(
    'SELECT * FROM tasks WHERE id = ?'
  ).get(id);

  res.json({
    ...updated,
    done: Boolean(updated.done)
  });
});
~~~

---

# 9. DELETE

SQL:

~~~sql
DELETE FROM tasks
WHERE id = ?;
~~~

Маршрут:

~~~javascript
app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);

  const result = db.prepare(
    'DELETE FROM tasks WHERE id = ?'
  ).run(id);

  if (result.changes === 0) {
    return res.status(404).json({
      error: 'Task not found'
    });
  }

  res.status(204).end();
});
~~~

204 означает, что операция выполнена успешно, но тело ответа не требуется.

---

# 10. Фильтрация через SQL

Query-параметры можно использовать для фильтрации в самой базе.

Например:

~~~text
GET /api/tasks?done=true
~~~

Запрос:

~~~sql
SELECT *
FROM tasks
WHERE done = ?;
~~~

Для поиска по тексту можно использовать LIKE:

~~~sql
SELECT *
FROM tasks
WHERE title LIKE ?;
~~~

И передать значение:

~~~javascript
'%' + q + '%'
~~~

Не собирайте SQL через конкатенацию пользовательского ввода.

---

# 11. HTTP-коды и результат операции

В этой работе придерживайтесь следующих правил:

| Ситуация | Код |
|---|---:|
| список или объект получен | 200 |
| запись создана | 201 |
| удаление успешно | 204 |
| некорректные входные данные | 400 |
| запись не найдена | 404 |
| внутренняя ошибка сервера или БД | 500 |

Ошибка пользователя и ошибка сервера — разные ситуации.

---

# 12. Обработка серверной ошибки

Пример общего обработчика:

~~~javascript
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: 'Internal server error'
  });
});
~~~

Клиенту не нужно отправлять stack trace и внутренние детали базы.

---

# Практическая работа №6. REST API с SQLite

Создайте папку:

~~~text
internet-technologies/06/
~~~

Можно продолжить сущность из ЛР5: задачи, книги, фильмы, товары и т.п.

## Часть 1. Таблица

Создайте таблицу минимум с четырьмя полями:

- id;
- основное текстовое поле;
- ещё одно содержательное поле;
- поле, подходящее для фильтрации.

Таблица должна создаваться автоматически при первом запуске.

## Часть 2. Полный CRUD

Реализуйте:

~~~text
GET    /api/items
GET    /api/items/:id
POST   /api/items
PATCH  /api/items/:id
DELETE /api/items/:id
~~~

Название items замените на свою сущность.

После перезапуска сервера данные должны сохраняться.

## Часть 3. Валидация

Проверяйте входные данные для POST и PATCH. Пустое обязательное поле или некорректное значение должны приводить к ответу 400.

## Часть 4. Фильтрация

Добавьте минимум два query-параметра. Хотя бы один фильтр должен выполняться через WHERE в SQL.

Примеры:

~~~text
GET /api/books?available=true
GET /api/books?author=King

GET /api/tasks?done=false
GET /api/tasks?q=server
~~~

## Часть 5. Безопасное выполнение SQL

Все значения клиента передавайте параметрами. Конкатенация пользовательского ввода в SQL не допускается.

## Часть 6. Проверка сохранения

Обязательно:

1. запустить сервер;
2. создать запись через POST;
3. получить её через GET;
4. остановить сервер;
5. запустить снова;
6. повторить GET.

Запись должна сохраниться.

## Часть 7. Ошибочные случаи

Проверьте:

~~~text
GET несуществующего ID      → 404
POST без обязательного поля → 400
PATCH несуществующего ID    → 404
DELETE несуществующего ID   → 404
неизвестный маршрут         → 404
~~~

## Что сдавать

В README.md укажите:

- команды установки и запуска;
- схему таблицы;
- список маршрутов;
- примеры POST и PATCH;
- query-параметры;
- правила валидации;
- результат проверки после перезапуска.

Добавьте таблицу:

| Метод | URL | SQL | Успешный код | Ошибки |
|---|---|---|---:|---|
| GET | /api/items | SELECT | 200 | — |
| GET | /api/items/:id | SELECT | 200 | 404 |
| POST | /api/items | INSERT | 201 | 400 |
| PATCH | /api/items/:id | UPDATE | 200 | 400, 404 |
| DELETE | /api/items/:id | DELETE | 204 | 404 |
