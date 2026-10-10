// All bot texts in one place (easy to translate later). HTML parse mode.
import {
  DELIVERY_OPTIONS,
  formatMoney,
  formatOrderNumber,
  ORDER_STATUS_LABELS,
  type OrderNotificationSnapshot,
  type OrderStatus,
} from '@vapehard/shared';

/** Escapes user data for Telegram HTML parse mode. */
export function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const deliveryTitle = (method: OrderNotificationSnapshot['deliveryMethod']) =>
  DELIVERY_OPTIONS.find((o) => o.method === method)?.title ?? method;

export const t = {
  openShop: 'Открыть магазин',
  menuButton: 'Магазин',
  start: (firstName: string) =>
    [
      `Привет, <b>${escapeHtml(firstName)}</b>! 👋`,
      '',
      'Это <b>VapeHard Minsk</b> — магазин в Telegram.',
      'Выбирайте товары, крутите бонусную рулетку и оформляйте заказ прямо здесь.',
      '',
      '🔞 Магазин только для лиц старше 18 лет.',
    ].join('\n'),
  help: (manager: string) =>
    [
      '<b>Команды</b>',
      '/start — открыть магазин',
      '/orders — мои последние заказы',
      '/help — помощь',
      '',
      `Менеджер: @${escapeHtml(manager)}`,
    ].join('\n'),
  noOrders: 'У вас пока нет заказов. Откройте магазин, чтобы сделать первый 🛍',
  ordersList: (
    orders: { number: number; status: OrderStatus; totalMinor: number; createdAt: Date }[],
  ) =>
    [
      '<b>Ваши последние заказы</b>',
      '',
      ...orders.map(
        (o) =>
          `<code>${formatOrderNumber(o.number)}</code> · ${ORDER_STATUS_LABELS[o.status]} · ${formatMoney(o.totalMinor)}`,
      ),
    ].join('\n'),
  notAdmin: 'Команда доступна только администраторам.',
  stats: (count: number, revenueMinor: number, completed: number) =>
    [
      '<b>Сегодня</b>',
      `Заказов: ${count}`,
      `Завершено: ${completed}`,
      `Выручка (завершенные): ${formatMoney(revenueMinor)}`,
    ].join('\n'),
  error: 'Что-то пошло не так. Попробуйте ещё раз позже.',

  managerNewOrder: (o: OrderNotificationSnapshot) => {
    const c = o.customer;
    const customerLink = `<a href="tg://user?id=${c.telegramId}">${escapeHtml(c.firstName || 'Клиент')}</a>`;
    return [
      `🆕 <b>Новый заказ ${formatOrderNumber(o.number)}</b>`,
      '',
      ...o.items.map(
        (i) =>
          `• ${escapeHtml(i.productName)} — ${escapeHtml(i.variantName)} × ${i.qty} = ${formatMoney(i.unitPriceMinor * i.qty)}`,
      ),
      '',
      `Товары: ${formatMoney(o.subtotalMinor)}`,
      ...(o.discountMinor > 0 ? [`Скидка: −${formatMoney(o.discountMinor)}`] : []),
      ...(o.giftName ? [`🎁 Подарок: ${escapeHtml(o.giftName)}`] : []),
      `Доставка: ${escapeHtml(deliveryTitle(o.deliveryMethod))} (${formatMoney(o.deliveryCostMinor)})`,
      `<b>Итого: ${formatMoney(o.totalMinor)}</b>`,
      '',
      `Клиент: ${customerLink} · @${escapeHtml(o.contactUsername)}`,
    ].join('\n');
  },

  customerStatusChanged: (o: OrderNotificationSnapshot) =>
    [
      `📦 Заказ <b>${formatOrderNumber(o.number)}</b>`,
      `Новый статус: <b>${ORDER_STATUS_LABELS[o.status]}</b>`,
      `Сумма: ${formatMoney(o.totalMinor)}`,
    ].join('\n'),
};
