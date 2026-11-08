import { assert, found, AppError } from '../utils/errors.js';
import { decimal, money, totals } from '../utils/money.js';
import { pagination, paginated, paymentEvent } from '../validators/index.js';

export function commerceService(repos, paymentAdapter) {
  async function ownedOrder(userId, id) {
    const order = found(await repos.order.get(id));
    assert(order.userId === userId, 404, 'NOT_FOUND', 'Order not found');
    return order;
  }
  async function cleanCart(r, userId) {
    await r.cart.removeInvalid(userId);
    const items = await r.cart.list(userId);
    const owned = [];
    for (const item of items) if (await r.enrollment.get(userId, item.courseId)) owned.push(item.courseId);
    if (owned.length) await r.cart.removeCourses(userId, owned);
    return items.filter(i => !owned.includes(i.courseId));
  }
  return {
    async cart(userId) {
      return repos.transaction(async r => {
        await r.lock(`user:${userId}`);
        const items = await cleanCart(r, userId);
        return { items: items.map(i => ({ id: i.id, courseId: i.courseId, title: i.course.title, slug: i.course.slug, thumbnailUrl: i.course.thumbnailUrl, price: i.course.price, discountPrice: i.course.discountPrice })), ...totals(items.map(i => i.course)) };
      });
    },
    async addCart(userId, courseId) {
      return repos.transaction(async r => {
        await r.lock(`user:${userId}`);
        const course = found(await r.course.get(courseId));
        assert(course.published && !course.deletedAt, 409, 'COURSE_UNAVAILABLE', 'Course is unavailable');
        assert(!await r.enrollment.get(userId, courseId), 409, 'ALREADY_ENROLLED', 'You are already enrolled');
        const items = await r.cart.list(userId);
        assert(items.length < 100 || items.some(i => i.courseId === courseId), 409, 'CART_FULL', 'A cart can contain up to 100 courses');
        return r.cart.add(userId, courseId);
      });
    },
    async removeCart(userId, courseId) {
      await repos.transaction(async r => { await r.lock(`user:${userId}`); await r.cart.remove(userId, courseId); });
      return { removed: true };
    },
    async createOrder(userId, idempotencyKey) {
      return repos.transaction(async r => {
        await r.lock(`user:${userId}`);
        const previous = await r.order.byKey(userId, idempotencyKey);
        if (previous) return { order: previous, reused: true };
        const pending = await r.order.pending(userId);
        if (pending) throw new AppError(409, 'PENDING_ORDER_EXISTS', 'Complete or cancel your pending order first', { orderId: pending.id });
        const items = await cleanCart(r, userId);
        assert(items.length > 0, 409, 'EMPTY_CART', 'Add an available course to your cart first');
        const amounts = totals(items.map(i => i.course));
        assert(decimal(amounts.total).lte('999999999999.99') && decimal(amounts.subtotal).lte('999999999999.99'), 400, 'ORDER_TOO_LARGE', 'Order total exceeds the supported amount');
        const order = await r.order.create({ userId, idempotencyKey, ...amounts, items: { create: items.map(({ course }) => ({ courseId: course.id, courseTitleSnapshot: course.title, priceSnapshot: course.price, discountSnapshot: money(decimal(course.price).minus(course.discountPrice ?? course.price)) })) } });
        return { order, reused: false };
      });
    },
    order: ownedOrder,
    async orders(userId, query) {
      const { skip, take } = pagination(query);
      return paginated(await repos.order.list({ userId }, skip, take), await repos.order.count({ userId }), query);
    },
    async cancelOrder(userId, id) {
      return repos.transaction(async r => {
        await r.lock(`user:${userId}`);
        const order = found(await r.order.get(id));
        assert(order.userId === userId, 404, 'NOT_FOUND', 'Order not found');
        assert(order.status !== 'PAID', 409, 'ORDER_PAID', 'A paid order cannot be cancelled');
        return r.order.update(id, { status: 'CANCELLED' });
      });
    },
    async checkout(userId, id) {
      const order = await ownedOrder(userId, id);
      assert(order.status === 'PENDING_PAYMENT', 409, 'ORDER_NOT_PENDING', 'Order is not awaiting payment');
      assert(paymentAdapter.enabled, 503, 'PAYMENTS_UNAVAILABLE', 'Payment integration is not configured');
      return paymentAdapter.createCheckout({ order: { id: order.id, total: money(order.total), currency: order.currency }, idempotencyKey: order.id });
    },
    async webhook(provider, rawBody, headers) {
      assert(paymentAdapter.enabled && paymentAdapter.provider === provider, 503, 'PAYMENTS_UNAVAILABLE', 'Payment integration is not configured');
      // Only the trusted, configured adapter can turn a provider request into a verified event.
      const verified = await paymentAdapter.verifyWebhook({ rawBody, headers });
      assert(verified?.verified === true, 401, 'INVALID_WEBHOOK', 'Payment verification failed');
      const event = paymentEvent.parse(verified.event);
      assert(event.provider === provider, 400, 'PAYMENT_MISMATCH', 'Payment provider does not match');
      return repos.transaction(async r => {
        const existingOrder = found(await r.order.get(event.orderId));
        await r.lock(`user:${existingOrder.userId}`);
        const order = found(await r.order.get(event.orderId));
        assert(decimal(event.amount).equals(order.total) && event.currency === order.currency, 400, 'PAYMENT_MISMATCH', 'Payment amount or currency does not match');
        const previous = await r.payment.get(provider, event.providerPaymentId);
        if (previous) {
          assert(previous.orderId === order.id && decimal(previous.amount).equals(event.amount), 409, 'PAYMENT_CONFLICT', 'Payment identifier already belongs to another transaction');
          return { received: true, duplicate: true };
        }
        assert(order.status === 'PENDING_PAYMENT', 409, 'ORDER_NOT_PENDING', 'Order is not awaiting payment; operator reconciliation is required');
        await r.payment.create({ orderId: order.id, provider, providerPaymentId: event.providerPaymentId, amount: event.amount, currency: event.currency, status: 'SUCCEEDED' });
        await r.order.update(order.id, { status: 'PAID' });
        for (const item of order.items) await r.enrollment.create(order.userId, item.courseId);
        await r.cart.removeCourses(order.userId, order.items.map(i => i.courseId));
        return { received: true, duplicate: false };
      });
    },
  };
}
