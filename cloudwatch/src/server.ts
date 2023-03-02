import { config } from "dotenv";

import app from "./app";
import { CONFIG } from "./constants/CONSTANTS.json";

config();

const PORT = process.env.PORT || CONFIG.DEFAULT.PORT;
const ENV = process.env.NODE_ENV || CONFIG.DEFAULT.DEVELOPMENT;

app.listen(PORT, () => {
  console.log(`Express ${ENV} server listening on port ${PORT}`);
});
