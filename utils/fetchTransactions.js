const axios = require("axios");

const apiUrl = "https://api.etherscan.io/api";
const etherscanApiKey = process.env.ETHERSCAN_API_KEY;

async function fetchTransactions(contractAddress) {
    let page = 1;
    let transactions = [];
    let blockNumber = 0; //TODO: Add block number of contract deployment
    while (true) {
      const params = {
        module: "account",
        action: "txlist",
        address: contractAddress,
        offset: 10000,
        //   page: page, // Increase the number of transactions per page
        startblock: blockNumber,
        apiKey: etherscanApiKey,
        sort: "asc",
      };
      try {
        const response = await axios.get(apiUrl, { params });
        // console.log(apiUrl, params);
        // console.log("Response", response.data);
        if (response.data.status === "1") {
          // console.log("Txn List", response.data);
          transactions = transactions.concat(response.data.result);
          blockNumber =
            response.data.result[response.data.result.length - 1].blockNumber;
          if (response.data.result.length < 10000) {
            break;
          }
        } else {
          console.error(
            "Etherscan API returned an error:",
            response.data.message
          );
          return [];
        }
      } catch (error) {
        console.error("Error fetching transactions:", error);
        throw error;
      }
      // console.log(page)
      page = page + 1;
    }
    return transactions;
  }

  module.exports = { fetchTransactions };