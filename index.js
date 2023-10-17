const {fetchPinkSaleTokens} = require('./controllers/fetchPinkSaleTokens');

(async () => {
  try {
    await fetchPinkSaleTokens();
  } catch (error) {
    console.error("An error occurred:", error);
  }
})();
