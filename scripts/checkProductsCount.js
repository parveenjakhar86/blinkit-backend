require('dotenv').config();
const { initMongo, getCollection } = require('../db/mongo');

async function checkProductsCount() {
  try {
    await initMongo();
    const products = getCollection('products');

    const [total, byCategory] = await Promise.all([
      products.countDocuments({}),
      products
        .aggregate([
          { $group: { _id: '$category', total: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ])
        .toArray()
    ]);

    console.log('Total products:', total);
    console.table(byCategory.map(row => ({ category: row._id, total: row.total })));
  } catch (error) {
    console.error('Check failed:', error.message);
    process.exitCode = 1;
  }
}

checkProductsCount();
