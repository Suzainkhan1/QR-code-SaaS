import { PrismaClient } from '@prisma/client';
import { Role, TableStatus, OrderStatus, PaymentMethod, StaffRequestType, RequestStatus } from '../src/types/enums';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with the exact requested menu...');

  // 1. Re-upsert default restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'mr-crunchos-cafe' },
    update: {},
    create: {
      name: 'Mr. Crunchos Cafe',
      slug: 'mr-crunchos-cafe',
      logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&auto=format&fit=crop&q=60',
      phone: '+91 98765 43210',
      email: 'contact@crunchos.com',
      address: 'Shop No. 12, Food Street, 2nd Floor, Sector V, Salt Lake, Kolkata, India',
      taxRate: 5.0,
      serviceCharge: 0.0,
    },
  });

  // 2. Clear old database items of restaurant to avoid duplications
  await prisma.menuItem.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.menuCategory.deleteMany({ where: { restaurantId: restaurant.id } });
  await prisma.user.deleteMany({ where: { email: { not: 'admin@crunchos.com' } } });

  // 3. Setup Users (Single Admin account, utilizing role OWNER for full permissions)
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);
  await prisma.user.upsert({
    where: { email: 'admin@crunchos.com' },
    update: {
      role: Role.OWNER,
    },
    create: {
      name: 'Mr. Crunchos Admin',
      email: 'admin@crunchos.com',
      password: hashedPassword,
      role: Role.OWNER,
      restaurantId: restaurant.id,
    },
  });

  // 4. Setup Tables (20 Tables)
  const tableData = [
    '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
    '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'
  ];
  for (const num of tableData) {
    await prisma.table.upsert({
      where: { restaurantId_number: { restaurantId: restaurant.id, number: num } },
      update: {},
      create: {
        number: num,
        capacity: 4,
        status: TableStatus.AVAILABLE,
        restaurantId: restaurant.id,
      },
    });
  }

  // 5. Seed Category List and Items precisely
  const menuData = [
    {
      category: 'Sandwich',
      description: 'Toasted or grilled hot sandwiches packed with fillings',
      items: [
        // Veg
        { name: 'Veggie Grilled Sandwich', price: 149, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 10, description: 'Fresh vegetables grilled to perfection between bread slices with local green chutney', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80' },
        { name: 'Veg Cheese Sandwich', price: 149, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 10, description: 'Crisp vegetable slices loaded with mozzarella cheese and spread on buttered toasts', image: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=400&q=80' },
        { name: 'Corn & Cheese Sandwich', price: 150, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 10, description: 'Golden sweet corn tossed with melting cream cheese inside grilled bread', image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80' },
        { name: 'Spicy Corn Sandwich', price: 160, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 10, description: 'Sweet corn and chopped green chillies with spicy mayo spread', image: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=400&q=80' },
        { name: 'Cheese Corn Sandwich', price: 165, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 10, description: 'Double loaded cheese with premium sweet corn kernels', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80' },
        { name: 'Tandoori Paneer Sandwich', price: 170, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 12, description: 'Tandoori-spiced cottage cheese cubes and capsicum grilled together', image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80' },
        { name: 'Paneer Bhurji Sandwich', price: 170, isVeg: true, isBestseller: false, isChefSpecial: true, prepTime: 12, description: 'Scrambled paneer sautéed with onions, tomatoes, and Indian aromatic spices', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80' },
        { name: 'Paneer Tikka Sandwich', price: 170, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 12, description: 'Tandoori-marinated paneer chunks grilled to perfection with bell peppers', image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80' },
        // Non Veg
        { name: 'Chicken Cheese Sandwich', price: 149, isVeg: false, isBestseller: false, isChefSpecial: false, prepTime: 12, description: 'Shredded chicken breasts cooked with cream and topped with melting cheese', image: 'https://images.unsplash.com/photo-1554522723-b2a47cb105e3?w=400&q=80' },
        { name: 'Chicken Grilled Sandwich', price: 155, isVeg: false, isBestseller: true, isChefSpecial: false, prepTime: 10, description: 'Crispy grilled sandwich stuffed with seasoned shredded chicken and veggies', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80' },
        { name: 'Chicken Crispy Sandwich', price: 160, isVeg: false, isBestseller: false, isChefSpecial: false, prepTime: 12, description: 'Crispy fried panko-crusted chicken fillet with lettuce and garlic mayo', image: 'https://images.unsplash.com/photo-1554522723-b2a47cb105e3?w=400&q=80' },
        { name: 'Schezwan Chicken Sandwich', price: 170, isVeg: false, isBestseller: false, isChefSpecial: false, prepTime: 12, description: 'Spicy Schezwan chicken chunks tossed in chili paste between toasted breads', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80' },
        { name: 'Creamy Butter Chicken Sandwich', price: 170, isVeg: false, isBestseller: false, isChefSpecial: true, prepTime: 12, description: 'Rich, creamy butter chicken gravy chunks layered inside fresh toasties', image: 'https://images.unsplash.com/photo-1554522723-b2a47cb105e3?w=400&q=80' },
      ]
    },
    {
      category: 'Pizza',
      description: 'Fresh stone-baked crust pizzas with premium toppings',
      items: [
        // Veg
        { name: 'Veg Cheese Pizza', price: 99, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 12, description: 'Simple single cheese pizza baked with rich tomato sauce and dynamic herbs', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80' },
        { name: 'Veg Corn Pizza', price: 149, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 12, description: 'Classic mozzarella topped with sweet corn kernels on fresh dough', image: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=400&q=80' },
        { name: 'Corn & Cheese Pizza', price: 149, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 12, description: 'Sweet golden corn loaded with extra mozzarella cheese base', image: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=400&q=80' },
        { name: 'Veggie Delight Pizza', price: 155, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 14, description: 'Topped with red onions, green capsicum, juicy tomatoes, sweet corn, and black olives', image: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=400&q=80' },
        { name: 'Ultimate Paneer Pizza', price: 160, isVeg: true, isBestseller: false, isChefSpecial: true, prepTime: 14, description: 'Diced paneer pieces tossed with capsicum, red paprika, and onions', image: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=400&q=80' },
        { name: 'Paneer Tikka Pizza', price: 165, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 14, description: 'Tandoori-spiced paneer chunks topped with onion strings and tandoori dip sauce', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80' },
        { name: 'Butter Paneer Pizza', price: 170, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 15, description: 'Rich makhani gravy base topped with paneer cubes and mozzarella', image: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=400&q=80' },
        { name: 'Cheese Explosion Pizza', price: 179, isVeg: true, isBestseller: true, isChefSpecial: true, prepTime: 14, description: 'Four cheese blend with liquid cheese center oozing out of the crust', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80' },
        // Non Veg
        { name: 'Tandoori Chicken Pizza', price: 170, isVeg: false, isBestseller: true, isChefSpecial: false, prepTime: 15, description: 'Marinated tandoori chicken cubes with sliced onions and coriander sprigs', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80' },
        { name: 'Chicken Tikka Pizza', price: 175, isVeg: false, isBestseller: false, isChefSpecial: false, prepTime: 15, description: 'Tender chicken tikka chunks baked with tandoori spices and red onions', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80' },
        { name: 'BBQ Chicken Pizza', price: 175, isVeg: false, isBestseller: false, isChefSpecial: false, prepTime: 15, description: 'Grilled chicken tossed in BBQ sauce with red onions and bell peppers', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80' },
        { name: 'Peri Peri Chicken Pizza', price: 175, isVeg: false, isBestseller: false, isChefSpecial: false, prepTime: 15, description: 'Diced chicken tossed in fiery African peri-peri sauce with red paprika', image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80' },
        { name: 'Chicken Overloaded Pizza', price: 199, isVeg: false, isBestseller: true, isChefSpecial: true, prepTime: 16, description: 'Topped with chicken tikka, BBQ chicken, sausage slices, and extra cheese', image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80' },
      ]
    },
    {
      category: 'Maggie',
      description: 'Your favorite instant noodles cooked with special spices',
      items: [
        { name: 'Butter Maggie', price: 99, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 5, description: 'Masala maggie cooked with a generous dollop of butter', image: 'https://images.unsplash.com/photo-1612966608997-30dad24c6ad0?w=400&q=80' },
        { name: 'Classic Maggie', price: 105, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 5, description: 'Classic masala instant noodles with select spices', image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&q=80' },
        { name: 'Corn & Cheese Maggie', price: 105, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 7, description: 'Masala maggie loaded with golden sweet corn and liquid cheese', image: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=400&q=80' },
        { name: 'Peri Peri Maggie', price: 105, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 6, description: 'Hot and spicy maggie tossed with African peri-peri spices', image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&q=80' },
        { name: 'Schezwan Maggie', price: 109, isVeg: true, isBestseller: true, isChefSpecial: true, prepTime: 6, description: 'Spicy stir-fried maggie with Chinese Schezwan paste and spring onions', image: 'https://images.unsplash.com/photo-1612966608997-30dad24c6ad0?w=400&q=80' },
      ]
    },
    {
      category: 'Pasta',
      description: 'Penne pasta tossed in delicious Italian styles',
      items: [
        { name: 'Alfredo White Sauce Pasta', price: 160, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 12, description: 'Creamy cheese sauce with mushrooms, black olives, and Italian herbs', image: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=400&q=80' },
        { name: 'Cheesy Peri Peri Pasta', price: 179, isVeg: true, isBestseller: false, isChefSpecial: true, prepTime: 12, description: 'Penne pasta tossed in spicy red tomato and cheese sauce with a hint of peri peri', image: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0bc6?w=400&q=80' },
      ]
    },
    {
      category: 'Garlic Bread',
      description: 'Toasted garlic baguette slices loaded with cheese and paneer',
      items: [
        { name: 'Cheese Garlic Bread', price: 150, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 8, description: 'Baguette slices topped with garlic butter and fresh mozzarella', image: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=400&q=80' },
        { name: 'Stuffed Garlic Bread', price: 160, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 10, description: 'Filled with sweet corn, green chillies, and extra mozzarella cheese', image: 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=400&q=80' },
        { name: 'Butter Paneer Garlic Bread', price: 170, isVeg: true, isBestseller: false, isChefSpecial: true, prepTime: 10, description: 'Baguette stuffed with rich makhani paneer chunks and cheese', image: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=400&q=80' },
        { name: 'Chicken Garlic Bread', price: 179, isVeg: false, isBestseller: true, isChefSpecial: false, prepTime: 10, description: 'Garlic bread topped with seasoned chicken flakes and mozzarella', image: 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=400&q=80' },
        { name: 'Butter Chicken Garlic Bread', price: 180, isVeg: false, isBestseller: false, isChefSpecial: true, prepTime: 12, description: 'Baguette stuffed with shredded butter chicken and cheese', image: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=400&q=80' },
      ]
    },
    {
      category: 'Shakes',
      description: 'Thick creamy milkshakes served cold',
      items: [
        { name: 'Chocolate Coffee Shake', price: 99, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 6, description: 'Blended coffee and rich chocolate syrup with vanilla ice cream base', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80' },
        { name: 'Oreo Cookies Shake', price: 99, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 6, description: 'Thick vanilla shake blended with chocolate Oreo cookies', image: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&q=80' },
        { name: 'Chocolate Shake', price: 105, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 5, description: 'Classic double chocolate fudge shake with chocolate chips', image: 'https://images.unsplash.com/photo-1534706936160-d5ee67737249?w=400&q=80' },
        { name: 'KitKat Shake', price: 109, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 6, description: 'Vanilla ice cream shake blended with crispy KitKat chocolate bars', image: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&q=80' },
        { name: 'Black Currant Shake', price: 110, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 5, description: 'Rich shake made from black currant syrup and pulp', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80' },
        { name: 'Strawberry Shake', price: 119, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 5, description: 'Creamy shake blended with sweet strawberry sauce and fruit bits', image: 'https://images.unsplash.com/photo-1553787499-6f9133860275?w=400&q=80' },
        { name: 'Chocolate Brownie Shake', price: 120, isVeg: true, isBestseller: true, isChefSpecial: true, prepTime: 7, description: 'Decadent shake blended with vanilla ice cream and whole chocolate brownie', image: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&q=80' },
        { name: 'Rose Berry Shake', price: 125, isVeg: true, isBestseller: false, isChefSpecial: true, prepTime: 6, description: 'Rose syrup combined with blended strawberries for a floral-fruity experience', image: 'https://images.unsplash.com/photo-1553787499-6f9133860275?w=400&q=80' },
      ]
    },
    {
      category: 'Coolers',
      description: 'Refreshing carbonated and iced coolers',
      items: [
        { name: 'Virgin Mojito', price: 119, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 5, description: 'Fresh lime slices, mint, simple syrup, club soda and crushed ice', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80' },
        { name: 'Watermelon Blast', price: 120, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 5, description: 'Chilled watermelon juice combined with a splash of lime and mint', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80' },
        { name: 'Blue Lagoon', price: 125, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 5, description: 'Blue curacao syrup combined with lemon juice, club soda, and sprite', image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&q=80' },
        { name: 'Green Apple Punch', price: 125, isVeg: true, isBestseller: false, isChefSpecial: true, prepTime: 5, description: 'Tangy green apple syrup topped with sprite, soda, and lime wedges', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80' },
        { name: 'Blueberry Mojito', price: 120, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 5, description: 'Sweet blueberry crush mixed with mint, lime, and soda', image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&q=80' },
      ]
    },
    {
      category: 'Dessert',
      description: 'Sweet treats to complete your meal',
      items: [
        { name: 'Chocolate Brownie', price: 99, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 5, description: 'Fudge chocolate brownie served warm', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80' },
        { name: 'KitKat Chocolate Brownie', price: 119, isVeg: true, isBestseller: false, isChefSpecial: true, prepTime: 6, description: 'Warm brownie topped with KitKat bits and hot fudge drizzle', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80' },
      ]
    },
    {
      category: 'Burger',
      description: 'Premium loaded burgers with fresh ingredients',
      items: [
        // Veg
        { name: 'Veg Cheese Burger', price: 129, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 8, description: 'Crispy veg patty, double cheese slice, lettuce, and premium burger sauce', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80' },
        { name: 'Indian Spice Burger', price: 149, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 10, description: 'Aloo tikki patty combined with local garam masala sauce and raw onions', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&q=80' },
        { name: 'Classic Veg Burger', price: 150, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 8, description: 'Toasted brioche buns with deep fried mix vegetable herb patty', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80' },
        { name: 'Butter Paneer Burger', price: 165, isVeg: true, isBestseller: false, isChefSpecial: true, prepTime: 12, description: 'Fried paneer slice coated in creamy butter makhani sauce and lettuce', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&q=80' },
        { name: 'Butter Paneer Tikka Burger', price: 180, isVeg: true, isBestseller: true, isChefSpecial: true, prepTime: 12, description: 'Charcoal-grilled paneer tikka, cheese, tandoori dip, and red onions', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80' },
        // Non Veg
        { name: 'Chicken Cheese Burger', price: 149, isVeg: false, isBestseller: true, isChefSpecial: false, prepTime: 10, description: 'Fried chicken patty loaded with liquid cheese and onions', image: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=400&q=80' },
        { name: 'Original Chicken Burger', price: 150, isVeg: false, isBestseller: false, isChefSpecial: false, prepTime: 8, description: 'Classic grilled chicken breast patty with herb mayonnaise', image: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=400&q=80' },
        { name: 'Tandoori Chicken Zinger Burger', price: 160, isVeg: false, isBestseller: false, isChefSpecial: true, prepTime: 12, description: 'Extra crispy tandoori zinger chicken breast with double cheese', image: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=400&q=80' },
        { name: 'Peri Peri Chicken Burger', price: 165, isVeg: false, isBestseller: false, isChefSpecial: false, prepTime: 10, description: 'Crispy fried chicken tossed in hot peri-peri glaze and lettuce', image: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=400&q=80' },
        { name: 'Mr. Fries Zinger Burger', price: 170, isVeg: false, isBestseller: true, isChefSpecial: false, prepTime: 12, description: 'Jumbo zinger burger stuffed with fried chicken strip and seasoned french fries', image: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=400&q=80' },
      ]
    },
    {
      category: 'Quick Snacks',
      description: 'Crispy potatoes and delicious appetizers',
      items: [
        { name: 'French Fries', price: 99, isVeg: true, isBestseller: true, isChefSpecial: false, prepTime: 5, description: 'Deep fried golden potatoes salted to perfection', image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80' },
        { name: 'Peri Peri Fries', price: 120, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 5, description: 'Golden fries tossed in spicy peri-peri dust seasoning', image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=400&q=80' },
        { name: 'Cheese Masala Fries', price: 130, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 6, description: 'Fries coated with local hot masala and cheddar cheese dip', image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80' },
        { name: 'Loaded Fries', price: 140, isVeg: true, isBestseller: true, isChefSpecial: true, prepTime: 7, description: 'Fries layered with sweet corn, onions, capsicum, olives, and melting cheese', image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=400&q=80' },
        { name: 'All Spice Fries', price: 150, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 6, description: 'Fries tossed in our secret chef mix of 6 spices', image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80' },
        { name: 'Tandoori Cheese Fries', price: 165, isVeg: true, isBestseller: false, isChefSpecial: false, prepTime: 7, description: 'Loaded fries covered in tandoori dressing sauce and mozzarella cheese', image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=400&q=80' },
        { name: 'Crunchos Popcorn Fries', price: 179, isVeg: true, isBestseller: true, isChefSpecial: true, prepTime: 8, description: 'Deep fried crispy popcorn potatoes served over loaded french fries', image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80' },
      ]
    },
    {
      category: 'Crunchos Chicken Popcorn',
      description: 'Bite-sized chicken breast nuggets deep fried in premium crunch coatings',
      items: [
        { name: 'Crunchos Chicken Popcorn', price: 119, isVeg: false, isBestseller: true, isChefSpecial: true, prepTime: 10, description: 'Original crispy fried chicken popcorn bits. Size customizable (Regular/Large) and flavors selectable.', image: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=400&q=80' },
      ]
    },
    {
      category: 'Crunchos Chicken Strips',
      description: 'Tender chicken breast strips panko coated and cooked to golden perfection',
      items: [
        { name: 'Crunchos Chicken Strips', price: 149, isVeg: false, isBestseller: true, isChefSpecial: false, prepTime: 10, description: 'Succulent chicken breast strips. Selectable quantities (4 / 6 / 8 pieces) and multiple choice flavors.', image: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&q=80' },
      ]
    }
  ];

  for (let i = 0; i < menuData.length; i++) {
    const catData = menuData[i];
    const category = await prisma.menuCategory.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: catData.category,
        },
      },
      update: {},
      create: {
        name: catData.category,
        description: catData.description,
        sortOrder: i,
        restaurantId: restaurant.id,
      },
    });

    for (const itemData of catData.items) {
      await prisma.menuItem.create({
        data: {
          name: itemData.name,
          description: itemData.description,
          price: itemData.price,
          isVeg: itemData.isVeg,
          isBestseller: itemData.isBestseller,
          isChefSpecial: itemData.isChefSpecial,
          prepTime: itemData.prepTime,
          image: itemData.image,
          categoryId: category.id,
          restaurantId: restaurant.id,
        },
      });
    }
  }

  // 6. Seed mock Expenses and Inventory
  await prisma.expense.create({
    data: { category: 'Salaries', amount: 35000, description: 'June salaries for KDS chef and tables helpers', restaurantId: restaurant.id },
  });
  await prisma.inventoryItem.create({
    data: { name: 'Raw Bread bags', quantity: 200, unit: 'units', minStock: 25, restaurantId: restaurant.id },
  });

  console.log('Exact menu database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
