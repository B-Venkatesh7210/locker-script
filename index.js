const {fetchPinkSaleTokens} = require('./controllers/fetchPinkSaleTokens');
const {fetchUnicryptTokens} = require('./controllers/fetchUnicryptTokens');


(async () => {
  try {
    await fetchPinkSaleTokens();
    await fetchUnicryptTokens();
  } catch (error) {
    console.error("An error occurred:", error);
  }
})();
