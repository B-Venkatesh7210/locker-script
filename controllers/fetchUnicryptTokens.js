const ethers = require("ethers");
const unicryptContractABI = require("../abi/unicryptContractABI");
const { fetchTransactions } = require("../utils/fetchTransactions");
const uniswapV2ABI = require("../abi/uniswapV2ABI");
const erc20ABI = require("../abi/erc20ABI");
const { dateFormatting } = require("../utils/dateFormatting");
const fs = require("fs");
const path = require("path");

const contractAddress = process.env.UNICRYPT_CONTRACT_ADDRESS;

async function fetchUnicryptTokens() {
  try {
    const provider = new ethers.providers.JsonRpcProvider(
      `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    );
    const contract = new ethers.Contract(
      contractAddress,
      unicryptContractABI,
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
          decodedData.name === "lockLPToken" &&
          decodedData.args._unlock_date !== undefined &&
          typeof decodedData.args._lpToken === "string"
        ) {
          validTransactions.push({
            unlockDate: Number(decodedData.args._unlock_date),
            tokenContractAddress: decodedData.args._lpToken,
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
          lockedAt: "Unicrypt",
        };
        if (name === "Uniswap V2") {
          const token0 = await tokenContract.token0();
          const token1 = await tokenContract.token1();
          if (
            token0.toLowerCase() ==
              "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2".toLowerCase() ||
            token0.toLowerCase() ==
              "0xdAC17F958D2ee523a2206206994597C13D831ec7".toLowerCase() ||
            token0.toLowerCase() ==
              "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".toLowerCase()
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
              lockedAt: "Unicrypt",
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
              lockedAt: "Unicrypt",
            };
            console.log("Token Details:", tokenDetails);
          }

          let existingData = [];
          const jsonFilePath = path.join(
            __dirname,
            "../tokenDetails/unicryptTokenDetails.json"
          );
          if (fs.existsSync(jsonFilePath)) {
            const fileContent = fs.readFileSync(jsonFilePath, "utf-8");
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

          existingData.push(tokenDetails);
          fs.writeFileSync(jsonFilePath, JSON.stringify(existingData, null, 2));
          console.log(`Token details appended and saved to ${jsonFilePath}`);
        }
        // console.log("Under 7 days", name, tokenContractAddress, unlockDate);
      }
    }
  } catch (error) {
    console.error("Error fetching transactions:", error);
    throw error;
  }
}

module.exports = { fetchUnicryptTokens };
