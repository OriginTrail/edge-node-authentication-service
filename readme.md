# Setup

1. create database **'edge-node-auth-service'**
      ``` SQL
      CREATE DATABASE `edge-node-auth-service`;
      ```

2. Create a .env file
   ``` bash
   cp .env.example .env
   ```

3. If your MySQL is password-protected, add your MySQL password to **DB_PASSWORD** variable in .env file

4. generate random strings for following .env variables: **JWT_SECRET** and **SECRET** (you can use openssl rand -hex 64 for example)

5. Install dependencies
   ``` bash
   npm install
   ```
6. Migrate the DB
   ``` bash
   npx sequelize-cli db:migrate
   ```

7. Generate a demo user
   ``` bash
   npx sequelize-cli db:seed:all
   ```

8. Update **this MySQL query ([UserConfig.sql](UserConfig.sql))** with real values of:
   1. your **v8 DKG Core node endpoint (run_time_node_endpoint) and port (run_time_node_port)**
   2. your **Paranet UAL (edge_node_paranet_ual)** (you can do it later, but the Edge node will not work without it. Paranet should be created before, in Preparation steps)

9. Execute your **MySQL query from the previous step** to define Edge node config parameters

10. Add your wallet to the "user_wallets" table by executing this query (example blockchain id - base:84532):
      ``` SQL
      UPDATE user_wallets
      SET wallet = 'YOUR_WALLET', private_key = 'WALLET_PRIVATE_KEY', blockchain = 'BLOCKCHAIN_ID'
      WHERE id = 1;
      ```
11. Start the auth service
      ``` bash
      npm run start
      ```

Seeder will create example user with following credentials:
- username: my_edge_node
- password: edge_node_pass

Authentication flow explained **(Edge node interface already have this integrated, no need for further steps)**:
1. POST /login - provide username and password [x-www-form], this will embed cookie in next requests
2. GET /auth/check - this route will return user and his config if the cookie from previous request is correct

Test can be done in Postman, no need to manually include cookie in next requests, it will be automatically applied.

## OpenTelemetry

This service comes with OpenTelemetry support pre-installed. To enable it, set `OTEL_ENABLED=true` in .env variables.

OpenTelemetry is implemented using [@opentelemetry/auto-instrumentations-node](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node) package, and can be further configured using env variables.
- Configuration: https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/
- Set up exporters: https://opentelemetry.io/docs/specs/otel/protocol/exporter/
- Exporters + dashboard docker setup: https://hub.docker.com/r/grafana/otel-lgtm 
