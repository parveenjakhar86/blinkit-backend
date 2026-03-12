require('dotenv').config();
const { initMongo, getCollection, generateId } = require('../db/mongo');

const products = [
  {
    name: 'Fresh Bananas',
    category: 'grocery',
    price: 60,
    image: 'https://images.unsplash.com/photo-1574226516831-e1dff420e12d?w=800',
    description: 'Naturally ripened fresh bananas, 1 dozen.'
  },
  {
    name: 'Organic Tomatoes',
    category: 'grocery',
    price: 45,
    image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=800',
    description: 'Fresh farm tomatoes, 1 kg pack.'
  },
  {
    name: 'Aashirvaad Atta 5kg',
    category: 'grocery',
    price: 289,
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800',
    description: 'Whole wheat flour, 5kg family pack.'
  },
  {
    name: 'Amul Toned Milk 1L',
    category: 'grocery',
    price: 62,
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800',
    description: 'Fresh toned milk, 1 litre pouch.'
  },
  {
    name: 'Basmati Rice 5kg',
    category: 'grocery',
    price: 499,
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800',
    description: 'Premium long grain basmati rice.'
  },
  {
    name: 'LED Table Lamp',
    category: 'electric',
    price: 799,
    image: 'https://images.unsplash.com/photo-1517999144091-3d9dca6d1e43?w=800',
    description: 'Adjustable warm/cool light LED table lamp.'
  },
  {
    name: 'Wireless Earbuds',
    category: 'electric',
    price: 1499,
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800',
    description: 'Bluetooth earbuds with charging case.'
  },
  {
    name: 'USB Extension Board',
    category: 'electric',
    price: 699,
    image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800',
    description: '4-socket extension board with USB ports.'
  },
  {
    name: 'Smart LED Bulb 9W',
    category: 'electric',
    price: 499,
    image: 'https://images.unsplash.com/photo-1518306727298-4c17e1bf6942?w=800',
    description: 'WiFi-enabled smart bulb with app control.'
  },
  {
    name: 'Portable Power Bank 10000mAh',
    category: 'electric',
    price: 1199,
    image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800',
    description: 'Fast charging power bank for daily use.'
  },
  {
    name: 'Women Floral Kurti',
    category: 'buteque',
    price: 899,
    image: 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?w=800',
    description: 'Soft cotton floral printed kurti.'
  },
  {
    name: 'Designer Handbag',
    category: 'buteque',
    price: 1299,
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800',
    description: 'Premium faux leather handbag.'
  },
  {
    name: 'Women Party Dress',
    category: 'buteque',
    price: 1899,
    image: 'https://images.unsplash.com/photo-1495385794356-15371f348c31?w=800',
    description: 'Elegant party wear dress for special occasions.'
  },
  {
    name: 'Men Linen Shirt',
    category: 'buteque',
    price: 1199,
    image: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?w=800',
    description: 'Premium linen shirt with breathable fabric.'
  },
  {
    name: 'Classic Wrist Watch',
    category: 'buteque',
    price: 2499,
    image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800',
    description: 'Minimal classic watch with leather strap.'
  },
  {
    name: 'Greek Yogurt Cup',
    category: 'dairy',
    price: 95,
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800',
    description: 'Protein-rich thick greek yogurt, 400g.'
  },
  {
    name: 'Cheddar Cheese Slices',
    category: 'dairy',
    price: 220,
    image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800',
    description: 'Creamy cheddar cheese slices pack.'
  },
  {
    name: 'Masala Potato Chips',
    category: 'snacks',
    price: 30,
    image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=800',
    description: 'Crispy masala flavored potato chips.'
  },
  {
    name: 'Roasted Salted Almonds',
    category: 'snacks',
    price: 180,
    image: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=800',
    description: 'Healthy roasted almonds snack pack.'
  },
  {
    name: 'Orange Juice 1L',
    category: 'beverages',
    price: 140,
    image: 'https://images.unsplash.com/photo-1600271886742-f049cd5bba3f?w=800',
    description: 'Refreshing orange juice, no added sugar.'
  },
  {
    name: 'Cold Coffee Can',
    category: 'beverages',
    price: 55,
    image: 'https://images.unsplash.com/photo-1494314671902-399b18174975?w=800',
    description: 'Ready-to-drink cold coffee can.'
  },
  {
    name: 'Herbal Face Wash',
    category: 'personalcare',
    price: 175,
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800',
    description: 'Gentle daily use herbal face cleanser.'
  },
  {
    name: 'Shampoo 340ml',
    category: 'personalcare',
    price: 249,
    image: 'https://images.unsplash.com/photo-1625772452859-1c03d5bf1137?w=800',
    description: 'Nourishing shampoo for smooth hair.'
  },
  {
    name: 'Liquid Floor Cleaner',
    category: 'household',
    price: 189,
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800',
    description: 'Disinfectant floor cleaner lemon fragrance.'
  },
  {
    name: 'Kitchen Tissue Roll',
    category: 'household',
    price: 120,
    image: 'https://images.unsplash.com/photo-1583947582886-f40ec95dd752?w=800',
    description: '2-ply absorbent kitchen tissue roll.'
  }
];

async function seedProducts() {
  try {
    await initMongo();
    const collection = getCollection('products');

    for (const product of products) {
      const now = new Date();
      await collection.updateOne(
        { name: product.name },
        {
          $set: {
            category: product.category,
            price: product.price,
            image: product.image,
            description: product.description,
            updatedAt: now
          },
          $setOnInsert: {
            _id: generateId(),
            name: product.name,
            createdAt: now
          }
        },
        { upsert: true }
      );
    }

    console.log('Products seeded successfully');
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  }
}

seedProducts();
