// Default seed data for BrewPOS

window.DEFAULT_PRODUCTS = [
  { id:1,  name:'Classic Milk Tea',      cat:'Milk Tea',  emoji:'🧋', prices:{S:59,M:79,L:99,XL:119}, color:'#c8841a', active:true,
    recipe:[{ingId:1,qty:150},{ingId:2,qty:20},{ingId:9,qty:50}] },
  { id:2,  name:'Brown Sugar Tiger',     cat:'Milk Tea',  emoji:'🐯', prices:{S:69,M:89,L:109,XL:129}, color:'#b5651d', active:true,
    recipe:[{ingId:1,qty:150},{ingId:8,qty:25},{ingId:9,qty:50}] },
  { id:3,  name:'Taro Milk Tea',         cat:'Milk Tea',  emoji:'🫐', prices:{S:69,M:89,L:109,XL:129}, color:'#9d6ef8', active:true,
    recipe:[{ingId:1,qty:150},{ingId:2,qty:15},{ingId:9,qty:50}] },
  { id:4,  name:'Matcha Latte',          cat:'Matcha',    emoji:'🍵', prices:{S:79,M:99,L:119,XL:139}, color:'#27c96e', active:true,
    recipe:[{ingId:7,qty:8},{ingId:1,qty:150},{ingId:2,qty:15}] },
  { id:5,  name:'Matcha Frappe',         cat:'Matcha',    emoji:'🍃', prices:{S:89,M:109,L:129,XL:149}, color:'#2ecc71', active:true,
    recipe:[{ingId:7,qty:10},{ingId:1,qty:100},{ingId:6,qty:50}] },
  { id:6,  name:'Choco Frappe',          cat:'Frappe',    emoji:'🍫', prices:{S:79,M:99,L:119,XL:139}, color:'#8B4513', active:true,
    recipe:[{ingId:5,qty:20},{ingId:1,qty:100},{ingId:6,qty:50},{ingId:2,qty:20}] },
  { id:7,  name:'Caramel Frappe',        cat:'Frappe',    emoji:'🍮', prices:{S:79,M:99,L:119,XL:139}, color:'#D2691E', active:true,
    recipe:[{ingId:12,qty:30},{ingId:1,qty:100},{ingId:6,qty:50}] },
  { id:8,  name:'Strawberry Frappe',     cat:'Frappe',    emoji:'🍓', prices:{S:79,M:99,L:119,XL:139}, color:'#e94560', active:true,
    recipe:[{ingId:10,qty:30},{ingId:1,qty:100},{ingId:6,qty:50}] },
  { id:9,  name:'Americano',             cat:'Coffee',    emoji:'☕', prices:{S:55,M:69,L:89,XL:99},   color:'#4ea8de', active:true,
    recipe:[{ingId:2,qty:18}] },
  { id:10, name:'Caramel Macchiato',     cat:'Coffee',    emoji:'🍦', prices:{S:79,M:99,L:119,XL:139}, color:'#f5a623', active:true,
    recipe:[{ingId:2,qty:18},{ingId:1,qty:120},{ingId:12,qty:30}] },
  { id:11, name:'Vanilla Latte',         cat:'Coffee',    emoji:'🥛', prices:{S:79,M:99,L:119,XL:139}, color:'#e8d5b7', active:true,
    recipe:[{ingId:2,qty:18},{ingId:1,qty:120},{ingId:4,qty:20}] },
  { id:12, name:'Strawberry Smoothie',   cat:'Smoothie',  emoji:'🍓', prices:{S:79,M:99,L:119,XL:139}, color:'#ff6b9d', active:true,
    recipe:[{ingId:10,qty:40},{ingId:1,qty:80},{ingId:2,qty:10}] },
  { id:13, name:'Mango Smoothie',        cat:'Smoothie',  emoji:'🥭', prices:{S:79,M:99,L:119,XL:139}, color:'#ffb347', active:true,
    recipe:[{ingId:1,qty:80},{ingId:2,qty:10}] },
  { id:14, name:'Tapioca Pearls',        cat:'Add-ons',   emoji:'⚫', prices:{S:15,M:15,L:15,XL:15},   color:'#555', active:true, recipe:[] },
  { id:15, name:'Coconut Jelly',         cat:'Add-ons',   emoji:'🥥', prices:{S:15,M:15,L:15,XL:15},   color:'#98d8c8', active:true, recipe:[] },
  { id:16, name:'Nata de Coco',          cat:'Add-ons',   emoji:'💎', prices:{S:15,M:15,L:15,XL:15},   color:'#87ceeb', active:true, recipe:[] },
];

window.DEFAULT_INGREDIENTS = [
  { id:1,  name:'Fresh Milk',       cat:'Dairy',     unit:'ml',  stock:5000, costPer:0.08,  reorder:500,  supplier:'Dairy Fresh' },
  { id:2,  name:'Espresso Beans',   cat:'Coffee',    unit:'g',   stock:2000, costPer:0.50,  reorder:300,  supplier:'Bean Masters' },
  { id:3,  name:'White Sugar',      cat:'Dry',       unit:'g',   stock:8000, costPer:0.005, reorder:1000, supplier:'Local' },
  { id:4,  name:'Vanilla Syrup',    cat:'Syrup',     unit:'ml',  stock:1500, costPer:0.25,  reorder:300,  supplier:'Monin' },
  { id:5,  name:'Choco Powder',     cat:'Dry',       unit:'g',   stock:2000, costPer:0.10,  reorder:400,  supplier:'Van Houten' },
  { id:6,  name:'Whipping Cream',   cat:'Dairy',     unit:'ml',  stock:1800, costPer:0.15,  reorder:400,  supplier:'Dairy Fresh' },
  { id:7,  name:'Matcha Powder',    cat:'Dry',       unit:'g',   stock:800,  costPer:0.35,  reorder:200,  supplier:'Zen Tea' },
  { id:8,  name:'Brown Sugar',      cat:'Dry',       unit:'g',   stock:4000, costPer:0.008, reorder:600,  supplier:'Local' },
  { id:9,  name:'Tapioca Pearls',   cat:'Dry',       unit:'g',   stock:2500, costPer:0.04,  reorder:500,  supplier:'QuickBubble' },
  { id:10, name:'Strawberry Syrup', cat:'Syrup',     unit:'ml',  stock:1200, costPer:0.22,  reorder:250,  supplier:'Monin' },
  { id:11, name:'Coconut Jelly',    cat:'Topping',   unit:'g',   stock:1500, costPer:0.06,  reorder:300,  supplier:'Local' },
  { id:12, name:'Caramel Syrup',    cat:'Syrup',     unit:'ml',  stock:1200, costPer:0.20,  reorder:250,  supplier:'Monin' },
  { id:13, name:'Cup 8oz',          cat:'Packaging', unit:'pcs', stock:400,  costPer:2.50,  reorder:100,  supplier:'PackSupply' },
  { id:14, name:'Cup 12oz',         cat:'Packaging', unit:'pcs', stock:400,  costPer:3.00,  reorder:100,  supplier:'PackSupply' },
  { id:15, name:'Cup 16oz',         cat:'Packaging', unit:'pcs', stock:250,  costPer:3.50,  reorder:80,   supplier:'PackSupply' },
  { id:16, name:'Cup 22oz',         cat:'Packaging', unit:'pcs', stock:150,  costPer:4.00,  reorder:50,   supplier:'PackSupply' },
  { id:17, name:'Straw',            cat:'Packaging', unit:'pcs', stock:1500, costPer:0.50,  reorder:400,  supplier:'PackSupply' },
  { id:18, name:'Lid',              cat:'Packaging', unit:'pcs', stock:800,  costPer:1.00,  reorder:200,  supplier:'PackSupply' },
  { id:19, name:'Paper Bag',        cat:'Packaging', unit:'pcs', stock:200,  costPer:3.50,  reorder:50,   supplier:'PackSupply' },
  { id:20, name:'Sealing Film',     cat:'Packaging', unit:'roll',stock:8,    costPer:25.00, reorder:2,    supplier:'PackSupply' },
];

window.DEFAULT_SETTINGS = {
  storeName: 'BrewPOS Café',
  storeAddress: 'Your Store Address',
  gcashNumber: '09XXXXXXXXX',
  gcashName: 'Store Owner',
  bankName: 'BDO',
  bankAccount: '0000-0000-0000',
  bankAccountName: 'Store Owner',
  taxRate: 0,
  loyaltyRate: 1,       // pts per peso
  loyaltyRedeem: 100,   // pts = ₱1
  currency: '₱',
  autoDeductStock: true,
  requireCashier: false,
  orderPrefix: 'ORD',
  adminPin: '',
  pinEnabled: false,
};

window.CATEGORIES = ['All','Milk Tea','Frappe','Coffee','Matcha','Smoothie','Add-ons'];
window.SIZES = ['S','M','L','XL'];
window.SIZE_LABELS = { S:'Small', M:'Medium', L:'Large', XL:'Extra Large' };
window.PAY_METHODS = [
  { id:'cash',    label:'Cash',         icon:'💵' },
  { id:'gcash',   label:'GCash',        icon:'📱' },
  { id:'maya',    label:'Maya',         icon:'💳' },
  { id:'bank',    label:'Bank',         icon:'🏧' },
  { id:'card',    label:'Card',         icon:'💰' },
];

window.AVATAR_COLORS = ['#e94560','#4ea8de','#27c96e','#f5a623','#a78bfa','#f472b6','#fb923c'];

function peso(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function nowTime() {
  return new Date().toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });
}
function dateLabel(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' });
}

window.peso = peso;
window.todayStr = todayStr;
window.nowTime = nowTime;
window.dateLabel = dateLabel;
