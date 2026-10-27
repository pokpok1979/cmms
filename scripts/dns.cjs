const dns = require("node:dns");
const dnsPromises = require("node:dns/promises");

const servers = ["8.8.8.8", "8.8.4.4"];

dns.setServers(servers);
dnsPromises.setServers(servers);
