// frontend/src/utils/smartSearch.js
// Ultra-fast smart search for products

/**
 * Smart search that matches:
 * 1. Initial letters of words: "TD" matches "Toor Dal"
 * 2. Start of any word: "Dal" matches "Toor Dal"
 * 3. Anywhere in name: "oor" matches "Toor Dal"
 * 4. Tamil names too
 */
export function smartSearch(products, searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      return products;
    }
  
    const search = searchTerm.toLowerCase().trim();
    const searchLen = search.length;
  
    return products
      .map((product) => {
        const name = product.name.toLowerCase();
        const tamilName = (product.tamil_name || '').toLowerCase();
        const words = name.split(/[\s\-_()]+/).filter(Boolean); // Split by space, dash, underscore, parentheses
        
        let score = 0;
        let matchType = null;
  
        // Match Type 1: Exact match (highest priority)
        if (name === search || tamilName === search) {
          score = 1000;
          matchType = 'exact';
        }
        
        // Match Type 2: Starts with search term
        else if (name.startsWith(search) || tamilName.startsWith(search)) {
          score = 900;
          matchType = 'starts-with';
        }
        
        // Match Type 3: Initial letters match (e.g., "td" matches "Toor Dal")
        else if (searchLen >= 2) {
          const initials = words.map(w => w[0]).join('');
          if (initials.startsWith(search)) {
            score = 800;
            matchType = 'initials';
          }
        }
        
        // Match Type 4: Any word starts with search term (e.g., "dal" matches "Toor Dal")
        else {
          const wordMatch = words.some(word => word.startsWith(search));
          if (wordMatch) {
            score = 700;
            matchType = 'word-start';
          }
        }
        
        // Match Type 5: Contains search term anywhere
        if (!matchType && (name.includes(search) || tamilName.includes(search))) {
          score = 500;
          matchType = 'contains';
        }
  
        // Match Type 6: Fuzzy match (allow 1 character difference for typos)
        if (!matchType && searchLen >= 3) {
          if (isFuzzyMatch(name, search) || isFuzzyMatch(tamilName, search)) {
            score = 300;
            matchType = 'fuzzy';
          }
        }
  
        // Boost score for recently used products
        if (matchType && product.last_used_at) {
          const hoursSinceUse = (new Date() - new Date(product.last_used_at)) / (1000 * 60 * 60);
          if (hoursSinceUse < 24) {
            score += 100; // Used today
          } else if (hoursSinceUse < 168) {
            score += 50; // Used this week
          }
        }
  
        return { product, score, matchType };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => {
        // Sort by score (highest first)
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // If same score, sort alphabetically
        return a.product.name.localeCompare(b.product.name);
      })
      .map(result => result.product);
  }
  
  /**
   * Fuzzy match - allows 1 character difference
   */
  function isFuzzyMatch(text, search) {
    if (!text || !search) return false;
    
    let differences = 0;
    let textIndex = 0;
    
    for (let i = 0; i < search.length; i++) {
      const found = text.indexOf(search[i], textIndex);
      if (found === -1) {
        differences++;
        if (differences > 1) return false;
      } else {
        textIndex = found + 1;
      }
    }
    
    return true;
  }
  
  /**
   * Get search suggestions based on partial input
   */
  export function getSearchSuggestions(products, searchTerm) {
    if (!searchTerm || searchTerm.length < 1) {
      return [];
    }
  
    const results = smartSearch(products, searchTerm);
    return results.slice(0, 20); // Return top 20 results
  }
  
  /**
   * Highlight matching parts of text
   */
  export function highlightMatch(text, searchTerm) {
    if (!searchTerm || !text) return text;
    
    const search = searchTerm.toLowerCase();
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(search);
    
    if (index === -1) return text;
    
    const before = text.slice(0, index);
    const match = text.slice(index, index + search.length);
    const after = text.slice(index + search.length);
    
    return { before, match, after };
  }