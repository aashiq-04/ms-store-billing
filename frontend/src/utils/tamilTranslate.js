// frontend/src/utils/tamilTranslate.js
// Simple Tamil translation dictionary for common grocery items

const tamilDictionary = {
    // Nuts & Dry Fruits
    'badam': 'பாதாம்',
    'almond': 'பாதாம்',
    'cashew': 'முந்திரி',
    'raisin': 'உலர் திராட்சை',
    'peanut': 'கடலை',
    'walnut': 'அக்ரூட்',
    
    // Grains
    'rice': 'அரிசி',
    'wheat': 'கோதுமை',
    'flour': 'மாவு',
    'atta': 'கோதுமை மாவு',
    'black channa': 'கருப்பு கடலை',
    'white channa': 'வெள்ளை கடலை',
    'rajma': 'ரஜ்மா',
    
    
    // Pulses/Dals
    'toor dal': 'துவரம் பருப்பு',
    'moong dal': 'பாசிப்பருப்பு',
    'channa dal': 'கடலைப் பருப்பு',
    'urad dal': 'உளுந்து',
    'masoor dal': 'மசூர் பருப்பு',
    
    // Spices
    'Red chili': 'மிளகாய்',
    'Round chilli': 'குண்டூ மிளகாய்',
    'turmeric': 'மஞ்சள்',
    'coriander': 'மல்லி',
    'cumin': 'சீரகம்',
    'mustard': 'கடுகு',
    'pepper': 'மிளகு',
    'cardamom': 'ஏலக்காய்',
    'cinnamon': 'பட்டை',
    'clove': 'கிராம்பு',
    'Sombu': 'சோம்பு',
    'sesame': 'எள்ளு',

    // Oils & Fats
    'oil': 'எண்ணெய்',
    'ghee': 'நெய்',
    'butter': 'வெண்ணெய்',
    
    // Basics
    'salt': 'உப்பு',
    'sugar': 'சர்க்கரை',
    'jaggery': 'வெல்லம்',
    'rock':'கல்',
    'powder':'பொடி',
    
    
    // Dairy
    'milk': 'பால்',
    'curd': 'தயிர்',
    'paneer': 'பன்னீர்',
    
    // Fresh
    'egg': 'முட்டை',
    'biscuit': 'பிஸ்கட்',
    
    // Beverages
    'coffee': 'காபி',
    
    // Brands (keep as-is but add Tamil script)
    'tata': 'டாடா',
    'aashirvaad': 'ஆஷீர்வாத்',
    'fortune': 'பார்ச்சூன்',
    'britannia': 'பிரிட்டானியா',
    'amul': 'அமுல்',
    'bru': 'ப்ரூ',
    
    // Units
    'kg': 'கி.கி',
    'gram': 'கிராம்',
    'liter': 'லிட்டர்',
    'packet': 'பாக்கெட்',
    'dozen': 'டஜன்',
    
    // Descriptors
    'loose': 'தளர்வு',
    'country': 'நாட்டு',
    'farm': 'பண்ணை',
  };
  
  // Auto-translate product name to Tamil
  export function autoTranslate(englishName) {
    if (!englishName) return '';
    
    const lowerName = englishName.toLowerCase();
    let tamilName = '';
    
    // Try to find matching words in dictionary
    for (const [eng, tamil] of Object.entries(tamilDictionary)) {
      if (lowerName.includes(eng)) {
        tamilName += tamil + ' ';
      }
    }
    
    // If no translation found, return empty (user can add manually)
    return tamilName.trim();
  }
  
  // Get Tamil translation for a specific word
  export function translateWord(word) {
    if (!word) return '';
    return tamilDictionary[word.toLowerCase()] || '';
  }
  
  // Check if product already has Tamil name
  export function hasTamilName(product) {
    return product.tamil_name && product.tamil_name.trim() !== '';
  }
  
  // Format display name (English + Tamil)
  export function formatBilingualName(product) {
    if (!product) return '';
    
    if (product.tamil_name && product.tamil_name.trim()) {
      return `${product.name} (${product.tamil_name})`;
    }
    
    return product.name;
  }