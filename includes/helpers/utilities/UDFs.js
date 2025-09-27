function combineNonNullStrings(strings, link = " and ") { // Combine multiple strings, ignore nulls, return "" if all are null
  const nonNullStrings = strings.filter(s => s != null);
  if (nonNullStrings.length === 0) { // If all are null, return empty string
    return "";
  }
  return nonNullStrings.join(link); // Join remaining strings with " and "
}

// Export the function for use in models
module.exports = { 
    combineNonNullStrings 
};