const express = require('express');
const {
  getCollection,
  generateId,
  allowedOrderStatus,
  allowedPaymentModes
} = require('../db/mongo');

const router = express.Router();

const deliveryPartners = ['Ravi', 'Aman', 'Suresh', 'Neha', 'Kunal', 'Pooja'];

const getOrderHash = orderId => {
  const text = String(orderId || '');
  return text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
};

const buildTrackingInfo = order => {
  const hash = getOrderHash(order._id);
  const deliveryPartnerName = deliveryPartners[hash % deliveryPartners.length];
  const minutesSinceOrder = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));

  if (order.status === 'cancelled') {
    return {
      etaMinutes: null,
      deliveryPartner: {
        name: deliveryPartnerName,
        status: 'Order Cancelled',
        location: null
      }
    };
  }

  if (order.status === 'delivered') {
    return {
      etaMinutes: 0,
      deliveryPartner: {
        name: deliveryPartnerName,
        status: 'Delivered',
        location: order.customer?.location
          ? {
            latitude: Number(order.customer.location.latitude),
            longitude: Number(order.customer.location.longitude),
            mapUrl:
              order.customer.location.mapUrl ||
              `https://www.google.com/maps?q=${order.customer.location.latitude},${order.customer.location.longitude}`
          }
          : null
      }
    };
  }

  const etaMinutes = Math.max(5, 35 - minutesSinceOrder);

  let riderLocation = null;
  const customerLat = Number(order.customer?.location?.latitude);
  const customerLng = Number(order.customer?.location?.longitude);

  if (Number.isFinite(customerLat) && Number.isFinite(customerLng)) {
    const startLatOffset = 0.03 + (hash % 7) * 0.003;
    const startLngOffset = 0.025 + (hash % 5) * 0.003;
    const progress = Math.min(1, Math.max(0.05, minutesSinceOrder / 35));
    const latitude = Number((customerLat + startLatOffset * (1 - progress)).toFixed(6));
    const longitude = Number((customerLng + startLngOffset * (1 - progress)).toFixed(6));

    riderLocation = {
      latitude,
      longitude,
      mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`
    };
  }

  return {
    etaMinutes,
    deliveryPartner: {
      name: deliveryPartnerName,
      status: 'On the way',
      location: riderLocation
    }
  };
};

const csvEscape = value => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const buildFilter = ({ search = '', status = 'all', dateRange = 'all', fromDate = '', toDate = '' }) => {
  const filter = {};

  if (status && status !== 'all') {
    filter.status = status;
  }

  const createdAt = {};
  if (dateRange && dateRange !== 'all') {
    const now = new Date();
    if (dateRange === 'today') {
      createdAt.$gte = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateRange === 'last7days') {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      createdAt.$gte = start;
    } else if (dateRange === 'last30days') {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      createdAt.$gte = start;
    }
  }

  if (fromDate) {
    const start = new Date(`${fromDate}T00:00:00`);
    if (!Number.isNaN(start.getTime())) createdAt.$gte = start;
  }

  if (toDate) {
    const end = new Date(`${toDate}T23:59:59.999`);
    if (!Number.isNaN(end.getTime())) createdAt.$lte = end;
  }

  if (Object.keys(createdAt).length) {
    filter.createdAt = createdAt;
  }

  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) {
    filter.$or = [
      { _id: trimmedSearch },
      { 'customer.fullName': { $regex: trimmedSearch, $options: 'i' } },
      { 'customer.phone': { $regex: trimmedSearch, $options: 'i' } }
    ];
  }

  return filter;
};

router.get('/', async (req, res) => {
  try {
    const orders = await getCollection('orders')
      .find(buildFilter(req.query))
      .sort({ createdAt: -1 })
      .toArray();
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const orders = await getCollection('orders')
      .find(buildFilter(req.query))
      .sort({ createdAt: -1 })
      .toArray();

    const headers = [
      'orderId',
      'createdAt',
      'customerName',
      'phone',
      'address',
      'locationMapUrl',
      'paymentMode',
      'status',
      'subtotal',
      'deliveryFee',
      'total',
      'items'
    ];

    const rows = orders.map(order => {
      const itemsText = (order.items || [])
        .map(item => `${item.name} x ${item.quantity} (Rs${Number(item.price || 0)})`)
        .join(' | ');

      return [
        String(order._id),
        new Date(order.createdAt).toISOString(),
        order.customer?.fullName || '',
        order.customer?.phone || '',
        order.customer?.address || '',
        order.customer?.location?.mapUrl || '',
        order.paymentMode || 'cod',
        order.status || 'placed',
        Number(order.subtotal || 0),
        Number(order.deliveryFee || 0),
        Number(order.total || 0),
        itemsText
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to export orders' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { customer, paymentMode, items, subtotal, deliveryFee, total } = req.body;

    if (!customer?.fullName || !customer?.phone || !customer?.address) {
      return res.status(400).json({ error: 'Customer details are required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one order item is required' });
    }

    const normalizedItems = items.map(item => ({
      product: String(item.product || '').trim() || null,
      name: String(item.name || ''),
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 0)
    }));

    if (normalizedItems.some(item => !item.name || item.price < 0 || item.quantity <= 0)) {
      return res.status(400).json({ error: 'Invalid item payload' });
    }

    let normalizedLocation;
    if (customer.location) {
      const latitude = Number(customer.location.latitude);
      const longitude = Number(customer.location.longitude);
      const mapUrl = String(customer.location.mapUrl || '').trim();
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        normalizedLocation = {
          latitude,
          longitude,
          mapUrl: mapUrl || `https://www.google.com/maps?q=${latitude},${longitude}`
        };
      }
    }

    const productIds = normalizedItems.map(item => item.product).filter(Boolean);
    const productsMap = new Map(
      (
        await getCollection('products')
          .find({ _id: { $in: productIds } }, { projection: { _id: 1, image: 1 } })
          .toArray()
      ).map(product => [product._id, product])
    );

    const orderId = generateId();
    const now = new Date();
    const safePaymentMode = allowedPaymentModes.includes(paymentMode) ? paymentMode : 'cod';

    const orderDoc = {
      _id: orderId,
      customer: {
        fullName: String(customer.fullName),
        phone: String(customer.phone),
        address: String(customer.address),
        ...(normalizedLocation ? { location: normalizedLocation } : {})
      },
      paymentMode: safePaymentMode,
      subtotal: Number(subtotal || 0),
      deliveryFee: Number(deliveryFee || 0),
      total: Number(total || 0),
      status: 'placed',
      items: normalizedItems.map(item => ({
        product: item.product
          ? {
            _id: item.product,
            image: productsMap.get(item.product)?.image || ''
          }
          : null,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      createdAt: now,
      updatedAt: now
    };

    await getCollection('orders').insertOne(orderDoc);
    return res.status(201).json({ message: 'Order placed', orderId });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to place order' });
  }
});

router.get('/customer-track', async (req, res) => {
  try {
    const fullName = String(req.query.fullName || '').trim();
    const phone = String(req.query.phone || '').trim();

    if (!/^[a-zA-Z\s]{2,50}$/.test(fullName)) {
      return res.status(400).json({ error: 'Enter valid customer name' });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter valid 10-digit phone number' });
    }

    const orders = await getCollection('orders')
      .find({
        'customer.phone': phone,
        'customer.fullName': { $regex: `^${fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    if (!orders.length) {
      return res.status(404).json({ error: 'No orders found for provided details' });
    }

    const trackedOrders = orders.map(order => ({
      _id: order._id,
      createdAt: order.createdAt,
      customer: order.customer,
      items: order.items || [],
      subtotal: Number(order.subtotal || 0),
      deliveryFee: Number(order.deliveryFee || 0),
      total: Number(order.total || 0),
      status: order.status,
      paymentMode: order.paymentMode,
      ...buildTrackingInfo(order)
    }));

    return res.json(trackedOrders);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to track customer orders' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!allowedOrderStatus.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const orders = getCollection('orders');
    const result = await orders.updateOne({ _id: id }, { $set: { status, updatedAt: new Date() } });
    if (!result.matchedCount) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updatedOrder = await orders.findOne({ _id: id });
    return res.json(updatedOrder);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;
