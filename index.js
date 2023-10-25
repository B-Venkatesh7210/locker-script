const {fetchPinkSaleTokens} = require('./controllers/fetchPinkSaleTokens');
const {fetchUnicryptTokens} = require('./controllers/fetchUnicryptTokens');
const {fetchTeamFinanceTokens} = require('./controllers/fetchTeamFinanceTokens');


(async () => {
  try {
    await fetchPinkSaleTokens();
    await fetchUnicryptTokens();
    await fetchTeamFinanceTokens();
  } catch (error) {
    console.error("An error occurred:", error);
  }
})();
