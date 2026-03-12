const express = require('express');
const multer = require('multer');
const path = require('path');
const { getCollection, generateId, allowedCategories } = require('../db/mongo');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const mapProduct = doc => ({
  _id: doc._id,
  name: doc.name,
  category: doc.category,
  price: Number(doc.price || 0),
  image: doc.image || '',
  description: doc.description || '',
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
});

const buildFilter = (category, search) => {
  const filter = {};

  if (category && category !== 'all') {
    filter.category = category;
  }

  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) {
    filter.name = { $regex: trimmedSearch, $options: 'i' };
  }

  return filter;
};

router.get('/', async (req, res) => {
  try {
    const { category = 'all', search = '', page, limit } = req.query;
    const products = getCollection('products');
    const filter = buildFilter(category, search);

    const hasPagination = page !== undefined || limit !== undefined;
    if (!hasPagination) {
      const docs = await products.find(filter).sort({ createdAt: -1 }).toArray();
      return res.json(docs.map(mapProduct));
    }

    const safePage = Math.max(1, Number(page || 1));
    const safeLimit = Math.max(1, Math.min(50, Number(limit || 10)));
    const skip = (safePage - 1) * safeLimit;

    const [docs, totalItems] = await Promise.all([
      products.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).toArray(),
      products.countDocuments(filter)
    ]);

    return res.json({
      items: docs.map(mapProduct),
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / safeLimit))
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, category, price, description, imageUrl } = req.body;
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const now = new Date();
    const doc = {
      _id: generateId(),
      name: String(name || ''),
      category,
      price: Number(price || 0),
      description: String(description || ''),
      image: req.file ? `/uploads/${req.file.filename}` : String(imageUrl || ''),
      createdAt: now,
      updatedAt: now
    };

    await getCollection('products').insertOne(doc);
    return res.status(201).json(mapProduct(doc));
  } catch (err) {
    return res.status(400).json({ error: 'Bad request' });
  }
});

router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, description, imageUrl } = req.body;

    if (category && !allowedCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const products = getCollection('products');
    const existing = await products.findOne({ _id: id });
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const nextImage = req.file
      ? `/uploads/${req.file.filename}`
      : imageUrl !== undefined && imageUrl !== ''
        ? String(imageUrl)
        : existing.image;

    const updates = {
      name: name ?? existing.name,
      category: category ?? existing.category,
      price: price ?? existing.price,
      description: description ?? existing.description,
      image: nextImage,
      updatedAt: new Date()
    };

    await products.updateOne({ _id: id }, { $set: updates });
    const updated = await products.findOne({ _id: id });
    return res.json(mapProduct(updated));
  } catch (err) {
    return res.status(400).json({ error: 'Bad request' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getCollection('products').deleteOne({ _id: id });

    if (!result.deletedCount) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json({ message: 'Product deleted' });
  } catch (err) {
    return res.status(400).json({ error: 'Bad request' });
  }
});

module.exports = router;
