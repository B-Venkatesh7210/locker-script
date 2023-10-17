const Intl = require("intl");

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

module.exports = { dateFormatting };
