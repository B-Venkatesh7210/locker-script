const ethers = require("ethers");
const teamFinanceContractABI = require("../abi/teamFinanceContractABI");
const { fetchTransactions } = require("../utils/fetchTransactions");
const uniswapV2ABI = require("../abi/uniswapV2ABI");
const erc20ABI = require("../abi/erc20ABI");
const { dateFormatting } = require("../utils/dateFormatting");
const fs = require("fs");
const path = require("path");

const contractAddress = process.env.TEAMFINANCE_CONTRACT_ADDRESS;
const startingBlockNumber = 12914481;

async function fetchTeamFinanceTokens() {
  try {
    const provider = new ethers.providers.JsonRpcProvider(
      `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    );
    const contract = new ethers.Contract(
      contractAddress,
      teamFinanceContractABI,
      provider
    );
    console.log("Into fetch transactions");
    const inputDatas = await fetchTransactions(
      contractAddress,
      startingBlockNumber
    );
    console.log("Input Data for Transactions:", inputDatas.length);
    console.log("Into filter transactions");

    const validTransactions = [];

    for (const transaction of inputDatas) {
      try {
        // console.log(transaction.input)
        if (transaction.input) {
          const decodedData = await contract.interface.parseTransaction({
            data: transaction.input,
          });
          console.log(decodedData)
          
          // if (
          //   decodedData.name === "lockLPToken" &&
          //   decodedData.args._unlock_date !== undefined &&
          //   typeof decodedData.args._lpToken === "string"
          // ) {
          //   console.log(
          //     Number(decodedData.args._unlock_date),
          //     decodedData.args._lpToken
          //   );
          //   validTransactions.push({
          //     unlockDate: Number(decodedData.args._unlock_date),
          //     tokenContractAddress: decodedData.args._lpToken,
          //   });
          // }
        }
        break;
      } catch (error) {
        console.error("Transaction Input", transaction);
      }
    }
  } catch (error) {
    console.error("Error fetching transactions:", error);
    throw error;
  }
}

module.exports = { fetchTeamFinanceTokens };
