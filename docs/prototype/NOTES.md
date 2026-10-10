# Prototype notes

The original prototype (single HTML file, React via CDN, data in `localStorage`) is **not committed** because it contains secrets (Supabase key, admin password). This file keeps what we need from it.

## Brand

- Name: **VapeHard Minsk**, subtitle "Telegram Store", logo: gradient square with "V".
- Colors: vapeDark `#0f172a`, vapeCard `#1e293b`, vapeAccent `#8b5cf6`, vapeGlow `#a855f7`, vapeGreen `#10b981`, vapeRed `#ef4444`. Borders `slate-800`, muted text `slate-400`.
- Gradient CTA: `from-vapeAccent to-vapeGlow`. Pulse glow on the roulette button.
- Manager: `@VapeHard_manager`.

## Screens and texts (Russian)

- Header: "VapeHard Minsk" / "Telegram Store", button "Профиль" (or "Админ").
- Tabs: Каталог, Корзина (badge), Рулетка (glow), Заказы, Профиль, Админка (admins only).
- Catalog: search "Поиск по каталогу...", chips: Все, Жидкости, Одноразки, Расходники, Под системы, 🔥 Уценка. Card: "Уценка" badge, name, "N вкусов"/"1 вариант", price, old price, button "Выбрать вкусы" / "Нет в наличии".
- Product: "Назад в каталог", badge "🔥 Акция / Уценка", category chip, "Описание" (fallback "Оригинальная продукция от производителя. Все товары прошли контроль качества."), "Выберите вкусы и количество" / "Можно несколько", "В наличии: N шт." / "Нет в наличии", sticky bar "Выбрано: N шт." + "Добавить в корзину". Toast "Добавлено позиций: N шт.".
- Cart: empty "Корзина пуста" / "Добавьте позиции из каталога". Title "Оформление заказа", "N поз.". Delivery block "Доставка по Минску и РБ": Самовывоз (Минск) 0, Курьер по Минску 15, Европочта по Беларуси 6. "Ваш Telegram Username". "Промокод / Бонус из Рулетки" + "Применить", "Промокод X активен", "Сбросить". Summary "Товары (N шт.):", "Скидка по промокоду:", "Доставка:", "Итого к оплате:". CTA "Оформить и написать Менеджеру".
- Success dialog: "Заказ #VH-XXXX создан!", "Для подтверждения и согласования времени доставки обязательно напишите нашему менеджеру!", sum, method, gift, profile, button "Написать @VapeHard_manager", "Закрыть окно". Prefilled text: "Здравствуйте! Оформил заказ #ID на сумму N BYN."
- Roulette: "🔥 Бонусная Рулетка", "Крутите колесо каждые 24 часа и получайте скидки", conic-gradient wheel of 9 segments with labels, pointer on top, "VH" center, button "КРУТИТЬ РУЛЕТКУ" / "ВРАЩЕНИЕ...", cooldown "Следующий бесплатный прокрут через:" HH:MM:SS, result "🎉 Поздравляем! Ваш приз:", "Промокод уже автоматически применен в вашей корзине!". Animation 4s `cubic-bezier(0.15, 0.85, 0.35, 1.2)`, 5 full turns, target `360 - index*seg - seg/2`.
- Orders: "Мои заказы (N)", empty "У вас нет активных заказов" / "Сделайте первый заказ из каталога". Status badges: Завершен green, Передан курьеру blue, Отменен red, В обработке amber.
- Admin: "Панель Управления", sub-tabs Склад, + Товар (1-30 вкусов), Заказы (N), Финансы, Шансы Рулетки. Stock: per-variant −/input/+, delete variant ("У товара должен оставаться хотя бы один вкус!"), quick add ("Такой вкус уже есть у товара!", "Максимум 30 вкусов на один товар!"), delete product confirm. Finance: "Выручка (Завершенные)", "Остаток на складе", counts by status. Odds: "Математическая вероятность призов", "Видно только администратору. Клиенты шансы не видят".
- Removed on purpose: admin login/password and settings screens.

## Products (seed)

1. Husky Premium 30ml — Жидкости — 28 — flavors: Miami Snow (Мята-Клубника) 12, Yogi Dog (Гуава-Драгонфрут) 5, Big Ball (Арбуз-Медовая дыня) 0, Dark Flesh (Черника-Гуава) 8.
2. Vaporesso XROS 4 Mini — Под системы — 85 — Black (Черный) 4, Silver (Серебро) 2, Ice Blue (Ледяной синий) 3.
3. Испаритель Vaporesso XROS Series 0.6 Ohm — Расходники — 12 — 0.6 Ohm (Сетка) 45, 0.8 Ohm (Сетка) 30.
4. Elf Bar BC10000 Ultra — Одноразки — 55 (old 65) — Watermelon Ice 6, Blue Razz Ice 1, Grape Cranberry 0.
5. Жидкость Podonki v2 (Уценка - повреждена коробка) — 🔥 Уценка — 18 (old 26) — Ананасовый Сок (Помятая пачка) 2.

Descriptions are copied into the seed file.

## Roulette prizes

| key            | title              | label        | type    | amount | color   |
| -------------- | ------------------ | ------------ | ------- | ------ | ------- |
| 1BYN           | Скидка 1 BYN       | Скидка 1р    | fixed   | 1      | #475569 |
| 2BYN           | Скидка 2 BYN       | Скидка 2р    | fixed   | 2      | #3b82f6 |
| 3BYN           | Скидка 3 BYN       | Скидка 3р    | fixed   | 3      | #0ea5e9 |
| 4BYN           | Скидка 4 BYN       | Скидка 4р    | fixed   | 4      | #14b8a6 |
| 5BYN           | Скидка 5 BYN       | Скидка 5р    | fixed   | 5      | #8b5cf6 |
| 10PCT          | Скидка 10%         | Скидка 10%   | percent | 10     | #ec4899 |
| 15PCT          | Скидка 15%         | Скидка 15%   | percent | 15     | #f59e0b |
| FREE_CARTRIDGE | Картридж в подарок | Картридж 🎁  | gift    | 0      | #10b981 |
| FREE_XROS      | XROS mini          | XROS mini 🎁 | gift    | 0      | #ef4444 |
