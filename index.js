const axios = require("axios");
const async = require("async");
const ethers = require("ethers");
const { Alchemy, Network } = require("alchemy-sdk");
const Intl = require("intl");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const pinkSaleContractABI = require("./abi/pinkSaleContractABI");
const erc20ABI = require("./abi/erc20ABI");
const uniswapV2ABI = require("./abi/uniswapV2ABI");

const contractAddress = process.env.PINKSALE_CONTRACT_ADDRESS;
const etherscanApiKey = process.env.ETHERSCAN_API_KEY;

const apiUrl = "https://api.etherscan.io/api";
const maxRequestsPerSecond = 5;

const config = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
};
const alchemy = new Alchemy(config);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function fetchTransactionInputData(transactionHash) {
  const params = {
    module: "proxy",
    action: "eth_getTransactionByHash",
    txhash: transactionHash,
    apiKey: etherscanApiKey,
  };

  try {
    const response = await axios.get(apiUrl, { params });
    return response.data.result.input;
  } catch (error) {
    console.error("Error fetching input data for transaction:", error);
    throw error;
  }
}

async function processTransactions(contractAddress) {
  let page = 1;
  let transactions = [];
  let inputDatas = [];

  while (true) {
    const batch = [];

    for (let i = 0; i < maxRequestsPerSecond; i++) {
      batch.push(fetchTransactions(contractAddress, page++));
    }

    const results = await Promise.all(batch);

    if (results.length === 0) {
      break;
    }

    transactions = transactions.concat(...results);

    // Rate limit: Wait 1 second before making the next batch of requests
    await sleep(1000);
  }

  // Fetch input data for each transaction
  await async.eachLimit(
    transactions,
    maxRequestsPerSecond,
    async (transaction) => {
      const inputData = await fetchTransactionInputData(transaction.hash);
      inputDatas.push(inputData);
    }
  );

  return inputDatas;
}

function dateFormatting(time) {
  const unixTimestamp = time; // Replace with your Unix timestamp
  const date = new Date(unixTimestamp * 1000); // Convert Unix timestamp to milliseconds

  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };

  const formattedDate = new Intl.DateTimeFormat("en-US", options).format(date);
  return formattedDate;
}

(async () => {
  try {
    const provider = new ethers.providers.JsonRpcProvider(
      `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    );
    const contract = new ethers.Contract(
      contractAddress,
      pinkSaleContractABI,
      provider
    );
    console.log("Into fetch transactions");
    const inputDatas = await fetchTransactions(contractAddress);
    console.log("Input Data for Transactions:", inputDatas.length);
    console.log("Into filter transactions");

    const validTransactions = [];

    for (const transaction of inputDatas) {
      try {
        const decodedData = await contract.interface.parseTransaction({
          data: transaction.input,
        });

        if (
          decodedData.name === "lock" &&
          decodedData.args.unlockDate !== undefined &&
          typeof decodedData.args.token === "string"
        ) {
          validTransactions.push({
            unlockDate: Number(decodedData.args.unlockDate),
            tokenContractAddress: decodedData.args.token,
          });
        }
      } catch (error) {
        console.error("Error parsing transaction data:", error);
      }
    }

    console.log("Filtered Transactions:", validTransactions.length);

    const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
    const sevenDaysInSeconds = 7 * 24 * 60 * 60;

    for (const transaction of validTransactions) {
      const { unlockDate, tokenContractAddress } = transaction;

      if (unlockDate >= now && unlockDate <= now + sevenDaysInSeconds) {
        const tokenContract = new ethers.Contract(
          tokenContractAddress,
          uniswapV2ABI,
          provider
        );
        const name = await tokenContract.name();
        let tokenDetails = {
          lpAddress: "",
          address: "",
          name: "",
          unlockDate: "",
          lockedAt: "PinkSale",
        };
        if (name === "Uniswap V2") {
          const token0 = await tokenContract.token0();
          const token1 = await tokenContract.token1();
          if (
            token0.toLowerCase() ==
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2".toLowerCase() ||
            token0.toLowerCase() ==
              "0xdAC17F958D2ee523a2206206994597C13D831ec7".toLowerCase() ||
            token0.toLowerCase() == "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".toLowerCase()
          ) {
            const newTokenContract = new ethers.Contract(
              token1,
              erc20ABI,
              provider
            );
            const newTokenName = await newTokenContract.name();
            const date = dateFormatting(unlockDate);
            tokenDetails = {
              lpAddress: tokenContractAddress,
              address: token1,
              name: newTokenName,
              unlockDate: date,
              lockedAt: "PinkSale",
            };
            console.log("Token Details:", tokenDetails);
          } else {
            const newTokenContract = new ethers.Contract(
              token0,
              erc20ABI,
              provider
            );
            const newTokenName = await newTokenContract.name();
            const date = dateFormatting(unlockDate);
            tokenDetails = {
              lpAddress: tokenContractAddress,
              address: token0,
              name: newTokenName,
              unlockDate: date,
              lockedAt: "PinkSale",
            };
            console.log("Token Details:", tokenDetails);
          }

          // Append the new tokenDetails to the existing data
          let existingData = [];
          const jsonFilePath = path.join(__dirname, "tokenDetails.json");
          if (fs.existsSync(jsonFilePath)) {
            const fileContent = fs.readFileSync(jsonFilePath, "utf-8");
            // existingData = JSON.parse(fileContent);
            try {
              // Attempt to parse the JSON data from the file
              existingData = JSON.parse(fileContent);
              if (!Array.isArray(existingData)) {
                throw new Error("Existing data is not an array.");
              }
            } catch (error) {
              console.error("Error parsing existing data:", error);
            }
          }
          // Append the new tokenDetails to the existing data
          existingData.push(tokenDetails);
          // Write the updated data back to the JSON file
          fs.writeFileSync(jsonFilePath, JSON.stringify(existingData, null, 2));
          console.log(`Token details appended and saved to ${jsonFilePath}`);
        }
      }
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
})();
