# Занятие 8. Поиск, фильтрация, сортировка и пагинация: запросы к API и SQLite

## О занятии

В ЛР6 мы создали API с постоянным хранением в SQLite, а в ЛР7 подключили к нему браузерный интерфейс. Пока приложение обычно получает **все** записи и рисует полный список.

Что произойдёт, если записей не 10, а 10 000? Передавать и отображать весь список после каждого изменения неэффективно. Сегодня научимся запрашивать только нужные данные: искать, фильтровать, сортировать и получать их постранично.

Продолжаем **тот же Express + SQLite + HTML/JS проект**. Новых библиотек для интерфейса не нужно.

---

# 1. Клиентская и серверная обработка

Два подхода:

~~~text
Клиентский:  GET все записи → filter/sort/slice в браузере
Серверный:  GET с параметрами → SQL WHERE/ORDER BY/LIMIT → только результат
~~~

Клиентский подход годится для небольших массивов. Но при большом количестве записей фильтровать только уже загруженную страницу нельзя: часть подходящих записей останется в базе.

В этой работе фильтрация, сортировка и пагинация должны выполняться **на сервере**, а браузер только формирует параметры запроса и отображает ответ.

---

# 2. Параметры URL: query string

Например:

~~~http
GET /api/tasks?search=отчёт&done=false&sort=title&order=asc&page=2&limit=5
~~~

Здесь путь — `/api/tasks`, а всё после `?` — параметры запроса:

- `search` — подстрока в названии;
- `done` — фильтр по признаку выполнения;
- `sort` — поле сортировки;
- `order` — направление;
- `page` — номер страницы, начиная с 1;
- `limit` — сколько записей показывать.

В Express параметры доступны через `req.query`.

Не путайте `req.params.id` (часть пути `/api/tasks/5`) и `req.query.page` (часть строки запроса `?page=2`).

---

# 3. Проверка и нормализация параметров

Данные из URL — внешние данные. Не доверяйте им.

~~~javascript
function parsePositiveInt(raw, defaultValue, maxValue) {
  if (raw === undefined) return defaultValue;
  if (typeof raw !== 'string' || !/^[1-9]\\d*$/.test(raw)) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maxValue) {
    return null;
  }

  return value;
}

function parseDone(raw) {
  if (raw === undefined || raw === '') return undefined;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}
~~~

Проверки:

~~~text
?page=1&limit=10    → корректно
?page=0             → 400
?page=abc           → 400
?limit=1000000      → 400
?done=false         → false, не Boolean("false")
?done=abc           → 400
~~~

Не используйте `Boolean(req.query.done)`: непустая строка `"false"` тоже станет `true`.

---

# 4. SQL WHERE: фильтрация

Пусть у нас таблица `tasks(id, title, description, done)`.

Поиск по части заголовка:

~~~sql
SELECT id, title, description, done
FROM tasks
WHERE title LIKE ?
~~~

Значение параметра передаётся отдельно:

~~~javascript
const term = '%отчёт%';

const rows = db.prepare(
  'SELECT id, title, description, done FROM tasks WHERE title LIKE ?'
).all(term);
~~~

Не составляйте SQL через конкатенацию пользовательского текста:

~~~javascript
// НЕЛЬЗЯ:
const sql = "SELECT * FROM tasks WHERE title LIKE '%" + search + "%'";
~~~

Параметризованный запрос отделяет SQL-код от значений и защищает от SQL-инъекции в этом месте.

Примечание: символы `%` и `_` имеют специальный смысл в LIKE. Для буквального поиска этих символов понадобится экранирование; в этой работе достаточно явно описать поведение поиска в README.

---

# 5. ORDER BY: безопасная сортировка

В SQLite нельзя передать имя столбца через обычный `?`. Поэтому имя поля нужно выбирать из заранее известного списка.

~~~javascript
const sortColumns = {
  id: 'id',
  title: 'title',
  done: 'done'
};

const sort = req.query.sort ?? 'id';
const order = req.query.order ?? 'asc';

if (!Object.hasOwn(sortColumns, sort) ||
    !['asc', 'desc'].includes(order)) {
  return res.status(400).json({ error: 'Некорректная сортировка' });
}

const orderSql = order.toUpperCase();
const sortSql = sortColumns[sort];
~~~

Теперь `sortSql` и `orderSql` берутся только из белого списка, а не из произвольного ввода.

Для устойчивого порядка добавляйте `id` вторым ключом, если сортируете по неуникальному полю.

---

# 6. LIMIT и OFFSET: страницы

Для `page = 3` и `limit = 5`:

~~~text
offset = (3 - 1) * 5 = 10
~~~

SQL:

~~~sql
SELECT id, title, description, done
FROM tasks
ORDER BY id ASC
LIMIT ? OFFSET ?
~~~

Пример вызова:

~~~javascript
const rows = db.prepare(sql).all(5, 10);
~~~

Он вернёт не более пяти записей, пропустив первые десять в выбранном порядке.

Для больших таблиц у OFFSET есть ограничения по производительности. Сейчас наша цель — понять базовую пагинацию.

---

# 7. Сколько всего записей: COUNT(*)

Клиенту недостаточно получить пять записей. Ему нужно знать, сколько всего **подходящих фильтру** записей находится в базе.

Для этого выполняем отдельный запрос с тем же условием `WHERE`:

~~~sql
SELECT COUNT(*) AS total
FROM tasks
WHERE done = ?
~~~

Например, если найдено 23 записи и размер страницы равен 5:

~~~text
pages = ceil(23 / 5) = 5
~~~

В ответе API удобно возвращать объект:

~~~json
{
  "items": [
    { "id": 12, "title": "Отчёт", "done": false }
  ],
  "pagination": {
    "page": 2,
    "limit": 5,
    "total": 23,
    "pages": 5
  }
}
~~~

**Важное изменение контракта:** раньше GET мог возвращать массив `[...]`, теперь возвращает объект `{ items, pagination }`. Обновите клиент из ЛР7, иначе код `tasks = await request(...)` больше не будет работать как раньше.

Остальные CRUD-маршруты сохраняются.

---

# 8. Собираем серверный маршрут

Ниже — учебный пример для сущности `tasks`. Подстройте имена таблиц и полей под свою ЛР6.

~~~javascript
app.get('/api/tasks', (req, res) => {
  const page = parsePositiveInt(req.query.page, 1, 1000000);
  const limit = parsePositiveInt(req.query.limit, 10, 50);
  const done = parseDone(req.query.done);
  const search = req.query.search ?? '';
  const sort = req.query.sort ?? 'id';
  const order = req.query.order ?? 'asc';

  const sortColumns = { id: 'id', title: 'title', done: 'done' };

  if (page === null || limit === null || done === null ||
      typeof search !== 'string' || search.length > 100 ||
      !Object.hasOwn(sortColumns, sort) ||
      !['asc', 'desc'].includes(order)) {
    return res.status(400).json({ error: 'Некорректные параметры' });
  }

  const where = [];
  const params = [];

  if (search.trim()) {
    where.push('title LIKE ?');
    params.push('%' + search.trim() + '%');
  }

  if (done !== undefined) {
    where.push('done = ?');
    params.push(done ? 1 : 0);
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(
    'SELECT COUNT(*) AS total FROM tasks ' + whereSql
  ).get(...params).total;

  const offset = (page - 1) * limit;
  const sortSql = sortColumns[sort];
  const orderSql = order.toUpperCase();

  const rows = db.prepare(
    'SELECT id, title, description, done FROM tasks ' +
    whereSql + ' ORDER BY ' + sortSql + ' ' + orderSql +
    ', id ASC LIMIT ? OFFSET ?'
  ).all(...params, limit, offset);

  const items = rows.map(row => ({
    ...row,
    done: Boolean(row.done)
  }));

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});
~~~

Примечания:

1. Здесь используется пакет `better-sqlite3`, как в примерах ЛР6.
2. Проверка делается **до** формирования SQL.
3. В `WHERE` и `LIMIT/OFFSET` передаются параметры, а в `ORDER BY` — только проверенные имена.
4. При `total = 0` значение `pages` равно 0; клиент должен показать пустой список и не предлагать переходить на другую страницу.
5. Если запрошена страница за пределами существующих записей, `items` будет пустым. В этой лабораторной это допустимое поведение при корректном номере страницы.

---

# 9. Клиент: URLSearchParams

Не собирайте длинный URL из фрагментов вручную.

~~~javascript
let filters = {
  search: '',
  done: '',
  sort: 'id',
  order: 'asc',
  page: 1,
  limit: 5
};

function makeTasksUrl() {
  const params = new URLSearchParams({
    search: filters.search,
    sort: filters.sort,
    order: filters.order,
    page: String(filters.page),
    limit: String(filters.limit)
  });

  if (filters.done !== '') {
    params.set('done', filters.done);
  }

  return '/api/tasks?' + params.toString();
}

async function refreshTasks() {
  const result = await request(makeTasksUrl());
  tasks = result.items;
  pagination = result.pagination;
  render();
}
~~~

`URLSearchParams` корректно кодирует пробелы, кириллицу и другие специальные символы.

При изменении поиска, фильтра или сортировки сбрасывайте `page` в 1: старая страница может уже не существовать для новых условий.

---

# 10. Поиск, кнопки страниц и состояние интерфейса

Добавьте элементы:

~~~html
<input id="search" placeholder="Поиск по названию">
<select id="done-filter">
  <option value="">Все</option>
  <option value="true">Выполненные</option>
  <option value="false">Невыполненные</option>
</select>
<select id="sort">
  <option value="id">По ID</option>
  <option value="title">По названию</option>
</select>
<button id="prev" type="button">Назад</button>
<span id="page-info"></span>
<button id="next" type="button">Вперёд</button>
~~~

Пример перехода вперёд:

~~~javascript
document.querySelector('#next').addEventListener('click', async () => {
  if (filters.page >= pagination.pages) return;
  filters.page += 1;
  await refreshTasks();
});
~~~

Обработайте также переход назад, фильтр, сортировку и выбор количества записей.

Чтобы не отправлять запрос на каждый символ при быстром вводе, можно использовать небольшую задержку (debounce). Это дополнительная часть, не подмена серверной фильтрации.

После POST/PATCH/DELETE повторно загрузите текущую страницу. Если после удаления последней записи на странице текущий номер оказался за пределами `pages`, перейдите на последнюю существующую страницу (или на 1 при пустой таблице).

---

# 11. Что проверять в DevTools

Откройте Network → Fetch/XHR:

- меняется ли URL при поиске и переключении страниц;
- передаются ли правильные значения `page`, `limit`, `done`;
- возвращает ли сервер именно `items` и `pagination`;
- появляется ли 400 на некорректном параметре;
- не загружается ли весь список вместо выбранной страницы.

Проверьте вручную запросы:

~~~text
/api/tasks?page=1&limit=3
/api/tasks?page=2&limit=3
/api/tasks?done=false
/api/tasks?search=отчёт&sort=title&order=desc
/api/tasks?page=0
/api/tasks?sort=unknown
/api/tasks?done=maybe
~~~

---

# Практическая работа №8. Каталог с серверным поиском и пагинацией

Создайте папку:

~~~text
internet-technologies/08/
~~~

**Продолжите проект ЛР7**. Существующие операции GET одной записи, POST, PATCH и DELETE должны остаться рабочими.

## Часть 1. Серверная фильтрация

Для коллекционного GET-маршрута реализуйте:

- поиск по текстовому полю;
- фильтр по одному логическому или категориальному полю;
- совместную работу двух условий.

Если у вас книги или товары, выбирайте подходящие поля своей сущности. Объясните выбор в README.

## Часть 2. Сортировка

Реализуйте сортировку минимум по двум полям с направлениями `asc` и `desc`.

Имена столбцов и направление выбирайте по белому списку. Не вставляйте пользовательский ввод напрямую в SQL.

## Часть 3. Пагинация

Поддержите `page` и `limit`, используйте SQL `LIMIT/OFFSET`.

Ответ должен содержать `items` и метаданные `page`, `limit`, `total`, `pages`.

Для демонстрации создайте не менее 20 записей (можно отдельным seed-скриптом; не надо вручную вводить их перед каждой защитой).

## Часть 4. Интерфейс

Добавьте поиск, фильтр, сортировку, размер страницы и кнопки «Назад/Вперёд». Все операции должны работать без полной перезагрузки.

При изменении условий поиска и фильтрации номер страницы сбрасывается. После удаления записи интерфейс остаётся в согласованном состоянии.

## Часть 5. Валидация и ошибки

Сервер возвращает 400 на:

- нулевую/отрицательную/нечисловую страницу;
- неправильный `limit` или превышение ограничения;
- неизвестное поле сортировки;
- неправильное направление;
- некорректное значение логического фильтра.

На странице отображаются ошибка, загрузка и пустой результат.

## Часть 6. Проверки

Продемонстрируйте:

1. разные записи на первой и второй страницах;
2. равенство `total` числу подходящих фильтру записей, а не размеру страницы;
3. совместный поиск + фильтр;
4. сортировку по двум разным полям;
5. пустой результат;
6. ответ 400 на `?sort=nonexistent`;
7. корректный результат после удаления записи с последней страницы;
8. данные сохраняются после перезапуска Node.js.

## Что сдавать

~~~text
internet-technologies/
  08/
    server.js
    package.json
    package-lock.json
    .gitignore
    public/
      index.html
      style.css
      app.js
    README.md
~~~

При желании добавьте `seed.js`, который создаёт демонстрационные записи, не дублируя их при повторном запуске.

В README.md укажите:

- запуск и структуру проекта;
- таблицу параметров API и допустимых значений;
- пример JSON-ответа с пагинацией;
- SQL-примеры `WHERE`, `ORDER BY`, `LIMIT/OFFSET`;
- объяснение, как защищены имена полей сортировки от SQL-инъекции;
- снимки интерфейса и как минимум трёх запросов в Network;
- результаты проверок, включая ошибку 400;
- чем серверная фильтрация отличается от `array.filter()` в браузере.

**Недостаточно** загрузить все записи одним GET и использовать `filter()`, `sort()`, `slice()` только в браузере. Это не соответствует цели работы.
