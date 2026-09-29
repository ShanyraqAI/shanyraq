import type {
  ConnectionStatus,
  ChannelCode,
  ReservationStatus,
  RoomStatus,
  SyncStatus,
} from "@/lib/constants";

/**
 * Единый словарь интерфейса. Русский — язык по умолчанию.
 * Позже рядом можно добавить en.ts / kk.ts и выбрать каталог по локали.
 */
export const t = {
  brand: "Shanyraq AI",
  tagline: "Платформа управления отелем",

  nav: {
    overview: "Обзор",
    calendar: "Календарь",
    reservations: "Бронирования",
    rooms: "Номера",
    guests: "Гости",
    rates: "Тарифы",
    channels: "Каналы",
    reports: "Отчёты",
    exports: "Экспорт",
    settings: "Настройки",
  },

  sidebar: {
    manage: "Управление",
    property: "Отель",
    help: "Помощь",
    role: "Управляющий отелем",
  },

  a11y: {
    openNav: "Открыть навигацию",
    navigation: "Навигация",
  },

  auth: {
    loginTitle: "Вход в Shanyraq AI",
    loginSubtitle: "Управляйте отелем и каналами продаж в одном окне",
    registerTitle: "Создать аккаунт",
    registerSubtitle: "Начните управлять своим отелем за пару минут",
    emailTab: "Email",
    phoneTab: "Телефон",
    fullName: "Имя и фамилия",
    firstName: "Имя",
    lastName: "Фамилия",
    fullNamePlaceholder: "Введите имя и фамилию",
    email: "Email",
    emailPlaceholder: "you@hotel.kz",
    phone: "Телефон",
    phonePlaceholder: "+7 701 123 45 67",
    password: "Пароль",
    passwordHint: "Минимум 8 символов",
    signIn: "Войти",
    signUp: "Зарегистрироваться",
    signingIn: "Входим…",
    creating: "Создаём аккаунт…",
    or: "или",
    continueWithGoogle: "Продолжить с Google",
    noAccount: "Нет аккаунта?",
    haveAccount: "Уже есть аккаунт?",
    toRegister: "Регистрация",
    toLogin: "Войти",
    demoHintLabel: "Демо-доступ:",
    errors: {
      invalidCredentials: "Неверный логин или пароль",
      emailTaken: "Этот email уже зарегистрирован",
      phoneTaken: "Этот телефон уже зарегистрирован",
      googleFailed: "Не удалось войти через Google. Попробуйте ещё раз.",
      googleNotConfigured:
        "Вход через Google пока не настроен — добавьте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET в .env",
    },
  },

  account: {
    title: "Аккаунт",
    description: "Как вас видят в Shanyraq — имя и фото профиля.",
    fullName: "Имя и фамилия",
    firstName: "Имя",
    lastName: "Фамилия",
    email: "Email",
    phone: "Телефон",
    notSet: "не указан",
    avatarUrl: "Ссылка на фото (URL)",
    avatarHint: "Необязательно — прямая ссылка на изображение.",
    save: "Сохранить профиль",
    saved: "Профиль сохранён",
    signOut: "Выйти",
  },

  common: {
    save: "Сохранить",
    cancel: "Отмена",
    edit: "Изменить",
    close: "Закрыть",
    search: "Поиск",
    reset: "Сбросить",
    viewDetails: "Подробнее",
    manage: "Управление",
    connect: "Подключить",
    disconnect: "Отключить",
    tryAgain: "Повторить",
    today: "Сегодня",
    back: "Назад",
    next: "Вперёд",
    loading: "Загрузка…",
    notFound: "Не найдено",
  },

  statuses: {
    reservation: {
      PENDING: "Ожидает подтверждения",
      CONFIRMED: "Подтверждено",
      CHECKED_IN: "Заселён",
      CHECKED_OUT: "Выселен",
      CANCELLED: "Отменено",
      NO_SHOW: "Не заехал",
    } as Record<ReservationStatus, string>,
    room: {
      AVAILABLE: "Свободен",
      OCCUPIED: "Занят",
      CLEANING: "Уборка",
      MAINTENANCE: "На обслуживании",
      OUT_OF_ORDER: "Вне сервиса",
    } as Record<RoomStatus, string>,
    connection: {
      CONNECTED: "Подключён",
      DISCONNECTED: "Не подключён",
      ERROR: "Ошибка",
    } as Record<ConnectionStatus, string>,
    sync: {
      QUEUED: "В очереди",
      RUNNING: "Выполняется",
      SUCCESS: "Успешно",
      PARTIAL: "Частично",
      FAILED: "Сбой",
    } as Record<SyncStatus, string>,
  },

  dashboard: {
    goodMorning: "Доброе утро",
    goodAfternoon: "Добрый день",
    goodEvening: "Добрый вечер",
    kpi: {
      occupancy: "Загрузка",
      occupancySub: (occupied: number, total: number) =>
        `${occupied} из ${total} номеров сегодня`,
      reservations: "Бронирования",
      reservationsSub: "активных бронирований",
      arrivalsToday: "Заезды сегодня",
      arrivalsSub: (checkedIn: number) => `${checkedIn} уже заселились`,
      departuresToday: "Выезды сегодня",
      departuresSub: (checkedOut: number) => `${checkedOut} уже выселились`,
      revenueMtd: "Выручка (с начала месяца)",
      revenueSub: "выручка за текущий месяц",
      availableRooms: "Свободные номера",
      availableRoomsSub: (guests: number) =>
        `на сегодня · ${pluralize(guests, "гость", "гостя", "гостей")} проживают`,
    },
    arrivalsSection: "Заезды сегодня",
    departuresSection: "Выезды сегодня",
    noArrivals: "На сегодня заездов нет",
    noDepartures: "На сегодня выездов нет",
    recentReservations: "Последние бронирования",
    recentSubtitle: "Свежие брони со всех каналов — нажмите на строку, чтобы увидеть детали.",
    table: {
      guest: "Гость",
      room: "Номер",
      nights: "Ночей",
      channel: "Канал",
      status: "Статус",
      dates: "Даты",
      amount: "Сумма",
      reservation: "Бронь",
      id: "ID",
      name: "Имя",
      email: "Email",
      phone: "Телефон",
    },
  },

  filters: {
    allTypes: "Все типы",
    allChannels: "Все каналы",
    allStatuses: "Все статусы",
    roomType: "Тип номера",
    channel: "Канал",
    status: "Статус",
    noMatch: "По выбранным фильтрам ничего не найдено.",
  },

  calendar: {
    title: "Календарь",
    description: (rooms: number) =>
      `Перетаскивайте брони прямо на таймлайне · ${rooms} ${pluralize(rooms, "номер", "номера", "номеров")} · недельный вид — основной режим работы`,
    day: "День",
    week: "Неделя",
    month: "Месяц",
    newReservation: "Бронирование",
    roomsCount: (n: number) => pluralize(n, "номер", "номера", "номеров"),
    noRoomsTitle: "Номера не настроены",
    noRoomsDescription:
      "Добавьте номера в разделе «Номера», чтобы планировать загрузку в календаре.",
    goToRooms: "Перейти к номерам",
    pendingSuffix: "· ожидает",
    tip: "Подсказка: нажмите на бронь для деталей · кликните пустую ячейку, чтобы создать бронирование · перетащите бронь, чтобы переместить её.",
    movedToast: "Бронирование перенесено",
    loadingBoard: "Загрузка календаря…",
    newReservationCell: (roomNumber: string, iso: string) =>
      `Новое бронирование в номере ${roomNumber} на ${iso}`,
  },

  onboarding: {
    step1Title: "Добро пожаловать в Shanyraq",
    step1Desc: "Заполните базовую информацию об отеле",
    step2Title: "Расскажите об объекте",
    step2Desc: "Выберите тип вашего объекта",
    step3Title: "Добавьте номера",
    step3Desc: "Создайте типы номеров и укажите их количество",
    hotelName: "Название отеля",
    hotelNamePlaceholder: "Например, Отель «Звезда»",
    city: "Город",
    cityPlaceholder: "Астана",
    country: "Страна",
    countryPlaceholder: "Выберите страну",
    language: "Язык",
    currency: "Валюта",
    timezone: "Часовой пояс",
    propertyType: "Тип объекта",
    roomTypes: "Типы номеров",
    roomName: "Название типа",
    roomNamePlaceholder: "Например, Стандарт",
    roomCount: "Количество номеров",
    capacity: "Вместимость (гостей)",
    basePrice: "Базовая цена (за ночь)",
    addRoomType: "Добавить тип номера",
    complete: "Завершить онбординг",
    hotelNameRequired: "Введите название отеля",
    propertyTypeRequired: "Выберите тип объекта",
    roomTypesRequired: "Добавьте хотя бы один тип номера",
    minOneRoomType: "Должен быть хотя бы один тип номера",
    createFailed: "Не удалось завершить онбординг",
  },

  reservations: {
    title: "Бронирования",
    description: "Все брони из всех каналов продаж — в едином списке.",
    searchPlaceholder: "Поиск по гостю, номеру или ID…",
    newButton: "Новая бронь",
    statsCount: (n: number) => pluralize(n, "бронирование", "бронирования", "бронирований"),
    statsBooked: "забронировано",
    emptyTitle: "Пока нет бронирований",
    emptyDescription:
      "Создайте первую бронь вручную или подключите канал продаж, чтобы импортировать брони автоматически.",
    createButton: "Создать бронирование",
    quickActions: "Быстрые действия",
    checkIn: "Заселить",
    checkOut: "Выселить",
    confirm: "Подтвердить",
    form: {
      createTitle: "Создать бронирование",
      editTitle: "Изменение бронирования",
      createDescription:
        "Прямое бронирование номера. Доступность проверяется автоматически.",
      editDescription:
        "Обновите детали проживания. Стоимость пересчитается по актуальным тарифам.",
      guest: "Гость",
      selectGuest: "Выберите гостя",
      newGuestOption: "+ Новый гость…",
      fullNamePlaceholder: "ФИО",
      emailPlaceholder: "Email (необязательно)",
      room: "Номер",
      selectRoom: "Выберите номер",
      checkIn: "Заезд",
      checkOut: "Выезд",
      adults: "Взрослые",
      children: "Дети",
      source: "Источник",
      unchanged: "без изменений",
      ratePlan: "Тариф",
      selectRatePlan: "Выберите тариф",
      perNight: "/ночь",
      noPlansWarning: "Для этой категории номера не настроены тарифы.",
      notes: "Комментарий",
      notesPlaceholder: "Особые пожелания, время прибытия…",
      nightsSummary: (nights: number, planName: string) =>
        `${nights} ${pluralize(nights, "ночь", "ночи", "ночей")} × ${planName}`,
      saveChanges: "Сохранить изменения",
    },
    details: {
      title: "Бронирование",
      createdBy: (date: string) => `Создано ${date}`,
      importedFrom: (channel: string) => ` · источник: ${channel}`,
      noEmail: "email не указан",
      noPhone: "телефон не указан",
      guestsLabel: "Гости",
      guestsField: (adults: number, children: number) => {
        const a = pluralize(adults, "взрослый", "взрослых", "взрослых");
        const c = children
          ? `, ${children} ${pluralize(children, "ребёнок", "ребёнка", "детей")}`
          : "";
        return `${adults} ${a}${c}`;
      },
      total: "Итого",
      externalId: "Внешний ID",
      restore: "Восстановить",
      move: "Перенести",
      moveTooltip: "Изменить даты или номер",
      cancelConfirm: (guest: string) =>
        `Отменить бронирование гостя ${guest}? Номер снова станет доступен для продаж.`,
    },
    toasts: {
      created: "Бронирование создано",
      updated: "Бронирование обновлено",
      createFailed: "Не удалось создать бронирование",
      updateFailed: "Не удалось обновить бронирование",
      cancelled: "Бронирование отменено",
      statusChanged: (label: string) => `Статус изменён на «${label}»`,
      movedToRoom: (room: string) => `Бронь перенесена в номер ${room}`,
    },
    errors: {
      guestRequired: "Укажите гостя",
      roomNotFound: "Номер не найден",
      ratePlanNotFound: "Тариф не найден",
      reservationNotFound: "Бронирование не найдено",
      planMismatch: (type: string) => `Выбранный тариф не подходит для категории «${type}»`,
      noPlanForType: "Для этой категории номера не настроен тариф",
    },
  },

  validation: {
    dateFormat: "Дата должна быть в формате ГГГГ-ММ-ДД",
    invalidEmail: "Некорректный email",
    checkoutAfterCheckin: "Дата выезда должна быть позже даты заезда",
    selectGuestOrName: "Выберите гостя из списка или введите имя",
    propertyIdRequired: "Укажите ID объекта",
    usernameRequired: "Укажите имя пользователя",
    apiKeyTooShort: "API-ключ должен содержать минимум 4 символа",
    endDateAfterStart: "Конечная дата не может быть раньше начальной",
    nameRequired: "Укажите имя",
    invalidInput: "Некорректные данные",
  },

  rooms: {
    title: "Номера",
    description: "Управление номерами, категориями, ценами и статусами.",
    fullBadge: (percent: string) => `Загрузка ${percent}`,
    terms: { count: "Номеров", capacity: "Вместимость", from: "От" },
    availableForDate: (available: number, total: number, date: string) =>
      `${available} из ${total} свободны на ${date}`,
    allRooms: "Все номера",
    emptyGrid: "У вас пока нет номеров",
    floorLabel: (floor: number) => `Этаж ${floor}`,
    tonight: (guest: string) => `Сегодня: ${guest}`,
    changeStatusAria: (number: string) => `Изменить статус номера ${number}`,
    statusChanged: (room: string, label: string) => `Номер ${room} — ${label}`,
    errors: { roomNotFound: "Номер не найден" },
  },

  guests: {
    title: "Гости",
    description: "Карточки гостей с историей проживания по всем каналам продаж.",
    searchPlaceholder: "Поиск по имени, email или телефону…",
    emptyTitle: "Гостей пока нет",
    emptyDescription: "Гости появятся здесь автоматически после первого бронирования.",
    searchEmpty: "По вашему запросу ничего не найдено.",
    table: {
      name: "Имя",
      reservations: "Бронирований",
      lastStay: "Последний заезд",
      lastSource: "Последний канал",
    },
    profile: {
      subtitle: "Профиль гостя и история проживания · гость создан автоматически",
      country: "Страна",
      totalStays: "Всего проживаний",
      historyTitle: "История бронирований",
      historyEmpty: "Бронирований пока нет.",
      roomLabel: (room: string) => `Номер ${room}`,
      editButton: "Изменить гостя",
    },
    editForm: {
      title: "Изменение гостя",
      fullName: "ФИО",
      country: "Страна",
      notes: "Комментарий",
      saveGuest: "Сохранить гостя",
    },
    toasts: {
      updated: "Данные гостя сохранены",
      created: "Гость создан",
    },
    errors: { guestNotFound: "Гость не найден" },
  },

  rates: {
    title: "Тарифы",
    description: (days: number) =>
      `Цены на ${days} дней вперёд — внутренние цены, которые отправляются в каналы продаж.`,
    emptyTitle: "Тарифов пока нет",
    emptyDescription: "Создайте тарифы, чтобы задавать цены на категории номеров.",
    planColumn: "Тариф",
    meta: {
      breakfast: " · завтрак",
      nonRefundable: " · невозвратный",
      avail: (n: number) => ` · свободно ${n}`,
    },
    editPricesAria: (name: string) => `Изменить цены тарифа «${name}»`,
    bulkDialog: {
      title: "Обновление цен",
      description: (name: string) =>
        `${name} · новые цены станут внутренним источником данных и будут отправлены в подключённые каналы при следующей синхронизации.`,
      from: "С",
      to: "По",
      priceLabel: (money: string) => `Цена за ночь (${money})`,
      weekendsOnly: "Только выходные (пт и сб)",
      apply: "Применить",
    },
    toast: (days: number) => `Обновлено ${pluralize(days, "день", "дня", "дней")}`,
    errors: { ratePlanNotFound: "Тариф не найден" },
  },

  reports: {
    title: "Отчёты",
    description: "Первый взгляд на показатели — полная аналитика появится позже.",
    revenueByChannel: "Выручка по каналам",
    totalRevenueLabel: "Всего выручки:",
    noRevenue: "Выручки пока нет.",
    occupancyTrend: "Динамика загрузки",
    occupancyDescription: "Занятые ночи по всем номерам за последние 14 дней",
  },

  settings: {
    title: "Настройки отеля",
    description: "Профиль объекта используется в Shanyraq и передаётся в каналы продаж.",
    form: {
      hotelName: "Название отеля",
      address: "Адрес",
      city: "Город",
      country: "Страна",
      timezone: "Часовой пояс (работа отеля)",
      timezoneHint: "Даты заезда считаются по местному времени отеля — без сдвига UTC.",
      currency: "Основная валюта",
      save: "Сохранить настройки",
    },
    demo: {
      heading: "Демо-среда",
      intro:
        "Эта демо-версия работает на локальной базе с имитацией каналов продаж. Чтобы в любой момент восстановить исходные демо-данные, выполните:",
      outro:
        "Роли пользователей и совместный доступ нескольких сотрудников появятся на следующем этапе.",
    },
    toastSaved: "Настройки сохранены",
  },

  channelsPage: {
    title: "Каналы",
    description: "Подключайте каналы продаж и держите тарифы и доступность синхронизированными.",
    allChannels: "Все каналы",
    syncLogs: "Журнал синхронизаций",
    connectHint:
      "Подключите этот канал на странице «Каналы», чтобы включить синхронизацию.",
    summary: {
      status: "Статус",
      propertyId: "ID объекта",
      lastSync: "Последняя синхронизация",
      credentials: "Учётные данные",
      credentialsValue: "Хранятся на сервере · никогда не передаются в браузер",
    },
    notConnectedTitle: (channel: string) => `${channel} не подключён`,
    notConnectedDescription:
      "Сначала подключите канал — затем настройте сопоставление номеров и тарифов.",
    logs: {
      title: (channel: string) => `${channel} — история синхронизаций`,
      description:
        "Все запуски синхронизации: импортированные брони и отправленные цены и доступность.",
      emptyTitle: "Синхронизаций пока не было",
      emptyDescription:
        "Запустите синхронизацию на странице «Каналы» — результаты появятся здесь.",
      columns: {
        started: "Начало",
        finished: "Окончание",
        status: "Статус",
        reservations: "Брони",
        rates: "Тарифы",
        availability: "Доступность",
        details: "Детали",
      },
    },
    cards: {
      builtIn: "Встроенный",
      notConnected: "Не подключён",
      mapped: "Сопоставлено",
      mappedValue: (rooms: number, rates: number) =>
        `${rooms} ${pluralize(rooms, "номер", "номера", "номеров")} · ${rates} ${pluralize(rates, "тариф", "тарифа", "тарифов")}`,
      internalNote: "Брони, созданные в Shanyraq, относятся к этому каналу.",
      sync: "Синхронизировать",
      mapping: "Сопоставление",
      logs: "Журнал",
      empty: "Нет доступных каналов",
      syncFailedToast: (name: string) => `Не удалось синхронизировать ${name}`,
    },
    health: {
      title: "Статус каналов",
      subtitle: (connected: number, total: number) =>
        `${connected} из ${total} каналов подключено`,
      lastSync: "Последняя синхронизация:",
      error: "Ошибка",
      manage: "Управление",
    },
    dialog: {
      settingsTitle: (channel: string) => `${channel} — настройки`,
      connectTitle: (channel: string) => `Подключение ${channel}`,
      settingsDescription:
        "Управляйте подключением и сопоставлением номерного фонда Shanyraq с этим каналом.",
      connectDescription:
        "В демо-режиме используется имитация провайдера — реальные API-вызовы не выполняются.",
      propertyId: "ID объекта",
      propertyIdPlaceholder: "например, 100200330",
      username: "Имя пользователя",
      usernamePlaceholder: "логин личного кабинета канала",
      apiKey: "API-ключ / пароль",
      testConnection: "Проверить подключение",
      saveConnection: "Сохранить подключение",
      testOk: "Подключение установлено — ",
      testFailed: "Не удалось подключиться — ",
      summaryPropertyId: "ID объекта:",
      summaryUser: " · пользователь ",
      loadingInventory: "Загрузка каталога канала…",
      inventoryErrorFallback: "Не удалось загрузить каталог канала",
      disconnectConfirm: (name: string) =>
        `Отключить ${name}? Сопоставление номеров и тарифов будет удалено.`,
    },
    mapping: {
      roomMapping: "Сопоставление номеров",
      rateMapping: "Сопоставление тарифов",
      roomSubtitle: (channel: string, mapped: number, total: number) =>
        `Сопоставьте типы номеров Shanyraq с номерами канала ${channel} · ${mapped}/${total}`,
      rateSubtitle: (channel: string, mapped: number, total: number) =>
        `Сопоставьте тарифы Shanyraq с тарифами канала ${channel} · ${mapped}/${total}`,
      shanyraqColumn: "Shanyraq",
      unmapped: "— Не сопоставлено —",
      mapAria: (name: string) => `Сопоставить «${name}»`,
    },
    syncButtons: {
      syncAll: "Синхронизировать каналы",
      syncNow: "Синхронизировать",
      syncing: "Синхронизация…",
      failed: "Синхронизация требует внимания",
      complete: "Синхронизация завершена",
      nothingToSync: "Нет подключённых каналов для синхронизации",
      queued: "Синхронизация поставлена в очередь",
      queuedSome: (total: number) =>
        `Поставлено в очередь: ${total} ${pluralize(total, "канал", "канала", "каналов")}`,
      syncedSome: (ok: number, total: number) =>
        `Синхронизировано ${ok}/${total} ${pluralize(total, "канала", "каналов", "каналов")}`,
    },
    toasts: {
      connected: (name: string) => `${name} подключён`,
      disconnected: (name: string) => `${name} отключён`,
      roomMappingsSaved: "Сопоставление номеров сохранено",
      rateMappingsSaved: "Сопоставление тарифов сохранено",
    },
    errors: {
      unknownChannel: "Неизвестный канал",
      connectionNotFound: "Подключение не найдено",
    },
  },

  errors: {
    genericTitle: "Что-то пошло не так",
    genericBody:
      "Не удалось загрузить страницу. Ваши данные в безопасности — попробуйте ещё раз. Если проблема повторяется, проверьте, запущена ли база данных (npm run db:reset восстанавливает демо-данные).",
  },
};

/** Русские формы множественного числа: 1 / 2–4 / 5+. */
export function pluralize(n: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = mod100 % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

const CHANNEL_LABELS: Record<ChannelCode, string> = {
  booking: "Booking.com",
  airbnb: "Airbnb",
  ostrovok: "Ostrovok",
  krisha: "Krisha",
  direct: "Прямые брони",
};

/** Человекочитаемое название канала по коду (с запасным вариантом). */
export function channelLabel(code: string): string {
  return (
    CHANNEL_LABELS[code as ChannelCode] ??
    code.charAt(0).toUpperCase() + code.slice(1)
  );
}
