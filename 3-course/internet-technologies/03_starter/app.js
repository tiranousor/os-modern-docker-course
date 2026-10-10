const API_URL = 'https://jsonplaceholder.typicode.com/users';

const state = {
  users: [],
  isLoading: false,
  error: null,
  filter: ''
};

const loadButton = document.querySelector('#loadButton');
const reloadButton = document.querySelector('#reloadButton');
const filterInput = document.querySelector('#filterInput');

const statusElement = document.querySelector('#status');
const statisticsElement = document.querySelector('#statistics');
const usersElement = document.querySelector('#users');


// 1. Загрузка данных

async function loadUsers() {
  /*
  TODO 1.

  Перед запросом:
  - state.isLoading = true
  - state.error = null
  - render()

  Затем:
  - fetch(API_URL)
  - проверить response.ok
  - response.json()
  - сохранить массив в state.users

  Ошибку обработать через try/catch.

  В finally:
  - state.isLoading = false
  - render()
  */
}


// 2. Фильтрация

function getFilteredUsers(users, filter) {
  /*
  TODO 2.

  Если filter пустой — вернуть всех пользователей.

  Иначе фильтровать минимум по:
  - name
  - username
  - email

  Регистр не учитывать.

  Подсказки:
  .toLowerCase()
  .includes()
  .filter()
  */

  return users;
}


// 3. Карточка пользователя

function createUserCard(user) {
  /*
  TODO 3.

  Создайте <article> и выведите:
  - name
  - username
  - email
  - user.address.city
  - user.company.name

  Используйте document.createElement(),
  textContent и append().
  */

  const article = document.createElement('article');
  article.className = 'user-card';

  article.textContent = user.name; // временный вариант

  return article;
}


// 4. Статистика

function getStatistics(users, filteredUsers) {
  /*
  TODO 4.

  Верните:
  {
    total: ...,
    visible: ...,
    uniqueCities: ...
  }

  uniqueCities — число уникальных городов.
  Подсказка: Set.
  */

  return {
    total: 0,
    visible: 0,
    uniqueCities: 0
  };
}


// 5. Отображение

function render() {
  usersElement.innerHTML = '';
  statisticsElement.textContent = '';

  /*
  TODO 5.

  По порядку обработайте:

  1. state.isLoading
     -> "Загрузка..."

  2. state.error
     -> вывести ошибку

  3. пустой state.users
     -> "Данные ещё не загружены."

  4. получить filteredUsers

  5. вывести карточки

  6. получить статистику и вывести её
  */
}


// 6. События

loadButton.addEventListener('click', () => {
  loadUsers();
});

reloadButton.addEventListener('click', () => {
  /*
  TODO 6.
  Повторно загрузить данные.
  */
});

filterInput.addEventListener('input', event => {
  /*
  TODO 7.
  state.filter = ...
  render();
  */
});

render();
